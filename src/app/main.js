import { Application } from "pixi.js";
import { defaultConfig } from "../config/defaultConfig.js";
import { ServiceRegistry } from "../core/di.js";
import { PixiGame } from "../renderer/PixiGame.js";
import { Controls } from "../ui/Controls.js";
import { GameEngine } from "../engine/GameEngine.js";
import { LocalRngService } from "../services/rng/LocalRngService.js";
import { LocalWalletService } from "../services/wallet/LocalWalletService.js";

(async () => {
	try {
		const app = new Application();
		const mount = document.getElementById("game");

		await app.init({
			background: "#06101c",
			width: 1280,
			height: 720,
			antialias: true,
			preference: "webgl"
		});

		if (mount) {
			mount.appendChild(app.canvas);
		}

		const rng = new LocalRngService(defaultConfig.rngSeed);
		const wallet = new LocalWalletService(defaultConfig);

		ServiceRegistry.register("rng", rng);
		ServiceRegistry.register("wallet", wallet);
		ServiceRegistry.register("config", defaultConfig);

		const engine = new GameEngine(defaultConfig, rng, wallet);
		const game = new PixiGame(app, engine, defaultConfig);
		// eslint-disable-next-line no-new
		new Controls(engine, game);

		// Handy for quick debugging in the console
		window.app = app;
		window.engine = engine;
		window.game = game;
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error("[main] init error:", err);
		const status = document.getElementById("status");
		if (status) {
			status.textContent = `Init error: ${err?.message || err}`;
		}
	}
})();
