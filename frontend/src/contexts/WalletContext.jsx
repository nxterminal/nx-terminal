import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState(null);

  const connect = useCallback(async () => {
    setError(null);

    if (!window.ethereum) {
      setError({
        title: 'wallet_not_found.exe',
        msg: 'No Ethereum wallet detected.\n\nPlease install MetaMask to participate in the Protocol Wars.',
      });
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setWallet(accounts[0]);
      }
    } catch (err) {
      if (err.code === 4001) {
        setError({
          title: 'connection_denied.exe',
          msg: 'Wallet connection rejected.\n\nYour employment contract remains unsigned.',
        });
      } else {
        setError({
          title: 'network_error.exe',
          msg: 'Failed to connect to NX Terminal Network.\n\nThe modem may be unplugged.',
        });
      }
    }
  }, []);

  const disconnect = useCallback(() => setWallet(null), []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) setWallet(null);
      else setWallet(accounts[0]);
    };

    const handleChainChanged = () => window.location.reload();

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const truncated = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : null;
  const clearError = useCallback(() => setError(null), []);

  return (
    <WalletContext.Provider value={{ wallet, truncated, connect, disconnect, connected: !!wallet, error, clearError }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be inside WalletProvider');
  return ctx;
}
