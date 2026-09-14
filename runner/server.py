import ast, json, os, resource, subprocess, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY = 2_000_000
MAX_CODE = 500_000
API_KEY = os.environ.get('EXECUTION_API_KEY')
if not API_KEY:
    raise SystemExit('EXECUTION_API_KEY is required; refusing to start insecure runner.')

BLOCKED_IMPORTS = {'os','socket','subprocess','ctypes','multiprocessing','signal','resource','shutil','pathlib','importlib','sysconfig'}

# Names/attributes that provide a path around the import check above (dynamic import,
# code execution, or reflection-based sandbox escapes via base classes / closures).
# This is defense-in-depth on top of the resource limits and the isolated subprocess
# in run_python() below -- it is NOT a substitute for real process/VM-level isolation
# (gVisor, Firecracker, nsjail, a locked-down container, etc.). Treat the runner's own
# host/container as untrusted-code-facing infrastructure regardless of this check.
BLOCKED_NAMES = {
    '__import__', 'eval', 'exec', 'compile', 'globals', 'locals', 'vars',
    'getattr', 'setattr', 'delattr', '__subclasses__', '__bases__', '__base__',
    '__mro__', '__globals__', '__builtins__', '__builtin__', '__loader__',
    '__import_module__', 'breakpoint', 'input', 'memoryview', 'open',
}

def validate_python(code):
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return f'Syntax error: {e}'
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [a.name.split('.')[0] for a in node.names]
            if any(name in BLOCKED_IMPORTS for name in names):
                return 'Restricted module import.'
        elif isinstance(node, ast.Name) and node.id in BLOCKED_NAMES:
            return 'Restricted name.'
        elif isinstance(node, ast.Attribute) and node.attr in BLOCKED_NAMES:
            return 'Restricted attribute access.'
    return None

