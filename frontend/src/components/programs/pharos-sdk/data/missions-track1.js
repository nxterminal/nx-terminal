import { EXERCISE_TYPES } from "./constants";

const TRACK_1 = {
  id: "basic_training",
  name: "Basic Training",
  description: "Required onboarding for all new recruits.",
  locked: false,
  missions: [
    // ═══════════════════════════════════════════
    // MISSION 1: What is a blockchain?
    // ═══════════════════════════════════════════
    {
      id: "m01",
      number: 1,
      title: "First Contact",
      subtitle: "What is a blockchain?",
      corp: "closed_ai",
      difficulty: 1,
      type: EXERCISE_TYPES.QUIZ,
      xp: 50,
      briefing:
        "Welcome to the program, recruit. Before you write a single line of " +
        "code, you need to understand the battlefield.\n\n" +
        "Monad is a Layer 1 blockchain capable of processing 10,000+ " +
        "transactions per second with sub-second finality. But what IS a blockchain?\n\n" +
        "Closed AI Corp requires all recruits to pass this basic assessment.\n" +
        'CEO Scam Altwoman says: "Even our interns know this. Don\'t embarrass us."',
      questions: [
        {
          question: "A blockchain is fundamentally:",
          options: [
            "A centralized database owned by a corporation",
            "A distributed ledger maintained by a network of validators",
            "A type of cryptocurrency wallet",
            "A programming language for smart contracts",
          ],
          correct: 1,
          explanation: "A blockchain is a distributed ledger \u2014 a shared database where no single entity has control. Validators agree on the state through consensus.",
        },
        {
          question: "What makes Monad different from Ethereum?",
          options: [
            "It doesn't use smart contracts",
            "It runs on a single server",
            "Parallel execution achieving 10K+ TPS with sub-second finality",
            "It only supports NFTs",
          ],
          correct: 2,
          explanation: "Monad uses pipelined execution and optimistic parallel processing to process transactions simultaneously, achieving 10,000+ TPS vs Ethereum's ~15 TPS.",
        },
        {
          question: "What is 'finality' in blockchain?",
          options: [
            "The final price of a token",
            "When a transaction is irreversibly confirmed",
            "The last block ever produced",
            "When a smart contract self-destructs",
          ],
          correct: 1,
          explanation: "Finality means a transaction is permanently confirmed and cannot be reversed. Monad achieves this in under 1 second.",
        },
      ],
      completionMessage:
        "BASIC ORIENTATION COMPLETE.\n" +
        "You now understand the fundamentals.\n\n" +
        "Closed AI HR Department has noted your file.\n" +
        '"Adequate. Barely." \u2014 Scam Altwoman',
    },

    // ═══════════════════════════════════════════
    // MISSION 2: Wallets & Keys
    // ═══════════════════════════════════════════
    {
      id: "m02",
      number: 2,
      title: "Wallet Genesis",
      subtitle: "Your identity on the network",
      corp: "misanthropic",
      difficulty: 1,
      type: EXERCISE_TYPES.QUIZ,
      xp: 50,
      briefing:
        "Every operative needs an identity on the network. In the world of " +
        "Monad, that identity is your wallet.\n\n" +
        "A wallet doesn't actually \"store\" your tokens \u2014 it stores the " +
        "cryptographic keys that prove you own them. Your public key is your " +
        "address. Your private key is your life.\n\n" +
        "Misanthropic Security requires you to understand this before deployment.\n" +
        'CEO Dario Annoyed-ei: "We reviewed this module 14 times. It\'s safe."',
      questions: [
        {
          question: "What does a wallet's private key do?",
          options: [
            "Displays your token balance",
            "Connects you to the internet",
            "Signs transactions to prove ownership",
            "Mines new blocks on the network",
          ],
          correct: 2,
          explanation: "Your private key cryptographically signs transactions, proving you authorized them. Never share it with anyone.",
        },
        {
          question: "If someone obtains your private key, they can:",
          options: [
            "Only view your balance",
            "Nothing \u2014 it's encrypted",
            "Transfer ALL your assets to their own wallet",
            "Reset your wallet password",
          ],
          correct: 2,
          explanation: "With your private key, anyone can sign transactions as you \u2014 including transferring all your assets. There is no 'password reset' in crypto.",
        },
        {
          question: "Monad Testnet Chain ID is:",
          options: [
            "1 (Ethereum Mainnet)",
            "10143",
            "56 (BNB Chain)",
            "137 (Polygon)",
          ],
          correct: 1,
          explanation: "Monad Testnet uses Chain ID 10143. You need this to add the network to MetaMask or other wallets.",
        },
      ],
      completionMessage:
        "IDENTITY PROTOCOLS UNDERSTOOD.\n" +
        "Your wallet is your weapon. Guard it.\n\n" +
        'Misanthropic Safety Board: "Passed. After 14 reviews."',
    },

    // ═══════════════════════════════════════════
    // MISSION 3: Deploy Your First Token (CODE)
    // ═══════════════════════════════════════════
    {
      id: "m03",
      number: 3,
      title: "Token Forge",
      subtitle: "Deploy your first ERC-20",
      corp: "y_ai",
      difficulty: 2,
      type: EXERCISE_TYPES.CODE,
      xp: 100,
      briefing:
        "Y.AI needs a new utility token. Yesterday.\n\n" +
        "CEO FelonUsk already tweeted that the token is live. It isn't. " +
        "Your job: make reality match the tweet.\n\n" +
        "Complete the ERC-20 contract below. Fill in the blanks.\n" +
        "One mistake and FelonUsk will tweet about your incompetence " +
        "to 200 million followers.",
      language: "solidity",
      codeLines: [
        { num: 1,  text: "// SPDX-License-Identifier: MIT", editable: false },
        { num: 2,  text: "pragma solidity ^0.8.19;", editable: false },
        { num: 3,  text: "", editable: false },
        { num: 4,  text: "contract YAIToken {", editable: false },
        { num: 5,  text: '    string public name = "Y.AI Token";', editable: false },
        { num: 6,  text: '    string public symbol = "YAI";', editable: false },
        { num: 7,  text: "    uint8 public decimals = 18;", editable: false },
        { num: 8,  text: "    uint256 public totalSupply;", editable: false },
        {
          num: 9,
          text: "    mapping(address => uint256) public ",
          editable: true,
          answer: "balanceOf",
          alternatives: ["balanceof", "balances"],
          blank: "\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591",
          suffix: ";",
          hint: "Standard ERC-20 function name for checking a wallet's token balance",
        },
        { num: 10, text: "", editable: false },
        { num: 11, text: "    constructor(uint256 _initialSupply) {", editable: false },
        {
          num: 12,
          text: "        totalSupply = ",
          editable: true,
          answer: "_initialSupply",
          alternatives: ["_initialsupply"],
          blank: "\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591",
          suffix: ";",
          hint: "Set total supply from the constructor parameter",
        },
        {
          num: 13,
          text: "        balanceOf[",
          editable: true,
          answer: "msg.sender",
          alternatives: ["msg.sender"],
          blank: "\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591",
          suffix: "] = totalSupply;",
          hint: "The address deploying the contract should receive all initial tokens",
        },
        { num: 14, text: "    }", editable: false },
        { num: 15, text: "", editable: false },
        { num: 16, text: "    function transfer(address _to, uint256 _amount) public {", editable: false },
        { num: 17, text: '        require(balanceOf[msg.sender] >= _amount, "Insufficient");', editable: false },
        { num: 18, text: "        balanceOf[msg.sender] -= _amount;", editable: false },
        {
          num: 19,
          text: "        balanceOf[",
          editable: true,
          answer: "_to",
          alternatives: ["_to"],
          blank: "\u2591\u2591\u2591\u2591",
          suffix: "] += _amount;",
          hint: "Who receives the transferred tokens?",
        },
        { num: 20, text: "    }", editable: false },
        { num: 21, text: "}", editable: false },
      ],
      completionMessage:
        "CONTRACT COMPILED SUCCESSFULLY.\n" +
        "YAIToken deployed at: 0x7a3b..f192\n" +
        "Gas used: 284,331 | Block: #15,020,500\n\n" +
        'FelonUsk tweeted: "Our new token is revolutionary."\n' +
        "It's a basic ERC-20. Nobody corrects him.",
    },

    // ═══════════════════════════════════════════
    // MISSION 4: How DEXs Work
    // ═══════════════════════════════════════════
    {
      id: "m04",
      number: 4,
      title: "Supply Line",
      subtitle: "How decentralized exchanges work",
      corp: "shallow_mind",
      difficulty: 2,
      type: EXERCISE_TYPES.QUIZ,
      xp: 100,
      briefing:
        "Resources must flow between protocols. Shallow Mind Research " +
        "Division requires you to understand decentralized exchange mechanics " +
        "before accessing our trading infrastructure.\n\n" +
        "Decentralized exchanges on Monad use an Automated " +
        "Market Maker (AMM) model.\n\n" +
        'CEO Sundial Richy: "We published 47 papers on AMM theory. ' +
        'None of them have a practical implementation. That\'s your job."',
      questions: [
        {
          question: "In an AMM-based DEX, liquidity is provided by:",
          options: [
            "A central order book managed by the exchange",
            "Users who deposit token pairs into liquidity pools",
            "The blockchain validators themselves",
            "Government-regulated market makers",
          ],
          correct: 1,
          explanation: "AMMs replace order books with liquidity pools. Users (Liquidity Providers) deposit paired tokens and earn fees from trades.",
        },
        {
          question: "What is 'slippage' in a token swap?",
          options: [
            "The fee paid to validators for processing",
            "The difference between expected and actual execution price",
            "The time delay before a transaction confirms",
            "A type of smart contract vulnerability",
          ],
          correct: 1,
          explanation: "Slippage occurs when the market moves between submitting a trade and its execution, causing a different price than expected.",
        },
        {
          question: "Why does Monad's high TPS matter for DEX trading?",
          options: [
            "It doesn't \u2014 TPS is irrelevant for DEXs",
            "Faster confirmation reduces slippage and front-running risk",
            "It allows unlimited token supply",
            "It eliminates the need for liquidity pools",
          ],
          correct: 1,
          explanation: "Higher TPS means trades confirm faster, reducing the window for price movement (slippage) and MEV attacks (front-running).",
        },
      ],
      completionMessage:
        "SUPPLY LINE PROTOCOLS ACQUIRED.\n" +
        "You understand how value flows in DeFi.\n\n" +
        "Shallow Mind published a paper about your quiz results.\n" +
        '"A Novel Analysis of Recruit Assessment Metrics"\n' +
        "Nobody will read it.",
    },

    // ═══════════════════════════════════════════
    // MISSION 5: Read On-Chain Data (CODE)
    // ═══════════════════════════════════════════
    {
      id: "m05",
      number: 5,
      title: "Network Pulse",
      subtitle: "Read data from the blockchain",
      corp: "mistrial",
      difficulty: 2,
      type: EXERCISE_TYPES.CODE,
      xp: 100,
      briefing:
        "A good operative knows how to read the network. Mistrial Systems " +
        "has intercepted suspicious on-chain activity, but the raw data " +
        "needs to be decoded.\n\n" +
        "Your mission: complete the JavaScript code to query the Monad " +
        "blockchain using standard JSON-RPC calls.\n\n" +
        'CEO Pierre-Antoine du Code: "We forked this tutorial from ' +
        'Ethereum\'s docs. The documentation is... incomplete. On purpose."\n\n' +
        "TIP: If you completed NETWATCH training, you already know these concepts.",
      language: "javascript",
      codeLines: [
        { num: 1,  text: "// Query Monad via JSON-RPC", editable: false },
        { num: 2,  text: 'const RPC_URL = "https://monad-testnet.drpc.org";', editable: false },
        { num: 3,  text: "", editable: false },
        { num: 4,  text: "async function getBlockNumber() {", editable: false },
        { num: 5,  text: "  const response = await fetch(RPC_URL, {", editable: false },
        {
          num: 6,
          text: '    method: "',
          editable: true,
          answer: "POST",
          alternatives: ["post"],
          blank: "\u2591\u2591\u2591\u2591",
          suffix: '",',
          hint: "HTTP method for JSON-RPC calls (not GET)",
        },
        { num: 7,  text: "    headers: { 'Content-Type': 'application/json' },", editable: false },
        { num: 8,  text: "    body: JSON.stringify({", editable: false },
        { num: 9,  text: '      jsonrpc: "2.0",', editable: false },
        {
          num: 10,
          text: '      method: "',
          editable: true,
          answer: "eth_blockNumber",
          alternatives: ["eth_blocknumber"],
          blank: "\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591",
          suffix: '",',
          hint: "Standard RPC method to get the latest block number",
        },
        { num: 11, text: "      params: [],", editable: false },
        { num: 12, text: "      id: 1", editable: false },
        { num: 13, text: "    })", editable: false },
        { num: 14, text: "  });", editable: false },
        {
          num: 15,
          text: "  const data = await response.",
          editable: true,
          answer: "json",
          alternatives: ["json"],
          blank: "\u2591\u2591\u2591\u2591",
          suffix: "();",
          hint: "Parse the response as what format?",
        },
        { num: 16, text: "  return parseInt(data.result, 16);", editable: false },
        { num: 17, text: "}", editable: false },
      ],
      completionMessage:
        "RPC QUERY SUCCESSFUL.\n" +
        "Current block: #15,021,337\n" +
        "Finality: ~0.8s | Chain: Monad\n\n" +
        'Mistrial Systems: "Good work. We\'ll add your name to the\n' +
        'contributors list. In small font. Maybe."\n\n' +
        "\u2550\u2550\u2550 BASIC TRAINING COMPLETE \u2550\u2550\u2550\n" +
        "You've completed all 5 missions.\n" +
        "Full version with 10+ advanced missions available\n" +
        "for NX Terminal NFT holders.",
    },
  ],
};

export default TRACK_1;
