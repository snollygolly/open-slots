export class LocalWalletService {
	constructor(config) {
		this.config = config;
		this.key = config.persistenceKey;
		this.credits = this.loadNumber("credits", 100000);
		this.pg = this.initMeters(config.progressives);
	}
	getCredits() { return this.credits; }
	addCredits(n) { this.credits += n; this.saveNumber("credits", this.credits); return this.credits; }
	deductCredits(n) { if (this.credits < n) { throw new Error("Insufficient credits"); } this.credits -= n; this.saveNumber("credits", this.credits); return this.credits; }
	initMeters(pg) { const balances = {}; pg.order.forEach((id) => { balances[id] = this.loadNumber(`pg_${id}`, pg.meta[id].seed); }); return { order: pg.order.slice(0), meta: pg.meta, balances }; }
	contributeToMeters(bet) {
		const cents = bet * this.config.denom;
		const toAdd = cents * this.config.progressives.contributionRate;
		const each = toAdd / this.pg.order.length;
		for (let i = 0; i < this.pg.order.length; i += 1) {
			const id = this.pg.order[i];
			this.pg.balances[id] += each;
			this.saveNumber(`pg_${id}`, this.pg.balances[id]);
		}
		return this.pg;
	}
	takeJackpot(id) {
		const bal = this.pg.balances[id];
		this.pg.balances[id] = this.config.progressives.meta[id].seed;
		this.saveNumber(`pg_${id}`, this.pg.balances[id]);
		return Math.round(bal / this.config.denom);
	}
	saveNumber(key, value) {
		try { const raw = localStorage.getItem(this.key); const json = raw ? JSON.parse(raw) : {}; json[key] = value; localStorage.setItem(this.key, JSON.stringify(json)); } catch {}
	}
	loadNumber(key, fallback) {
		try { const raw = localStorage.getItem(this.key); if (!raw) { return fallback; } const json = JSON.parse(raw); return typeof json[key] === "number" ? json[key] : fallback; } catch { return fallback; }
	}
}
