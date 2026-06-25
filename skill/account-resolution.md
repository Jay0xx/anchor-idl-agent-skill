# Account Resolution

The hardest part of calling an unknown Anchor program is filling the accounts array correctly. This file is the algorithm.

## Account classification

Walk `instructions[i].accounts[]`. Classify each:

1. **Sysvar** — name matches a known sysvar (`rent`, `clock`, `recentBlockhashes`, `slotHashes`, `stakeHistory`, `instructions`). Substitute the canonical pubkey.
2. **Program** — IDL type is `Program<…>` or the address field equals a known program ID. Use that.
3. **PDA (new spec)** — account has `pda.seeds[]`. Derive deterministically (see below).
4. **PDA (legacy spec, known pattern)** — name matches a documented pattern (`vaultAuthority`, `<thing>Pda`). Use the adapter's hint table.
5. **ATA** — account name ends in `Ata` or `TokenAccount` AND has a related `mint` + owner field. Derive via `getAssociatedTokenAddress`.
6. **Signer** — `isSigner: true` AND not already classified. Fill from the user's wallet (or the explicit signer arg).
7. **User-supplied** — everything else. Surface to the user.

## PDA derivation from IDL seeds (new spec)

The 0.30+ spec encodes seeds as a typed array. Each seed is one of:

```json
{ "kind": "const", "value": [118, 97, 117, 108, 116] }      // "vault" as bytes
{ "kind": "arg",   "path": "id" }                            // value of an instruction arg
{ "kind": "account", "path": "user.key" }                    // value of another account
```

Resolve in order:

```ts
function deriveFromSeeds(seeds, ix, args, accounts) {
  const buffers = seeds.map(s => {
    switch (s.kind) {
      case 'const':   return Buffer.from(s.value)
      case 'arg':     return serializeArg(args[s.path], findArgType(ix, s.path))
      case 'account': return accounts[s.path].toBuffer()
    }
  })
  return PublicKey.findProgramAddressSync(buffers, programId)[0]
}
```

**Important**: integer args must be serialized as **little-endian fixed-width**, matching the IDL type — not as the decimal string passed in JSON. `u64` → 8 LE bytes; `u32` → 4 LE bytes.

## ATA resolution

For accounts named `*Ata` or `*TokenAccount`:
1. Find the matching `mint` field (same instruction).
2. Find the matching owner field (signer if implied, else owner field).
3. Decide Token-2022 vs SPL Token: look at the program field; `tokenProgram2022` ⇒ Token-2022.
4. `getAssociatedTokenAddressSync(mint, owner, /* allowOwnerOffCurve */ false, tokenProgramId)`.
5. If the ATA doesn't exist on-chain, prepend a `createAssociatedTokenAccountIdempotent` instruction.

## Legacy IDLs (no seeds metadata)

The IDL doesn't tell you how to derive PDAs. Two options:

1. **Adapter hint table** — for known programs, `adapters.md` documents seed conventions.
2. **Refuse + ask** — for unknown programs, do NOT guess. Tell the user the IDL is legacy spec, list the unresolved PDA accounts, and ask them to either upgrade the IDL or supply the addresses manually.

## Pre-resolution validation

Before building the instruction, assert:
- Every account is now a `PublicKey` (not undefined)
- Signer count matches the IDL (`accounts.filter(a => a.isSigner).length`)
- No duplicate writable accounts unless allowed (Solana rule)

See [`code/src/resolve.ts`](../code/src/resolve.ts) for the reference implementation.
