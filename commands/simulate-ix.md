---
name: simulate-ix
description: Pre-flight simulate an instruction against mainnet (or a Surfpool fork). Decode result. Do not send.
---

# /simulate-ix

`/simulate-ix <program> <instruction> <args.json>`

Builds the instruction per `skill/account-resolution.md`, simulates per `skill/simulation-and-send.md`, and prints:

- `err` (decoded if present, per `skill/error-decoding.md`)
- `unitsConsumed`
- estimated total fee at current priority
- `returnData` (decoded against IDL return type)
- account writes diff (before/after for each writable)
- top 20 program log lines

This command **never sends**. It's the dry-run that always precedes any `send` call.

`args.json` example:
```json
{
  "args": { "amount": "100000000" },
  "accounts": { "user": "GjE7…", "destinationAta": "9pQW…" },
  "rpc": "mainnet"
}
```
