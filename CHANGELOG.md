# Changelog

## 1.4.0
- Rules of the game in the app: from the home screen and from the in-game ✕ menu; short sections that open for details, in Greek and English.
- Inside a game, the rules start with that game's settings (board, amounts, auction type, house rules, time limit, custom cards).
- Amounts in the rules come from the board being played, and are checked by tests against the rules engine.
- Fix: dialogs opened from the home screen had unreadable white text.

## 1.3.1
- Project documentation: English README with screenshots, architecture notes, Greek player guide, changelog; licence: all rights reserved.
- Code quality: zero lint warnings; UI helpers and components split; monthly dependency updates (Dependabot).

## 1.3.0
- Online: a phone showing an outdated screen now always resynchronises with the host (fixes a player getting stuck in an auction).
- Faster host replies to heartbeats; more tolerant connection watchdog.
- Board brightness setting: normal / low / night.

## 1.2.0
- Start arrow points the way pieces move.
- Calmer board colours (no glaring white on desktop screens).
- Free Parking money shown as a pile of coins in the middle of the 3D board (the dice bounce off it).
- Host keeps reconnecting to the signalling server; "Reconnect" button; visible sync status.
- New and improved pieces: equestrian statue, lucky cat, sack of money, turtle shell, cactus spines; black colour option; big preview of the chosen piece.

## 1.1.0
- 3D board with physics dice, follow camera, buildings around the board, 3D pieces.
- In-game chat for online games; jail animation; flying coins for payments.
- End-of-game statistics and rematch.
- Automated tests and CI/CD to GitHub Pages.

## 1.0.0
- Full rules engine, classic and large boards, auctions, trades, custom names and cards, house rules.
- One-phone and online peer-to-peer play, installable PWA, Greek and English.
