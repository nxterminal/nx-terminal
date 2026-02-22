import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { useWallet } from '../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI } from '../services/contract';
import { api } from '../services/api';

const ARCHETYPE_COLORS = {
  '10X_DEV': '#ff4444', 'LURKER': '#808080', 'DEGEN': '#ffd700',
  'GRINDER': '#4488ff', 'INFLUENCER': '#ff44ff', 'HACKTIVIST': '#33ff33',
  'FED': '#ffaa00', 'SCRIPT_KIDDIE': '#00ffff',
};

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function EnergyBar({ energy }) {
  const pct = Math.max(0, Math.min(100, energy || 0));
  const cls = pct > 60 ? 'energy-high' : pct > 30 ? 'energy-mid' : 'energy-low';
  return (
    <div className="energy-bar" style={{ width: '60px', display: 'inline-block' }}>
      <div className={`energy-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function MyDevs({ openDevProfile }) {
  const { address, isConnected, connect, displayAddress } = useWallet();
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Read token IDs owned by this wallet from the contract
  const { data: ownedTokens, isLoading: tokensLoading } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'tokensOfOwner',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Fetch dev data from API for each owned token ID
  useEffect(() => {
    if (!ownedTokens || ownedTokens.length === 0) {
      setDevs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(null);

    const tokenIds = ownedTokens.map(id => Number(id));

    Promise.all(
      tokenIds.map(id =>
        api.getDev(id).catch(() => ({
          token_id: id,
          name: `Dev #${id}`,
          archetype: 'UNKNOWN',
          energy: 0,
          balance_nxt: 0,
          mood: '?',
        }))
      )
    )
      .then(results => setDevs(results))
      .catch(() => setFetchError('Failed to load developer data'))
      .finally(() => setLoading(false));
  }, [ownedTokens]);

  const isLoadingAny = tokensLoading || loading;

  // ── Not connected ──
  if (!isConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          padding: '6px 8px',
          background: 'var(--terminal-bg)',
          color: 'var(--terminal-amber)',
          fontFamily: "'VT323', monospace",
          fontSize: '14px',
          borderBottom: '1px solid var(--border-dark)',
        }}>
          {'>'} MY DEVELOPERS
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '24px',
        }}>
          <div style={{ fontSize: '32px' }}>🔌</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}>
            Connect wallet to see your devs
          </div>
          <div style={{ fontSize: '11px', color: '#888', textAlign: 'center' }}>
            Your developers will appear here once your wallet is connected.
          </div>
          <button className="win-btn" onClick={connect} style={{ padding: '4px 20px', fontWeight: 'bold' }}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // ── Connected, 0 devs ──
  if (!isLoadingAny && devs.length === 0 && !fetchError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          padding: '6px 8px',
          background: 'var(--terminal-bg)',
          color: 'var(--terminal-green)',
          fontFamily: "'VT323', monospace",
          fontSize: '14px',
          borderBottom: '1px solid var(--border-dark)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{'>'} MY DEVELOPERS</span>
          <span style={{ color: 'var(--terminal-green)' }}>{displayAddress}</span>
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '24px',
        }}>
          <div style={{ fontSize: '32px' }}>📭</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}>
            No devs yet
          </div>
          <div style={{ fontSize: '11px', color: '#888', textAlign: 'center' }}>
            Open Mint/Hire Devs to get started!
          </div>
        </div>
      </div>
    );
  }

  // ── Connected with devs ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '6px 8px',
        background: 'var(--terminal-bg)',
        color: 'var(--terminal-green)',
        fontFamily: "'VT323', monospace",
        fontSize: '14px',
        borderBottom: '1px solid var(--border-dark)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{'>'} MY DEVELOPERS ({devs.length})</span>
        <span style={{ color: 'var(--terminal-green)' }}>{displayAddress}</span>
      </div>

      {fetchError && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--terminal-bg)',
          borderBottom: '1px solid var(--terminal-red)',
          color: 'var(--terminal-red)',
          fontFamily: "'VT323', monospace",
          fontSize: '14px',
        }}>
          [X] {fetchError}
        </div>
      )}

      <div className="win-panel" style={{ flex: 1, overflow: 'auto' }}>
        {isLoadingAny ? (
          <div className="loading">Loading devs...</div>
        ) : (
          <table className="win-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Archetype</th>
                <th>Energy</th>
                <th>Balance</th>
                <th>Mood</th>
              </tr>
            </thead>
            <tbody>
              {devs.map((dev) => (
                <tr
                  key={dev.token_id || dev.id}
                  className="clickable"
                  onClick={() => openDevProfile?.(dev.token_id || dev.id)}
                >
                  <td>#{dev.token_id || dev.id}</td>
                  <td style={{ fontWeight: 'bold' }}>{dev.name}</td>
                  <td>
                    <span
                      className={`badge badge-${dev.archetype}`}
                      style={{ color: ARCHETYPE_COLORS[dev.archetype] }}
                    >
                      {dev.archetype}
                    </span>
                  </td>
                  <td><EnergyBar energy={dev.energy} /></td>
                  <td style={{ color: 'var(--gold)' }}>
                    {formatNumber(dev.balance_nxt || dev.balance)} $NXT
                  </td>
                  <td>{dev.mood || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
