# Changelog

## 1.11.0
- Upsets (optional, in the setup's rules tab), so a game isn't decided early:
  - **Wealth tax:** every N rounds the richest player — or everyone above the average — pays a chosen % of their net worth (to Free Parking if it's on, else to the bank).
  - **Underdog bonus:** the poorest player gets double salary at Start.
  - **Market crisis:** every N rounds everyone pays per house and per hotel.
  - **Earthquake:** every N rounds a random colour group with buildings loses a house on each street (half the price back).
- Your own rules, like your own cards: When (every N rounds / passing Start / stopping on a square) → Who (the player whose turn it is / everyone / the richest / the poorest) → What (gets or pays money, pays a % of net worth, pays per house and hotel, goes to jail, loses a house).
- Everyone sees a short animation when an upset or a rule fires (the earthquake shakes); the history and the in-game rules list them.

## 1.10.0
- Sharper board text: a larger board picture (3072 px on phones, 4096 px on computers), the best angle filtering the device offers, and slightly bigger, bolder names and prices.
- Animations with sound for paying tax, landing on Start and landing on Free Parking (with or without the pot), next to the rent one; the square flashes on the 3D board.
- Cards are shown to everyone: the card of the current turn appears top left on every phone, and the history says which card it was. Only the player who drew it gets the big card.
- Online: if the host leaves for good, the game goes on. After 30 seconds the next player becomes host by themselves (then the one after, if they are gone too); any player can also take over by hand after 10 seconds. A host who comes back later joins as a normal player.
- Board contrast slider (80–150 %) in the ✕ menu and the device settings, for the 3D and 2D board.
- Setup → Names & prices: separate buttons to reset the names and to reset the prices (the old one reset both).
- Fix (computers): the buttons for the square the piece was heading to flashed for a moment before the piece arrived; they now appear when it lands.
- Fix: the history showed a card's text twice.
- Fix (online): someone joining a game in progress could see the game before the host answered; they now get nothing until the host lets them in.
- Tests can run against a local signalling server (`VITE_PEER_SERVER=host:port`) where the public one isn't reachable.

## 1.9.0
- Join an online game that has already started: the newcomer asks, the host lets them in as a player (starting money, on Start, playing last) or as a spectator (watches and chats), or says no.
- Guests in the lobby can see the host's settings (board, names & prices, cards, rules), locked.
- Starting money can be set in the setup (rules tab).
- Money in the top bar (and the +/− amounts, rent and jail banners) changes when the piece arrives, not when the dice are thrown.
- A little more contrast on the board (darker text and lines, lighter paper).
- Fix (online, from 1.8.1): long games stopped updating the other phones (messages over 16 KB were refused); now split and joined. Every phone also tells the host its app version, and a warning appears if someone runs an older one.

## 1.8.1
- **Fix (online):** in longer games the game state grew past 16 KB, which the data channel silently refused; other phones stopped getting updates (e.g. stuck in an old auction round, “bid must be higher”) while chat still worked. Big messages are now split into parts and joined again; player photos were affected too. Regression test: a game state over 20 KB reaches the other phone.
- “Report a problem” in the ✕ menu: a short network diary to copy and send.

## 1.8.0
- Player photo straight from the camera, inside the app (front/back camera, round preview of what is kept); “From file” for the gallery. Falls back to the phone's camera app if live camera access isn't available.
- Repository: issue forms for bugs and ideas, security note.

## 1.7.0
- Computers and tablets: the board fills the left side and the controls sit in a column on the right; dialogs open in the middle of the screen.
- Joining a game keeps trying for up to 2 minutes (with a timer and a cancel button), so a host who stepped out to send the code can come back; hosts get a reminder to stay on the screen and a “Send the code” button (share sheet).
- Rent animation: the square flashes in the owner's colour, a cash-register sound plays, and a card shows the amount and who pays whom.
- Corner squares (Start, Jail, Parking, Go to Jail) have their text running diagonally, like a real board.
- Animated banners are shown even on devices where animations don't run.

## 1.6.2
- The app shows its version discreetly (home screen and ✕ menu), with the build's commit, e.g. “v1.6.2 · 8ffa863”.

## 1.6.1
- Online: our own relay (TURN, Metered) is tried first, so players on networks that block direct connections (e.g. different countries) can still play.

## 1.6.0
- Online across countries: the free relays PeerJS used to provide no longer exist; replaced with working public STUN servers and the Open Relay TURN service, with a slot for a relay of your own. Longer connection wait and clearer messages (game not found vs. networks blocking the connection).
- House rule: pass on a free property without starting an auction.
- Setup → Names & prices: change the price of any property (multiples of 10 €; rents stay as in the table).
- The classic board is now checked by tests against the official prices and rents.
- Fix: lifting a mortgage on some prices cost 1 € too much (floating-point rounding).

## 1.5.0
- City name sets: Athens (default), Patras and Thessaloniki, chosen in Setup → Names; stations follow the city too.
- Move a neighbourhood to another colour group before the game (tap ⇅ on two squares to swap them), e.g. Glyfada into the blue group.
- Tests: every city has complete, unique names on both boards; invalid moves (e.g. a station with a street) are rejected.

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
