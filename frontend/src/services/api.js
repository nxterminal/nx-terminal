const API_BASE = import.meta.env.VITE_API_URL || 'https://nx-terminal.onrender.com';
const WS_BASE = API_BASE.replace('https', 'wss').replace('http', 'ws');

async function fetchJSON(url, options) {
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
    const err = new Error(detail || `HTTP ${r.status}`);
    if (structured) err.detail = structured;
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
  hackPlayer: (player_address, attacker_dev_id) =>
    fetchJSON(`${API_BASE}/api/shop/hack-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_address, attacker_dev_id }),
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

  // Players
  getPlayer: (wallet) => fetchJSON(`${API_BASE}/api/players/${wallet}`),
  getClaimHistory: (wallet) => fetchJSON(`${API_BASE}/api/players/${wallet}/claim-history`),
  recordClaim: (wallet, data) => fetchJSON(`${API_BASE}/api/players/${wallet}/record-claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  // Wallet
  getWalletSummary: (wallet) => fetchJSON(`${API_BASE}/api/players/${wallet}/wallet-summary`),
  getBalanceHistory: (wallet, days = 30) => fetchJSON(`${API_BASE}/api/players/${wallet}/balance-history?days=${days}`),
  getMovements: (wallet, limit = 50) => fetchJSON(`${API_BASE}/api/players/${wallet}/movements?limit=${limit}`),

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

  // WebSocket
  wsUrl: `${WS_BASE}/ws/feed`,
};
