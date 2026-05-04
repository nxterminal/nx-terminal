import { useState, useCallback } from 'react';
import BootScreen from './components/BootScreen';
import Desktop from './components/Desktop';
import { useWallet } from './hooks/useWallet';
import { useChatModal } from './contexts/ChatContext';
import { isInNXSoulsBeta } from './config/betaFeatures';
import './App.css';

function App() {
  const [phase, setPhase] = useState('boot'); // boot -> desktop
  const { address } = useWallet();
  const { openChatModal } = useChatModal();

  const handleBootComplete = useCallback(() => {
    setPhase('desktop');
  }, []);

  if (phase === 'boot') {
    return <BootScreen onComplete={handleBootComplete} />;
  }

  // Phase 3.2 debug button: only renders for beta-allowlisted wallets,
  // gives the operator a way to manually pop the chat modal during
  // review before the real entry points exist (Phase 3.6 wires the
  // per-Dev "💬 CHAT" button on each card and the global "💬 MESSAGES"
  // button in the header). REMOVE this entire block in Phase 3.6 once
  // those entry points are live.
  return (
    <>
      <Desktop />
      {isInNXSoulsBeta(address) && (
        <button
          type="button"
          onClick={() => openChatModal()}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 10000,
            padding: '8px 12px',
            background: '#4a6fa5',
            color: 'white',
            border: '1px solid #2a4f85',
            cursor: 'pointer',
            fontFamily: 'Tahoma, sans-serif',
            fontSize: 11,
          }}
        >
          [debug] Open Chat
        </button>
      )}
    </>
  );
}

export default App;
