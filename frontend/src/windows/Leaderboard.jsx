import { useState, useEffect } from 'react';
import { api } from '../services/api';

const ARCHETYPE_COLORS = {
  '10X_DEV': 'var(--red-on-grey, #aa0000)', 'LURKER': 'var(--common-on-grey, #333333)', 'DEGEN': 'var(--gold-on-grey, #7a5c00)',
  'GRINDER': 'var(--blue-on-grey, #0d47a1)', 'INFLUENCER': 'var(--pink-on-grey, #660066)', 'HACKTIVIST': 'var(--green-on-grey, #005500)',
  'FED': 'var(--amber-on-grey, #7a5500)', 'SCRIPT_KIDDIE': 'var(--cyan-on-grey, #005060)',
};

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

// $NXT balances arrive as base-unit strings (uint256, 18 decimals).
// Convert to a human display: drop the 18-decimal mantissa, then
// thousands-format. We deliberately don't show fractional NXT — the
// leaderboard is about magnitudes, not micro-balances. Numbers below
// 1 NXT render as "0".
function formatNxtBalance(raw) {
  if (raw == null) return '0';
  const s = String(raw);
  if (s === '0') return '0';
  if (s.length <= 18) return '0';
  const whole = s.slice(0, s.length - 18);
  // Strip leading zeros (shouldn't happen with chain data but be safe).
  const clean = whole.replace(/^0+/, '') || '0';
  // Group thousands.
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Wallets are surfaced as 0x1234...abcd everywhere on the leaderboard
// (6 head + ellipsis + 4 tail). Anything shorter than 12 chars is
// returned as-is so we don't mangle obviously invalid inputs.
function truncateWallet(w) {
  if (!w || typeof w !== 'string' || w.length < 12) return w || '';
  return `${w.slice(0, 6)}...${w.slice(-4)}`;
}

// Snapshot age footer for NXT Holders. Reads ISO timestamp from the
// endpoint and renders "Updated Xmin ago" / "Updated Xs ago" so the
// user can see how stale the on-chain pull is.
function formatRelativeAge(iso) {
  if (!iso) return 'Snapshot pending...';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Snapshot pending...';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `Updated ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Updated ${min}min ago`;
  const hr = Math.floor(min / 60);
  return `Updated ${hr}h ago`;
}

function EmptyState({ message }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: '12px', padding: '24px',
    }}>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: '24px', color: 'var(--text-secondary, #555)' }}>[#]</div>
      <div style={{ fontWeight: 'bold', fontSize: 'var(--text-base)', textAlign: 'center', color: 'var(--text-primary, #000)' }}>
        Leaderboard is empty
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary, #888)', textAlign: 'center', maxWidth: '280px' }}>
        {message}
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: '12px', padding: '24px',
    }}>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: '24px', color: 'var(--terminal-red, #aa0000)' }}>[!]</div>
      <div style={{ fontWeight: 'bold', fontSize: 'var(--text-base)', textAlign: 'center', color: 'var(--terminal-red, #aa0000)' }}>
        Leaderboard unavailable
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary, #888)', textAlign: 'center', maxWidth: '280px' }}>
        {message}
      </div>
    </div>
  );
}

// Tab definitions live in one array so the order is the single
// source of truth (left-to-right). 'reputation' was removed in
// Phase 5.11; the backend path still accepts ?sort=reputation but
// nothing in the UI surfaces it anymore — see leaderboard.py for
// the deprecation note before tearing the server side out.
const TABS = [
  { id: 'balance',        label: 'By Balance' },
  { id: 'top-hackers',    label: 'Top Hackers' },
  { id: 'nxt-holders',    label: 'NXT Holders' },
  { id: 'dev-collectors', label: 'Dev Collectors' },
  { id: 'corporations',   label: 'Corporations' },
];

// Wallet cell — non-clickable on purpose.
// TODO(wallet-profile): no WalletProfile window exists yet. The
// Block C spec deliberately leaves wallets read-only so we don't
// half-build a feature: reusing MyDevs would require refactoring
// useDevs to accept an owner override + gating every action modal
// (fund/transfer/hack/buy), which is out of scope here. When
// WalletProfile lands, wire an openWalletProfile(wallet) prop
// through Leaderboard and switch this cell to a button.
function WalletCell({ wallet }) {
  return (
    <td
      title={wallet}
      style={{
        fontFamily: "'VT323', monospace",
        cursor: 'default',
      }}
    >
      {truncateWallet(wallet)}
    </td>
  );
}

function RankCell({ rank }) {
  return (
    <td style={{
      color: rank <= 3 ? 'var(--gold-on-grey)' : undefined,
      fontWeight: rank <= 3 ? 'bold' : undefined,
    }}>
      {rank}
    </td>
  );
}

