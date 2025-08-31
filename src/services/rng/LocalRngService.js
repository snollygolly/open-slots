import { mulberry32 } from "../../core/utils.js";
export class LocalRngService {
	constructor(seed) { this.rng = mulberry32(seed); }
	random() { return this.rng(); }
	int(max) { return Math.floor(this.random() * max); }
}
