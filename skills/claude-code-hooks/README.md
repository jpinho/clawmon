# Claude Code Hooks for Clawmon

This makes clawmons **proactive**: your primary companion automatically greets you at session start and extracts observations at session end -- without you lifting a finger.

## What it does

**SessionStart hook** -- runs instantly (file reads only, no AI call). Outputs your primary clawmon's:
- Role and catchphrase
- Current feelings (mood, confidence, trend)
- Active goals
- Preferences
- Recent observations

Claude Code injects this as session context, so it already knows what your clawmon knows when you start working.

**SessionEnd hook** -- runs when Claude Code closes a session. Reads the transcript, calls Sonnet once to extract 0-3 observations relevant to your primary clawmon's role, and saves them as memories. Silent -- you won't notice it running.

## Setup

### 1. Pick your primary clawmon

```bash
clawmon primary penny
```

This is the one that greets and observes. You can change it anytime.

### 2. Add the hooks to `~/.claude/settings.json`

Edit your settings file and add this block (replace `/ABSOLUTE/PATH/TO/clawmon` with your checkout path):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "cd /ABSOLUTE/PATH/TO/clawmon && NODE_NO_WARNINGS=1 npx tsx src/index.ts session-start",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "clear|logout|prompt_input_exit|other",
        "hooks": [
          {
            "type": "command",
            "command": "NODE_NO_WARNINGS=1 npx tsx /ABSOLUTE/PATH/TO/clawmon/src/index.ts session-end",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Important:** Claude Code hooks require a nested `matcher` + `hooks` wrapper. The `matcher` controls *when* the hook fires. Supported values:
- SessionStart: `startup`, `resume`, `clear`, `compact`
- SessionEnd: `clear`, `resume`, `logout`, `prompt_input_exit`, `other`

Use `|` to match multiple.

### 3. Make sure `ANTHROPIC_API_KEY` is available

SessionEnd calls Sonnet to extract observations. The hook needs `ANTHROPIC_API_KEY` in env. Either:

- Export it in your shell profile (`~/.zshrc` or `~/.bashrc`)
- Wrap the command with `op run` if you use 1Password CLI

### 4. Restart Claude Code

New sessions will include your companion's context. Session endings will quietly capture what happened.

## Verification

Start a new Claude Code session and ask: "what does my clawmon know about me?" Claude should reference the context your session-start hook injected.

To test session-end without running a full session:

```bash
echo '{"transcript_path":"/path/to/some/transcript.jsonl"}' | \
  clawmon --debug session-end
```

## What this solves

Without these hooks, clawmons are reactive -- you have to remember to talk to them. With them, they're present. Your primary clawmon shows up automatically at the start of every Claude Code session with everything it has learned about you, and quietly observes what happens so next session is richer still.

This is the loop that makes a persistent agent feel persistent.
