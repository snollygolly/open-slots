# 🎰 Open Slots — Player Guide & Rules

Welcome to Open Slots. This guide matches the current UI, symbols, and the features implemented in the game.

---

## 🎮 UI & Basic Play

- Credit: your current balance (in credits).
- Bet: the amount wagered on a base spin.
- Buttons:
  - SPIN: play one spin at the current bet.
  - Buy Hold & Spin (10k): immediately triggers Hold & Spin for 10,000 credits.
  - Buy Free Games (10k): immediately triggers Free Games for 10,000 credits.
  - Sim 1k: runs a 1,000‑spin simulation and prints a summary in the results log (no effect on credits).
- Results panel:
  - Last Win: most recent total win (in credits).
  - Win Log: shows per‑spin win details and Sim 1k summaries.
  - Meters (top): progressive jackpot values (Mini, Minor, Maxi, Major, Grand).

---

## 🎲 Reels & Symbols

- Grid: 5 reels × 3 rows (5×3), using 243‑ways pays.
- Special symbols:
  - WILD: substitutes for standard symbols to complete ways.
  - SCATTER: 3+ triggers Free Games.
  - ORB: 5+ triggers Hold & Spin.
- Standard symbols:
  - High: LANTERN, LILY, FROG, GATOR
  - Low: A, K, Q, J, T

---

## 💰 Ways to Win (243 Ways)

- Wins occur when 3 or more matching symbols land on consecutive reels starting from reel 1.
- Any row positions count; multiple ways for the same symbol are summed.
- WILD substitutes for standard symbols.

Example:
- K on reels 1–3 (any rows) = a win.
- K + WILD + K on reels 1–3 also = a win.

---

## ⭐ Features

### Free Games (SCATTER)
- Trigger: 3 or more SCATTER symbols anywhere.
- Award: 8 free spins. Retrigger adds 5 more.
- During Free Games: spins do not deduct your bet; wins still credit to your balance.
- The on‑screen “Win” label shows a running total for the current Free Games session.

### Hold & Spin (ORB)
- Trigger: 5 or more ORB symbols in view in a base spin.
- Start with 3 respins. All ORBs lock in place.
- Each new ORB resets the respin counter back to 3 and also locks.
- Some ORBs carry fixed credit values; some carry jackpot labels (MINI, MINOR, MAXI, MAJOR).
- Filling the entire 5×3 grid during the feature also awards the GRAND jackpot.
- Payout at the end = sum of all locked ORB credit values + any jackpots awarded.
- The on‑screen “Win” label shows the live total of locked values during the feature.

### Feature Buy
- Buy Hold & Spin (10k): deducts 10,000 credits and forces Hold & Spin to start on the next spin (the spin itself doesn’t deduct a base bet).
- Buy Free Games (10k): deducts 10,000 credits and starts an 8‑spin Free Games session (retrigger still awards +5).

---

## 📊 Progressive Jackpots

- Tiers: Mini, Minor, Maxi, Major, Grand (shown at the top).
- Jackpots increase slightly with base spins. When a jackpot is won, its meter resets to its seed value.
- Jackpots are awarded by special ORBs during Hold & Spin; GRAND is awarded only by filling the entire grid during Hold & Spin.
- Display: meters show dollar‑style values; wins and balance display in credits.

---

## 🧪 Simulation (Sim 1k)

- Runs 1,000 virtual spins and prints a one‑line summary (RTP, hit rate, feature triggers, jackpots) at the top of the Win Log.
- Simulation does not change your credits or meters.

---

## 💾 Persistence

- Your credits and progressive meter balances are saved locally between sessions.

---

## ℹ️ Notes

- This is a demo/learning project; values and visuals may change.
- There is no real‑money play.
