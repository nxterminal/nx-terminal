/**
 * useChatHistory(walletAddress, tokenId, { enabled }) — Phase 3.5.2
 * stub.
 *
 * Phase 3.5.2 lands this file with the right signature so Phase 3.5.3
 * only has to fill in the body — no consumer refactors, no
 * circular-dep dance. The corresponding API wrapper
 * `api.getMessages(wallet, tokenId)` is already shipped in
 * services/api.js.
 *
 * Intended Phase 3.5.3 behaviour:
 *   - Fetch GET /api/user/{wallet}/messages?token_id={tokenId} on
 *     mount and on tokenId/wallet change.
 *   - Return { messages: [...], loading, error, reload() } so
 *     ChatConversation can hydrate its messages array on open.
 *   - No polling — chat history is stable between sends; the
 *     Conversation will append optimistically + call reload after
 *     a successful send if the backend is the source of truth.
 *
 * Phase 3.5.2 stub: returns the shape but does not fetch. Safe to
 * import from ChatConversation today, even though nothing mounts it
 * yet — the stub keeps eslint happy if a Phase 3.5.3 PR pre-imports
 * it ahead of wiring.
 */

export function useChatHistory(/* walletAddress, tokenId, options */) {
  return {
    messages: [],
    loading: false,
    error: null,
    // Phase 3.5.3 will return a real refetcher; the stub's noop is
    // safe because callers will already render with messages=[].
    reload: () => {},
  };
}
