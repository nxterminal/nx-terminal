import { useWalletProviderContext } from '../contexts/WalletProviderContext';
import { useWalletWagmi } from './useWalletWagmi';
import { useWalletMoss } from './useWalletMoss';

// useWallet — unified wallet hook, provider-agnostic.
//
// Dispatches to the wagmi or MOSS implementation based on the active
// provider stored in WalletProviderContext. Both return the same shape,
// so existing consumers (Desktop, Mint, FundDev, NXT Wallet, etc.) keep
// working without changes.
//
// Important backward-compat note:
// - When activeProvider === null (first-time user, nobody has picked yet),
//   we default to wagmi so read-only flows and pre-connect UI continue
//   behaving exactly as before the refactor.
// - Both hooks are always called (Rules of Hooks), but only the active
//   one's return value is used. wagmi's hooks are cheap when disconnected;
//   MOSS's iframe bootstraps lazily — see useWalletMoss for details.

export function useWallet() {
  const { isMoss } = useWalletProviderContext();

  // Both hooks must be called unconditionally to satisfy Rules of Hooks.
  // The inactive one's result is simply ignored.
  const wagmi = useWalletWagmi();
  const moss = useWalletMoss();

  return isMoss ? moss : wagmi;
}
