# Testing

Testing IDL-driven calls without burning real SOL on mainnet.

## Local stack

| Tool | When to use |
|---|---|
| **Surfpool** | Local mainnet fork. Best for testing against real program state (Jupiter routes, Drift markets). Spins up in ~5s. |
| **LiteSVM** | In-process Solana VM. Fastest. Use for pure logic tests where you don't need mainnet account state. |
| **anchor-test / Bankrun** | Anchor's bundled test runner. Use when you also own the program. |

## Surfpool flow (recommended for IDL skill tests)

```bash
surfpool start --fork-url https://mainnet.helius-rpc.com/?api-key=$KEY
```

Then point the toolkit at `http://localhost:8899` and `simulateAndSend` will run against a forked mainnet state. The fork is read-write locally; resets between runs.

## Adapter smoke tests

Every adapter in `code/src/adapters/` has a sibling test in `code/tests/adapters/`. The pattern:

```ts
test('jupiter.swap: USDC → SOL simulates cleanly', async () => {
  const { connection, wallet, cleanup } = await startSurfpool({ fundedSol: 5 })
  try {
    const quote = await jupiter.quote({ inputMint: USDC, outputMint: SOL, amount: 100_000_000 })
    const { tx } = await jupiter.swap({ quote, user: wallet.publicKey })
    const sim = await connection.simulateTransaction(tx)
    expect(sim.value.err).toBeNull()
    expect(sim.value.unitsConsumed).toBeLessThan(200_000)
  } finally { await cleanup() }
})
```

## CI

`.github/workflows/test.yml` runs the full suite on every PR. Surfpool is installed as a step; tests are tagged `@surfpool` (skipped if the binary isn't present, e.g. on the contributor's first PR).

## Fuzzing IDL ingestion

The ingest layer is fuzz-tested with [Trident](https://github.com/Ackee-Blockchain/trident): a corpus of 200+ real mainnet IDLs (both v0.29 and v0.30+) is run through `loadIdl` → `buildToolSchema` → JSON-validate the output. Any crash or invalid schema fails the build.

## Mainnet smoke (manual)

Before any release tag, the maintainer runs `pnpm test:mainnet` — a curated set of 5 `simulateOnly` flows against live mainnet, using a hot test wallet. **Never sends** — pure simulation, asserts `err: null` and `unitsConsumed > 0`.
