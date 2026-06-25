# Error Decoding

Solana surfaces Anchor errors as raw hex codes (`0x1771`) buried in transaction logs. Decoding them back to a human-readable error name + source location is critical — and easy if you have the IDL.

## The error code ranges

| Code range | Meaning | Source |
|---|---|---|
| `0` – `99` | Framework errors (`InstructionMissing`, `AccountNotEnoughKeys`, …) | Anchor itself |
| `100` – `299` | IDL-builtin (`ConstraintMut`, `ConstraintSigner`, …) | Anchor attribute violations |
| `6000`+ | Custom errors declared with `#[error_code]` | The program's `errors[]` in the IDL |

## Decoding algorithm

```ts
function decodeAnchorError(code: number, idl: Idl, logs: string[]): DecodedAnchorError {
  // 1. Custom error from IDL
  if (code >= 6000) {
    const err = idl.errors?.find(e => e.code === code)
    if (err) return { kind: 'custom', code, name: err.name, msg: err.msg, hint: '' }
  }

  // 2. Framework / built-in error from Anchor's static table
  const builtin = ANCHOR_BUILTIN_ERRORS[code]
  if (builtin) return { kind: 'anchor', code, name: builtin.name, msg: builtin.msg }

  // 3. Constraint violation — Anchor prefixes logs with "AnchorError caused by account: X. Error Code: Y."
  const constraintMatch = logs.find(l => l.startsWith('AnchorError'))
  if (constraintMatch) return parseConstraintLog(constraintMatch)

  return { kind: 'unknown', code }
}
```

## Mapping back to source

For Anchor programs that ship debug metadata (most do not on mainnet), the IDL `errors[i]` entry may include `code`, `name`, `msg`. That's enough. For programs that don't, the message printed in logs (`AnchorError thrown in programs/<name>/src/lib.rs:142`) gives the source line directly.

## Constraint errors are special

When an account violates a constraint (`#[account(mut, has_one = authority)]` etc.), Anchor prints structured logs:

```
Program log: AnchorError caused by account: vault. Error Code: ConstraintHasOne. Error Number: 2001. Error Message: A has_one constraint was violated.
Program log: Left:
Program log: 7xKX…
Program log: Right:
Program log: 9pQW…
```

Parse the four-line block: `caused by` (account), `Error Code` (name), `Left` (expected), `Right` (actual). Surface ALL FOUR to the user — without the addresses, the error is useless.

## User-facing output template

```
✗ Transaction failed

  Program:    Kamino Lend (KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYZgmJjVB)
  Instruction: deposit
  Error:      InsufficientCollateral (custom: 6011)
  Message:    "Deposit amount exceeds available collateral capacity"
  Source:     programs/klend/src/instructions/deposit.rs:218
  Likely fix: reduce amount, or wait for vault capacity to free up

  Compute units consumed: 87,432 / 200,000
  Full logs: <gist link>
```

## Built-in error table

Anchor's framework errors (codes 100–6000) are well known. Ship a static `ANCHOR_BUILTIN_ERRORS` map (see [`code/src/decode.ts`](../code/src/decode.ts) — derived from `@coral-xyz/anchor/src/error.ts`). Refresh per Anchor minor version bump.
