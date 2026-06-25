# CLAUDE.md addendum — Anchor IDL Agent Skill

This file is appended to `~/.claude/CLAUDE.md` by `./install.sh`. It registers
routing rules so Claude Code knows when to load the skill.

## Trigger conditions

Load `~/.claude/skills/anchor-idl-agent/SKILL.md` when ANY of these are true:

- User asks to **call, simulate, inspect, build, or explain** an instruction of a deployed Solana program
- User mentions an Anchor program by **program ID** (base58, 32–44 chars)
- User mentions a known DeFi/infra protocol that exposes an Anchor IDL: Jupiter, Drift, Kamino, MarginFi, Squads, Marinade, Meteora, Phoenix, Openbook, Sanctum, etc.
- User asks to **decode an Anchor error** or an on-chain transaction
- User asks how to **generate types / tool definitions** from an IDL

## Hard rules (apply whenever this skill is active)

1. **Never send a mainnet transaction without simulating first.** Simulation is non-negotiable; if simulation fails, surface the decoded error and stop.
2. **Never call a program whose program ID is not in the user's allowlist** without explicit confirmation. See `skill/safety-rails.md`.
3. **Always prefer IDL-declared seeds** over hand-written PDA derivation. If the IDL lacks seeds metadata (pre-0.30), surface that and ask before guessing.
4. **Decode every `0x...` error** through the loaded IDL before reporting to the user.
