export const MONAD_PATH = {
  id: "monad",
  name: "Blockchain Builder",
  icon: "{ }",
  description: "Build on Pharos. Smart contracts, parallel execution, and dApps.",
  modules: [
    {
      id: "mm1", title: "Monad Fundamentals", corp: "mistrial",
      lessons: [
        {
          id: "ml1", type: "concept", title: "What is Monad?",
          steps: [
            {
              title: "A new kind of blockchain",
              blocks: [
                { type: "text", content: "Monad is a Layer 1 blockchain that is fully compatible with Ethereum but dramatically faster. If you know Ethereum, you already know how to build on Monad." },
                { type: "highlight", content: "Think of Monad as Ethereum with a turbo engine — same language, same tools, 1000x more speed." },
              ],
            },
            {
              title: "The numbers",
              blocks: [
                { type: "list", items: [
                  "10,000+ transactions per second (Ethereum does ~15)",
                  "1-second block times (Ethereum: ~12 seconds)",
                  "Full EVM compatibility — deploy your existing Solidity code unchanged",
                  "Same tooling: Hardhat, Foundry, viem, wagmi all work",
                ] },
              ],
            },
            {
              title: "Why is it so fast?",
              blocks: [
                { type: "text", content: "Monad achieves speed through two key innovations:" },
                { type: "code", label: "Traditional blockchain (sequential)", content: "TX1 -> TX2 -> TX3 -> TX4  (one at a time)" },
                { type: "code", label: "Monad (parallel execution)", content: "TX1 --|\nTX2 --|-> All at once!\nTX3 --|" },
                { type: "text", content: "Instead of processing transactions one by one, Monad processes many simultaneously. If two transactions don't affect the same data, there's no reason to wait." },
              ],
            },
          ],
          question: "What makes Monad different from standard EVM chains?",
          options: ["It uses a different programming language", "It processes transactions in parallel", "It doesn't support smart contracts", "It requires special hardware"],
          correct: 1, xp: 10,
          explanation: "Monad's core innovation is parallel transaction execution — processing multiple transactions simultaneously instead of one at a time.",
        },
        {
          id: "ml2", type: "concept", title: "Monad Architecture",
          steps: [
            {
              title: "Pipelined execution",
              blocks: [
                { type: "text", content: "Traditional blockchains process each block in a single step. Monad breaks processing into stages that overlap, like an assembly line:" },
                { type: "code", label: "Pipeline stages", content: "Block N:   [Execute] [Verify] [Commit]\nBlock N+1:          [Execute] [Verify] [Commit]\nBlock N+2:                   [Execute] [Verify] [Commit]" },
                { type: "text", content: "While Block N is being verified, Block N+1 is already executing. This overlap dramatically increases throughput." },
              ],
            },
            {
              title: "Optimistic parallel execution",
              blocks: [
                { type: "text", content: "Monad assumes transactions don't conflict and runs them in parallel. If a conflict is detected (two transactions modifying the same state), the affected transaction is re-executed:" },
                { type: "code", content: "TX1: Transfer A -> B    \\ \nTX2: Transfer C -> D     } No conflict = parallel OK\nTX3: Transfer A -> E    /  Conflict with TX1 = re-execute" },
                { type: "highlight", content: "In practice, most transactions don't conflict, so parallel execution yields huge speedups." },
              ],
            },
            {
              title: "MonadDb — the state store",
              blocks: [
                { type: "text", content: "Monad uses a custom database (MonadDb) optimized for blockchain workloads:" },
                { type: "list", items: [
                  "Asynchronous I/O — doesn't block while reading/writing",
                  "SSD-optimized storage — takes advantage of modern hardware",
                  "Efficient state access — faster reads mean faster execution",
                ] },
              ],
            },
          ],
          question: "What happens when parallel transactions conflict in Monad?",
          options: ["The chain halts", "Both transactions fail", "Affected transactions are re-executed", "Users must resubmit"],
          correct: 2, xp: 10,
          explanation: "Monad detects conflicts automatically and re-executes only the affected transactions. Users don't need to do anything.",
        },
        {
          id: "ml2b", type: "fill-blank", title: "Pharos Config",
          prompt: "Fill in the blanks for a Pharos testnet configuration:",
          code: 'const config = {\n  chainName: ___,\n  chainId: ___,\n  rpcUrl: ___,\n};',
          blanks: [
            { answer: '"Pharos Atlantic Testnet"', placeholder: 'chain name', explanation: "The chain name is a string describing the network" },
            { answer: "688689", placeholder: 'number', explanation: "Pharos testnet uses chain ID 688689" },
            { answer: '"https://atlantic.dplabs-internal.com"', placeholder: 'RPC URL', explanation: "The RPC URL is the endpoint your app uses to talk to the blockchain" },
          ],
          xp: 10,
        },
        {
          id: "ml3", type: "code", title: "Connect to Pharos",
          prompt: "Write code to create a JSON-RPC provider URL variable pointing to 'https://atlantic.dplabs-internal.com' and a chainId variable set to 688689",
          starter: "// Set up Pharos testnet config\n",
          solution: 'const rpcUrl = "https://atlantic.dplabs-internal.com";\nconst chainId = 688689;',
          hint: "Use const to declare the RPC URL string and chain ID number", xp: 15,
        },
      ],
    },
    {
      id: "mm2", title: "Solidity on Monad", corp: "closedai",
      lessons: [
        {
          id: "ml4", type: "concept", title: "Smart Contract Basics",
          steps: [
            {
              title: "What is a smart contract?",
              blocks: [
                { type: "text", content: "A smart contract is a program that lives on the blockchain. Once deployed, it runs exactly as programmed — no one can change it or shut it down." },
                { type: "highlight", content: "Think of it like a vending machine: you put money in, follow the rules, and get a guaranteed result. No middleman needed." },
              ],
            },
            {
              title: "Solidity — the language",
              blocks: [
                { type: "text", content: "Smart contracts are written in Solidity. It looks similar to JavaScript but with some key differences:" },
                { type: "code", label: "A simple contract", content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract DevRegistry {\n    mapping(address => string) public devNames;\n    uint256 public totalDevs;\n\n    function register(string memory name) external {\n        devNames[msg.sender] = name;\n        totalDevs++;\n    }\n}' },
                { type: "list", items: [
                  "'pragma' sets the compiler version",
                  "'contract' is like 'class' — defines a new contract",
                  "'mapping' is like a dictionary/hashtable",
                  "'msg.sender' is the address of whoever called the function",
                  "'external' means it can be called from outside the contract",
                ] },
              ],
            },
            {
              title: "Same Solidity, faster execution",
              blocks: [
                { type: "text", content: "The best part about Monad: your existing Solidity knowledge transfers directly. The exact same contract deployed on Monad just runs faster." },
                { type: "code", content: '// This contract works on BOTH Ethereum and Monad\n// Zero changes needed!\ncontract MyToken {\n    mapping(address => uint256) public balances;\n\n    function transfer(address to, uint256 amount) external {\n        balances[msg.sender] -= amount;\n        balances[to] += amount;\n    }\n}' },
              ],
            },
          ],
          question: "Can you deploy existing Ethereum Solidity contracts on Monad?",
          options: ["No, Monad uses a different language", "Yes, Monad is fully EVM compatible", "Only with major modifications", "Only simple contracts"],
          correct: 1, xp: 10,
          explanation: "Monad is fully EVM compatible. Any valid Solidity contract that works on Ethereum works on Monad without changes.",
        },
        {
          id: "ml4b", type: "reorder", title: "Contract Structure",
          prompt: "Arrange these lines into a valid Solidity contract that stores a counter:",
          lines: [
            '}',
            '    counter++;',
            'contract Counter {',
            '    uint256 public counter;',
            '    function increment() external {',
            '    }',
          ],
          correctOrder: [
            'contract Counter {',
            '    uint256 public counter;',
            '    function increment() external {',
            '    counter++;',
            '    }',
            '}',
          ],
          explanation: "A contract starts with 'contract Name {', then state variables, then functions, and closes with '}'.",
          xp: 10,
        },
        {
          id: "ml5", type: "code", title: "Write a Monad Contract",
          prompt: "Write a Solidity function called 'mintNFT' that takes an address 'to' and uint256 'tokenId', increments a 'totalMinted' counter, and emits a 'Minted(address, uint256)' event",
          starter: "// Inside your contract\nuint256 public totalMinted;\nevent Minted(address indexed to, uint256 tokenId);\n\n",
          solution: "uint256 public totalMinted;\nevent Minted(address indexed to, uint256 tokenId);\n\nfunction mintNFT(address to, uint256 tokenId) external {\n    totalMinted++;\n    emit Minted(to, tokenId);\n}",
          hint: "Define the function with external visibility, increment the counter, and use emit for the event", xp: 20,
        },
        {
          id: "ml5b", type: "fix-bug", title: "Fix the Contract",
          prompt: "This Solidity function should transfer tokens from the sender to a recipient, but it has a bug that lets anyone drain tokens. Find and fix it.",
          errorOutput: "Anyone can transfer tokens from any address",
          buggyCode: 'function transfer(address from, address to, uint256 amount) external {\n    balances[from] -= amount;\n    balances[to] += amount;\n}',
          solution: 'function transfer(address to, uint256 amount) external {\n    balances[msg.sender] -= amount;\n    balances[to] += amount;\n}',
          fixChecks: [
            { mustContain: "msg.sender", errorMsg: "The function lets anyone specify the 'from' address. Use msg.sender to ensure only the caller's tokens are transferred." },
          ],
          hints: [
            "Who should be allowed to move tokens? Only the token owner, not anyone.",
            "Instead of accepting a 'from' parameter, use msg.sender to always deduct from the caller's balance.",
          ],
          xp: 15,
        },
        {
          id: "ml6", type: "concept", title: "Gas Optimization",
          steps: [
            {
              title: "Gas still matters on Monad",
              blocks: [
                { type: "text", content: "Even though Monad is fast, every operation costs gas. Optimized code = cheaper transactions for your users." },
              ],
            },
            {
              title: "Storage vs Memory",
              blocks: [
                { type: "text", content: "The biggest optimization: minimize storage reads inside loops." },
                { type: "code", label: "Expensive: storage read every iteration", content: '// BAD — reads storage each loop\nfor (uint i = 0; i < items.length; i++) {\n    total += prices[i]; // storage read!\n}' },
                { type: "code", label: "Cheaper: cache in memory first", content: '// GOOD — one storage read, then memory\nuint256[] memory cached = prices;\nfor (uint i = 0; i < cached.length; i++) {\n    total += cached[i]; // memory read\n}' },
              ],
            },
            {
              title: "Parallel-friendly code",
              blocks: [
                { type: "text", content: "Monad's parallel execution gives a bonus to well-structured contracts:" },
                { type: "highlight", content: "Contracts that minimize shared state modifications benefit most from parallel execution. If two function calls don't touch the same storage slot, Monad can run them simultaneously." },
                { type: "list", items: [
                  "Use separate storage slots for independent data",
                  "Avoid writing to global counters in hot paths",
                  "Batch updates when possible instead of many small writes",
                ] },
              ],
            },
          ],
          question: "Why should you minimize storage reads in loops?",
          options: ["Storage reads are slow and expensive", "Loops don't work with storage", "Monad doesn't support storage", "It makes code harder to read"],
          correct: 0, xp: 15,
          explanation: "Storage lives on disk and costs gas to read. Memory is cheaper and faster. Cache storage values in memory before looping.",
        },
      ],
    },
    {
      id: "mm3", title: "Building dApps", corp: "zucklabs",
      lessons: [
        {
          id: "ml7", type: "concept", title: "dApp Architecture",
          steps: [
            {
              title: "Three layers of a dApp",
              blocks: [
                { type: "text", content: "A decentralized app (dApp) on Monad has three layers that work together:" },
                { type: "code", label: "dApp architecture", content: 'Frontend (React)\n  |-- Wallet Connect (MetaMask, etc.)\n  |-- UI Components\n  |-- State Management\n       |\n  Blockchain Bridge (viem / wagmi)\n       |\n  Smart Contracts (On Monad Chain)\n  |-- Your on-chain logic\n  |-- Permanent, trustless execution' },
              ],
            },
            {
              title: "Standard EVM tools",
              blocks: [
                { type: "text", content: "Because Monad is EVM-compatible, you use the exact same frontend libraries as Ethereum:" },
                { type: "list", items: [
                  "viem — lightweight library for reading/writing blockchain data",
                  "wagmi — React hooks for wallet connection and contract interaction",
                  "ethers.js — popular alternative to viem",
                  "No special Monad SDK needed!",
                ] },
                { type: "highlight", content: "If you've built an Ethereum dApp, building on Monad requires zero new tools. Just point your RPC URL to Monad." },
              ],
            },
            {
              title: "The flow",
              blocks: [
                { type: "text", content: "Here's how a typical dApp interaction works:" },
                { type: "code", content: '1. User clicks "Mint NFT" button\n2. Frontend calls contract via wagmi hook\n3. Wallet pops up for signature\n4. Transaction sent to Monad RPC\n5. Monad executes in ~1 second\n6. Frontend updates with result' },
                { type: "text", content: "On Ethereum, step 5 takes 12+ seconds. On Monad, it's nearly instant." },
              ],
            },
          ],
          question: "What library connects your frontend to Monad?",
          options: ["monad-sdk (custom library)", "Standard EVM libraries like viem or wagmi", "web3-monad (special fork)", "You can't build frontends for Monad"],
          correct: 1, xp: 10,
          explanation: "Monad uses standard EVM libraries. viem, wagmi, and ethers.js all work out of the box.",
        },
        {
          id: "ml7b", type: "fill-blank", title: "Wallet Connection",
          prompt: "Complete the code to set up a wallet connection to Monad:",
          code: 'import { createPublicClient, ___ } from "viem";\n\nconst client = createPublicClient({\n  chain: monadTestnet,\n  transport: ___(___),\n});',
          blanks: [
            { answer: "http", placeholder: "transport type", explanation: "viem uses 'http' transport for JSON-RPC connections" },
            { answer: "http", placeholder: "function", explanation: "The http function creates an HTTP transport" },
            { answer: '"https://monad-testnet.drpc.org"', placeholder: "RPC URL", explanation: "Pass the Monad RPC URL to the transport" },
          ],
          xp: 10,
        },
        {
          id: "ml8", type: "code", title: "Read Contract Data",
          prompt: "Write a JavaScript async function called 'getDevCount' that fetches data from an API endpoint '/api/contract/totalDevs' and returns the parsed JSON result",
          starter: "// Read from contract via API\n",
          solution: "async function getDevCount() {\n  const response = await fetch('/api/contract/totalDevs');\n  const data = await response.json();\n  return data;\n}",
          hint: "Use async/await with fetch() and response.json()", xp: 20,
        },
        {
          id: "ml8b", type: "reorder", title: "dApp Flow",
          prompt: "Put these dApp interaction steps in the correct order:",
          lines: [
            "Smart contract executes on Monad",
            "User clicks action button in the UI",
            "Frontend updates with transaction result",
            "Wallet prompts user to sign transaction",
            "Frontend sends call via wagmi/viem",
          ],
          correctOrder: [
            "User clicks action button in the UI",
            "Frontend sends call via wagmi/viem",
            "Wallet prompts user to sign transaction",
            "Smart contract executes on Monad",
            "Frontend updates with transaction result",
          ],
          explanation: "User action -> frontend prepares call -> wallet signs -> blockchain executes -> UI updates. This is the standard dApp interaction flow.",
          xp: 10,
        },
        {
          id: "ml9", type: "code", title: "Build a Mint Button",
          prompt: "Write an async function called 'handleMint' that calls fetch with POST method to '/api/mint' with a JSON body containing { tokenId: 1 }, then parses and returns the JSON response",
          starter: "// Mint function\n",
          solution: 'async function handleMint() {\n  const response = await fetch("/api/mint", {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({ tokenId: 1 }),\n  });\n  const data = await response.json();\n  return data;\n}',
          hint: "Use fetch with { method: 'POST', headers, body: JSON.stringify(...) } and await response.json()", xp: 20,
        },
      ],
    },
  ],
};
