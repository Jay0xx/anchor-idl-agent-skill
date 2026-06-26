# Anchor IDL Agent Skill

> **The meta-skill that turns every deployed Anchor program on Solana into an agent-callable tool.**

A production-grade [Solana AI Kit](https://github.com/solanabr/solana-ai-kit) skill that teaches Claude Code / Codex to consume any Anchor IDL — fetched from chain, a registry, or a file — and call its instructions safely: typed arguments, automatic PDA + ATA resolution, mandatory pre-flight simulation, decoded Anchor errors, and mainnet safety rails.

Submitted to the [Superteam Brasil "Ship Useful Agent Skills" bounty](https://superteam.fun/earn/listing/skills).

---

## Why this skill exists

Every other Solana skill in the kit teaches an agent about *one* domain — payments, games, token extensions, oracles. But the long tail of value on Solana lives in **thousands of deployed Anchor programs** an agent has never seen.

Today, calling an unknown Anchor program from an agent means:

1. Find the IDL (chain? GitHub? broken link in docs?)
2. Hand-translate every instruction into a TypeScript call
3. Figure out which accounts are signers, which are PDAs, what seeds they use
4. Hope the transaction lands; if it fails, decode `0x1771` by hand
5. Pray it isn't a malicious program impersonating a real one

This skill collapses steps 1–5 into a single agent-callable workflow.

```
You: "Deposit 100 USDC into Kamino's main vault using my wallet."

Agent: [loads IDL] → [derives PDAs from IDL seeds] → [builds ix] →
       [simulates against mainnet fork] → [shows you decoded CU cost,
       account writes, expected return] → [waits for confirm] → [sends]
```

## What it actually does

| Capability | File |
|---|---|
| Fetch any Anchor IDL (chain / Anchor.toml / GitHub / file) — both v0.29 legacy and v0.30+ specs | [`skill/idl-ingestion.md`](skill/idl-ingestion.md) |
| Generate JSON-schema tool definitions an LLM can call | [`skill/tool-generation.md`](skill/tool-generation.md) |
| Automatic PDA / ATA / sysvar / signer resolution from IDL metadata | [`skill/account-resolution.md`](skill/account-resolution.md) |
| Mandatory pre-flight simulation with CU surfacing and return-data decoding | [`skill/simulation-and-send.md`](skill/simulation-and-send.md) |
| Decode raw `0x1771` errors back to source line + enum variant | [`skill/error-decoding.md`](skill/error-decoding.md) |
| Mainnet allowlist, CU/fee caps, confirmation flow, simulation-or-die | [`skill/safety-rails.md`](skill/safety-rails.md) |
| Worked adapters for Jupiter, Drift, Kamino, MarginFi v2, Squads v4 | [`skill/adapters.md`](skill/adapters.md) |
| Common recipes (swap, lend, vote, propose, mint) | [`skill/cookbook.md`](skill/cookbook.md) |
| Test against Surfpool / LiteSVM without burning SOL | [`skill/testing.md`](skill/testing.md) |

## Reference implementation

A real TypeScript toolkit ships in [`code/`](code/) — `@solanabr/anchor-agent-toolkit` — implementing every claim above as importable functions:

```ts
const idl = await loadIdl({ programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' })
const tools = buildToolSchema(idl)        // → JSON-schema array for LLM tool calls
const { tx } = await resolveAccounts(idl, 'route', { ... }, signer)
const result = await simulateAndSend(connection, tx, { simulateOnly: true })
// → { ok: true, computeUnits: 142_018, accountWrites: [...], returnData: ... }
```

## Slash commands

| Command | Purpose |
|---|---|
| `/ingest-idl <source>` | Fetch + parse + emit tool spec |
| `/explain-ix <program> <ix>` | Human-readable account map and effect |
| `/simulate-ix <program> <ix> <args.json>` | Pre-flight simulate, decode result |
| `/decode-error <txSig | code>` | Anchor error → source line |

## Install

```bash
git clone https://github.com/Jay0xx/anchor-idl-agent-skill.git
cd anchor-idl-agent-skill
./install.sh
```

This places the skill at `~/.claude/skills/anchor-idl-agent/` and appends routing rules to your `~/.claude/CLAUDE.md`. Restart Claude Code. Try:

> *"Using the Anchor IDL Agent skill, ingest the IDL for program `JUP6Lkb...` and list every instruction with its account requirements."*

## License

MIT © 2026 — built for the [Superteam Brasil Solana AI Kit bounty](https://superteam.fun/earn/listing/skills).

## Safety usage notes

When calling `loadIdl`, pin both the IDL hash and upgrade authority for any
programId you treat as trusted:

```ts
const idl = await loadIdl({
  programId,
  source: 'onchain',
  provider,
  expectedSha256: '<pinned hash>',
  expectedUpgradeAuthority: '<pinned authority or null for immutable>',
})
```

`simulate()` allowlist-checks **every** programId in the bundle. To bypass,
you must pass `unsafe: { allowNonAllowlisted: true, reason: '...' }` — the
bypass is logged.

## Limitations

See [LIMITATIONS.md](./LIMITATIONS.md) for the full list of trust
assumptions, data-source risks, and out-of-scope functionality.
