export class ServerRngService {
	constructor(api) { this.api = api; }
	async randomBatch(n) { const res = await this.api.postJson("/rng", { n }); return res.values; }
	random() { throw new Error("random() not available; use randomBatch via engine path"); }
	int() { throw new Error("int() not available in server mode"); }
}
