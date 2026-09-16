# SkillForge isolated execution service

This service executes untrusted SQL/Python outside Vercel. It is a security boundary, not a general-purpose compute API.

## Required environment

`EXECUTION_API_KEY` is mandatory. The service refuses to start when it is missing.

## Build

```bash
docker build -t skillforge-runner:latest runner
```

## Production run

Use `runner/run-production.sh`. It applies the important container-level controls:

- `--network=none`
- read-only root filesystem
- small writable `/tmp`
- all Linux capabilities dropped
- `no-new-privileges`
- PID, CPU and memory limits
- loopback-only port binding

Run the runner on a dedicated host/container service. Do not expose it directly to the public internet if you can avoid it; place it behind a private network or trusted gateway.

The application sends `Authorization: Bearer $EXECUTION_API_KEY` on every request.

## SQL grading contract

Student SQL is always the query executed. Test entries contain expected results, not replacement queries:

```json
{
  "language": "sql",
  "code": "SELECT name FROM employees WHERE salary > 50000",
  "dataset": {"employees": [{"name":"A","salary":60000}]},
  "tests": [
    {"name":"hidden-1","expected":{"columns":["name"],"rows":[["A"]]},"ordered":true}
  ]
}
```

External file access is disabled inside DuckDB before student SQL is executed.

## Python grading contract

Tests call a function defined by the student's code. Hidden test data is embedded in the generated harness rather than passed through environment variables.

Container-level isolation remains mandatory. Python-level import restrictions are only defense-in-depth.
