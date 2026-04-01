import { Code2, ArrowRight } from 'lucide-react';
import { useBuild } from '../../BuildContext';
import CompileStep from './CompileStep';
import DeployForm from './DeployForm';
import DeployStatus from './DeployStatus';
import DeploySuccess from './DeploySuccess';
import VerifyContract from './VerifyContract';
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

  // Deployed successfully
  if (state.deployStatus === 'confirmed' && state.deployedAddress) {
    return (
      <div className="mb-animate-in">
        <DeploySuccess />
        <div className="mb-divider" />
        <VerifyContract />
      </div>
    );
  }

  // Deploying in progress
  if (state.deployStatus !== 'idle' && state.deployStatus !== 'error') {
    return (
      <div className="mb-animate-in">
        <DeployStatus />
      </div>
    );
  }

  function handleDeploy() {
    // Simulate deployment phases since we use the simplified approach
    // In production, this would use wagmi's useWriteContract
    dispatch({ type: 'SET_DEPLOY_STATUS', payload: 'compiling' });

    setTimeout(() => {
      dispatch({ type: 'SET_DEPLOY_STATUS', payload: 'signing' });
    }, 1000);

    setTimeout(() => {
      dispatch({ type: 'SET_DEPLOY_STATUS', payload: 'pending' });
      dispatch({ type: 'SET_DEPLOYED', payload: { address: null, txHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('') } });
    }, 3000);

    setTimeout(() => {
      const fakeAddress = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      dispatch({ type: 'SET_DEPLOYED', payload: { address: fakeAddress, txHash: state.txHash } });
      dispatch({ type: 'SET_DEPLOY_STATUS', payload: 'confirmed' });
    }, 4000);
  }

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

      {/* Deploy Form */}
      <div className="mb-divider" />
      <DeployForm onDeploy={handleDeploy} />

      {state.deployStatus === 'error' && (
        <div className="mb-callout mb-callout-error mb-mt-md">
          Deployment failed. Check your wallet connection and try again.
        </div>
      )}
    </div>
  );
}
