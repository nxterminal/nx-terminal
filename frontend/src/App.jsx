import { useState } from 'react';
import BootScreen from './components/BootScreen';
import Desktop from './components/Desktop';
import { WalletProvider } from './contexts/WalletContext';
import './App.css';

function App() {
  const [booted, setBooted] = useState(false);

  if (!booted) {
    return <BootScreen onComplete={() => setBooted(true)} />;
  }

  return (
    <WalletProvider>
      <Desktop />
    </WalletProvider>
  );
}

export default App;
