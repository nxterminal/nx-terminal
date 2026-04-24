import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MegaProvider } from '@megaeth-labs/wallet-sdk-react';
import { wagmiConfig } from './services/wagmi';
import { DevsProvider } from './contexts/DevsContext';
import { WalletSelectorProvider } from './contexts/WalletSelectorContext';
import WalletSelectorModal from './components/WalletSelectorModal';
import WalletSelectorCancelOverlay from './components/WalletSelectorCancelOverlay';
import './index.css';
import App from './App.jsx';
import MossTest from './pages/MossTest.jsx';

const queryClient = new QueryClient();

// MOSS SDK config. Only consumed by /moss-test (a diagnostic page); the
// production wallet flow now goes through the wagmi connector.
const mossConfig = {
  network: 'mainnet',
  logging: 'warn',
};

// Lightweight path-based routing without adding react-router as a dep.
// `/moss-test` is an internal diagnostic page used during rollout to
// validate the SDK end-to-end (connect, balances, contract reads).
// Not linked from the menu; share the URL directly with testers.
function Root() {
  const path = window.location.pathname;
  if (path === '/moss-test' || path === '/moss-test/') {
    return <MossTest />;
  }
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MegaProvider config={mossConfig}>
          <WalletSelectorProvider>
            <DevsProvider>
              <Root />
            </DevsProvider>
            <WalletSelectorModal />
            <WalletSelectorCancelOverlay />
          </WalletSelectorProvider>
        </MegaProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
