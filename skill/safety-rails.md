# Safety Rails

These rails are **non-negotiable** and apply to every send. The skill refuses to proceed if they're violated, regardless of user instruction.

## The allowlist

Mainnet program IDs the agent will call without a friction prompt. Anything else triggers explicit confirmation that echoes the full program ID back to the user.

```ts
export const ALLOWLIST = new Set([
  // DEX aggregators
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter V6

  // Perps
  'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',   // Drift V2

  // Lending
  'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYZgmJjVB',  // Kamino Lend
  'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA',   // MarginFi v2

  // Squads
  'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu',   // Squads v4

  // Liquid staking
  'CrX7kMhLC3cSsXJdT7JDgqrRVWGnUpX3gfEfxxU2NVLi',  // Sanctum
])
```

For anything outside this set:

> ⚠️ About to call **unknown program** `Az9P…uWqx`. This program is not in the allowlist.
> Source of IDL: on-chain fetch (verified discriminator match against account type `UserStats`).
> Type **YES, send to Az9P…uWqx** to proceed.

## Hard caps

| Limit | Default |
|---|---|
| Max compute units per tx | 1,400,000 (Solana cap) |
| Max priority fee | 1,000,000 microLamports / CU (≈ 0.0014 SOL on a 1.4M CU tx) |
| Max total fee (base + priority) | 0.01 SOL — refuses to send if exceeded; asks user |
| Max single-tx transfer to non-allowlisted destination | 0 (force user confirm) |
| Max simulation retries | 3 (then give up) |
| Max instructions per tx | 64 |

Override only with explicit `{ unsafe: { ... } }` parameter on `simulateAndSend` — and log it loudly.

## Mandatory pre-flight checks

Before any send, all of these must pass:

- [ ] IDL discriminator verified against on-chain account type (per [`idl-ingestion.md`](idl-ingestion.md))
- [ ] Simulation returned `err: null`
- [ ] `unitsConsumed` < hard cap and < `simulated × 1.1`
- [ ] Every signer pubkey appears in `tx.message.staticAccountKeys[0..N]` where `N = numRequiredSignatures`
- [ ] No writable account is the system program or a sysvar
- [ ] Priority fee within cap
- [ ] If program not in allowlist, user has explicitly confirmed

If ANY check fails, throw `SafetyRailViolation(checkName)` — do not attempt to "best-effort" continue.

## Confirmation flow

For every send, surface this block and wait for explicit Y/N:

```
About to send transaction
─────────────────────────────────────────
  Program:        Jupiter V6 (JUP6Lkb…)
  Instruction:    route
  Compute units:  142,018 (cap 200,000)
  Priority fee:   12,500 µLAMP/CU = 0.0028 SOL
  Total fee:      ~0.0029 SOL
  Account writes:
    • UserSwapState:  150 USDC → 0 USDC
    • UserSwapState:  0 SOL    → 0.92 SOL
    • Slippage:       expected 0.4% (set: 1.0%)

Send? (y/N)
```

Never auto-confirm. Never set a default of "y". Never collapse the confirmation into the same prompt that started the task.

## Logging

Every send writes one line to `~/.claude/anchor-idl-agent.log`:

```
2026-06-25T11:14:02Z program=JUP6Lkb… ix=route signer=GjE7…  sig=4xK2… cu=142018 fee=0.0029  status=confirmed
```

Local-only, never transmitted. Used for incident reconstruction.
