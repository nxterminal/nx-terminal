const API_BASE = import.meta.env.VITE_API_URL || 'https://nx-terminal.onrender.com';
const WS_BASE = API_BASE.replace('https', 'wss').replace('http', 'ws');

// Build the leaderboard query string used by the three Phase 5.12
// tabs (top-hackers / nxt-holders / dev-collectors). viewer_wallet is
// appended only when it's a non-empty string — keeps the back-compat
// URL exact (and the response shape stable) when the caller has no
// wallet connected.
function _lbQuery(limit, viewerWallet) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (viewerWallet) params.set('viewer_wallet', viewerWallet);
  return params.toString();
}

// Phase 5.12 — auto-retry parking for nickname-gated requests.
//
// When a call 409s with `nickname_required` we do NOT surface the
// error to the caller. Instead `fetchJSON` opens the onboarding modal
// (via the `nx-nickname-required` event), parks the request by simply
// holding its `url` + `options` in the closure, waits for the modal
// to emit `nx-nickname-claimed`, and then replays the identical fetch.
// The caller's original promise (`await api.hackPlayer(...)`) resolves
// with the retried result — feature code never has to know the gate
// exists.
//
// `nx-nickname-cancelled` is the defensive escape hatch: the modal is
// non-skippable today so it never fires, but if a future change adds
// a dismiss path this rejects every parked request (dropping the
// stored { url, options }) instead of leaving promises hanging.
function waitForNicknameClaim() {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener('nx-nickname-claimed', onClaimed);
      window.removeEventListener('nx-nickname-cancelled', onCancelled);
    };
    const onClaimed = () => { cleanup(); resolve(); };
    const onCancelled = () => {
      cleanup();
      reject(new Error('nickname_onboarding_cancelled'));
    };
    window.addEventListener('nx-nickname-claimed', onClaimed);
    window.addEventListener('nx-nickname-cancelled', onCancelled);
  });
}

async function fetchJSON(url, options, _isNicknameRetry = false) {
  const r = await fetch(url, options);
  if (!r.ok) {
    let detail = '';
    let structured = null;
    try {
      const body = await r.json();
      const d = body.detail || body.message || '';
      if (typeof d === 'object' && d !== null) {
        structured = d;
        detail = d.message || JSON.stringify(d);
      } else {
        detail = d;
      }
    } catch {}

    // Phase 5.12 — nickname gate. Park the request, open the modal,
    // replay it once the user claims a nickname. `_isNicknameRetry`
    // guards against an infinite loop: if the replayed request is
    // STILL gated (claim somehow didn't persist), we fall through and
    // surface the 409 like any other error rather than re-opening the
    // modal forever. Any non-409 failure of the replay is thrown by
    // the recursive call and propagates to the original caller.
    if (
      r.status === 409 &&
      structured &&
      structured.error === 'nickname_required' &&
      !_isNicknameRetry
    ) {
      try {
        window.dispatchEvent(new CustomEvent('nx-nickname-required'));
      } catch {}
      await waitForNicknameClaim(); // rejects if the modal is cancelled
      return fetchJSON(url, options, true); // replay exactly once
    }

    const err = new Error(detail || `HTTP ${r.status}`);
    if (structured) err.detail = structured;
    err.status = r.status;
    throw err;
  }
  return r.json();
}

