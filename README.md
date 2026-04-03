<div align="center">

# Clawmon

### Your life council. Hatch. Evolve. Rebirth.

![Clawmon Hero](assets/hero.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Hatch AI companions that live in your terminal. They have personalities, memories, and they remember you across sessions.**

</div>

---

## What is Clawmon?

Clawmon is a companion that lives in your AI terminal. You hatch it, give it a role, and it remembers you. It collects notes about your life, notices patterns, and speaks up when it has something worth saying.

It's not a chatbot. It's a small persistent creature with a personality, a memory, and a name.

## Quick Start

```bash
npm install -g clawmon
clawmon init
clawmon hatch
```

```
  ~~ Clawmon Hatching Ceremony ~~

       ,    ,
      /(    )\
     /  \  /  \
    |  ~~\/~~  |
    |   (oo)   |
     \  {==}  /
      `--''--`

  Species: Emberfawn (Common)
  Name: Kindlewick

  "Oh! Hello. I'm... I think I'm yours?
   I'll be around. Just getting my bearings."
```

## Talk to Your Clawmon

```bash
clawmon talk kindlewick "How are you?"
```

Your clawmon remembers previous conversations. It builds up a picture of who you are over time.

## Show Your Clawmon

```bash
clawmon show kindlewick
```

```
  ┌──────────────────────────────────────┐
  │  Kindlewick                          │
  │  Species: Emberfawn (Common)         │
  │  Stats: INSIGHT 42 | CREATIVITY 38  │
  │         FOCUS 55  | EMPATHY 61      │
  │         WIT 47                       │
  │                                      │
  │       ,    ,                         │
  │      /(    )\                        │
  │     /  \  /  \                       │
  │    |  ~~\/~~  |                      │
  │    |   (oo)   |                      │
  │     \  {==}  /                       │
  │      `--''--`                        │
  │                                      │
  │  Notes: 3 collected                  │
  │  Last active: 2 hours ago            │
  └──────────────────────────────────────┘
```

## Commands

```bash
clawmon init                    # set up ~/.clawmon/
clawmon hatch                   # hatch a new companion
clawmon talk <name> [message]   # talk to your clawmon
clawmon show <name>             # display sprite, stats, notes
clawmon notes <name>            # show collected observations
clawmon export <name>           # export to portable JSON
clawmon import <file>           # import from JSON
```

## How It Works

- Your clawmon's personality is generated on hatch (species, stats, name, voice)
- Conversations are powered by Claude API with the clawmon's persona as context
- Notes and observations persist as markdown files in `~/.clawmon/`
- Everything is local, human-readable, and yours

## License

[MIT](LICENSE)
