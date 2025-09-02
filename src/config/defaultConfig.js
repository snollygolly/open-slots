export const defaultConfig = {
	grid: { reels: 5, rows: 3, ways: 243 },
	bet: 100,
	denom: 0.01,
	rngSeed: 1337,
	persistenceKey: "slot-modular-save-v1",
	symbols: {
		WILD: "WILD",
		SCATTER: "SCATTER",
		ORB: "ORB",
		P1: "LANTERN",
		P2: "FROG",
		P3: "GATOR",
		P4: "LILY",
		A: "A",
		K: "K",
		Q: "Q",
		J: "J",
		T: "T"
	},
	paytable: {
		LANTERN: [0, 0, 40, 120, 400],
		LILY: [0, 0, 40, 120, 400],
		FROG: [0, 0, 35, 100, 300],
		GATOR: [0, 0, 30, 90, 250],
		A: [0, 0, 20, 60, 150],
		K: [0, 0, 20, 60, 150],
		Q: [0, 0, 15, 50, 120],
		J: [0, 0, 15, 50, 120],
		T: [0, 0, 10, 40, 100]
	},
	reels: [
		["A","Q","WILD","LANTERN","LILY","K","J","A","ORB","Q","FROG","J","T","GATOR","A","ORB","SCATTER","Q","J","A","K","T","Q","FROG","ORB","A","K","T"],
		["Q","K","J","LANTERN","LILY","A","Q","WILD","GATOR","K","J","ORB","A","SCATTER","Q","K","J","A","T","Q","ORB","FROG","J","A","T","ORB","Q"],
		["K","J","A","Q","WILD","LILY","FROG","K","J","ORB","Q","T","SCATTER","K","A","Q","J","GATOR","K","A","ORB","J","T","ORB","K"],
		// Reduce ORB density on reel 4 by 1
		["J","A","Q","K","WILD","LANTERN","J","Q","K","FROG","SCATTER","J","A","Q","K","T","ORB","J","A","K","ORB","T","J"],
		// Slightly reduce ORB density on the last reel (remove one ORB)
		["A","Q","K","J","WILD","GATOR","A","ORB","K","J","SCATTER","T","A","Q","K","J","LANTERN","LILY","A","K","J","ORB","T","A"]
	],
	holdAndSpin: {
		triggerCount: 5,
		respins: 3,
		fullGridWinsGrand: true,
		creditValues: [50, 100, 150, 200, 250, 500, 1000, 2500],
		creditWeights: [30, 30, 20, 15, 10, 7, 4, 1],
		jackpotWeights: { MINI: 6, MINOR: 3, MAXI: 1, MAJOR: 0.5 },
		// Reduce jackpots showing on orbs (does not affect GRAND)
		jackpotChancesPerOrb: 0.05
	},
	freeGames: {
		triggerScatters: 3,
		spins: 8,
		retrigger: 5,
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
