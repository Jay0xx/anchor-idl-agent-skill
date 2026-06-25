---
name: decode-error
description: Decode an Anchor error code or a failed transaction signature back to its IDL-defined name, source line, and likely cause.
---

# /decode-error

`/decode-error <txSig | 0xCODE>`

If given a transaction signature: fetch the failed tx logs, extract the program + error code, load the program's IDL, decode per `skill/error-decoding.md`.

If given a raw `0x…` code: ask which program, then decode against that program's IDL.

Output:

- Error name + custom code + IDL message
- Constraint-violation details if present (caused-by account, Left/Right values)
- Source file:line if available
- One-line likely-fix heuristic (e.g. "insufficient collateral → reduce amount or wait")
- Compute units consumed at failure
- Link to a gist with full logs (optional)
