import { Application } from "pixi.js";
import { GameEngine } from "./runtime/engine.js";
import { PixiRenderer } from "./runtime/renderer.js";
import { defaultConfig } from "./runtime/config.js";

const app = new Application();
const mount = document.getElementById("game");
await app.init({ background: "#06101c", width: 1280, height: 720, antialias: true });
mount.appendChild(app.canvas);

const engine = new GameEngine(defaultConfig);
const renderer = new PixiRenderer(app, engine);
renderer.renderMatrix(engine.math.spinReels());


const $credit = document.getElementById("credit");
const $bet = document.getElementById("bet");
const $spin = document.getElementById("spin");
const $auto = document.getElementById("autoplay");
const $sim = document.getElementById("sim1000");
const $last = document.getElementById("lastWin");
const $meters = document.getElementById("meters");
const $status = document.getElementById("status");
const $winlog = document.getElementById("winlog");

const updateMeters = () => {
	$meters.innerHTML = "";
	engine.progressives.order.forEach((id) => {
		const el = document.createElement("div");
		el.className = "meter";
		el.textContent = `${engine.progressives.meta[id].label}: $${engine.progressives.balances[id].toFixed(2)}`;
		$meters.appendChild(el);
	});
};

const format = (n) => n.toLocaleString("en-US");
const refresh = () => {
	$credit.textContent = format(engine.credits);
	$bet.textContent = format(engine.bet);
	$last.textContent = format(engine.lastWin);
	updateMeters();
};

engine.on("balance", refresh);
engine.on("progressives", updateMeters);
engine.on("status", (msg) => { $status.textContent = msg; });

const appendWinLog = (result) => {
	if (!result?.evaln?.waysDetail?.length) { return; }
	for (let i = 0; i < result.evaln.waysDetail.length; i += 1) {
		const w = result.evaln.waysDetail[i];
		const row = document.createElement("div");
		row.className = "line";
		const left = document.createElement("div");
		left.textContent = `${w.sym} × ${w.count}`;
		const right = document.createElement("div");
		right.className = "amt";
		right.textContent = `+${format(w.award)}`;
		row.appendChild(left);
		row.appendChild(right);
		$winlog.prepend(row);
	}
	// keep last ~20 lines
	while ($winlog.children.length > 20) { $winlog.removeChild($winlog.lastChild); }
};

$spin.onclick = async() => {
	if (engine.spinning) { return; }
	const result = await renderer.playSpin();
	renderer.showWins(result);
	appendWinLog(result);
	refresh();
};

let auto = false;
$auto.onclick = async() => {
	auto = !auto;
	$auto.textContent = auto ? "AUTO: ON" : "AUTO";
	while (auto) {
		if (engine.credits < engine.bet) { auto = false; break; }
		// eslint-disable-next-line no-await-in-loop
		const result = await renderer.playSpin();
		// eslint-disable-next-line no-await-in-loop
		renderer.showWins(result);
		appendWinLog(result);
		refresh();
	}
	$auto.textContent = "AUTO";
};

$sim.onclick = async() => {
	const summary = await engine.simulate(1000);
	$last.textContent = `Sim RTP ${(summary.rtp * 100).toFixed(2)}% Hit ${(summary.hitRate * 100).toFixed(1)}%`;
};

refresh();
