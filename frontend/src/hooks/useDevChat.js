/**
 * useDevChat(walletAddress, tokenId) — fire-and-await wrapper around
 * POST /api/devs/{tokenId}/chat.
 *
 * Returns:
 *   - sendMessage(text, sessionMessages) → Promise<resp | null>
 *       Returns the parsed JSON response (so callers can read
 *       `is_resting`, `quota`, `provider_used`). Returns `null` when
 *       the request was aborted (caller navigated away). Throws on
 *       any other failure — error mapping happens at the caller so
 *       different UIs can surface different messaging.
 *   - isTyping: boolean — true between request start and response /
 *       error / abort. Drives the typing indicator and the composer
 *       disabled state.
 *   - error: Error | null — the most recent thrown error, with
 *       `error.detail` populated for structured backend responses
 *       (ip_rate_limited, all_providers_failed, etc.) thanks to the
 *       fetchJSON helper.
 *
 * Cancellation:
 *   - sendMessage cancels any in-flight request before starting a new
 *     one (fast-typer protection).
 *   - The hook aborts any in-flight request on unmount, so navigating
 *     out of the conversation view (back arrow, modal close) cancels
 *     the fetch. fetchJSON propagates the AbortSignal to fetch via
 *     `options.signal`.
 *
 * State persistence:
 *   - The hook holds NO message history. The conversation component
 *     owns the messages array; this hook is just the I/O surface.
 *     Phase A is stateless by design — when the modal closes the
 *     history is gone.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export function useDevChat(walletAddress, tokenId) {
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);

  // Tracks the active AbortController so we can cancel the previous
  // request when a new one starts, and on unmount.
  const abortRef = useRef(null);

  const sendMessage = useCallback(
    async (text, sessionMessages = []) => {
      if (!walletAddress || !tokenId) {
        throw new Error('useDevChat: walletAddress and tokenId required');
      }

      // Cancel any in-flight call first. Without this a fast typer
      // could end up with two responses racing to update state and
      // a quota slot consumed for a reply they'll never see.
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsTyping(true);
      setError(null);

      try {
        const res = await api.postChat(
          tokenId,
          {
            message: text,
            session_messages: sessionMessages,
            wallet_address: walletAddress,
          },
          controller.signal
        );
        // Defensive: only commit if we're still the current request.
        // If a newer call superseded us between fetch resolution and
        // this line, the controller is no longer in abortRef.
        if (abortRef.current !== controller) return null;
        return res;
      } catch (e) {
        // AbortError: fetch was cancelled — caller navigated away or
        // a newer request superseded us. Don't surface as a real
        // error; return null so the caller can no-op cleanly.
        if (e?.name === 'AbortError') return null;
        if (abortRef.current === controller) {
          setError(e);
        }
        throw e;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsTyping(false);
        }
      }
    },
    [walletAddress, tokenId]
  );

  // Cancel any in-flight request on unmount. Without this, navigating
  // out of the conversation view while waiting for the LLM cascade
  // would leak the fetch and might consume a quota slot for a reply
  // the user will never see.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { sendMessage, isTyping, error };
}
