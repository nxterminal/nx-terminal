import { useState } from 'react';
import { useBuild } from '../../BuildContext';
import TemplateGallery from './TemplateGallery';
import ContractWizard from './ContractWizard';
import MigrationTool from './MigrationTool';
import CodeEditor from './CodeEditor';
import Button from '../shared/Button';
import { Copy, Download, ArrowRight, Check } from 'lucide-react';

export default function BuildModule() {
  const { state, dispatch } = useBuild();
  const [view, setView] = useState('gallery'); // gallery | wizard | editor | migrate
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');

  function handleGallerySelect(nextView) {
    setView(nextView);
  }

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

  // If we already have a contract type set (from Home quick actions), show wizard
  if (state.contractType && view === 'gallery' && state.contractType !== 'custom') {
    return (
      <div className="mb-animate-in">
        <ContractWizard onBack={() => {
          dispatch({ type: 'RESET_BUILD' });
          setView('gallery');
        }} />
      </div>
    );
  }

  if (view === 'wizard') {
    return (
      <div className="mb-animate-in">
        <ContractWizard onBack={() => {
          dispatch({ type: 'RESET_BUILD' });
          setView('gallery');
        }} />
      </div>
    );
  }

  if (view === 'editor' || (state.contractType === 'custom' && state.generatedCode)) {
    return (
      <div className="mb-animate-in">
        <div className="mb-flex mb-items-center mb-justify-between mb-mb-md">
          <h2 className="mb-h2">Code Editor</h2>
          <div className="mb-flex mb-gap-sm">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download size={14} /> Download
            </Button>
            <Button size="sm" onClick={() => dispatch({ type: 'SET_MODULE', payload: 'deploy' })}>
              Deploy <ArrowRight size={14} />
            </Button>
          </div>
        </div>
        <CodeEditor
          value={state.generatedCode}
          onChange={code => dispatch({ type: 'SET_CODE', payload: code })}
          height={450}
        />
      </div>
    );
  }

  return (
    <div className="mb-animate-in">
      <div className="mb-tabs mb-mb-lg">
        <button
          className={`mb-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
        <button
          className={`mb-tab ${activeTab === 'migrate' ? 'active' : ''}`}
          onClick={() => setActiveTab('migrate')}
        >
          Migrate from ETH
        </button>
      </div>

      {activeTab === 'templates' ? (
        <TemplateGallery onSelect={handleGallerySelect} />
      ) : (
        <MigrationTool />
      )}
    </div>
  );
}
