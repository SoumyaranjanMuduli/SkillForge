import ast
import json
import hmac
import os
import resource
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

MAX_BODY = 2_000_000
MAX_CODE = 500_000
MAX_TESTS = 500
MAX_DATASET_BYTES = 1_000_000
MAX_OUTPUT = 100_000
MAX_RESULT_ROWS = 5_000
MAX_RESULT_BYTES = 120_000
DEFAULT_TIMEOUT_MS = 5_000
MAX_TIMEOUT_MS = 30_000
MAX_CONCURRENT_EXECUTIONS = 4
EXECUTION_SLOTS = threading.BoundedSemaphore(MAX_CONCURRENT_EXECUTIONS)
API_KEY = os.environ.get('EXECUTION_API_KEY')

if not API_KEY:
    raise SystemExit('EXECUTION_API_KEY is required; refusing to start insecure runner.')

# AST validation is defense-in-depth only. The production runner MUST remain inside the
# hardened container defined by run-production.sh, with no network and no Linux capabilities.
BLOCKED_IMPORTS = {
    'os', 'socket', 'subprocess', 'ctypes', 'multiprocessing', 'signal', 'resource', 'shutil',
    'pathlib', 'importlib', 'sysconfig', 'sys', 'pty', 'fcntl', 'builtins', 'runpy', 'code',
    'codeop', 'pkgutil', 'inspect', 'marshal', 'pickle', 'tempfile', 'glob', 'fnmatch',
}

BLOCKED_NAMES = {
    '__import__', 'eval', 'exec', 'compile', 'globals', 'locals', 'vars', 'getattr', 'setattr',
    'delattr', 'dir', 'help', 'open', 'input', 'breakpoint', 'memoryview', 'next', 'iter',
    'super', '__builtins__', '__builtin__', '__loader__', '__spec__', '__package__', '__file__',
}

MAX_AST_NODES = 20_000


def validate_python(code: str) -> str | None:
    try:
        tree = ast.parse(code, mode='exec')
    except SyntaxError as exc:
        return f'Syntax error: {exc}'

    nodes = list(ast.walk(tree))
    if len(nodes) > MAX_AST_NODES:
        return 'Python program is too complex.'

    for node in nodes:
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split('.', 1)[0]
                if root in BLOCKED_IMPORTS:
                    return 'Restricted module import.'
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or '').split('.', 1)[0]
            if node.level > 0 or root in BLOCKED_IMPORTS:
                return 'Restricted module import.'
        elif isinstance(node, ast.Name):
            if node.id in BLOCKED_NAMES or node.id.startswith('__'):
                return 'Restricted name.'
        elif isinstance(node, ast.Attribute):
            if node.attr.startswith('__') or node.attr in BLOCKED_NAMES:
                return 'Restricted attribute access.'
        elif isinstance(node, (ast.Lambda, ast.FunctionDef, ast.AsyncFunctionDef)):
            # User-defined functions are required for grading. Their bodies are still checked
            # recursively by the AST walk above.
            continue
    return None


def _json_size(value: Any) -> int:
    try:
        return len(json.dumps(value, separators=(',', ':'), default=str).encode('utf-8'))
    except (TypeError, ValueError, OverflowError):
        return MAX_DATASET_BYTES + 1


def _validate_tests(tests: Any) -> list[dict[str, Any]]:
    if tests is None:
        return []
    if not isinstance(tests, list) or len(tests) > MAX_TESTS:
        raise ValueError('Invalid tests payload.')
    out: list[dict[str, Any]] = []
    for raw in tests:
        if not isinstance(raw, dict):
            raise ValueError('Invalid test case.')
        out.append(raw)
    return out


