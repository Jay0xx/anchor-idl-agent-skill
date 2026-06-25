# AGENTS.md — Anchor IDL Agent Skill

This file registers the skill for **agent runtimes other than Claude Code** —
primarily **OpenAI Codex CLI** and any tool that follows the AGENTS.md
convention (Cursor, Cline, Aider, etc.). The skill itself is agent-agnostic:
the markdown in `skill/` and the TypeScript toolkit in `code/` have no
Claude-specific dependencies.

## When to load this skill

Load `skill/SKILL.md` (and follow it from there) whenever the user:

- Mentions a Solana program by **program ID** (base58, 32–44 chars)
- Mentions a known protocol exposing an Anchor IDL: Jupiter, Drift, Kamino,
  MarginFi, Squads, Marinade, Meteora, Phoenix, Openbook, Sanctum, …
- Asks to **build, simulate, send, inspect, or explain** any instruction of
  a deployed Solana program
- Asks to **decode** an Anchor error or a failed transaction signature
- Asks to **generate types or tool definitions from an IDL**

## Hard rules (non-negotiable, apply on every send)

1. Never send a mainnet transaction without a successful simulation first.
2. Never call a program whose ID is not in `skill/safety-rails.md` allowlist
   without explicit user confirmation that echoes the full program ID back.
3. Never invent PDA seeds. If the IDL lacks seeds metadata, ask.
4. Always decode `0x…` errors through the loaded IDL before reporting.

## Entry point

Start at [`skill/SKILL.md`](skill/SKILL.md). That file contains the full
operating procedure, the task-routing table, and links to every sub-document
in the skill.

## Reference implementation

The TypeScript package in [`code/`](code/) (`@solanabr/anchor-agent-toolkit`)
implements every step of the operating procedure as plain importable
functions — usable from any LLM tool-calling runtime (Anthropic Messages API,
OpenAI Responses API with tools, Vercel AI SDK, raw HTTP, etc.).

```ts
```

No Claude dependency. No framework lock-in.

## Codex-specific notes

OpenAI's Codex CLI reads `AGENTS.md` files in repo roots and uses them as
persistent context. When this repo is a submodule of `solana-ai-kit` (or any
parent project), Codex will pick this file up automatically and route to the
skill when the trigger conditions above are met.

## Slash commands and subagents

The files in `commands/` and `agents/` use Claude Code's conventions (file
names → commands, frontmatter `model:` field → subagent model). For other
runtimes, treat them as plain markdown:

- `commands/*.md` document **named workflows** the user may invoke by name
  (`ingest-idl`, `explain-ix`, `simulate-ix`, `decode-error`).
- `agents/*.md` document **specialist roles** to adopt when the corresponding
  sub-task arises (architect / adapter engineer).

Both are useful prompts regardless of runtime.
