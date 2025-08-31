import { GameEngine } from "../runtime/engine.js";
import { defaultConfig } from "../runtime/config.js";

const engine = new GameEngine(defaultConfig);

const N = 100000;
let wagered = 0;
let paid = 0;
let hits = 0;

for (let i = 0; i < N; i += 1) {
	const r = await engine.spinOnce();
	wagered += engine.bet;
	paid += r.totalWin;
	if (r.totalWin > 0) { hits += 1; }
}

const rtp = paid / wagered;
const hit = hits / N;
console.log(JSON.stringify({ spins: N, rtp, hit }, null, 2));