def _resource_limits(timeout_ms: int) -> None:
    cpu = max(1, min(30, timeout_ms // 1000 + 1))
    resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NPROC, (16, 16))
    resource.setrlimit(resource.RLIMIT_FSIZE, (2 * 1024 * 1024, 2 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))


def _bounded(text: str, limit: int) -> str:
    return text[-limit:] if len(text) > limit else text


def run_python(code: str, tests: Any, timeout_ms: int) -> dict[str, Any]:
    err = validate_python(code)
    if err:
        return {'ok': False, 'stderr': err}

    try:
        test_cases = _validate_tests(tests)
    except ValueError as exc:
        return {'ok': False, 'stderr': str(exc)}

    tests_literal = repr(json.dumps(test_cases, separators=(',', ':'), default=str))
    harness = f'''{code}\n\nimport json\n\ndef __sf_run():\n    tests = json.loads({tests_literal})\n    out = []\n    for t in tests:\n        try:\n            fn = globals()[t['function']]\n            got = fn(*t.get('args', []), **t.get('kwargs', {{}}))\n            out.append({{'name': t.get('name', 'test'), 'ok': got == t.get('expected'), 'got': got}})\n        except Exception as exc:\n            out.append({{'name': t.get('name', 'test'), 'ok': False, 'error': str(exc)}})\n    print('SF_RESULT:' + json.dumps({{'passed': sum(1 for x in out if x['ok']), 'total': len(out), 'tests': out}}, default=str))\n\n__sf_run()\n'''

    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'PYTHONPATH': '', 'PYTHONNOUSERSITE': '1'}
    with tempfile.TemporaryDirectory(prefix='skillforge-') as td:
        path = os.path.join(td, 'main.py')
        with open(path, 'x', encoding='utf-8') as fh:
            fh.write(harness)

        try:
            proc = subprocess.run(
                ['python', '-I', path],
                capture_output=True,
                text=True,
                timeout=timeout_ms / 1000,
                env=env,
                cwd=td,
                preexec_fn=lambda: _resource_limits(timeout_ms),
            )
        except subprocess.TimeoutExpired:
            return {'ok': False, 'stderr': 'Execution timed out.'}
        except OSError:
            return {'ok': False, 'stderr': 'Execution service failed to start the sandbox.'}

    result = None
    for line in proc.stdout.splitlines():
        if line.startswith('SF_RESULT:'):
            try:
                result = json.loads(line[len('SF_RESULT:'):])
            except json.JSONDecodeError:
                result = None

    return {
        'ok': proc.returncode == 0 and result is not None,
        'stdout': _bounded(proc.stdout, MAX_OUTPUT),
        'stderr': _bounded(proc.stderr, 20_000),
        'result': result,
    }


def normalize_rows(rows: Any) -> list[Any]:
    return [list(row) if isinstance(row, (list, tuple)) else row for row in rows]


def run_sql(code: str, dataset: Any, tests: Any, timeout_ms: int = DEFAULT_TIMEOUT_MS) -> dict[str, Any]:
    try:
        import duckdb
    except Exception:
        return {'ok': False, 'stderr': 'DuckDB is not installed in runner image.'}

    if _json_size(dataset) > MAX_DATASET_BYTES:
        return {'ok': False, 'stderr': 'Dataset is too large.'}

    try:
        test_cases = _validate_tests(tests)
    except ValueError as exc:
        return {'ok': False, 'stderr': str(exc)}

    con = duckdb.connect(':memory:')
    try:
        con.execute('SET enable_external_access=false')
        con.execute('SET preserve_insertion_order=false')
        con.execute("SET memory_limit='384MB'")
        con.execute('SET threads=1')

        if isinstance(dataset, dict):
            for name, rows in dataset.items():
                if not isinstance(rows, list) or not rows:
                    continue
                safe = ''.join(ch for ch in str(name) if ch.isalnum() or ch == '_') or 'table1'
                fd, path = tempfile.mkstemp(prefix='skillforge-', suffix='.json')
                os.close(fd)
                try:
                    with open(path, 'w', encoding='utf-8') as fh:
                        json.dump(rows, fh, separators=(',', ':'), default=str)
                    con.execute(f'CREATE TABLE "{safe}" AS SELECT * FROM read_json_auto(?)', [path])
                finally:
                    try:
                        os.unlink(path)
                    except OSError:
                        pass

        def execute_candidate() -> dict[str, Any]:
            cur = con.execute(code)
            cols = [d[0] for d in cur.description] if cur.description else []
            rows: list[Any] = []
            encoded_size = len(json.dumps({'columns': cols, 'rows': []}, separators=(',', ':'), default=str).encode('utf-8'))
            while True:
                batch = cur.fetchmany(100)
                if not batch:
                    break
                for row in batch:
                    normalized = list(row) if isinstance(row, (list, tuple)) else row
                    rows.append(normalized)
                    if len(rows) > MAX_RESULT_ROWS:
                        raise ValueError(f'Result set exceeds {MAX_RESULT_ROWS} rows.')
                    encoded_size += len(json.dumps(normalized, separators=(',', ':'), default=str).encode('utf-8'))
                    if encoded_size > MAX_RESULT_BYTES:
                        raise ValueError('Result set is too large.')
            return {'rows': rows, 'columns': cols}

        if not test_cases:
            timer = threading.Timer(timeout_ms / 1000, con.interrupt)
            timer.start()
            try:
                result = execute_candidate()
            except duckdb.InterruptException:
                return {'ok': False, 'stderr': 'Query timed out.'}
            except Exception as exc:
                return {'ok': False, 'stderr': str(exc)}
            finally:
                timer.cancel()
            return {'ok': True, 'result': result}

        out = []
        for test in test_cases:
            expected = test.get('expected')
            timer = threading.Timer(timeout_ms / 1000, con.interrupt)
            timer.start()
            try:
                got = execute_candidate()
                if isinstance(expected, dict):
                    exp_rows = normalize_rows(expected.get('rows', []))
                    exp_cols = expected.get('columns')
                    cols_ok = exp_cols is None or got['columns'] == exp_cols
                    rows_ok = (
                        got['rows'] == exp_rows
                        if test.get('ordered', False)
                        else sorted(map(str, got['rows'])) == sorted(map(str, exp_rows))
                    )
                    ok = cols_ok and rows_ok
                else:
                    exp_rows = normalize_rows(expected or [])
                    ok = (
                        got['rows'] == exp_rows
                        if test.get('ordered', False)
                        else sorted(map(str, got['rows'])) == sorted(map(str, exp_rows))
                    )
                out.append({'name': test.get('name', 'test'), 'ok': ok, 'rows': got['rows'], 'columns': got['columns']})
            except duckdb.InterruptException:
                out.append({'name': test.get('name', 'test'), 'ok': False, 'error': 'Query timed out.'})
            except Exception as exc:
                out.append({'name': test.get('name', 'test'), 'ok': False, 'error': str(exc)})
            finally:
                timer.cancel()

        return {'ok': True, 'result': {'passed': sum(x['ok'] for x in out), 'total': len(out), 'tests': out}}
    finally:
        con.close()


