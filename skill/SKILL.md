---
name: anchor-idl-agent
description: Turn any Anchor IDL into agent-callable tools. Fetch IDLs from chain/file/GitHub, resolve PDAs + ATAs + signers automatically, simulate before sending, decode errors back to source. Use whenever the user wants to call, simulate, inspect, or explain an instruction of any deployed Anchor program.
license: MIT
version: 0.1.0
---

# Anchor IDL Agent Skill

## What this skill is for

Calling **any** deployed Anchor program on Solana — known or unknown — safely and correctly, without writing program-specific wrappers. This skill is the bridge between an LLM coding agent and the long tail of thousands of Anchor programs deployed on mainnet.

**When this skill activates** (load it without asking the user):
- The user names a Solana program by program ID or by protocol name (Jupiter, Drift, Kamino, MarginFi, Squads, Marinade, Meteora, Phoenix, Openbook, Sanctum, …)
- The user asks to build, simulate, send, or explain an instruction
- The user asks to decode an Anchor error or a failed transaction signature
- The user asks how to generate types or tool schemas from an IDL

**Hard never-violate rules** — even if the user insists:
1. **Never send a mainnet transaction without a successful simulation first.** See [`safety-rails.md`](safety-rails.md).
2. **Never call a program whose ID is not in the allowlist** without explicit user confirmation that quotes the full program ID back to them.
3. **Never invent PDA seeds.** If the IDL doesn't declare them (pre-0.30), ask.
4. **Always decode `0x…` errors** through the loaded IDL before reporting them.

## Default stack decisions

These are the choices this skill makes unless the user overrides:

| Concern | Default | Why |
|---|---|---|
| IDL fetcher | On-chain via `AnchorProvider.fetchIdl`, fallback to GitHub raw | Survives broken docs links |
| Anchor version | Detect from IDL `metadata.spec` ("0.1.0" = legacy, otherwise new) | Both spec formats exist on mainnet today |
| RPC | Helius or user-supplied; never a public RPC for sim | Public RPCs drop simulate calls under load |
| Simulation | `simulateTransaction` with `replaceRecentBlockhash: true`, sigVerify off, full account data | Catches CU overflow and account-state mismatches |
| Transaction format | v0 versioned transaction with address lookup tables when present | Modern programs require it |
| Confirmation | `processed` for simulation, `confirmed` for send | Fast feedback, safe finality |
| Priority fees | `getRecentPrioritizationFees` × 1.5, capped at `safety-rails.md` ceiling | Lands without overpaying |

## Operating procedure

Run through this top-to-bottom for every IDL-driven task.

| Step | Goal | Reference |
|---|---|---|
| 1 | Classify the request: ingest? explain? simulate? send? decode? | This file |
| 2 | Load the IDL (cache by program ID + spec version) | [`idl-ingestion.md`](idl-ingestion.md) |
| 3 | Build a tool schema the LLM can call (JSON-schema per instruction) | [`tool-generation.md`](tool-generation.md) |
| 4 | Resolve every account: signer, PDA from IDL seeds, ATA, sysvar, user-supplied | [`account-resolution.md`](account-resolution.md) |
| 5 | Simulate. If it fails, decode the error and stop. | [`simulation-and-send.md`](simulation-and-send.md) and [`error-decoding.md`](error-decoding.md) |
| 6 | Show the user: decoded effects, CU, fee, account writes. Get confirmation. | [`safety-rails.md`](safety-rails.md) |
| 7 | Send with retry-on-blockhash-expired; surface signature + explorer link | [`simulation-and-send.md`](simulation-and-send.md) |

## Task → file routing

| User intent | Files to load |
|---|---|
| "What does this program do?" / "List instructions" | `idl-ingestion.md` + `tool-generation.md` |
| "Build / send / simulate this instruction" | `account-resolution.md` + `simulation-and-send.md` + `safety-rails.md` |
| "Why did my tx fail?" / "Decode error 0x…" | `error-decoding.md` |
| "Set up calls to {Jupiter, Drift, Kamino, MarginFi, Squads}" | `adapters.md` (worked examples) |
| "Common recipe: swap / lend / vote / propose" | `cookbook.md` |
| "How do I test this without burning SOL?" | `testing.md` |

## Recommended subagents

Spawn these when the task warrants it (see `agents/`):

- **idl-tool-architect** (opus) — given an unknown IDL, design the tool surface: which instructions should be one-call tools, which need composition, what defaults to apply.
- **idl-adapter-engineer** (sonnet) — implements a typed adapter module for a specific program against the conventions in this skill.

## Recommended commands

See `commands/`:

- `/ingest-idl <source>` — fetch + parse + emit tool spec
- `/explain-ix <program> <ix>` — human-readable account map
- `/simulate-ix <program> <ix> <args.json>` — pre-flight only
- `/decode-error <txSig | code>` — Anchor error → source

## Reference implementation

A working TypeScript package lives in [`code/`](../code/) — `@solanabr/anchor-agent-toolkit` — that implements every step of the operating procedure. Adapters in `code/src/adapters/` show how to compose the toolkit for real programs.

## See also

- [`resources.md`](resources.md) — links to Anchor IDL specs, codecs, and reference programs
- [`safety-rails.md`](safety-rails.md) — the allowlist, CU caps, confirmation flow
