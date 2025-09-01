# 🎰 Open Slots — Game Rules

Welcome to **Open Slots**!  
This document explains how to play, how wins are scored, and what features you can trigger while spinning.

---

## 🎮 How to Play

1. **Set your bet**  
   - Your current **credits** are shown in the HUD at the bottom.  
   - Each spin costs the **bet amount** shown.

2. **Spin the reels**  
   - Click **SPIN** to play one round.  
   - Click **AUTO** to spin continuously until stopped.  
   - Click **Sim 1k** to simulate 1,000 spins instantly (useful for testing math).

3. **Read results**  
   - Any winnings from the spin are shown as **Last Win** in the HUD.  
   - Winning lines are highlighted on the reels.  
   - Details of each winning line appear in the log at the bottom.

---

## 🎲 Reels & Symbols

- The game uses **5 reels × 3 rows** (5×3 grid).
- Each reel contains a mix of **high** and **low** symbols:

| Symbol   | Color     | Role |
|----------|-----------|------|
| **WILD** | Gold      | Substitutes for any standard symbol |
| **SCATTER** | Blue   | Triggers Free Games feature |
| **ORB**  | Red       | Triggers Hold & Spin feature |
| **A, K, Q, J, T** | White/Grey tones | Standard low symbols |
| **Lantern, Coins, Cowboy** | Themed symbols | Standard high symbols |

---

## 💰 Ways to Win

- The game uses a **“243 Ways”** system (not fixed paylines).  
- A win occurs when **3 or more matching symbols** appear **left-to-right on consecutive reels**, starting from Reel 1.  
- **WILD** symbols can substitute to complete a winning way.  
- Multiple ways of the same symbol in a spin are added together.

Example:  
- `K K K` across reels 1–3 in any row positions = a win.  
- `K + WILD + K` across reels 1–3 = also a win.

---

## ⭐ Features

### Free Games (Triggered by SCATTER)
- **3+ SCATTER** symbols anywhere trigger Free Games.  
- A set number of free spins are awarded.  
- During Free Games, reels spin without deducting credits, but wins still add to your balance.

### Hold & Spin (Triggered by ORB)
- **6+ ORB** symbols in view trigger Hold & Spin.  
- ORBs lock in place and award 3 respins.  
- Each new ORB resets the respin counter.  
- The feature ends when spins run out or the grid fills.  
- Payout is the sum of all ORB values collected.

### Progressive Jackpots
- Certain special symbols contribute to progressive meters:  
  - **Mini, Minor, Maxi, Major, Grand**.  
- When triggered, the corresponding jackpot is awarded and the meter resets.

---

## 📊 Progressive Meters

At the bottom of the HUD, you’ll see jackpot values:
- **Mini** (lowest tier)
- **Minor**
- **Maxi**
- **Major**
- **Grand** (top prize)

Progressive values increase slightly with each bet placed.  
When a jackpot is won, its value resets to the seed amount.

---

## 🏆 Scoring & Payouts

- **Line Wins**: Sum of all valid ways wins from standard symbols.  
- **Feature Wins**: Added immediately to your balance at the end of Free Games or Hold & Spin.  
- **Jackpots**: Paid immediately when triggered.  
- **Total Win**: All line + feature + jackpot wins combined, displayed after each spin.

---

## ℹ️ Notes

- This is a **demo / learning project**, not a real money game.  
- The math model, features, and art are subject to change as the project evolves.  
- Use **Sim 1k** if you want to quickly test probabilities and payouts.
