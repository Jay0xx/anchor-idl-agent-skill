#!/bin/bash
# Anchor IDL Agent Skill — standard installer
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
SKILL_PATH="$SKILLS_DIR/anchor-idl-agent"
CLAUDE_MD="$HOME/.claude/CLAUDE.md"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "   Anchor IDL Agent Skill — installer"
echo "   The meta-skill that turns every Anchor program into a tool"
echo "═══════════════════════════════════════════════════════════════"
echo ""

mkdir -p "$SKILLS_DIR" "$HOME/.claude"

if [ -d "$SKILL_PATH" ]; then
  echo "→ Removing previous install at $SKILL_PATH"
  rm -rf "$SKILL_PATH"
fi

# Copy skill body
cp -r "$SCRIPT_DIR/skill" "$SKILL_PATH"
cp -r "$SCRIPT_DIR/agents"   "$SKILL_PATH/agents"
cp -r "$SCRIPT_DIR/commands" "$SKILL_PATH/commands"
cp -r "$SCRIPT_DIR/rules"    "$SKILL_PATH/rules"
echo "✓ Installed skill body  → $SKILL_PATH"

# Append routing addendum to CLAUDE.md
MARKER="<!-- anchor-idl-agent-skill -->"
if ! grep -q "$MARKER" "$CLAUDE_MD" 2>/dev/null; then
  cat >> "$CLAUDE_MD" <<'EOF'

<!-- anchor-idl-agent-skill -->
## Anchor IDL Agent Skill

When the user asks to call, simulate, inspect, or explain an instruction
of a deployed Anchor program — OR mentions any program by its program ID
or a known protocol (Jupiter, Drift, Kamino, MarginFi, Squads, etc.) —
load the skill at ~/.claude/skills/anchor-idl-agent/SKILL.md and follow
its operating procedure. Never call an unknown Anchor program without
first running it through the IDL ingestion → simulation pipeline.
EOF
  echo "✓ Appended routing rule → $CLAUDE_MD"
else
  echo "→ CLAUDE.md already references this skill (skipped)"
fi

echo ""
echo "Installed. Restart Claude Code, then try:"
echo "  "Ingest the IDL for program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 and list its instructions.""
echo ""
