import { useWalletProviderContext } from '../contexts/WalletProviderContext';
import { useWalletSelector } from '../contexts/WalletSelectorContext';
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
//   we default to wagmi for read-only fields so pre-connect UI keeps
//   behaving as before — but we re-route connect() to open the wallet
//   selector instead of firing a direct wagmi connect. This keeps the 8+
//   non-taskbar connect() call sites from silently choosing a provider
//   for the user.
// - Both provider hooks are always called (Rules of Hooks), but only the
//   active one's return value is used. wagmi's hooks are cheap when
//   disconnected; MOSS's iframe bootstraps lazily — see useWalletMoss for
//   details.

export function useWallet() {
  const { activeProvider, isMoss } = useWalletProviderContext();
  const { open: openSelector } = useWalletSelector();

  // Both hooks must be called unconditionally to satisfy Rules of Hooks.
  // The inactive one's result is simply ignored.
  const wagmi = useWalletWagmi();
  const moss = useWalletMoss();

  const base = isMoss ? moss : wagmi;

  if (activeProvider === null) {
    return { ...base, connect: openSelector };
  }
  return base;
}
