import { useCallback } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWriteContract,
  useWalletClient,
} from 'wagmi';
import { megaeth, isMossConnector } from '../services/wagmi';
import { useWalletSelector } from '../contexts/WalletSelectorContext';
import { useMegaName } from './useMegaName';

// useWallet — thin wrapper on top of wagmi.
//
// Since MOSS is now registered as a wagmi connector via
// @megaeth-labs/wallet-wagmi-connector, both MetaMask and MOSS flow
// through the same wagmi hook surface (useAccount, useConnect,
// useWriteContract, etc). MOSS-specific actions (openWallet,
// depositWallet) delegate to the connector's provider through its
// request() surface.
//
// The exposed `connect` is the selector-opening wrapper — every existing
// consumer that calls `useWallet().connect()` as a no-arg function keeps
// working without migration. The modal itself uses wagmi's useConnect()
// directly to fire connect({ connector }).

const formatAddress = (addr) => {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

export function useWallet() {
  const {
    address,
    isConnected,
    isConnecting,
    isReconnecting,
    chain,
    chainId,
    connector,
  } = useAccount();
  // connectError is the last error from the useConnect instance tied to
  // THIS hook call. It's not a global app-wide connect error — each
  // useWallet() subscriber sees its own slot. Taskbar is the canonical
  // reader for showing connect-failed banners.
  const { connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();
  const { open: openSelector } = useWalletSelector();
  const megaName = useMegaName(address);

  const isMoss = isMossConnector(connector);
  // chainId from useAccount is reliable even when the connected chain is
  // not in wagmiConfig.chains; chain?.id would be undefined in that case
  // and produce a false-positive wrong-chain banner.
  const isWrongChain =
    isConnected && chainId !== undefined && chainId !== megaeth.id;

  const switchToMegaETH = useCallback(async () => {
    if (isMoss) {
      // MOSS is pinned to MegaETH at construction time. Log so debugging
      // a stuck "switch" button is obvious.
      console.info('[wallet] MOSS is fixed to MegaETH, no switch needed');
      return;
    }

    try {
      await switchChainAsync({ chainId: megaeth.id });
      return;
    } catch (err) {
      // Some injected wallets reject wagmi's switchChain even when they'd
      // accept the raw EIP-3326 call; fall back to window.ethereum direct.
      if (typeof window === 'undefined' || !window.ethereum) {
        throw err;
      }
      const chainIdHex = '0x' + megaeth.id.toString(16);
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
      } catch (switchErr) {
        if (switchErr?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: megaeth.name,
              nativeCurrency: megaeth.nativeCurrency,
              rpcUrls: megaeth.rpcUrls.default.http,
              blockExplorerUrls: [megaeth.blockExplorers.default.url],
            }],
          });
        } else {
          throw switchErr;
        }
      }
    }
  }, [isMoss, switchChainAsync]);

  const openWallet = useCallback(async () => {
    if (!isMoss || !connector) return;
    const provider = await connector.getProvider();
    await provider.request({ method: 'wallet_open' });
  }, [isMoss, connector]);

  const depositWallet = useCallback(async () => {
    if (!isMoss || !connector) return;
    const provider = await connector.getProvider();
    await provider.request({ method: 'wallet_deposit' });
  }, [isMoss, connector]);

  return {
    // Identity
    address,
    isConnected,
    isConnecting: isConnecting || isReconnecting,
    chain,
    chainId,
    connector,
    isMoss,
    isWrongChain,
    connectError,

    // Connect/disconnect
    connect: openSelector,
    connectors,
    disconnect,
    switchToMegaETH,
    switchToMonad: switchToMegaETH, // backwards-compat alias

    // Contract / transaction surface
    writeContract: writeContractAsync,
    walletClient,

    // MOSS-only actions. Safe no-ops on injected.
    openWallet,
    depositWallet,

    // Display
    formatAddress,
    displayAddress: address ? (megaName || formatAddress(address)) : null,
    megaName,

    // Debug / UI hints. For "is it MOSS?" checks, use isMoss instead —
    // comparing activeProvider against strings would require duplicating
    // the id-vs-name fallback logic from isMossConnector.
    activeProvider: connector?.id ?? null,
  };
}
