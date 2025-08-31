export class ServerWalletService {
	constructor(api, config) { this.api = api; this.config = config; }
	async getCredits() { const j = await this.api.getJson("/wallet"); return j.credits; }
	async addCredits(n) { const j = await this.api.postJson("/wallet/add", { n }); return j.credits; }
	async deductCredits(n) { const j = await this.api.postJson("/wallet/spend", { n }); return j.credits; }
	async contributeToMeters(bet) { const j = await this.api.postJson("/meters/contribute", { bet }); return j.progressives; }
	async takeJackpot(id) { const j = await this.api.postJson("/meters/take", { id }); return j.payoutCredits; }
}
