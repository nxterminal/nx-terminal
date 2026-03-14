import { useState } from 'react';
import { Cpu, GitCompare, Fuel, Zap, ClipboardCheck, Code2, ChevronLeft } from 'lucide-react';
import TopicCard from './TopicCard';
import MonadArchitecture from './MonadArchitecture';
import InteractiveComparison from './InteractiveComparison';
import GasGuide from './GasGuide';
import QuickStartGuide from './QuickStartGuide';
import DeploymentChecklist from './DeploymentChecklist';

const TOPICS = [
  { id: 'architecture', icon: Cpu, title: 'What is Monad?', description: 'Architecture overview: parallel execution, MonadBFT, and more', readTime: 5, difficulty: 'Beginner', component: MonadArchitecture },
  { id: 'comparison', icon: GitCompare, title: 'Monad vs Ethereum', description: 'Side-by-side comparison of key differences', readTime: 4, difficulty: 'Beginner', component: InteractiveComparison },
  { id: 'gas', icon: Fuel, title: 'Gas on Monad', description: 'Critical gas differences — must read before deploying', readTime: 3, difficulty: 'Intermediate', component: GasGuide },
  { id: 'quickstart', icon: Zap, title: '5-Minute Quick Start', description: 'Fastest path to your first deploy on Monad', readTime: 5, difficulty: 'Beginner', component: QuickStartGuide },
  { id: 'checklist', icon: ClipboardCheck, title: 'Pre-Deploy Checklist', description: 'Everything to verify before mainnet deployment', readTime: 2, difficulty: 'Intermediate', component: DeploymentChecklist },
  { id: 'solidity', icon: Code2, title: 'Solidity on Monad', description: 'What changes, what doesn\'t — EVM compatibility notes', readTime: 3, difficulty: 'Advanced', component: SolidityOnMonad },
];

function SolidityOnMonad() {
  return (
    <div>
      <h2 className="mb-h2 mb-mb-md">Solidity on Monad</h2>
      <p className="mb-text-sm mb-mb-lg">
        Monad is fully EVM-compatible. Your Solidity code works as-is with a few important notes.
      </p>

      <h3 className="mb-h3 mb-mb-md">What Stays the Same</h3>
      <div className="mb-flex-col mb-gap-sm mb-mb-lg">
        {[
          'All Solidity syntax and features work identically',
          'OpenZeppelin contracts are fully compatible',
          'ERC-20, ERC-721, ERC-1155 standards work out of the box',
          'All opcodes behave the same (EVM equivalence)',
          'msg.sender, msg.value, block.timestamp — all identical',
        ].map((item, i) => (
          <div key={i} className="mb-flex mb-gap-sm" style={{ fontSize: 13, color: 'var(--mb-text-secondary)' }}>
            <span style={{ color: 'var(--mb-accent-secondary)' }}>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <h3 className="mb-h3 mb-mb-md">What You Must Change</h3>
      <div className="mb-flex-col mb-gap-sm mb-mb-lg">
        {[
          'Set evmVersion: "prague" in compiler settings — MANDATORY',
          'Use pragma solidity ^0.8.28 or later',
          'Optimize gas limits (Monad charges the full gas limit)',
          'Cache cold storage reads in memory variables',
          'Minimize cold cross-contract calls (10,100 gas per cold account)',
        ].map((item, i) => (
          <div key={i} className="mb-flex mb-gap-sm" style={{ fontSize: 13, color: 'var(--mb-text-secondary)' }}>
            <span style={{ color: 'var(--mb-accent-warning)' }}>!</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <h3 className="mb-h3 mb-mb-md">Compiler Configuration</h3>
      <pre className="mb-code-block">
{`// hardhat.config.js
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "prague",  // MANDATORY for Monad
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    monad: {
      url: "https://rpc.monad.xyz",
      chainId: 143,
    },
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
    },
  },
};`}
      </pre>
    </div>
  );
}

export default function LearnModule() {
  const [selectedTopic, setSelectedTopic] = useState(null);

  if (selectedTopic) {
    const topic = TOPICS.find(t => t.id === selectedTopic);
    const TopicComponent = topic?.component;

    return (
      <div className="mb-animate-in">
        <button className="mb-back-btn" onClick={() => setSelectedTopic(null)}>
          <ChevronLeft size={16} /> Back to Topics
        </button>
        {TopicComponent && <TopicComponent />}
      </div>
    );
  }

  return (
    <div className="mb-animate-in">
      <h1 className="mb-h1 mb-mb-sm">Learn Monad</h1>
      <p className="mb-text-sm mb-mb-lg">
        Everything you need to know to build on the fastest EVM chain.
      </p>

      <div className="mb-grid-2">
        {TOPICS.map(topic => (
          <TopicCard
            key={topic.id}
            icon={topic.icon}
            title={topic.title}
            description={topic.description}
            readTime={topic.readTime}
            difficulty={topic.difficulty}
            onClick={() => setSelectedTopic(topic.id)}
          />
        ))}
      </div>
    </div>
  );
}
