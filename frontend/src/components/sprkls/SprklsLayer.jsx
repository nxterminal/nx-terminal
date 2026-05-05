/**
 * SprklsLayer — chrome-floating container for sprkl toasts.
 *
 * Mounted unconditionally in App.jsx (so the container is always
 * available to render into); the beta gate + walletAddress check
 * inside this component returns null when the user shouldn't see
 * any toasts.
 *
 * Phase 4.2 scope: only `action_type='toast'` sprkls are rendered.
 * Other action types (graffiti / window / screensaver / wallpaper /
 * desktop_file / cursor_prank / fake_popup) are silently ignored
 * here and will land in Phases 4.3-4.5. The hook still returns the
 * full feed so the future layers can subscribe alongside this one
 * without forcing a hook refactor.
 *
 * Stack semantics:
 *   - Render at most MAX_VISIBLE_TOASTS at a time. Backend already
 *     hard-caps the feed at 50 (services/user.py
 *     _RECENT_SPRKLS_MAX) so a runaway scheduler can't overwhelm
 *     the layer; this is the visual ceiling.
 *   - Most-recent first (the backend ORDERs by created_at DESC).
 *     Combined with `flex-direction: column-reverse` in the CSS, a
 *     fresh toast slides in at the BOTTOM of the stack — natural
 *     for a bottom-right anchor.
 *   - Click on a toast → openChatModal(sprkl.token_id), which
 *     opens the NX Souls modal directly into that Dev's
 *     conversation (Phase 3.6 entry path).
 *
 * Z-index: 9500 — above Desktop / WindowManager (≤ 100s) but below
 * the NX Souls chat modal (9999) so opening the modal cleanly
 * covers the toast that triggered it.
 */

import { useWallet } from '../../hooks/useWallet';
import { useChatModal } from '../../contexts/ChatContext';
import { useSprkls } from '../../hooks/useSprkls';
import { isInNXSoulsBeta } from '../../config/betaFeatures';
import SprklToast from './SprklToast';
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

  // Phase 4.2 only renders toasts. The filter is the entire opt-in
  // surface for this PR — other action types pass straight through
  // the hook's array but render nothing here.
  const toastSprkls = sprkls.filter((s) => s.action_type === 'toast');
  const visible = toastSprkls.slice(0, MAX_VISIBLE_TOASTS);

  return (
    <div className={styles.sprklsLayer}>
      {visible.map((sprkl) => (
        <SprklToast
          key={sprkl.id}
          sprkl={sprkl}
          onDismiss={() => dismiss(sprkl.id)}
          onClick={() => openChatModal(sprkl.token_id)}
        />
      ))}
    </div>
  );
}
