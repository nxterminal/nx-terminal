import { useState, useCallback } from 'react';
import BootScreen from './components/BootScreen';
import Desktop from './components/Desktop';
import SprklsLayer from './components/sprkls/SprklsLayer';
import './App.css';

function App() {
  const [phase, setPhase] = useState('boot'); // boot -> desktop

  const handleBootComplete = useCallback(() => {
    setPhase('desktop');
  }, []);

  if (phase === 'boot') {
    return <BootScreen onComplete={handleBootComplete} />;
  }

  // SprklsLayer is mounted unconditionally as a sibling of Desktop:
  // the beta gate + walletAddress check live INSIDE the component
  // (returns null when the user shouldn't see toasts), so non-beta
  // wallets pay zero render cost and the polling never starts.
  return (
    <>
      <Desktop />
      <SprklsLayer />
    </>
  );
}

export default App;