class Handler(BaseHTTPRequestHandler):
    server_version = 'SkillForgeRunner/2.1'

    def do_POST(self) -> None:
        if self.path != '/v1/execute':
            self.send_json(404, {'ok': False, 'stderr': 'Not found.'})
            return

        if not hmac.compare_digest(self.headers.get('authorization', ''), f'Bearer {API_KEY}'):
            self.send_json(401, {'ok': False, 'stderr': 'Unauthorized.'})
            return

        content_length = self.headers.get('content-length')
        try:
            body_len = int(content_length or '0')
        except ValueError:
            self.send_json(400, {'ok': False, 'stderr': 'Invalid content length.'})
            return
        if body_len <= 0 or body_len > MAX_BODY:
            self.send_json(413, {'ok': False, 'stderr': 'Request too large.'})
            return

        try:
            req = json.loads(self.rfile.read(body_len))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {'ok': False, 'stderr': 'Invalid JSON.'})
            return
        if not isinstance(req, dict):
            self.send_json(400, {'ok': False, 'stderr': 'Invalid request body.'})
            return

        language = req.get('language')
        if language not in ('python', 'sql'):
            self.send_json(400, {'ok': False, 'stderr': 'Unsupported language.'})
            return

        code = req.get('code')
        if not isinstance(code, str) or not code or len(code) > MAX_CODE:
            self.send_json(413, {'ok': False, 'stderr': 'Invalid code size.'})
            return

        try:
            timeout_ms = int(req.get('timeoutMs', DEFAULT_TIMEOUT_MS))
        except (TypeError, ValueError):
            timeout_ms = DEFAULT_TIMEOUT_MS
        timeout_ms = max(250, min(timeout_ms, MAX_TIMEOUT_MS))

        if not EXECUTION_SLOTS.acquire(blocking=False):
            self.send_json(429, {'ok': False, 'stderr': 'Execution capacity is temporarily full.'})
            return

        try:
            try:
                if language == 'python':
                    out = run_python(code, req.get('tests'), timeout_ms)
                else:
                    out = run_sql(code, req.get('dataset'), req.get('tests'), timeout_ms)
            except Exception:
                self.log_message('execution handler failed')
                out = {'ok': False, 'stderr': 'Internal execution error.'}
        finally:
            EXECUTION_SLOTS.release()

        self.send_json(200, out)

    def send_json(self, status: int, obj: dict[str, Any]) -> None:
        raw = json.dumps(obj, default=str, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.send_header('content-type', 'application/json; charset=utf-8')
        self.send_header('content-length', str(len(raw)))
        self.send_header('cache-control', 'no-store')
        self.send_header('x-content-type-options', 'nosniff')
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> None:
    port = int(os.environ.get('PORT', '8080'))
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    server.daemon_threads = True
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