export default function Leaderboard({ openDevProfile }) {
  const [tab, setTab] = useState('balance');
  // One state per tab payload type. Keeping them separate avoids
  // the previous bug where switching tabs flashed the wrong shape
  // for a render before the new fetch returned.
  const [byBalance, setByBalance] = useState([]);
  const [corpData, setCorpData] = useState([]);
  const [hackers, setHackers] = useState([]);
  const [holders, setHolders] = useState([]);
  const [holdersUpdatedAt, setHoldersUpdatedAt] = useState(null);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Single fetcher keyed by `tab`. Re-runs on tab change AND on the
  // 30s auto-refresh interval. setError(null) on each request so a
  // recovered backend clears a stale error state without a window
  // close/reopen.
  function fetchForTab(activeTab) {
    setError(null);
    if (activeTab === 'balance') {
      return api.getLeaderboard('balance').then(d => {
        setByBalance(Array.isArray(d) ? d : d.leaderboard || []);
      });
    }
    if (activeTab === 'corporations') {
      return api.getCorpLeaderboard().then(d => {
        setCorpData(Array.isArray(d) ? d : d.corporations || []);
      });
    }
    if (activeTab === 'top-hackers') {
      return api.getTopHackers().then(d => {
        setHackers(Array.isArray(d) ? d : d.hackers || []);
      });
    }
    if (activeTab === 'nxt-holders') {
      return api.getNxtHolders().then(d => {
        setHolders(Array.isArray(d?.holders) ? d.holders : []);
        setHoldersUpdatedAt(d?.snapshot_updated_at || null);
      });
    }
    if (activeTab === 'dev-collectors') {
      return api.getDevCollectors().then(d => {
        setCollectors(Array.isArray(d) ? d : d.collectors || []);
      });
    }
    return Promise.resolve();
  }

  useEffect(() => {
    setLoading(true);
    fetchForTab(tab)
      .catch((e) => setError(e?.message || 'Network error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auto-refresh every 30s (silent — no loading flash on refresh,
  // only on tab change).
  useEffect(() => {
    const id = setInterval(() => {
      fetchForTab(tab).catch((e) => setError(e?.message || 'Network error'));
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Per-tab body renderer. Each block handles its own empty/
  // error states so the surrounding chrome doesn't need to know
  // about the data shapes. Loading is handled once at the wrapper.
  function renderBody() {
    if (loading) {
      return <div className="loading">Loading leaderboard...</div>;
    }
    if (error) {
      return <ErrorState message={error} />;
    }

    if (tab === 'balance') {
      if (byBalance.length === 0) {
        return <EmptyState message="No devs on the leaderboard yet. Mint your first developer and watch them climb the ranks." />;
      }
      return (
        <table className="win-table">
          <thead>
            <tr><th>#</th><th>Name</th><th>Archetype</th><th>Corporation</th><th>Balance</th></tr>
          </thead>
          <tbody>
            {byBalance.map((dev, i) => (
              <tr
                key={dev.token_id || i}
                className="clickable"
                onClick={() => openDevProfile?.(dev.token_id || dev.id)}
              >
                <RankCell rank={dev.rank_balance || i + 1} />
                <td>{dev.name}</td>
                <td>
                  <span className={`badge badge-${dev.archetype}`} style={{ color: ARCHETYPE_COLORS[dev.archetype] }}>
                    {dev.archetype}
                  </span>
                </td>
                <td>{dev.corporation || '-'}</td>
                <td>{formatNumber(dev.balance_nxt || dev.balance)} $NXT</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (tab === 'corporations') {
      if (corpData.length === 0) {
        return <EmptyState message="No corporations have been formed yet. Mint devs to see the corporate hierarchy." />;
      }
      return (
        <table className="win-table">
          <thead>
            <tr><th>#</th><th>Corporation</th><th>Devs</th><th>Total Balance</th></tr>
          </thead>
          <tbody>
            {corpData.map((c, i) => (
              <tr key={c.corporation || c.name || i}>
                <RankCell rank={i + 1} />
                <td>{c.corporation || c.name}</td>
                <td>{c.total_devs || c.dev_count}</td>
                <td>{formatNumber(c.total_balance)} $NXT</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (tab === 'top-hackers') {
      if (hackers.length === 0) {
        return <EmptyState message="No successful hacks recorded yet. Send your devs to raid rivals or crack the mainframe." />;
      }
      return (
        <table className="win-table">
          <thead>
            <tr><th>#</th><th>Wallet</th><th>Successful Hacks</th><th>Devs Contributing</th></tr>
          </thead>
          <tbody>
            {hackers.map((h, i) => (
              <tr key={h.wallet || i}>
                <RankCell rank={i + 1} />
                <WalletCell wallet={h.wallet} />
                <td>{formatNumber(h.hacks_successful)}</td>
                <td>{formatNumber(h.contributing_devs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (tab === 'nxt-holders') {
      if (holders.length === 0) {
        return <EmptyState message="No on-chain $NXT holders snapshot yet. The snapshot job runs every 5 minutes." />;
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table className="win-table">
              <thead>
                <tr><th>#</th><th>Wallet</th><th>Balance</th></tr>
              </thead>
              <tbody>
                {holders.map((h, i) => (
                  <tr key={h.wallet || i}>
                    <RankCell rank={i + 1} />
                    <WalletCell wallet={h.wallet} />
                    <td>{formatNxtBalance(h.balance)} $NXT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{
            padding: '4px 8px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary, #666)',
            fontFamily: "'VT323', monospace",
            textAlign: 'right',
            borderTop: '1px solid var(--border-dark, #888)',
          }}>
            {formatRelativeAge(holdersUpdatedAt)}
          </div>
        </div>
      );
    }

    if (tab === 'dev-collectors') {
      if (collectors.length === 0) {
        return <EmptyState message="No wallets hold any devs yet. Mint to claim the #1 collector spot." />;
      }
      return (
        <table className="win-table">
          <thead>
            <tr><th>#</th><th>Wallet</th><th>Devs Owned</th></tr>
          </thead>
          <tbody>
            {collectors.map((c, i) => (
              <tr key={c.wallet || i}>
                <RankCell rank={i + 1} />
                <WalletCell wallet={c.wallet} />
                <td>{formatNumber(c.dev_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="win-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`win-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="win-panel" style={{ flex: 1, overflow: 'auto' }}>
        {renderBody()}
      </div>
    </div>
  );
}
