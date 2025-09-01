export const defaultConfig = {
	grid: { reels: 5, rows: 3, ways: 243 },
	bet: 100,
	denom: 0.01,
	rngSeed: 1337,
	persistenceKey: "slot-modular-save-v1",
	api: { baseUrl: "http://localhost:8787" },
	services: { useServerRng: false, useServerWallet: false },
	symbols: {
		WILD: "WILD",
		SCATTER: "SCATTER",
		ORB: "ORB",
		P1: "LANTERN",
		P2: "COINS",
		P3: "COWBOY",
		A: "A",
		K: "K",
		Q: "Q",
		J: "J",
		T: "T"
	},
	payTable: {
		LANTERN: [0, 0, 40, 120, 400],
		COINS: [0, 0, 35, 100, 300],
		COWBOY: [0, 0, 30, 90, 250],
		A: [0, 0, 20, 60, 150],
		K: [0, 0, 20, 60, 150],
		Q: [0, 0, 15, 50, 120],
		J: [0, 0, 15, 50, 120],
		T: [0, 0, 10, 40, 100]
	},
	reelStrips: [
		["A","Q","WILD","P1","K","ORB","A","ORB","Q","P2","J","ORB","P3","A","K","SCATTER","Q","ORB","ORB","K","T","Q","P2","J","A","K","T"],
		["Q","K","ORB","P1","A","Q","WILD","P3","K","ORB","ORB","A","SCATTER","Q","K","ORB","A","T","Q","ORB","P2","J","A","T","Q"],
		["K","ORB","A","Q","WILD","P2","K","ORB","A","Q","T","SCATTER","K","A","ORB","Q","ORB","P3","K","ORB","Q","J","T","K"],
		["ORB","A","Q","K","WILD","P1","ORB","A","Q","K","P2","SCATTER","J","ORB","Q","K","T","ORB","J","A","ORB","K","T","J"],
		["A","ORB","K","J","WILD","P3","A","ORB","K","J","SCATTER","T","A","ORB","K","J","ORB","P1","A","Q","ORB","J","T","A"]
	],
	holdAndSpin: {
		triggerCount: 6,
		respins: 3,
		fullGridWinsGrand: true,
		creditValues: [50, 100, 150, 200, 250, 500, 1000, 2500],
		creditWeights: [30, 30, 20, 15, 10, 7, 4, 1],
		jackpotWeights: { MINI: 6, MINOR: 3, MAXI: 1, MAJOR: 0.5 },
		jackpotChancesPerOrb: 0.08
	},
	freeGames: {
		triggerScatters: 3,
		spins: 8,
		retrigger: 5,
		multiplier: 2,
		extraWildChance: 0.15
	},
	progressives: {
		order: ["MINI","MINOR","MAXI","MAJOR","GRAND"],
		meta: {
			MINI: { label: "Mini", seed: 15 },
			MINOR: { label: "Minor", seed: 30 },
			MAXI: { label: "Maxi", seed: 523.14 },
			MAJOR: { label: "Major", seed: 1562.53 },
			GRAND: { label: "Grand", seed: 8104.77 }
		},
		contributionRate: 0.005
	}
};
