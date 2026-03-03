const TRACK_2 = {
  id: "corporate_warfare",
  name: "Corporate Warfare",
  description: "Advanced training. Requires NX Terminal NFT.",
  locked: true,
  lockMessage: "REQUIRES MINT \u2014 Available for NX Terminal holders",
  missions: [
    { id: "m06", number: 6,  title: "Smart Arsenal",      subtitle: "Write a contract from scratch",   corp: "y_ai",        difficulty: 3 },
    { id: "m07", number: 7,  title: "Liquidity Siege",     subtitle: "Provide AMM liquidity",          corp: "closed_ai",    difficulty: 3 },
    { id: "m08", number: 8,  title: "Vault Infiltration",  subtitle: "Interact with lending protocols", corp: "shallow_mind", difficulty: 3 },
    { id: "m09", number: 9,  title: "Bug Bounty",          subtitle: "Find the vulnerability",          corp: "misanthropic", difficulty: 4 },
    { id: "m10", number: 10, title: "The Parallel Path",   subtitle: "Pharos execution model",          corp: "mistrial",     difficulty: 4 },
    { id: "m11", number: 11, title: "RWA Protocol",        subtitle: "Tokenize a real-world asset",     corp: "closed_ai",    difficulty: 3 },
    { id: "m12", number: 12, title: "Gas Optimizer",       subtitle: "Optimize contract gas usage",     corp: "misanthropic", difficulty: 4 },
    { id: "m13", number: 13, title: "Cross-Corp Sabotage", subtitle: "Capture The Flag challenge",      corp: "zuck_labs",    difficulty: 4 },
    { id: "m14", number: 14, title: "SPN Architect",       subtitle: "Design a Special Processing Net", corp: "shallow_mind", difficulty: 4 },
    { id: "m15", number: 15, title: "Protocol Veteran",    subtitle: "Final combined challenge",         corp: "y_ai",        difficulty: 4 },
  ],
};

export default TRACK_2;
