# IDL Ingestion

Anchor IDLs come in **two incompatible spec versions** and **four common locations**. Always determine version + source before parsing.

## Spec versions

| Spec | How to detect | Notes |
|---|---|---|
| **Legacy (≤ 0.29)** | Top-level `version`, `name`, `instructions[]` with `accounts[]` and `args[]`; no `metadata.spec` field | Most deployed mainnet IDLs as of mid-2026 |
| **New (≥ 0.30)** | Has `metadata.spec: "0.1.0"`; instructions carry discriminator bytes; accounts can declare `pda.seeds[]` natively | Required for `anchor idl build` output |

The new spec is **strictly more expressive** — it carries PDA seed metadata that lets you resolve accounts without hard-coding. Always check `metadata.spec` first and branch.

## Sources (in priority order)

### 1. On-chain (preferred)
```ts
const idl = await Program.fetchIdl(programId, provider)
```
Pros: always matches deployed program. Cons: many programs never upload their IDL on-chain.

### 2. GitHub raw
```
https://raw.githubusercontent.com/<org>/<repo>/<sha>/target/idl/<program>.json
```
Pin to a **commit SHA**, not `main`. IDLs drift.

### 3. Anchor.toml in a cloned repo
```toml
[programs.mainnet]
my_program = "ProgRamID..."
```
Resolves to `target/idl/my_program.json` after `anchor build`.

### 4. Local file
```ts
const idl = JSON.parse(fs.readFileSync('./idl.json', 'utf8'))
```

## Caching

Cache by `(programId, idlSha256)`. Never cache by program ID alone — programs upgrade, IDLs change, and a stale cache will resolve accounts incorrectly and produce signed-but-wrong transactions.

```ts
const cacheKey = `${programId.toBase58()}:${sha256(JSON.stringify(idl))}`
```

## Verification

Before trusting an IDL fetched off-chain:
1. Compute the on-chain account-data discriminator for one well-known account type in the IDL.
2. Fetch one such account from mainnet.
3. Confirm the first 8 bytes match.

If they don't, the IDL is wrong for the deployed program — refuse to proceed.

## Common failure modes

- **IDL not on-chain**: many older Anchor programs never ran `anchor idl init`. Fall back to GitHub.
- **IDL upgrade gates**: some IDL accounts are upgrade-restricted; `fetchIdl` returns null. Check the program's authority before assuming "no IDL".
- **Squads-managed authority**: IDL updates require a Squads vote. Trust the on-chain copy.

See [`code/src/ingest.ts`](../code/src/ingest.ts) for the reference implementation.
