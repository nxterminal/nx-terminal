import { EXERCISE_TYPES } from './constants';

const TRACK_1 = {
  id: 'megaeth_fundamentals',
  name: 'MegaETH Fundamentals',
  description: 'Core training for MegaETH blockchain development.',
  locked: false,
  missions: [
    // ═══════════════════════════════════════════
    // MISSION 1: Gas Mechanics on MegaETH
    // ═══════════════════════════════════════════
    {
      id: 'm01',
      number: 1,
      title: 'Gas Trap',
      subtitle: 'Understanding gas on MegaETH',
      corp: 'closed_ai',
      difficulty: 1,
      type: EXERCISE_TYPES.QUIZ,
      xp: 50,
      briefing:
        'Every transaction on MegaETH consumes gas \u2014 computational fuel that ' +
        'keeps the network running.\n\n' +
        'But MegaETH isn\'t like other chains. With sub-second block times and parallel ' +
        'execution, gas dynamics work differently here. You need to understand ' +
        'the fundamentals before writing a single line of code.\n\n' +
        'Closed AI Corp requires all recruits to pass this assessment.\n' +
        'CEO Scam Altwoman says: "Gas optimization is our competitive advantage. ' +
        'Don\'t waste it."',
      questions: [
        {
          question: 'What is "gas" in the context of MegaETH?',
          options: [
            'A cryptocurrency token you can trade on exchanges',
            'A unit measuring the computational work needed to execute transactions',
            'The electricity cost of running a validator node',
            'A type of smart contract programming language',
          ],
          correct: 1,
          explanation: 'Gas measures computational effort. Every operation (transfer, contract call, storage write) costs a specific amount of gas. Users pay gas fees in ETH to compensate validators.',
        },
        {
          question: 'On MegaETH, what token is used to pay gas fees?',
          options: [
            'MEGA \u2014 a custom MegaETH token',
            'USDC \u2014 a stablecoin for predictable fees',
            'ETH \u2014 the native token of MegaETH',
            'Gas tokens are not needed on MegaETH',
          ],
          correct: 2,
          explanation: 'ETH is MegaETH\'s native token, used to pay for gas fees. MegaETH is fully EVM-compatible and uses ETH as its native currency.',
        },
        {
          question: 'MegaETH\'s block time is:',
          options: [
            '12 seconds \u2014 same as Ethereum',
            '2 seconds \u2014 like most L2s',
            'Sub-second 2014 enabling 30,000+ TPS with parallel execution',
            '1 second \u2014 a standard fast blockchain',
          ],
          correct: 2,
          explanation: 'MegaETH produces blocks in sub-second time. Combined with parallel transaction execution across 8 lanes, this enables 30,000+ TPS \u2014 orders of magnitude faster than Ethereum.',
        },
      ],
      completionMessage:
        'GAS FUNDAMENTALS ACQUIRED.\n' +
        'You understand the fuel that powers MegaETH.\n\n' +
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
      subtitle: 'MegaETH\'s account model',
      corp: 'misanthropic',
      difficulty: 1,
      type: EXERCISE_TYPES.QUIZ,
      xp: 50,
      briefing:
        'MegaETH introduces a concept not found on Ethereum: the reserve balance.\n\n' +
        'Every account on MegaETH maintains a small reserve of ETH that cannot be ' +
        'spent. This exists to protect the network from certain attack vectors ' +
        'and ensure validators are always compensated.\n\n' +
        'Misanthropic Security requires you to understand this mechanism.\n' +
        'CEO Dario Annoyed-ei: "We reviewed this module 14 times. It\'s safe."',
      questions: [
        {
          question: 'What is MegaETH\'s reserve balance?',
          options: [
            'A savings account that earns interest on your ETH',
            'A minimum balance held to ensure accounts can cover failed transaction costs',
            'The total amount of ETH locked in staking contracts',
            'A deposit required to create a new wallet address',
          ],
          correct: 1,
          explanation: 'The reserve balance is a small amount of ETH that every account must maintain. It ensures that even if a transaction reverts, validators can still be compensated for the computational work performed.',
        },
        {
          question: 'Why does MegaETH require a reserve balance?',
          options: [
            'To generate yield for token holders',
            'To prevent spam and ensure validators are compensated even for reverted transactions',
            'To fund the MegaETH Foundation\'s development',
            'Reserve balances are optional and can be disabled',
          ],
          correct: 1,
          explanation: 'Without a reserve, an attacker could submit transactions that intentionally revert, consuming validator resources without paying. The reserve ensures there\'s always ETH available to cover gas costs.',
        },
        {
          question: 'MegaETH Testnet Chain ID is:',
          options: [
            '1 (Ethereum Mainnet)',
            '4326',
            '10 (Optimism)',
            '42161 (Arbitrum)',
          ],
          correct: 1,
          explanation: 'MegaETH Testnet uses Chain ID 4326. You need this to add the network to MetaMask or configure your development tools.',
        },
      ],
      completionMessage:
        'RESERVE BALANCE UNDERSTOOD.\n' +
        'You now know how MegaETH protects its validators.\n\n' +
        'Misanthropic Safety Board: "Passed. After 14 reviews."',
    },

    // ═══════════════════════════════════════════
    // MISSION 3: Deploy a Contract on MegaETH (CODE)
    // ═══════════════════════════════════════════
    {
      id: 'm03',
      number: 3,
      title: 'Contract Forge',
      subtitle: 'Deploy your first contract on MegaETH',
      corp: 'y_ai',
      difficulty: 2,
      type: EXERCISE_TYPES.CODE,
      xp: 100,
      briefing:
        'MegaETH is fully EVM-compatible. That means your Solidity contracts ' +
        'work out of the box \u2014 no modifications needed.\n\n' +
        'Y.AI needs a utility token deployed on MegaETH. Yesterday.\n' +
        'CEO FelonUsk already tweeted that the token is live. It isn\'t.\n\n' +
        'Complete the ERC-20 contract below. Fill in the blanks.\n' +
        'Remember: MegaETH supports contracts up to 128KB in size.\n' +
        'This simple token is well under that limit.',
      language: 'solidity',
      codeLines: [
        { num: 1,  text: '// SPDX-License-Identifier: MIT', editable: false },
        { num: 2,  text: 'pragma solidity ^0.8.19;', editable: false },
        { num: 3,  text: '', editable: false },
        { num: 4,  text: '// Deploying on MegaETH Testnet (Chain ID: 4326)', editable: false },
        { num: 5,  text: 'contract MegaETHToken {', editable: false },
        { num: 6,  text: '    string public name = "MegaETH Token";', editable: false },
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
        'MegaETHToken deployed at: 0x8b4c..e291\n' +
        'Gas used: 284,331 | Block time: sub-second\n\n' +
        'FelonUsk tweeted: "MegaETH deployment in sub-second time."\n' +
        'Technically true. Nobody corrects him.',
    },

    // ═══════════════════════════════════════════
    // MISSION 4: AsyncBFT Pipeline
    // ═══════════════════════════════════════════
    {
      id: 'm04',
      number: 4,
      title: 'AsyncBFT Pipeline',
      subtitle: 'How MegaETH achieves consensus',
      corp: 'shallow_mind',
      difficulty: 2,
      type: EXERCISE_TYPES.QUIZ,
      xp: 100,
      briefing:
        'MegaETH\'s consensus mechanism is a pipelined BFT protocol.\n\n' +
        'Unlike traditional blockchains that process one block at a time, it ' +
        'runs four stages simultaneously \u2014 each processing a different block. ' +
        'This is how MegaETH achieves sub-second block times without sacrificing security.\n\n' +
        'Shallow Mind Research requires you to understand this before accessing ' +
        'our validator infrastructure.\n' +
        'CEO Sundial Richy: "We published 47 papers on pipelined BFT. ' +
        'None of them explain it simply. That\'s your job."',
      questions: [
        {
          question: 'AsyncBFT processes blocks in a pipeline of:',
          options: [
            '2 stages: Propose and Confirm',
            '3 stages: Propose, Vote, Execute',
            '4 stages: Propose, Vote, Finalize, Execute',
            '5 stages: Propose, Prevote, Precommit, Commit, Execute',
          ],
          correct: 2,
          explanation: 'AsyncBFT uses a 4-stage pipeline: PROPOSE (leader proposes block), VOTE (validators vote), FINALIZE (block is finalized), EXECUTE (transactions are executed). Each stage processes a different block simultaneously.',
        },
        {
          question: 'What makes AsyncBFT\'s pipeline special?',
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
          question: 'MegaETH achieves finality in approximately:',
          options: [
            '12 seconds (like Ethereum)',
            '6 seconds (like most L2s)',
            '~800ms (approximately 2 block times)',
            '~5 seconds (typical BFT)',
          ],
          correct: 2,
          explanation: 'With sub-second block times, MegaETH achieves finality in roughly 800ms (2 blocks). Once finalized, a transaction cannot be reverted \u2014 much faster than Ethereum\'s ~13 minute finality.',
        },
        {
          question: 'How many validators does MegaETH support in its active set?',
          options: [
            '21 validators (like BNB Chain)',
            '~120 validators',
            '100,000+ validators (like Ethereum)',
            '4 validators (one per pipeline stage)',
          ],
          correct: 1,
          explanation: 'MegaETH supports approximately 120 validators in the active set, balancing decentralization with the performance requirements of sub-second block times and pipelined consensus.',
        },
      ],
      completionMessage:
        'CONSENSUS PROTOCOL UNDERSTOOD.\n' +
        'You now know how AsyncBFT achieves speed.\n\n' +
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
        'MegaETH\'s killer feature: optimistic parallel execution.\n\n' +
        'Transactions are distributed across execution lanes and processed ' +
        'simultaneously. If two transactions access the same state, a conflict ' +
        'is detected and one is re-executed.\n\n' +
        'Your mission: complete the JavaScript code that simulates MegaETH\'s ' +
        'parallel transaction distribution algorithm.\n\n' +
        'Mistrial Systems CEO Pierre-Antoine du Code: "We forked this from ' +
        'MegaETH\'s docs. The comments are... sparse. On purpose."',
      language: 'javascript',
      codeLines: [
        { num: 1,  text: '// Simulate MegaETH parallel transaction distribution', editable: false },
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
        '\u2550\u2550\u2550 MEGAETH FUNDAMENTALS COMPLETE \u2550\u2550\u2550\n' +
        'You\'ve completed all 5 missions.\n' +
        'Full version with 10+ advanced missions available\n' +
        'for NX Terminal NFT holders.',
    },
  ],
};

export default TRACK_1;
