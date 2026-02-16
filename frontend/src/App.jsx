import { useState } from 'react';
import BootScreen from './components/BootScreen';
import Desktop from './components/Desktop';
import { WalletProvider } from './contexts/WalletContext';
import { DevsProvider } from './contexts/DevsContext';
import { InboxProvider } from './contexts/InboxContext';
import './App.css';

function App() {
  const [booted, setBooted] = useState(false);

  if (!booted) {
    return <BootScreen onComplete={() => setBooted(true)} />;
  }

  return (
    <WalletProvider>
      <DevsProvider>
        <InboxProvider>
          <Desktop />
        </InboxProvider>
      </DevsProvider>
    </WalletProvider>
  );
}

export default App;
