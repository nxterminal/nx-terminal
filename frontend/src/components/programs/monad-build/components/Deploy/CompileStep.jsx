import { useState } from 'react';
import { ExternalLink, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import Button from '../shared/Button';

const HARDHAT_CONFIG = `// hardhat.config.js
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "prague",  // MANDATORY for Monad
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    monad: {
      url: "https://rpc.monad.xyz",
      chainId: 143,
      accounts: [process.env.PRIVATE_KEY],
    },
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};`;

const FOUNDRY_CONFIG = `# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.28"
evm_version = "prague"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
monad = "https://rpc.monad.xyz"
monadTestnet = "https://testnet-rpc.monad.xyz"`;

export default function CompileStep() {
  const [showHardhat, setShowHardhat] = useState(false);
  const [showFoundry, setShowFoundry] = useState(false);
  const [copiedHH, setCopiedHH] = useState(false);
  const [copiedF, setCopiedF] = useState(false);

  function copyConfig(text, setCopied) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <h3 className="mb-h3 mb-mb-md">Compilation</h3>
      <div className="mb-callout mb-callout-info mb-mb-md">
        <div>
          <strong>Required compiler settings:</strong> Solidity ^0.8.28, evmVersion: "prague", optimizer enabled.
        </div>
      </div>

      <div className="mb-flex mb-gap-sm mb-mb-lg">
        <a
          href="https://remix.ethereum.org"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-btn mb-btn-primary"
          style={{ textDecoration: 'none' }}
        >
          Open in Remix IDE <ExternalLink size={14} />
        </a>
        <div className="mb-text-sm" style={{ display: 'flex', alignItems: 'center', color: 'var(--mb-text-tertiary)' }}>
          Copy your code and paste it in Remix to compile
        </div>
      </div>

      <div className="mb-accordion">
        <button
          className={`mb-accordion-header ${showHardhat ? 'open' : ''}`}
          onClick={() => setShowHardhat(!showHardhat)}
        >
          Hardhat Configuration
          {showHardhat ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showHardhat && (
          <div className="mb-accordion-body">
            <div className="mb-flex mb-justify-between mb-items-center mb-mb-sm">
              <span className="mb-text-xs">hardhat.config.js</span>
              <Button variant="ghost" size="sm" onClick={() => copyConfig(HARDHAT_CONFIG, setCopiedHH)}>
                {copiedHH ? <Check size={12} /> : <Copy size={12} />}
                {copiedHH ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="mb-code-block" style={{ fontSize: 12 }}>{HARDHAT_CONFIG}</pre>
          </div>
        )}
      </div>

      <div className="mb-accordion">
        <button
          className={`mb-accordion-header ${showFoundry ? 'open' : ''}`}
          onClick={() => setShowFoundry(!showFoundry)}
        >
          Foundry Configuration
          {showFoundry ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showFoundry && (
          <div className="mb-accordion-body">
            <div className="mb-flex mb-justify-between mb-items-center mb-mb-sm">
              <span className="mb-text-xs">foundry.toml</span>
              <Button variant="ghost" size="sm" onClick={() => copyConfig(FOUNDRY_CONFIG, setCopiedF)}>
                {copiedF ? <Check size={12} /> : <Copy size={12} />}
                {copiedF ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="mb-code-block" style={{ fontSize: 12 }}>{FOUNDRY_CONFIG}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
