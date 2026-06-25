---
name: explain-ix
description: Produce a human-readable account map and effect summary for one instruction of an Anchor program.
---

# /explain-ix

`/explain-ix <program> <instruction>`

For the given program (program ID or known protocol name) and instruction name, output:

1. **Purpose** — one sentence, from the IDL `docs` or inferred.
2. **Accounts** — table with: name, role (signer / writable / read-only), classification (sysvar / program / PDA / ATA / user-supplied), and how it's resolved.
3. **Arguments** — typed list with valid ranges.
4. **Effects** — what on-chain state changes, derived from `#[account(mut)]` markings in the IDL.
5. **Common errors** — pulled from the IDL's `errors[]` that this instruction can raise.
6. **Composition hints** — instructions commonly chained before or after.

Use this for code-review-style understanding of an unfamiliar program before any send.
