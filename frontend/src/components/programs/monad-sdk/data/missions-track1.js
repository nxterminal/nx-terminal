import { EXERCISE_TYPES } from './constants';

const TRACK_1 = {
  id: 'monad_fundamentals',
  name: 'Monad Fundamentals',
  description: 'Core training for Monad blockchain development.',
  locked: false,
  missions: [
    // ═══════════════════════════════════════════
    // MISSION 1: Gas Mechanics on Monad
    // ═══════════════════════════════════════════
    {
      id: 'm01',
      number: 1,
      title: 'Gas Trap',
      subtitle: 'Understanding gas on Monad',
      corp: 'closed_ai',
      difficulty: 1,
      type: EXERCISE_TYPES.QUIZ,
      xp: 50,
      briefing:
        'Every transaction on Monad consumes gas \u2014 computational fuel that ' +
        'keeps the network running.\n\n' +
        'But Monad isn\'t like other chains. With 400ms block times and parallel ' +
        'execution, gas dynamics work differently here. You need to understand ' +
        'the fundamentals before writing a single line of code.\n\n' +
        'Closed AI Corp requires all recruits to pass this assessment.\n' +
        'CEO Scam Altwoman says: "Gas optimization is our competitive advantage. ' +
        'Don\'t waste it."',
      questions: [
        {
          question: 'What is "gas" in the context of Monad?',
          options: [
            'A cryptocurrency token you can trade on exchanges',
            'A unit measuring the computational work needed to execute transactions',
            'The electricity cost of running a validator node',
            'A type of smart contract programming language',
          ],
          correct: 1,
          explanation: 'Gas measures computational effort. Every operation (transfer, contract call, storage write) costs a specific amount of gas. Users pay gas fees in MON to compensate validators.',
        },
        {
          question: 'On Monad, what token is used to pay gas fees?',
          options: [
            'ETH \u2014 Monad uses Ethereum\'s native token',
            'USDC \u2014 a stablecoin for predictable fees',
            'MON \u2014 the native token of Monad',
            'Gas tokens are not needed on Monad',
          ],
          correct: 2,
          explanation: 'MON is Monad\'s native token, used to pay for gas fees just like ETH is used on Ethereum. Despite being EVM-compatible, Monad has its own native token.',
        },
        {
          question: 'Monad\'s block time is:',
          options: [
            '12 seconds \u2014 same as Ethereum',
            '2 seconds \u2014 like most L2s',
            '400ms \u2014 enabling ~10,000 TPS with parallel execution',
            '1 second \u2014 a standard fast blockchain',
          ],
          correct: 2,
          explanation: 'Monad produces blocks every 400 milliseconds. Combined with parallel transaction execution across 8 lanes, this enables ~10,000 TPS \u2014 orders of magnitude faster than Ethereum.',
        },
      ],
      completionMessage:
        'GAS FUNDAMENTALS ACQUIRED.\n' +
        'You understand the fuel that powers Monad.\n\n' +
        'Closed AI HR Department has noted your file.\n' +
        '"Adequate. Barely." \u2014 Scam Altwoman',
    },

    // ═══════════════════════════════════════════
    // MISSION 2: Reserve Balance
    // ═══════════════════════════════════════════
    {
      id: 'm02',
      number: 2,
      title: 'Reserve Balance',
      subtitle: 'Monad\'s account model',
      corp: 'misanthropic',
      difficulty: 1,
      type: EXERCISE_TYPES.QUIZ,
      xp: 50,
      briefing:
        'Monad introduces a concept not found on Ethereum: the reserve balance.\n\n' +
        'Every account on Monad maintains a small reserve of MON that cannot be ' +
        'spent. This exists to protect the network from certain attack vectors ' +
        'and ensure validators are always compensated.\n\n' +
        'Misanthropic Security requires you to understand this mechanism.\n' +
        'CEO Dario Annoyed-ei: "We reviewed this module 14 times. It\'s safe."',
      questions: [
        {
          question: 'What is Monad\'s reserve balance?',
          options: [
            'A savings account that earns interest on your MON',
            'A minimum balance held to ensure accounts can cover failed transaction costs',
            'The total amount of MON locked in staking contracts',
            'A deposit required to create a new wallet address',
          ],
          correct: 1,
          explanation: 'The reserve balance is a small amount of MON that every account must maintain. It ensures that even if a transaction reverts, validators can still be compensated for the computational work performed.',
        },
        {
          question: 'Why does Monad require a reserve balance?',
          options: [
            'To generate yield for token holders',
            'To prevent spam and ensure validators are compensated even for reverted transactions',
            'To fund the Monad Foundation\'s development',
            'Reserve balances are optional and can be disabled',
          ],
          correct: 1,
          explanation: 'Without a reserve, an attacker could submit transactions that intentionally revert, consuming validator resources without paying. The reserve ensures there\'s always MON available to cover gas costs.',
        },
        {
          question: 'Monad Mainnet Chain ID is:',
          options: [
            '1 (Ethereum Mainnet)',
            '143',
            '10 (Optimism)',
            '42161 (Arbitrum)',
          ],
          correct: 1,
          explanation: 'Monad Mainnet uses Chain ID 143. You need this to add the network to MetaMask or configure your development tools.',
        },
      ],
      completionMessage:
        'RESERVE BALANCE UNDERSTOOD.\n' +
        'You now know how Monad protects its validators.\n\n' +
        'Misanthropic Safety Board: "Passed. After 14 reviews."',
    },

    // ═══════════════════════════════════════════
    // MISSION 3: Deploy a Contract on Monad (CODE)
    // ═══════════════════════════════════════════
    {
      id: 'm03',
      number: 3,
      title: 'Contract Forge',
      subtitle: 'Deploy your first contract on Monad',
      corp: 'y_ai',
      difficulty: 2,
      type: EXERCISE_TYPES.CODE,
      xp: 100,
      briefing:
        'Monad is fully EVM-compatible. That means your Solidity contracts ' +
        'work out of the box \u2014 no modifications needed.\n\n' +
        'Y.AI needs a utility token deployed on Monad. Yesterday.\n' +
        'CEO FelonUsk already tweeted that the token is live. It isn\'t.\n\n' +
        'Complete the ERC-20 contract below. Fill in the blanks.\n' +
        'Remember: Monad supports contracts up to 128KB in size.\n' +
        'This simple token is well under that limit.',
      language: 'solidity',
      codeLines: [
        { num: 1,  text: '// SPDX-License-Identifier: MIT', editable: false },
        { num: 2,  text: 'pragma solidity ^0.8.19;', editable: false },
        { num: 3,  text: '', editable: false },
        { num: 4,  text: '// Deploying on Monad (Chain ID: 143)', editable: false },
        { num: 5,  text: 'contract MonadToken {', editable: false },
        { num: 6,  text: '    string public name = "Monad Token";', editable: false },
        { num: 7,  text: '    string public symbol = "MTKN";', editable: false },
        { num: 8,  text: '    uint8 public decimals = 18;', editable: false },
        { num: 9,  text: '    uint256 public totalSupply;', editable: false },
        {
          num: 10,
          text: '    mapping(address => uint256) public ',
          editable: true,
          answer: 'balanceOf',
          alternatives: ['balanceof', 'balances'],
          blank: '\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591',
          suffix: ';',
          hint: 'Standard ERC-20 function name for checking a wallet\'s token balance',
        },
        { num: 11, text: '', editable: false },
        { num: 12, text: '    constructor(uint256 _initialSupply) {', editable: false },
        {
          num: 13,
          text: '        totalSupply = ',
          editable: true,
          answer: '_initialSupply',
          alternatives: ['_initialsupply'],
          blank: '\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591',
          suffix: ';',
          hint: 'Set total supply from the constructor parameter',
        },
        {
          num: 14,
          text: '        balanceOf[',
          editable: true,
          answer: 'msg.sender',
          alternatives: ['msg.sender'],
          blank: '\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591',
          suffix: '] = totalSupply;',
          hint: 'The address deploying the contract should receive all initial tokens',
        },
        { num: 15, text: '    }', editable: false },
        { num: 16, text: '', editable: false },
        { num: 17, text: '    function transfer(address _to, uint256 _amount) public {', editable: false },
        { num: 18, text: '        require(balanceOf[msg.sender] >= _amount, "Insufficient");', editable: false },
        { num: 19, text: '        balanceOf[msg.sender] -= _amount;', editable: false },
        {
          num: 20,
          text: '        balanceOf[',
          editable: true,
          answer: '_to',
          alternatives: ['_to'],
          blank: '\u2591\u2591\u2591\u2591',
          suffix: '] += _amount;',
          hint: 'Who receives the transferred tokens?',
        },
        { num: 21, text: '    }', editable: false },
        { num: 22, text: '}', editable: false },
      ],
      completionMessage:
        'CONTRACT COMPILED SUCCESSFULLY.\n' +
        'MonadToken deployed at: 0x8b4c..e291\n' +
        'Gas used: 284,331 | Block time: 400ms\n\n' +
        'FelonUsk tweeted: "Monad deployment in under a second."\n' +
        'Technically true. Nobody corrects him.',
    },

    // ═══════════════════════════════════════════
    // MISSION 4: MonadBFT Pipeline
    // ═══════════════════════════════════════════
    {
      id: 'm04',
      number: 4,
      title: 'MonadBFT Pipeline',
      subtitle: 'How Monad achieves consensus',
      corp: 'shallow_mind',
      difficulty: 2,
      type: EXERCISE_TYPES.QUIZ,
      xp: 100,
      briefing:
        'Monad\'s consensus mechanism, MonadBFT, is a pipelined BFT protocol.\n\n' +
        'Unlike traditional blockchains that process one block at a time, MonadBFT ' +
        'runs four stages simultaneously \u2014 each processing a different block. ' +
        'This is how Monad achieves 400ms block times without sacrificing security.\n\n' +
        'Shallow Mind Research requires you to understand this before accessing ' +
        'our validator infrastructure.\n' +
        'CEO Sundial Richy: "We published 47 papers on pipelined BFT. ' +
        'None of them explain it simply. That\'s your job."',
      questions: [
        {
          question: 'MonadBFT processes blocks in a pipeline of:',
          options: [
            '2 stages: Propose and Confirm',
            '3 stages: Propose, Vote, Execute',
            '4 stages: Propose, Vote, Finalize, Execute',
            '5 stages: Propose, Prevote, Precommit, Commit, Execute',
          ],
          correct: 2,
          explanation: 'MonadBFT uses a 4-stage pipeline: PROPOSE (leader proposes block), VOTE (validators vote), FINALIZE (block is finalized), EXECUTE (transactions are executed). Each stage processes a different block simultaneously.',
        },
        {
          question: 'What makes MonadBFT\'s pipeline special?',
          options: [
            'It only requires a single validator to confirm blocks',
            'Different stages process different blocks simultaneously',
            'It eliminates the need for transaction execution',
            'It uses proof-of-work instead of proof-of-stake',
          ],
          correct: 1,
          explanation: 'While block N is being executed, block N+1 is being finalized, N+2 is being voted on, and N+3 is being proposed. This parallelism maximizes throughput without compromising consensus safety.',
        },
        {
          question: 'Monad achieves finality in approximately:',
          options: [
            '12 seconds (like Ethereum)',
            '6 seconds (like most L2s)',
            '~800ms (approximately 2 block times)',
            '~5 seconds (typical BFT)',
          ],
          correct: 2,
          explanation: 'With 400ms block times, Monad achieves finality in roughly 800ms (2 blocks). Once finalized, a transaction cannot be reverted \u2014 much faster than Ethereum\'s ~13 minute finality.',
        },
        {
          question: 'How many validators does Monad support in its active set?',
          options: [
            '21 validators (like BNB Chain)',
            '~175 validators',
            '100,000+ validators (like Ethereum)',
            '4 validators (one per pipeline stage)',
          ],
          correct: 1,
          explanation: 'Monad supports approximately 175 validators in the active set, balancing decentralization with the performance requirements of 400ms block times and pipelined consensus.',
        },
      ],
      completionMessage:
        'CONSENSUS PROTOCOL UNDERSTOOD.\n' +
        'You now know how MonadBFT achieves speed.\n\n' +
        'Shallow Mind published a paper about your quiz results.\n' +
        '"A Novel Analysis of Pipeline Comprehension Metrics"\n' +
        'Nobody will read it.',
    },

    // ═══════════════════════════════════════════
    // MISSION 5: Parallel Execution (CODE)
    // ═══════════════════════════════════════════
    {
      id: 'm05',
      number: 5,
      title: 'Parallel Lanes',
      subtitle: 'How optimistic parallel execution works',
      corp: 'mistrial',
      difficulty: 3,
      type: EXERCISE_TYPES.CODE,
      xp: 100,
      briefing:
        'Monad\'s killer feature: optimistic parallel execution.\n\n' +
        'Transactions are distributed across execution lanes and processed ' +
        'simultaneously. If two transactions access the same state, a conflict ' +
        'is detected and one is re-executed.\n\n' +
        'Your mission: complete the JavaScript code that simulates Monad\'s ' +
        'parallel transaction distribution algorithm.\n\n' +
        'Mistrial Systems CEO Pierre-Antoine du Code: "We forked this from ' +
        'Monad\'s docs. The comments are... sparse. On purpose."',
      language: 'javascript',
      codeLines: [
        { num: 1,  text: '// Simulate Monad parallel transaction distribution', editable: false },
        { num: 2,  text: 'const NUM_LANES = 8;', editable: false },
        { num: 3,  text: '', editable: false },
        { num: 4,  text: 'function assignToLane(transaction) {', editable: false },
        { num: 5,  text: '  // Hash the target address to determine lane', editable: false },
        { num: 6,  text: '  const addrHex = transaction.to.slice(2, 10);', editable: false },
        {
          num: 7,
          text: '  const hash = ',
          editable: true,
          answer: 'parseInt',
          alternatives: ['parseint', 'Number', 'number'],
          blank: '\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591',
          suffix: '(addrHex, 16);',
          hint: 'Convert a hexadecimal string to a number',
        },
        {
          num: 8,
          text: '  return hash ',
          editable: true,
          answer: '% NUM_LANES',
          alternatives: ['% num_lanes', '%NUM_LANES', '% 8', '%8'],
          blank: '\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591',
          suffix: ';',
          hint: 'Use modulo to map hash to one of 8 lanes',
        },
        { num: 9,  text: '}', editable: false },
        { num: 10, text: '', editable: false },
        { num: 11, text: 'function detectConflict(txA, txB) {', editable: false },
        { num: 12, text: '  // Two txs conflict if they access the same state', editable: false },
        { num: 13, text: '  if (txA.to === txB.to && txA.lane !== txB.lane) {', editable: false },
        {
          num: 14,
          text: '    txA.state = ',
          editable: true,
          answer: "'conflict'",
          alternatives: ['"conflict"', 'conflict', "'conflict'"],
          blank: '\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591',
          suffix: ';',
          hint: 'Mark the transaction state when a conflict is detected',
        },
        { num: 15, text: '    return true;', editable: false },
        { num: 16, text: '  }', editable: false },
        { num: 17, text: '  return false;', editable: false },
        { num: 18, text: '}', editable: false },
        { num: 19, text: '', editable: false },
        { num: 20, text: 'function resolveConflict(tx) {', editable: false },
        { num: 21, text: '  // Re-execute the conflicting transaction', editable: false },
        {
          num: 22,
          text: '  ',
          editable: true,
          answer: 'reexecute',
          alternatives: ['reexecute', 're_execute', 'reExecute'],
          blank: '\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591',
          suffix: '(tx);',
          hint: 'What do you do with a conflicting transaction? (re-____)',
        },
        { num: 23, text: "  tx.state = 'done';", editable: false },
        { num: 24, text: '}', editable: false },
      ],
      completionMessage:
        'PARALLEL EXECUTION UNDERSTOOD.\n' +
        'Lane assignment: address-based hashing\n' +
        'Conflict detection: state access overlap\n' +
        'Resolution: deterministic re-execution\n\n' +
        'Mistrial Systems: "Good work. We\'ll add your name to the\n' +
        'contributors list. In small font. Maybe."\n\n' +
        '\u2550\u2550\u2550 MONAD FUNDAMENTALS COMPLETE \u2550\u2550\u2550\n' +
        'You\'ve completed all 5 missions.\n' +
        'Full version with 10+ advanced missions available\n' +
        'for NX Terminal NFT holders.',
    },
  ],
};

export default TRACK_1;
