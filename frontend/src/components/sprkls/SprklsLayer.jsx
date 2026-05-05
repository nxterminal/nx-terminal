/**
 * SprklsLayer — chrome-floating container for sprkls.
 *
 * Mounted unconditionally in App.jsx. The beta gate +
 * walletAddress check inside this component returns null when the
 * user shouldn't see anything — non-beta wallets pay zero render
 * cost and the polling never starts.
 *
 * Two visual surfaces, one hook (so a single `dismiss` set is
 * authoritative across both):
 *
 *   1. Toasts (Phase 4.2) — bottom-right column, MAX 3 visible,
 *      auto-dismiss after visual_metadata.duration_ms.
 *   2. Graffiti (Phase 4.3, this PR) — viewport overlay,
 *      absolutely positioned per visual_metadata.position. NO auto-
 *      dismiss; the user clicks the text to clear it.
 *
 * Other action types (window / screensaver / wallpaper /
 * desktop_file / cursor_prank / fake_popup) are silently skipped
 * here and will land in Phases 4.4-4.5. The hook still returns
 * the full feed so future surfaces can subscribe alongside without
 * forcing a hook refactor.
 *
 * Layer ordering (z-index):
 *   - Desktop / WindowManager: ≤ 100s
 *   - Graffiti layer: 9300                 ← Phase 4.3
 *   - Toast layer:    9500
 *   - NX Souls modal: 9999
 *   - NewChatPicker:  10001
 *
 * Graffiti sits BELOW toasts so a fresh notification still pops
 * over a busy desktop — the toast is the more time-sensitive
 * surface and shouldn't get visually drowned by stacked graffiti.
 */

import { useWallet } from '../../hooks/useWallet';
import { useChatModal } from '../../contexts/ChatContext';
import { useSprkls } from '../../hooks/useSprkls';
import { isInNXSoulsBeta } from '../../config/betaFeatures';
import SprklToast from './SprklToast';
import SprklGraffiti from './SprklGraffiti';
import styles from './sprkls.module.css';

const MAX_VISIBLE_TOASTS = 3;

export default function SprklsLayer() {
  const { address } = useWallet();
  const { openChatModal } = useChatModal();
  const isBeta = isInNXSoulsBeta(address);

  // Polling only runs while enabled — non-beta wallets don't even
  // hit /sprkls/recent. Disconnected wallet is handled by the hook's
  // !walletAddress branch (loading=true, no fetch).
  const { sprkls, dismiss } = useSprkls(address, { enabled: isBeta });

  if (!isBeta || !address) return null;

  // Phase 4.2 + 4.3 only render toast and graffiti. The filters are
  // the entire opt-in surface for these PRs — other action types
  // pass straight through the hook's array but render nothing here.
  const toastSprkls = sprkls.filter((s) => s.action_type === 'toast');
  const graffitiSprkls = sprkls.filter((s) => s.action_type === 'graffiti');

  const visibleToasts = toastSprkls.slice(0, MAX_VISIBLE_TOASTS);

  return (
    <>
      <div className={styles.sprklsGraffitiLayer}>
        {graffitiSprkls.map((sprkl) => (
          <SprklGraffiti
            key={sprkl.id}
            sprkl={sprkl}
            onDismiss={() => dismiss(sprkl.id)}
            // No onClick passed — graffiti dismisses on click per the
            // Phase 4.3 brief. If a future variant wants click-to-open-
            // chat, pass `onClick={() => openChatModal(sprkl.token_id)}`
            // and SprklGraffiti will honour it.
          />
        ))}
      </div>
      <div className={styles.sprklsLayer}>
        {visibleToasts.map((sprkl) => (
          <SprklToast
            key={sprkl.id}
            sprkl={sprkl}
            onDismiss={() => dismiss(sprkl.id)}
            onClick={() => openChatModal(sprkl.token_id)}
          />
        ))}
      </div>
    </>
  );
}
