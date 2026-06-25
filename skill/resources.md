# Resources

Pinned references the skill relies on. If any of these go stale, the skill needs to be updated.

## Specifications

- [Anchor IDL specification (0.30+)](https://www.anchor-lang.com/docs/idl) — the canonical schema for the new IDL format
- [Anchor 0.29 IDL types](https://github.com/coral-xyz/anchor/blob/v0.29.0/ts/packages/anchor/src/idl.ts) — for legacy IDLs still on mainnet
- [Solana versioned transactions](https://solana.com/docs/advanced/versions) — required for v0 + ALT support
- [Address Lookup Tables](https://solana.com/docs/advanced/lookup-tables) — used by Jupiter, Drift, others

## Tooling

- [`@coral-xyz/anchor`](https://github.com/coral-xyz/anchor) — the official client we wrap
- [Codama](https://github.com/codama-idl/codama) — alternative IDL → client codegen (we borrow type-mapping conventions)
- [Surfpool](https://github.com/txtx/surfpool) — local mainnet fork for testing
- [LiteSVM](https://github.com/LiteSVM/litesvm) — in-process Solana VM
- [Helius DAS / RPC](https://helius.dev) — for IDL fetching and account hydration

## Reference programs (their IDLs + repos)

- Jupiter V6 — [jup-ag/jupiter-core](https://github.com/jup-ag) (IDL on-chain)
- Drift V2 — [drift-labs/protocol-v2](https://github.com/drift-labs/protocol-v2)
- Kamino Lend — [Kamino-Finance/klend](https://github.com/Kamino-Finance/klend)
- MarginFi v2 — [mrgnlabs/mrgn-v2](https://github.com/mrgnlabs/mrgn-v2)
- Squads v4 — [Squads-Protocol/v4](https://github.com/Squads-Protocol/v4)

## Background reading

- [Anchor "Errors" chapter](https://www.anchor-lang.com/docs/errors) — error code conventions
- [Solana priority fees deep-dive (Helius)](https://www.helius.dev/blog/priority-fees-understanding-solanas-transaction-fee-mechanics)
- [What Anchor 0.30's new IDL gives you](https://www.anchor-lang.com/release-notes/0.30.0)