def run_python(code, tests, timeout):
    err = validate_python(code)
    if err:
        return {'ok':False,'stderr':err}
    tests = tests or []
    tests_literal = repr(json.dumps(tests))
    harness = code + "\n\n" + '''
import json

def __sf_run():
    tests=json.loads(__SF_TESTS_LITERAL__)
    out=[]
    for t in tests:
        try:
            fn=globals()[t['function']]
            got=fn(*t.get('args',[]),**t.get('kwargs',{}))
            out.append({'name':t.get('name','test'),'ok':got==t.get('expected'),'got':got})
        except Exception as e:
            out.append({'name':t.get('name','test'),'ok':False,'error':str(e)})
    print('SF_RESULT:'+json.dumps({'passed':sum(1 for x in out if x['ok']),'total':len(out),'tests':out},default=str))

__sf_run()
'''.replace('__SF_TESTS_LITERAL__', tests_literal)
    env={'PATH':os.environ.get('PATH',''),'PYTHONPATH':''}
    with tempfile.TemporaryDirectory() as td:
        path=os.path.join(td,'main.py')
        open(path,'w').write(harness)
        def limits():
            cpu=max(1, min(30, timeout//1000+1))
            resource.setrlimit(resource.RLIMIT_CPU,(cpu,cpu+1))
            resource.setrlimit(resource.RLIMIT_AS,(512*1024*1024,512*1024*1024))
            resource.setrlimit(resource.RLIMIT_NPROC,(16,16))
            resource.setrlimit(resource.RLIMIT_FSIZE,(2*1024*1024,2*1024*1024))
        try:
            r=subprocess.run(['python','-I',path],capture_output=True,text=True,timeout=timeout/1000,env=env,cwd=td,preexec_fn=limits)
        except subprocess.TimeoutExpired:
            return {'ok':False,'stderr':'Execution timed out.'}
    result=None
    for line in r.stdout.splitlines():
        if line.startswith('SF_RESULT:'):
            try:
                result=json.loads(line[10:])
            except Exception:
                pass
    return {'ok':r.returncode==0 and result is not None,'stdout':r.stdout[-100_000:],'stderr':r.stderr[-20_000:],'result':result}

def normalize_rows(rows):
    return [list(row) if isinstance(row,(list,tuple)) else row for row in rows]

def run_sql(code,dataset,tests,timeout=10000):
    try:
        import duckdb
    except Exception:
        return {'ok':False,'stderr':'DuckDB is not installed in runner image.'}
    con=duckdb.connect(':memory:')
    try:
        for name,rows in (dataset or {}).items():
            if not isinstance(rows,list) or not rows:
                continue
            safe=''.join(ch for ch in str(name) if ch.isalnum() or ch=='_') or 'table1'
            fd,path=tempfile.mkstemp(suffix='.json'); os.close(fd)
            try:
                with open(path,'w') as f: json.dump(rows,f)
                con.execute(f'CREATE TABLE "{safe}" AS SELECT * FROM read_json_auto(?)',[path])
            finally:
                try: os.unlink(path)
                except OSError: pass
        con.execute("SET enable_external_access=false")
        def execute_candidate():
            cur=con.execute(code)
            rows=cur.fetchall()
            cols=[d[0] for d in cur.description] if cur.description else []
            return {'rows':normalize_rows(rows),'columns':cols}
        if not tests:
            timer=threading.Timer(timeout/1000,con.interrupt); timer.start()
            try:
                result=execute_candidate()
            except duckdb.InterruptException:
                return {'ok':False,'stderr':'Query timed out.'}
            except Exception as e:
                return {'ok':False,'stderr':str(e)}
            finally:
                timer.cancel()
            return {'ok':True,'result':result}
        out=[]
        for t in tests:
            expected=t.get('expected')
            timer=threading.Timer(timeout/1000,con.interrupt); timer.start()
            try:
                got=execute_candidate()
                if isinstance(expected,dict):
                    exp_rows=normalize_rows(expected.get('rows',[])); exp_cols=expected.get('columns')
                    cols_ok=exp_cols is None or got['columns']==exp_cols
                    rows_ok=got['rows']==exp_rows if t.get('ordered',False) else sorted(map(str,got['rows']))==sorted(map(str,exp_rows))
                    ok=cols_ok and rows_ok
                else:
                    exp_rows=normalize_rows(expected or [])
                    ok=got['rows']==exp_rows if t.get('ordered',False) else sorted(map(str,got['rows']))==sorted(map(str,exp_rows))
                out.append({'name':t.get('name','test'),'ok':ok,'rows':got['rows'],'columns':got['columns']})
            except duckdb.InterruptException:
                out.append({'name':t.get('name','test'),'ok':False,'error':'Query timed out.'})
            except Exception as e:
                out.append({'name':t.get('name','test'),'ok':False,'error':str(e)})
            finally:
                timer.cancel()
        return {'ok':True,'result':{'passed':sum(x['ok'] for x in out),'total':len(out),'tests':out}}
    finally:
        con.close()

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path!='/v1/execute': return self.send(404,{'ok':False,'stderr':'Not found'})
        if self.headers.get('authorization') != f'Bearer {API_KEY}': return self.send(401,{'ok':False,'stderr':'Unauthorized'})
        try: n=int(self.headers.get('content-length','0'))
        except ValueError: return self.send(400,{'ok':False,'stderr':'Invalid content length'})
        if n<=0 or n>MAX_BODY: return self.send(413,{'ok':False,'stderr':'Request too large'})
        try: req=json.loads(self.rfile.read(n))
        except Exception: return self.send(400,{'ok':False,'stderr':'Invalid JSON'})
        if req.get('language') not in ('python','sql'): return self.send(400,{'ok':False,'stderr':'Unsupported language'})
        code=str(req.get('code',''))
        if not code or len(code)>MAX_CODE: return self.send(413,{'ok':False,'stderr':'Invalid code size'})
        try: timeout=max(250,min(int(req.get('timeoutMs',5000)),30_000))
        except (TypeError,ValueError): timeout=5000
        try:
            out=run_python(code,req.get('tests'),timeout) if req['language']=='python' else run_sql(code,req.get('dataset'),req.get('tests'),timeout)
        except Exception:
            return self.send(500,{'ok':False,'stderr':'Internal execution error.'})
        return self.send(200,out)
    def send(self,status,obj):
        raw=json.dumps(obj,default=str).encode(); self.send_response(status); self.send_header('content-type','application/json'); self.send_header('content-length',str(len(raw))); self.send_header('cache-control','no-store'); self.end_headers(); self.wfile.write(raw)
    def log_message(self,*args): pass

if __name__=='__main__': ThreadingHTTPServer(('0.0.0.0',int(os.environ.get('PORT','8080'))),H).serve_forever()
