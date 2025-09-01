export class Controls {
	constructor(engine, game) {
		this.engine = engine; this.game = game;
		this.$credit = document.getElementById("credit");
		this.$bet = document.getElementById("bet");
		this.$spin = document.getElementById("spin");
		this.$auto = document.getElementById("autoplay");
		this.$sim = document.getElementById("sim1000");
		this.$last = document.getElementById("lastWin");
		this.$meters = document.getElementById("meters");
		this.$status = document.getElementById("status");
		this.$winlog = document.getElementById("winlog");
		this.update();
		engine.on("balance", () => this.update());
		engine.on("progressives", () => this.updateMeters());
		engine.on("status", (msg) => { this.$status.textContent = msg; });
		this.$spin.onclick = async() => {
			if (this.engine.spinning) { return; }
			this.clearWinLog();
			const result = await this.game.spinAndRender();
			this.engine.applyWinCredits(result);
			this.game.showWins(result);
			this.appendWinLog(result);
			this.update();
		};
		let auto = false;
		this.$auto.onclick = async() => {
			auto = !auto;
			this.$auto.textContent = auto ? "AUTO: ON" : "AUTO";
			while (auto) {
				if (this.engine.credits < this.engine.bet) { auto = false; break; }
				this.clearWinLog();
				const result = await this.game.spinAndRender();
				this.engine.applyWinCredits(result);
				this.game.showWins(result);
				this.appendWinLog(result);
				this.update();
			}
			this.$auto.textContent = "AUTO";
		};
		this.$sim.onclick = async() => {
			const n = 1000; let wagered = 0; let paid = 0; let hits = 0;
			let freeGamesTriggers = 0; let totalFreeGamesPlayed = 0; let orbFeatures = 0;
			let jackpotHits = { MINI: 0, MINOR: 0, MAJOR: 0, GRAND: 0 };
			
			for (let i = 0; i < n; i += 1) {
				const r = this.game.engine.simulateSpinOnly();
				wagered += this.engine.bet; paid += r.totalWin; if (r.totalWin > 0) { hits += 1; }
				
				if (r.feature === "FREE_GAMES_TRIGGER") {
					freeGamesTriggers += 1;
					totalFreeGamesPlayed += this.engine.config.freeGames.spins;
				}
				
				if (r.feature === "HOLD_AND_SPIN") {
					orbFeatures += 1;
					if (r.hold?.jackpots) {
						Object.keys(r.hold.jackpots).forEach(jp => {
							jackpotHits[jp] = (jackpotHits[jp] || 0) + r.hold.jackpots[jp];
						});
					}
				}
			}
			
			const jpText = Object.keys(jackpotHits).filter(jp => jackpotHits[jp] > 0).map(jp => `${jp}:${jackpotHits[jp]}`).join(' ') || 'None';
			this.$last.textContent = `Sim RTP ${((paid / wagered) * 100).toFixed(2)}% Hit ${(hits / n * 100).toFixed(1)}% | FG: ${freeGamesTriggers}x (${totalFreeGamesPlayed} spins) | Orb: ${orbFeatures} | JP: ${jpText}`;
		};
		this.updateMeters();
	}
	format(n) { return n.toLocaleString("en-US"); }
	update() { this.$credit.textContent = this.format(this.engine.credits); this.$bet.textContent = this.format(this.engine.bet); this.$last.textContent = this.format(this.engine.lastWin); this.updateMeters(); }
	updateMeters() {
		this.$meters.innerHTML = "";
		const pg = this.engine.wallet.pg;
		for (let i = 0; i < pg.order.length; i += 1) {
			const id = pg.order[i];
			const el = document.createElement("div");
			el.className = "meter"; el.textContent = `${pg.meta[id].label}: $${pg.balances[id].toFixed(2)}`;
			this.$meters.appendChild(el);
		}
	}
	clearWinLog() {
		this.$winlog.innerHTML = "";
	}
	appendWinLog(result) {
		if (!result?.evaln?.waysDetail?.length) { return; }
		for (let i = 0; i < result.evaln.waysDetail.length; i += 1) {
			const w = result.evaln.waysDetail[i];
			if (w.ways && w.ways > 1) {
				const row = document.createElement("div"); row.className = "line";
				const left = document.createElement("div"); left.textContent = `(${w.ways}x) ${w.sym} × ${w.count}`;
				const right = document.createElement("div"); right.className = "amt"; right.textContent = `+${this.format(w.award)}`;
				row.appendChild(left); row.appendChild(right); this.$winlog.prepend(row);
			} else {
				const row = document.createElement("div"); row.className = "line";
				const left = document.createElement("div"); left.textContent = `${w.sym} × ${w.count}`;
				const right = document.createElement("div"); right.className = "amt"; right.textContent = `+${this.format(w.award)}`;
				row.appendChild(left); row.appendChild(right); this.$winlog.prepend(row);
			}
		}
		while (this.$winlog.children.length > 20) { this.$winlog.removeChild(this.$winlog.lastChild); }
	}
}
