const API_BASE = import.meta.env.VITE_API_URL || 'https://nx-terminal.onrender.com';
const WS_BASE = API_BASE.replace('https', 'wss').replace('http', 'ws');

function fetchJSON(url, options) {
  return fetch(url, options).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
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
  getDev: (id) => fetchJSON(`${API_BASE}/api/devs/${id}`),
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

  // Players
  getPlayer: (wallet) => fetchJSON(`${API_BASE}/api/players/${wallet}`),
  getClaimHistory: (wallet) => fetchJSON(`${API_BASE}/api/players/${wallet}/claim-history`),

  // Wallet
  getWalletSummary: (wallet) => fetchJSON(`${API_BASE}/api/players/${wallet}/wallet-summary`),
  getBalanceHistory: (wallet, days = 30) => fetchJSON(`${API_BASE}/api/players/${wallet}/balance-history?days=${days}`),
  getMovements: (wallet, limit = 50) => fetchJSON(`${API_BASE}/api/players/${wallet}/movements?limit=${limit}`),

  // WebSocket
  wsUrl: `${WS_BASE}/ws/feed`,
};
