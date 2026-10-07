# Architecture

## Overview

```
┌──────────────┐   actions    ┌──────────────────────┐   state    ┌──────────────┐
│  UI (React)  │ ───────────▶ │  Store (store.ts)    │ ─────────▶ │  UI + 3D     │
│  screens     │              │  local / host / client│           │  scene       │
└──────────────┘              └──────────┬───────────┘            └──────────────┘
                                          │ apply(state, by, action)
                                          ▼
                               ┌──────────────────────┐
                               │ Rules engine          │  pure, deterministic,
                               │ src/game/engine.ts    │  seeded RNG, no I/O
                               └──────────────────────┘
```

The same engine runs in every mode. Only *who* calls it changes:

| Mode | Who applies actions | Transport |
|---|---|---|
| One phone | the phone itself | – |
| Host | the host phone | WebRTC data channels (PeerJS) |
| Client | sends actions to the host, renders the host's state | WebRTC |

## Rules engine

- `apply(game, by, action, now)` clones the state, validates that `by` may perform `action`, applies it and returns the new state. Invalid moves throw a `RuleError` with a translation key.
- Everything that "waits" is a queue of pending items (`buy`, `card`, `rename`, `debt`, `auction`). `waiting(game)` returns who may act now, which drives both the UI and the automatic moves for absent players.
- Randomness (dice, shuffles) comes from a seeded generator stored in the state, so a game is reproducible from its state.
- Statistics (rent paid/collected per player and square, jail visits, net worth per round) are recorded for the end-of-game screen.

## Networking

- The host opens a PeerJS peer with a predictable id derived from the 5-letter room code; clients connect to it. The public PeerJS server is only used for signalling.
- **Host-authoritative:** clients never change the state themselves. Every accepted action is broadcast as a full state snapshot (≈10–40 KB).
- **Self-healing:**
  - the host pings with its state version; any mismatch makes the client ask for a resync;
  - a rejected action is answered with an error *and* the current state;
  - the host keeps reconnecting to the signalling server if it drops, and re-checks when the app returns from the background;
  - clients reconnect automatically, and after 5 minutes without a host any client can take over (the room id moves to the next generation; a returning original host joins as a normal player).
- Absent players are detected by heartbeat; after a configurable delay their turn is played automatically.

## 3D scene

- `Scene3D` (three.js) owns the renderer, board texture (drawn on a canvas, re-drawn only when names/owners change), buildings, tokens, dice, coins and camera.
- **Dice:** the engine decides the numbers; `simulateDice` pre-computes the whole throw with cannon-es using a fixed time step, settles the dice flat and apart, and reports which face ended on top so that face can be painted with the rolled value. Playback is time-based, so slow devices skip frames instead of slowing down.
- **Camera:** follows the current player; after a roll it chases the moving piece, then returns to the overview. Any touch hands control to the player until the 🎯 button is pressed.
- **Quality:** `setQuality` sets the pixel ratio, shadows and board-picture size (High / Medium / Low). In Auto, the frame times are measured in 3-second windows; uneven frames under 40 fps (or anything under 27 fps) step the level down once the current animation has finished. A steady 30 fps (screen or battery-saver limit) is not counted as slowness. It never steps back up by itself. → `src/three/quality.ts`
- **Loading:** the 3D board is its own code piece (`board3d-lazy.ts`); screens use `preloadable` (`src/lazy.ts`), which renders directly once the code is there and only falls back to React.lazy if opened earlier. A failed fetch reloads once (guarded against loops), then shows a message.
- **Safety:** a watchdog ends any animation after 10 s, errors inside the render loop jump to the final state, and a lost WebGL context rebuilds the scene.

## Testing

| Layer | Tool | What |
|---|---|---|
| Rules | Vitest | targeted tests per rule; 60 random full games checking invariants |
| Dice | Vitest | 3,000 throws: flat, inside walls, apart, correct face, bounded duration |
| Pieces | Vitest | every piece builds, finite geometry, fits a square |
| Texts | Vitest | Greek/English parity, every log line and error has a text |
| App | Playwright | 3D/2D play, menus, jail, language, end + rematch |
| Online | Playwright | two browsers: chat, sync, host outage, stale-screen recovery |

CI (GitHub Actions) runs lint, unit tests, build and browser tests on every push and deploys to GitHub Pages only if everything passes.
