/* WalletSelectorCancelOverlay.module.css
 *
 * Floating cancel button shown on top of the MOSS iframe while a connect
 * is pending. Matches the dark, modern aesthetic of WalletSelectorModal —
 * deliberately distinct from the Win98 chrome of the main app since both
 * live on top of the MOSS iframe's own branded background.
 */

.overlay {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 10100; /* > MOSS iframe's 9999, > our selector modal's 10050 */
  pointer-events: none; /* container is non-interactive; only the button */
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 10px 12px;
  background: rgba(20, 20, 24, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #e8e8ea;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  pointer-events: auto;
  backdrop-filter: blur(8px);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    transform 80ms ease;
}

.button:hover {
  background: rgba(40, 40, 48, 0.96);
  border-color: rgba(255, 255, 255, 0.2);
}

.button:active {
  transform: scale(0.98);
}

.button:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 20px;
  line-height: 1;
  font-weight: 400;
  color: #b8b8bc;
}

.label {
  letter-spacing: 0.01em;
}
