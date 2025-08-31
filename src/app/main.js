import { Application } from "pixi.js";
import { defaultConfig } from "../config/defaultConfig.js";
import { ServiceRegistry } from "../core/di.js";
import { PixiGame } from "../renderer/PixiGame.js";
import { Controls } from "../ui/Controls.js";
import { GameEngine } from "../engine/GameEngine.js";
import { LocalRngService } from "../services/rng/LocalRngService.js";
import { ServerRngService } from "../services/rng/ServerRngService.js";
import { LocalWalletService } from "../services/wallet/LocalWalletService.js";
import { ServerWalletService } from "../services/wallet/ServerWalletService.js";
import { ApiClient } from "../services/api/ApiClient.js";

const app = new Application();
const mount = document.getElementById("game");
await app.init({ background: "#06101c", width: 1280, height: 720, antialias: true });
mount.appendChild(app.canvas);

const api = new ApiClient(defaultConfig.api);
const rng = defaultConfig.services.useServerRng ? new ServerRngService(api) : new LocalRngService(defaultConfig.rngSeed);
const wallet = defaultConfig.services.useServerWallet ? new ServerWalletService(api, defaultConfig) : new LocalWalletService(defaultConfig);

ServiceRegistry.register("api", api);
ServiceRegistry.register("rng", rng);
ServiceRegistry.register("wallet", wallet);
ServiceRegistry.register("config", defaultConfig);

const engine = new GameEngine(defaultConfig, rng, wallet);
const game = new PixiGame(app, engine, defaultConfig);
const controls = new Controls(engine, game);

window.engine = engine;
window.game = game;
window.controls = controls;
