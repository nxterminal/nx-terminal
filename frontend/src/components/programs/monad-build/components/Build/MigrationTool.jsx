import { useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useBuild } from '../../BuildContext';
import MigrationAnalysis from './MigrationAnalysis';
import Button from '../shared/Button';

export default function MigrationTool() {
  const [code, setCode] = useState('');
  const [analyzed, setAnalyzed] = useState(false);
  const { dispatch } = useBuild();

  function handleAnalyze() {
    if (code.trim().length > 10) {
      setAnalyzed(true);
    }
  }

  function handleDeploy() {
    dispatch({ type: 'SET_CODE', payload: code });
    dispatch({ type: 'SET_CONTRACT_TYPE', payload: 'custom' });
    dispatch({ type: 'SET_MODULE', payload: 'deploy' });
  }

  return (
    <div>
      <h2 className="mb-h2 mb-mb-sm">Migrate from Ethereum</h2>
      <p className="mb-text-sm mb-mb-lg">
        Paste your existing Ethereum Solidity contract to analyze compatibility and get optimization suggestions for MegaETH.
      </p>

      <textarea
        className="mb-textarea"
        rows={12}
        placeholder="// Paste your Solidity contract here..."
        value={code}
        onChange={e => { setCode(e.target.value); setAnalyzed(false); }}
      />

      <div className="mb-flex mb-justify-between mb-items-center mb-mt-md">
        <Button onClick={handleAnalyze} disabled={code.trim().length < 10}>
          <Search size={14} /> Analyze for MegaETH
        </Button>
        {analyzed && (
          <Button variant="secondary" onClick={handleDeploy}>
            Deploy to MegaETH <ArrowRight size={14} />
          </Button>
        )}
      </div>

      {analyzed && (
        <div className="mb-mt-lg">
          <MigrationAnalysis code={code} />
        </div>
      )}
    </div>
  );
}
