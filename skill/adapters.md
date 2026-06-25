# Worked Adapters

Reference compositions of the skill against five real mainnet programs. Each adapter is one TypeScript file that re-exports typed wrappers around the generic toolkit — code lives in `code/src/adapters/`.

## Jupiter V6 — `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`

```ts
const quote = await jupiter.quote({ inputMint: USDC, outputMint: SOL, amount: 100_000_000 })
const { tx } = await jupiter.swap({ quote, user: wallet.publicKey })
await simulateAndSend(connection, tx, signer)
```

Notes: Jupiter's IDL is **enormous** — auto-generated tool schema is too big for some context windows. The adapter pre-filters to the four useful instructions (`route`, `sharedAccountsRoute`, `createTokenLedger`, `closeTokenLedger`).

## Drift V2 — `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`

PDA-heavy. Drift declares seeds in its IDL (modern spec) so resolution is automatic. Adapter exposes high-level perpetuals primitives: `depositCollateral`, `openPerpOrder`, `cancelOrder`, `closePerpPosition`.

```ts
const { tx } = await drift.openPerpOrder({
  market: 'SOL-PERP',
  direction: 'long',
  baseSize: 1.5,
  limitPrice: 142.30,
  reduceOnly: false,
})
```

Drift's User account discriminator must be verified against the on-chain user (`User` discriminator = `[159, 117, 95, 227, 239, 151, 58, 236]`) before any order — otherwise a stale local IDL can produce orders against the wrong subaccount.

## Kamino Lend — `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYZgmJjVB`

Lending. `depositReserveLiquidity`, `borrowObligationLiquidity`, `repayObligationLiquidity`, `withdrawObligationCollateral`. Reserve PDAs are derived from `(marketAddress, mint)` — encoded in IDL seeds, so account resolution is hands-free.

Health check: before any borrow/withdraw, simulate AND parse the post-state of the Obligation account; refuse to send if post-tx LTV would exceed 95% of liquidation threshold.

## MarginFi v2 — `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA`

Similar shape to Kamino. `lendingAccountDeposit`, `lendingAccountBorrow`, `lendingAccountWithdraw`. Bank PDAs derived from `(group, mint, "bank")` seeds.

## Squads v4 — `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu`

Multisig. `vaultTransactionCreate`, `vaultTransactionApprove`, `vaultTransactionExecute`, `proposalCreate`, `proposalApprove`.

The adapter has a special mode: **propose-instead-of-send**. When the user's wallet is a Squads vault member rather than the vault authority, the adapter wraps any other adapter's instruction into a Squads proposal automatically:

```ts
const { tx } = await drift.openPerpOrder({ ... }, { proposeVia: 'squads', vault: vaultPda })
// → produces a Squads vault_transaction_create + proposal_approve instead of a direct Drift call
```

This is the **killer feature** of having a generic IDL toolkit: any instruction for any program becomes a Squads proposal for free.

## Adding your own adapter

1. `pnpm tsx scripts/scaffold-adapter.ts <programId> <name>`
2. The script ingests the on-chain IDL, generates a typed adapter at `code/src/adapters/<name>.ts`, and writes a smoke test against Surfpool.
3. Hand-edit the exported functions to expose just the instructions you care about with friendly names + sensible defaults.
4. Add the program ID to `ALLOWLIST` in [`safety-rails.md`](safety-rails.md).
