import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import styles from './NicknameOnboardingModal.module.css';

// NicknameOnboardingModal — one-shot capture of the player's nickname.
//
// Phase 5.12. Opened by Desktop when:
//   1. A wallet connects and `api.getPlayer(addr)` returns
//      `display_name === null`, OR
//   2. Any API call returns 409 nickname_required (fetchJSON dispatches
//      the `nx-nickname-required` window event).
//
// Not dismissable — no backdrop click, no ESC, no close button. The
// wallet is gated from sensitive actions on the backend, so dismissing
// would just defer the same modal to the next interaction. The only
// way out is to claim a valid nickname.
//
// Live validation calls `GET /api/players/check-nickname` after a
// 400ms debounce. Submit is gated on a successful check OR an
// implicit one (we re-check on submit too in case the user mashed
// Enter before the debounce fired).

const NICKNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const DEBOUNCE_MS = 400;

// Mirror of backend's error → user-facing message mapping. Kept in
// sync with backend/api/routes/players.py:_validate_nickname_format
// and backend/config/reserved_nicknames.py.
const ERROR_MESSAGES = {
  invalid_nickname: 'Use 3–20 letters, digits, or underscores.',
  nickname_reserved: 'That nickname is reserved.',
  nickname_taken: 'That nickname is already in use.',
  nickname_already_set: 'Your nickname is already set.',
  player_not_found: "No player profile found. Mint a Dev first, then come back.",
};

export default function NicknameOnboardingModal({ walletAddress, onClaimed }) {
  const [value, setValue] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  // status: 'idle' | 'checking' | 'ok' | 'error' | 'submitting'
  // (state also carries `code` and `message` on 'error', and the
  // last-checked nickname string on 'ok' so submit knows the check is
  // still valid.)
  const [submitError, setSubmitError] = useState('');
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const checkSeqRef = useRef(0);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    setSubmitError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed) {
      setState({ status: 'idle' });
      return;
    }
    if (!NICKNAME_RE.test(trimmed)) {
      setState({
        status: 'error',
        code: 'invalid_nickname',
        message: ERROR_MESSAGES.invalid_nickname,
      });
      return;
    }

    setState({ status: 'checking' });
    const mySeq = ++checkSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.checkNickname(trimmed);
        if (mySeq !== checkSeqRef.current) return; // stale
        if (res.ok) {
          setState({ status: 'ok', checked: trimmed });
        } else {
          setState({
            status: 'error',
            code: res.error,
            message: ERROR_MESSAGES[res.error] || res.message || 'Unavailable.',
          });
        }
      } catch (err) {
        if (mySeq !== checkSeqRef.current) return;
        // Network failure → leave the input in idle so submit's
        // server-side check is the source of truth. Don't pretend the
        // nickname is ok and don't pretend it's invalid.
        setState({ status: 'idle' });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const canSubmit =
    state.status === 'ok' && state.checked === value.trim() && !!walletAddress;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setState((s) => ({ ...s, status: 'submitting' }));
    setSubmitError('');
    try {
      const trimmed = value.trim();
      await api.claimNickname(walletAddress, trimmed);
      onClaimed?.(trimmed);
    } catch (err) {
      const code = err?.detail?.error;
      setSubmitError(
        ERROR_MESSAGES[code] || err?.message || 'Could not save nickname.',
      );
      setState({ status: 'error', code, message: ERROR_MESSAGES[code] || '' });
    }
  }

  const inputClass = [
    styles.input,
    state.status === 'error' ? styles.invalid : '',
    state.status === 'ok' ? styles.valid : '',
  ]
    .filter(Boolean)
    .join(' ');

  let hint = '';
  let hintClass = styles.hint;
  if (state.status === 'checking') {
    hint = 'Checking…';
  } else if (state.status === 'ok') {
    hint = 'Available.';
    hintClass = `${styles.hint} ${styles.ok}`;
  } else if (state.status === 'error') {
    hint = state.message || '';
    hintClass = `${styles.hint} ${styles.error}`;
  }
  if (submitError) {
    hint = submitError;
    hintClass = `${styles.hint} ${styles.error}`;
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nickname-onboarding-title"
    >
      <form className={styles.dialog} onSubmit={handleSubmit}>
        <h2 id="nickname-onboarding-title" className={styles.title}>
          Choose your nickname
        </h2>
        <p className={styles.subtitle}>
          This is how other players will know you in NX Terminal.
          It's tied to your wallet and can't be changed later.
        </p>

        <label className={styles.label} htmlFor="nickname-input">
          Nickname
        </label>
        <div className={styles.inputWrap}>
          <input
            id="nickname-input"
            ref={inputRef}
            className={inputClass}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={20}
            spellCheck={false}
            autoComplete="off"
            placeholder="e.g. valent1ne"
            disabled={state.status === 'submitting'}
          />
        </div>
        <p className={hintClass}>{hint}</p>

        <div className={styles.rules}>
          Rules:
          <ul>
            <li>3–20 characters</li>
            <li>Letters, digits, and underscores only</li>
            <li>Unique across all wallets</li>
            <li>Permanent — choose carefully</li>
          </ul>
        </div>

        <button
          type="submit"
          className={styles.submit}
          disabled={!canSubmit || state.status === 'submitting'}
        >
          {state.status === 'submitting' ? 'Saving…' : 'Claim nickname'}
        </button>
      </form>
    </div>
  );
}
