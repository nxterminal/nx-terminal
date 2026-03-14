import { useEffect } from 'react';
import { Copy, Download, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useBuild } from '../../../BuildContext';
import { generateERC20 } from '../templates/erc20Template';
import { generateERC721 } from '../templates/erc721Template';
import { generateERC1155 } from '../templates/erc1155Template';
import { generateStaking } from '../templates/stakingTemplate';
import { generateGameToken } from '../templates/gameTokenTemplate';
import CodeEditor from '../CodeEditor';
import Button from '../../shared/Button';
import Badge from '../../shared/Badge';

const GENERATORS = {
  erc20: generateERC20,
  erc721: generateERC721,
  erc1155: generateERC1155,
  staking: generateStaking,
  game: generateGameToken,
};

export default function Step4Review() {
  const { state, dispatch } = useBuild();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state.generatedCode && state.contractType) {
      const generator = GENERATORS[state.contractType];
      if (generator) {
        const code = generator(state.contractConfig, state.contractFeatures);
        dispatch({ type: 'SET_CODE', payload: code });
      }
    }
  }, [state.contractType, state.contractConfig, state.contractFeatures, state.generatedCode, dispatch]);

  function handleCopy() {
    navigator.clipboard.writeText(state.generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const name = state.contractConfig.contractName || 'Contract';
    const blob = new Blob([state.generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.sol`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDeploy() {
    dispatch({ type: 'SET_MODULE', payload: 'deploy' });
  }

  return (
    <div>
      <div className="mb-flex mb-items-center mb-justify-between mb-mb-md">
        <h3 className="mb-h3">Generated Contract</h3>
        <div className="mb-flex mb-gap-sm">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download size={14} /> Download
          </Button>
        </div>
      </div>

      <div className="mb-flex mb-gap-md mb-mb-md">
        <Badge color="purple">{state.contractType?.toUpperCase()}</Badge>
        <Badge color="green">Monad Optimized</Badge>
        <Badge color="blue">pragma ^0.8.28</Badge>
      </div>

      <CodeEditor
        value={state.generatedCode}
        onChange={code => dispatch({ type: 'SET_CODE', payload: code })}
        height={350}
      />

      <div className="mb-flex mb-justify-between mb-items-center mb-mt-lg">
        <div className="mb-text-sm">
          You can edit the code above before deploying.
        </div>
        <Button onClick={handleDeploy}>
          Proceed to Deploy <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
