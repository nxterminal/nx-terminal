import { Code2, ArrowRight } from 'lucide-react';
import { useBuild } from '../../BuildContext';
import CompileStep from './CompileStep';
import Button from '../shared/Button';

export default function DeployModule() {
  const { state, dispatch } = useBuild();

  // No code available
  if (!state.generatedCode) {
    return (
      <div className="mb-animate-in">
        <div className="mb-empty">
          <Code2 size={48} />
          <h3 className="mb-h3">No Contract to Deploy</h3>
          <p className="mb-text-sm">Generate a contract in the Build module first.</p>
          <Button onClick={() => dispatch({ type: 'SET_MODULE', payload: 'build' })}>
            Go to Build <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    );
  }

  const copyCode = () => {
    navigator.clipboard.writeText(state.generatedCode).catch(() => {});
  };

  return (
    <div className="mb-animate-in">
      <h1 className="mb-h1 mb-mb-sm">Deploy Contract</h1>
      <p className="mb-text-sm mb-mb-lg">
        Compile and deploy your contract to MegaETH.
      </p>

      {/* Source Code Preview */}
      <div className="mb-card mb-mb-md">
        <div className="mb-flex mb-items-center mb-justify-between">
          <div>
            <div className="mb-text-xs" style={{ color: 'var(--mb-text-tertiary)' }}>Source Code</div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {state.contractConfig.contractName || 'Contract'}.sol
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: 'SET_MODULE', payload: 'build' })}
          >
            Edit
          </Button>
        </div>
        <pre className="mb-code-block mb-mt-sm" style={{ maxHeight: 100, overflow: 'hidden', fontSize: 11 }}>
          {state.generatedCode.slice(0, 300)}...
        </pre>
      </div>

      {/* Compile Step */}
      <div className="mb-mb-lg">
        <CompileStep code={state.generatedCode} />
      </div>

      {/* Deploy Instructions */}
      <div className="mb-divider" />
      <div className="mb-card mb-mb-md" style={{ lineHeight: 1.8 }}>
        <h3 className="mb-h3" style={{ marginBottom: 12 }}>Deploy on MegaETH</h3>
        <ol style={{ paddingLeft: 20, margin: 0, fontSize: 13 }}>
          <li>Copy the contract code using the button below</li>
          <li>Open <strong>remix.ethereum.org</strong> and paste it in a new file</li>
          <li>Compile with <strong>Solidity 0.8.20</strong>, EVM version: <strong>prague</strong></li>
          <li>Connect MetaMask to MegaETH (Chain ID <strong>4326</strong>, RPC: <code style={{ background: 'var(--mb-bg-tertiary, #1a1a2e)', padding: '1px 4px', borderRadius: 3 }}>https://carrot.megaeth.com/rpc</code>)</li>
          <li>Deploy with gas limit: <strong>8,000,000</strong></li>
        </ol>
        <div className="mb-flex mb-mt-md" style={{ gap: 8 }}>
          <Button onClick={copyCode}>
            Copy Code
          </Button>
          <Button variant="ghost" onClick={() => window.open('https://remix.ethereum.org', '_blank')}>
            Open Remix <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