export const api = {
  // Simulation
  getHealth: () => fetchJSON(`${API_BASE}/health`),
  getSimulationState: () => fetchJSON(`${API_BASE}/api/simulation/state`),
  getSimulationStats: () => fetchJSON(`${API_BASE}/api/simulation/stats`),
  getFeed: (limit = 50) => fetchJSON(`${API_BASE}/api/simulation/feed?limit=${limit}`),
  getEvents: () => fetchJSON(`${API_BASE}/api/simulation/events`),

  // Devs
  getDevs: (params = {}) => fetchJSON(`${API_BASE}/api/devs?${new URLSearchParams(params)}`),
  getDevCount: () => fetchJSON(`${API_BASE}/api/devs/count`),
  getDev: (id, owner) => fetchJSON(`${API_BASE}/api/devs/${id}${owner ? `?owner=${owner}` : ''}`),
  getDevMetadata: (id) => fetchJSON(`${API_BASE}/api/devs/${id}/metadata`),
  getDevHistory: (id) => fetchJSON(`${API_BASE}/api/devs/${id}/history`),
  getDevProtocols: (id) => fetchJSON(`${API_BASE}/api/devs/${id}/protocols`),
  getDevInvestments: (id) => fetchJSON(`${API_BASE}/api/devs/${id}/investments`),
  getDevAIs: (id) => fetchJSON(`${API_BASE}/api/devs/${id}/ais`),
  getDevMessages: (id) => fetchJSON(`${API_BASE}/api/devs/${id}/messages`),

  // Protocols
  getProtocols: (params = {}) => fetchJSON(`${API_BASE}/api/protocols?${new URLSearchParams(params)}`),
  getProtocol: (id) => fetchJSON(`${API_BASE}/api/protocols/${id}`),

  // AIs
  getAIs: () => fetchJSON(`${API_BASE}/api/ais`),

  // Leaderboard
  getLeaderboard: (sort = 'balance') => fetchJSON(`${API_BASE}/api/leaderboard?sort=${sort}`),
  getCorpLeaderboard: () => fetchJSON(`${API_BASE}/api/leaderboard/corporations`),
  // Bloque F: `viewerWallet` is optional. When provided the response
  // shape changes — see leaderboard.py docstrings. When null/empty
  // we omit the param entirely so the back-compat list/holders
  // shape is preserved (backend's _normalise_viewer would also fold
  // empty values back to "no viewer", but skipping the param keeps
  // the URL clean).
  getTopHackers: (limit = 50, viewerWallet = null) =>
    fetchJSON(`${API_BASE}/api/leaderboard/top-hackers?${_lbQuery(limit, viewerWallet)}`),
  getNxtHolders: (limit = 50, viewerWallet = null) =>
    fetchJSON(`${API_BASE}/api/leaderboard/nxt-holders?${_lbQuery(limit, viewerWallet)}`),
  getDevCollectors: (limit = 50, viewerWallet = null) =>
    fetchJSON(`${API_BASE}/api/leaderboard/dev-collectors?${_lbQuery(limit, viewerWallet)}`),

  // Chat
  getDevChat: (channel = 'trollbox') => fetchJSON(`${API_BASE}/api/chat/devs?channel=${channel}`),
  getWorldChat: () => fetchJSON(`${API_BASE}/api/chat/world`),
  postWorldChat: (player_address, display_name, message) =>
    fetchJSON(`${API_BASE}/api/chat/world`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_address, display_name, message }),
    }),

  // Shop
  getShop: () => fetchJSON(`${API_BASE}/api/shop`),
  buyItem: (player_address, item_id, target_dev_id) =>
    fetchJSON(`${API_BASE}/api/shop/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_address, item_id, target_dev_id }),
    }),
  graduate: (player_address, dev_id) =>
    fetchJSON(`${API_BASE}/api/shop/graduate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_address, dev_id }),
    }),
  hackMainframe: (player_address, attacker_dev_id) =>
    fetchJSON(`${API_BASE}/api/shop/hack-mainframe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_address, attacker_dev_id }),
    }),
  // Phase 5.13 — target_nickname optional. When passed, the backend
  // raids that specific player (PvP targeting modal). When omitted,
  // the legacy random matchmaker runs (the "HACK RANDOM" button).
  hackPlayer: (player_address, attacker_dev_id, target_nickname = null) =>
    fetchJSON(`${API_BASE}/api/shop/hack-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        target_nickname
          ? { player_address, attacker_dev_id, target_nickname }
          : { player_address, attacker_dev_id },
      ),
    }),
  fixBug: (player_address, dev_id) =>
    fetchJSON(`${API_BASE}/api/shop/fix-bug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_address, dev_id }),
    }),
  fundDev: (player_address, dev_token_id, amount, tx_hash) =>
    fetchJSON(`${API_BASE}/api/shop/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_address, dev_token_id, amount, tx_hash }),
    }),
  transferNxt: (player_address, from_dev_token_id, to_dev_token_id, amount) =>
    fetchJSON(`${API_BASE}/api/shop/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_address, from_dev_token_id, to_dev_token_id, amount }),
    }),
  getPendingFundStatus: (tx_hash) =>
    fetchJSON(`${API_BASE}/api/shop/pending-funds/status/${tx_hash}`),

  // Players
  getPlayer: (wallet) => fetchJSON(`${API_BASE}/api/players/${wallet}`),
  getClaimHistory: (wallet) => fetchJSON(`${API_BASE}/api/players/${wallet}/claim-history`),
  recordClaim: (wallet, data) => fetchJSON(`${API_BASE}/api/players/${wallet}/record-claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  // Phase 5.12 — nickname onboarding. checkNickname returns `{ok}` with
  // a distinct `error` code per failure mode (invalid_nickname /
  // nickname_reserved / nickname_taken) so the modal can render the
  // right message. claimNickname does the one-shot UPDATE on the
  // existing players row created by the on-chain mint listener.
  checkNickname: (nickname) =>
    fetchJSON(`${API_BASE}/api/players/check-nickname?nickname=${encodeURIComponent(nickname)}`),
  claimNickname: (wallet_address, nickname) =>
    fetchJSON(`${API_BASE}/api/players/claim-nickname`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address, nickname }),
    }),
  // Phase 5.13 — PvP targeting search. q ≥ 3 chars; prefix match on
  // nickname or exact match on a full 0x wallet. `caller` is excluded
  // from results. Response never contains wallet addresses.
  searchPlayers: (q, caller = null, limit = 10) => {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (caller) params.set('caller', caller);
    return fetchJSON(`${API_BASE}/api/players/search?${params.toString()}`);
  },

  // NX Souls — chat list (per-wallet view of every Dev with quota /
  // status / resting flags). Backed by GET /api/user/{wallet}/conversations.
  getUserConversations: (wallet) =>
    fetchJSON(`${API_BASE}/api/user/${wallet}/conversations`),

  // NX Souls — active chats (only Devs with non-expired persisted
  // messages). Backed by GET /api/user/{wallet}/active-chats. Phase
  // 3.5.2 left-pane data source.
  getActiveChats: (wallet) =>
    fetchJSON(`${API_BASE}/api/user/${wallet}/active-chats`),

  // NX Souls — full message history for one Dev's chat. Phase 3.5.3
  // will wire ChatConversation to this on open; Phase 3.5.2 just
  // makes the wrapper available.
  getMessages: (wallet, tokenId) =>
    fetchJSON(`${API_BASE}/api/user/${wallet}/messages?token_id=${tokenId}`),

  // Sprkls — toast feed (Phase 4.2). Backed by GET /api/user/{wallet}/sprkls/recent.
  // The backend filters to non-dismissed, non-expired, last-24h
  // sprkls + joins to nx.devs for the rendering metadata.
  getSprkls: (wallet) =>
    fetchJSON(`${API_BASE}/api/user/${wallet}/sprkls/recent`),

  // Sprkls — dismiss one. POST /api/user/{wallet}/sprkls/dismiss/{post_id}.
  // Idempotent server-side (UPDATE includes a dismissed_at IS NULL
  // guard). 404 for cross-wallet probes.
  dismissSprkl: (wallet, postId) =>
    fetchJSON(`${API_BASE}/api/user/${wallet}/sprkls/dismiss/${postId}`, {
      method: 'POST',
    }),

  // ── NX POSTS Phase 5.2 ─────────────────────────────────────────
  // Public global feed across all Devs / wallets. The viewer wallet
  // is optional — when passed, each post in the response carries
  // user_has_liked: bool for that wallet. tab ∈
  // {latest, for_you, top_today, awakenings}.
  getPostsTimeline: ({ tab = 'latest', limit = 20, before, wallet } = {}) => {
    const qs = new URLSearchParams({ tab, limit: String(limit) });
    if (before) qs.set('before', String(before));
    if (wallet) qs.set('wallet', wallet);
    return fetchJSON(`${API_BASE}/api/posts/timeline?${qs.toString()}`);
  },

  // Single post + its immediate replies. Used by the "in reply to"
  // affordance when the parent post isn't visible in the timeline.
  getPost: (postId, wallet) => {
    const qs = wallet ? `?wallet=${wallet}` : '';
    return fetchJSON(`${API_BASE}/api/posts/${postId}${qs}`);
  },

  // Like / unlike. Both are idempotent server-side
  // (UNIQUE constraint + ON CONFLICT DO NOTHING / no-404-on-unlike).
  // The frontend optimistic-updates the like icon and re-syncs the
  // count from the response.
  likePost: (postId, wallet) =>
    fetchJSON(
      `${API_BASE}/api/posts/${postId}/like?wallet=${wallet}`,
      { method: 'POST' },
    ),
  unlikePost: (postId, wallet) =>
    fetchJSON(
      `${API_BASE}/api/posts/${postId}/like?wallet=${wallet}`,
      { method: 'DELETE' },
    ),

  // Trending hashtags over the last 7 days. Top 10, ordered DESC.
  getPostsTrending: () =>
    fetchJSON(`${API_BASE}/api/posts/trending`),

  // Sidebar counters (devs_active / posts_today / devs_dormant).
  getPostsFeedStats: () =>
    fetchJSON(`${API_BASE}/api/posts/feed-stats`),

  // 3 random Devs the viewer doesn't already own and that have
  // posted recently. Engagement starter — no real follow mechanic
  // in MVP.
  getPostsWhoToFollow: (wallet) =>
    fetchJSON(`${API_BASE}/api/posts/who-to-follow?wallet=${wallet}`),

  // NX Souls — send a message to a Dev. POST /api/devs/{tokenId}/chat.
  // The optional AbortSignal lets callers cancel an in-flight request
  // when the user navigates away mid-typing (Phase 3.4 ChatConversation).
  postChat: (tokenId, payload, signal) =>
    fetchJSON(`${API_BASE}/api/devs/${tokenId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    }),

  // Wallet
  getWalletSummary: (wallet) => fetchJSON(`${API_BASE}/api/players/${wallet}/wallet-summary`),
  getBalanceHistory: (wallet, days = 30) => fetchJSON(`${API_BASE}/api/players/${wallet}/balance-history?days=${days}`),
  getMovements: (wallet, limit = 50) => fetchJSON(`${API_BASE}/api/players/${wallet}/movements?limit=${limit}`),
  getWalletActivity: (wallet, { limit, dev_token_id } = {}) => {
    const params = new URLSearchParams();
    if (limit != null) params.set('limit', String(limit));
    if (dev_token_id != null) params.set('dev_token_id', String(dev_token_id));
    const q = params.toString();
    return fetchJSON(`${API_BASE}/api/players/${wallet}/activity${q ? `?${q}` : ''}`);
  },

  // Notifications
  getNotifications: (wallet, unread = false) =>
    fetchJSON(`${API_BASE}/api/notifications/${wallet}?unread=${unread}`),
  markNotificationRead: (id) =>
    fetchJSON(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: (wallet) =>
    fetchJSON(`${API_BASE}/api/notifications/${wallet}/read-all`, { method: 'POST' }),
  submitTicket: (wallet, subject, message) =>
    fetchJSON(`${API_BASE}/api/notifications/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, subject, message }),
    }),

  // Prompts
  postPrompt: (devId, playerAddress, promptText) =>
    fetchJSON(`${API_BASE}/api/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dev_id: devId, player_address: playerAddress, prompt_text: promptText }),
    }),

  // Claim Sync
  getClaimSyncStatus: () => fetchJSON(`${API_BASE}/api/claim-sync/status`),
  forceClaimSync: (tokenIds, walletAddress) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s — sync waits for TX receipt
    const payload = {};
    if (walletAddress) payload.wallet_address = walletAddress.toLowerCase();
    if (tokenIds && tokenIds.length) payload.token_ids = tokenIds;
    return fetchJSON(`${API_BASE}/api/claim-sync/force`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: Object.keys(payload).length ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  },

  // Sentinel
  sentinelHealth: () => fetchJSON(`${API_BASE}/api/sentinel/health`),
  sentinelXray: (contract) => fetchJSON(`${API_BASE}/api/sentinel/xray?contract=${contract}`),
  sentinelFirewallScan: (wallet) => fetchJSON(`${API_BASE}/api/sentinel/firewall/scan?wallet=${wallet}`),
  sentinelFirewallRevoke: (token, spender, wallet) =>
    fetchJSON(`${API_BASE}/api/sentinel/firewall/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, spender, wallet }),
    }),
  sentinelAutopsy: (contract) => fetchJSON(`${API_BASE}/api/sentinel/autopsy?contract=${contract}`),
  sentinelHologram: (contract) => fetchJSON(`${API_BASE}/api/sentinel/hologram?contract=${contract}`),
  sentinelGraduation: (filter = 'all', page = 1, limit = 20) =>
    fetchJSON(`${API_BASE}/api/sentinel/graduation?filter=${filter}&page=${page}&limit=${limit}`),

  // Missions
  getMissionsAvailable: (wallet) => fetchJSON(`${API_BASE}/api/missions/available?wallet=${wallet}`),
  getMissionsActive: (wallet) => fetchJSON(`${API_BASE}/api/missions/active?wallet=${wallet}`),
  getMissionsHistory: (wallet, limit = 50) => fetchJSON(`${API_BASE}/api/missions/history?wallet=${wallet}&limit=${limit}`),
  startMission: (wallet, mission_id, dev_token_ids) =>
    fetchJSON(`${API_BASE}/api/missions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, mission_id, dev_token_ids }),
    }),
  claimMission: (wallet, player_mission_id) =>
    fetchJSON(`${API_BASE}/api/missions/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, player_mission_id }),
    }),
  abandonMission: (wallet, player_mission_id) =>
    fetchJSON(`${API_BASE}/api/missions/abandon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, player_mission_id }),
    }),

  // Training
  getTrainingCatalog: () => fetchJSON(`${API_BASE}/api/shop/training/catalog`),
  getActiveTraining: (wallet) => fetchJSON(`${API_BASE}/api/shop/training/active?wallet=${wallet}`),

  // Streak
  getStreak: (wallet) => fetchJSON(`${API_BASE}/api/streak?wallet=${wallet}`),
  claimStreak: (wallet) =>
    fetchJSON(`${API_BASE}/api/streak/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet }),
    }),

  // Achievements
  getAchievements: (wallet) => fetchJSON(`${API_BASE}/api/achievements?wallet=${wallet}`),
  claimAchievement: (wallet, achievement_id) =>
    fetchJSON(`${API_BASE}/api/achievements/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, achievement_id }),
    }),

  // Admin: support tickets. Caller passes the connected wallet; it
  // goes in the X-Admin-Wallet header which the backend matches
  // against ADMIN_WALLETS. Non-admin wallets get 403, so these are
  // safe to call from a wallet-agnostic component (server gates).
  getAdminTickets: (wallet, status = 'open', limit = 50) =>
    fetchJSON(
      `${API_BASE}/api/admin/tickets?status=${encodeURIComponent(status)}&limit=${limit}`,
      { headers: { 'X-Admin-Wallet': wallet || '' } },
    ),
  replyToTicket: (wallet, ticket_id, text) =>
    fetchJSON(`${API_BASE}/api/admin/tickets/${ticket_id}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Wallet': wallet || '',
      },
      body: JSON.stringify({ text }),
    }),

  // NXMARKET — prediction markets. All endpoints live under /api/nxmarket
  // (public) and /api/admin/nxmarket (admin-gated by X-Admin-Wallet).
  // Backend is source of truth; non-admin callers of admin endpoints get
  // 403 even though we mirror the wallet set client-side for UX.
  listMarkets: (params = {}) => {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all')
    );
    const qs = new URLSearchParams(filtered).toString();
    return fetchJSON(`${API_BASE}/api/nxmarket/markets${qs ? `?${qs}` : ''}`);
  },
  getMarketDetail: (marketId) =>
    fetchJSON(`${API_BASE}/api/nxmarket/markets/${marketId}`),
  createUserMarket: (body) =>
    fetchJSON(`${API_BASE}/api/nxmarket/markets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  createOfficialMarket: (wallet, body) =>
    fetchJSON(`${API_BASE}/api/admin/nxmarket/markets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Wallet': wallet || '',
      },
      body: JSON.stringify(body),
    }),
  buyShares: (marketId, body) =>
    fetchJSON(`${API_BASE}/api/nxmarket/markets/${marketId}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  exitPosition: (marketId, body) =>
    fetchJSON(`${API_BASE}/api/nxmarket/markets/${marketId}/exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  resolveMarket: (wallet, marketId, resolution) =>
    fetchJSON(`${API_BASE}/api/admin/nxmarket/markets/${marketId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Wallet': wallet || '',
      },
      body: JSON.stringify({ resolution }),
    }),

  // NXMARKET comments (PR C1) — flat per-market thread, like/dislike
  // votes, soft delete, 1-per-minute rate limit on create.
  listComments: (marketId, wallet, limit = 20, offset = 0) => {
    const params = new URLSearchParams({ limit, offset });
    if (wallet) params.append('wallet', wallet);
    return fetchJSON(`${API_BASE}/api/nxmarket/markets/${marketId}/comments?${params}`);
  },
  createComment: (marketId, wallet, body) =>
    fetchJSON(`${API_BASE}/api/nxmarket/markets/${marketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, body }),
    }),
  deleteComment: (commentId, wallet) =>
    fetchJSON(`${API_BASE}/api/nxmarket/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'X-Wallet': wallet || '' },
    }),
  voteComment: (commentId, wallet, vote) =>
    fetchJSON(`${API_BASE}/api/nxmarket/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, vote }),
    }),

  // NXMARKET leaderboard (PR C2) — top users by net profit. Period
  // toggle: 'all' (entire history) or '30d' (last 30 days). Renamed
  // from getLeaderboard to avoid colliding with the main Leaderboard
  // window's `api.getLeaderboard(sort)` at the top of this file —
  // duplicate keys in the same object literal silently dropped the
  // first definition, and the main Leaderboard's `?sort=balance`
  // started landing here as `?period=balance` and 422'd against the
  // `^(all|30d)$` pattern.
  getNxmarketLeaderboard: (period = 'all', limit = 25) =>
    fetchJSON(
      `${API_BASE}/api/nxmarket/leaderboard?period=${encodeURIComponent(period)}&limit=${limit}`,
    ),

  // NXMARKET dev→market escalera. Returns dev_count, max_markets,
  // active_markets, remaining, can_create so the Create Market modal
  // can warn (or block) before hitting the 400 at submit.
  getUserCap: (wallet) =>
    fetchJSON(`${API_BASE}/api/nxmarket/markets/cap/${wallet}`),

  // NXMARKET admin pending list — closed-unresolved markets with
  // per-side pool breakdowns. Drives the yellow alert banner atop
  // MarketsList for admin wallets.
  getPendingMarkets: (wallet) =>
    fetchJSON(`${API_BASE}/api/nxmarket/markets/pending`, {
      headers: { 'X-Admin-Wallet': wallet || '' },
    }),

  // WebSocket
  wsUrl: `${WS_BASE}/ws/feed`,
};
