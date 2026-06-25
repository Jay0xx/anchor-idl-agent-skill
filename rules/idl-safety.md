---
name: idl-safety
description: Hard rules that apply whenever the anchor-idl-agent skill is producing or sending a transaction.
globs: ["**/anchor-*.ts", "**/idl-*.ts", "**/tx-*.ts", "**/*.idl.json"]
---

# IDL Safety Rule

This rule applies to any code that builds, simulates, or sends Solana transactions derived from an Anchor IDL.

## Must

- Always call `simulateTransaction` before `sendTransaction`. If sim returns non-null `err`, decode it and stop. **No exceptions.**
- Always use the `resolveAccounts` helper for account resolution; never hand-derive PDAs in adapter code.
- Always verify the IDL's account discriminator matches an on-chain account of that type before trusting an off-chain IDL.
- Always include `ComputeBudgetProgram.setComputeUnitLimit` and `setComputeUnitPrice` sized from the simulation result.
- Always check the program ID against `ALLOWLIST` in `skill/safety-rails.md` and prompt for explicit confirmation if not present.

## Must not

- Do not call `sendTransaction` with `skipPreflight: true` unless a simulation has just succeeded in the same code path with the same blockhash.
- Do not retry failed sends automatically — surface the signature, decoded error, and let the user decide.
- Do not cache IDLs by program ID alone; always include the IDL sha256.
- Do not bypass the safety rails with `{ unsafe: ... }` without logging the override and the reason.
