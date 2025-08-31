export class ApiClient {
	constructor(cfg) { this.baseUrl = cfg.baseUrl; }
	async getJson(path) {
		const res = await fetch(`${this.baseUrl}${path}`);
		if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
		return res.json();
	}
	async postJson(path, body) {
		const res = await fetch(`${this.baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
		if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
		return res.json();
	}
}
