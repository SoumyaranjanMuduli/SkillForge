# Runner Sandbox Hardening

## Issue
`runner/server.py` blocked dangerous Python modules (`os`, `subprocess`, etc.) only by
inspecting `ast.Import` / `ast.ImportFrom` nodes. This missed dynamic-import and
reflection-based bypasses, e.g.:

- `__import__('os').system('ls')`
- `().__class__.__bases__[0].__subclasses__()` (classic sandbox-escape via base classes)
- `open('/etc/passwd').read()` (raw filesystem access — never blocked at all)

A learner's submitted code could use these to reach the filesystem or shell inside the
runner container.

## Fix
`validate_python()` now also walks the AST for `Name` and `Attribute` nodes matching a
blocklist of dangerous identifiers (`__import__`, `eval`, `exec`, `compile`, `globals`,
`getattr`/`setattr`, `__subclasses__`, `__bases__`, `__globals__`, `open`, etc.) in
addition to the existing import-statement check. Verified against the bypasses above
plus normal user-defined functions (which still pass).

## Important note
This is defense-in-depth on top of the existing resource limits (CPU/memory/process/file
size) and the isolated subprocess — it is a blocklist, not a sandbox, and blocklists can
in principle be extended around. For a public-facing code-execution feature, run this
service inside real process/VM-level isolation (gVisor, Firecracker, nsjail, or an
ephemeral locked-down container per execution) as the actual security boundary, and treat
this check as a second layer, not the only one.
