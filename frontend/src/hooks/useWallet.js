import { useWalletProviderContext } from '../contexts/WalletProviderContext';
import { useWalletSelector } from '../contexts/WalletSelectorContext';
import { useWalletWagmi } from './useWalletWagmi';
import { useWalletMoss } from './useWalletMoss';

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
// - writeContract: when no provider has been picked, we replace it with a
//   helper that opens the selector and throws, rather than silently using
//   the default (wagmi). This prevents "mint failed silently" bugs when a
//   user clicks mint while MOSS is their saved preference but wagmi is the
//   fallback shape we're returning.

export function useWallet() {
  const { activeProvider, isMoss } = useWalletProviderContext();
  const { open: openSelector } = useWalletSelector();
  // Both hooks must be called unconditionally to satisfy Rules of Hooks.
  // The inactive one's result is simply ignored.
  const wagmi = useWalletWagmi();
  const moss = useWalletMoss();
  const base = isMoss ? moss : wagmi;

  if (activeProvider === null) {
    const connectThenThrow = async () => {
      openSelector();
      throw new Error('Please connect a wallet first.');
    };
    return {
      ...base,
      connect: openSelector,
      writeContract: connectThenThrow,
    };
  }

  return base;
}
