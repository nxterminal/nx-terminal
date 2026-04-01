import { EXERCISE_TYPES } from './constants';

const TRACK_2 = {
  id: 'advanced_megaeth',
  name: 'Advanced MegaETH',
  description: 'Deep dive into MegaETH architecture. Requires NX Terminal NFT.',
  locked: true,
  missions: [
    {
      id: 'm06', number: 6, title: 'MegaETH DB Deep Dive',
      subtitle: 'Custom database for parallel state access',
      corp: 'closed_ai', difficulty: 3, type: EXERCISE_TYPES.CODE, xp: 150,
      briefing: 'Locked. Requires NX Terminal NFT.', language: 'solidity',
      codeLines: [], questions: [], completionMessage: '',
    },
    {
      id: 'm07', number: 7, title: 'RaptorCast Protocol',
      subtitle: 'Erasure-coded block propagation',
      corp: 'misanthropic', difficulty: 3, type: EXERCISE_TYPES.QUIZ, xp: 150,
      briefing: 'Locked. Requires NX Terminal NFT.',
      codeLines: [], questions: [], completionMessage: '',
    },
    {
      id: 'm08', number: 8, title: 'State Access Patterns',
      subtitle: 'Optimizing for parallel execution',
      corp: 'y_ai', difficulty: 3, type: EXERCISE_TYPES.CODE, xp: 150,
      briefing: 'Locked. Requires NX Terminal NFT.', language: 'solidity',
      codeLines: [], questions: [], completionMessage: '',
    },
    {
      id: 'm09', number: 9, title: 'Conflict Resolution',
      subtitle: 'Deterministic re-execution strategies',
      corp: 'shallow_mind', difficulty: 4, type: EXERCISE_TYPES.QUIZ, xp: 200,
      briefing: 'Locked. Requires NX Terminal NFT.',
      codeLines: [], questions: [], completionMessage: '',
    },
    {
      id: 'm10', number: 10, title: 'Deferred Execution',
      subtitle: 'Separating consensus from execution',
      corp: 'mistrial', difficulty: 4, type: EXERCISE_TYPES.QUIZ, xp: 200,
      briefing: 'Locked. Requires NX Terminal NFT.',
      codeLines: [], questions: [], completionMessage: '',
    },
    {
      id: 'm11', number: 11, title: 'MEV on MegaETH',
      subtitle: 'Extractable value in parallel chains',
      corp: 'closed_ai', difficulty: 3, type: EXERCISE_TYPES.QUIZ, xp: 150,
      briefing: 'Locked. Requires NX Terminal NFT.',
      codeLines: [], questions: [], completionMessage: '',
    },
    {
      id: 'm12', number: 12, title: 'Gas Optimizer Pro',
      subtitle: 'Advanced gas optimization patterns',
      corp: 'misanthropic', difficulty: 4, type: EXERCISE_TYPES.CODE, xp: 200,
      briefing: 'Locked. Requires NX Terminal NFT.', language: 'solidity',
      codeLines: [], questions: [], completionMessage: '',
    },
    {
      id: 'm13', number: 13, title: 'Validator Operations',
      subtitle: 'Running a MegaETH validator node',
      corp: 'y_ai', difficulty: 4, type: EXERCISE_TYPES.CODE, xp: 200,
      briefing: 'Locked. Requires NX Terminal NFT.', language: 'javascript',
      codeLines: [], questions: [], completionMessage: '',
    },
    {
      id: 'm14', number: 14, title: 'Cross-Contract State',
      subtitle: 'Managing shared state across contracts',
      corp: 'shallow_mind', difficulty: 4, type: EXERCISE_TYPES.QUIZ, xp: 200,
      briefing: 'Locked. Requires NX Terminal NFT.',
      codeLines: [], questions: [], completionMessage: '',
    },
    {
      id: 'm15', number: 15, title: 'Protocol Mastery',
      subtitle: 'Final comprehensive assessment',
      corp: 'mistrial', difficulty: 4, type: EXERCISE_TYPES.CODE, xp: 250,
      briefing: 'Locked. Requires NX Terminal NFT.', language: 'solidity',
      codeLines: [], questions: [], completionMessage: '',
    },
  ],
};

export default TRACK_2;
