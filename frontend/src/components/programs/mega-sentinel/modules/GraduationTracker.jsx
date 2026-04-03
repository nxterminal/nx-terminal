import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../services/api';
import { COLORS } from '../constants';
import ScanProgressBar from '../components/ScanProgressBar';

function fmt(n) {
  if (n == null) return '--';
  const num = Number(n);
  if (isNaN(num)) return '--';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
}

function fmtPrice(p) {
  if (p == null) return '--';
  const n = Number(p);
  if (isNaN(n)) return '--';
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  return '$' + n.toFixed(6);
}

function shortAddr(a) {
  if (!a) return '--';
  return a.slice(0, 6) + '...' + a.slice(-4);
}

const STATUS_COLORS = {
  trending: COLORS.green,
  graduating: COLORS.cyan,
  active: COLORS.text,
  dead: COLORS.red,
};

const STATUS_ICONS = {
  trending: '\u{1F525}',
  graduating: '\u{1F393}',
  active: '\u25CF',
  dead: '\u{1F480}',
};

const FILTERS = ['all', 'trending', 'graduating', 'active', 'dead'];

export default function GraduationTracker() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterCounts, setFilterCounts] = useState({});
  const [error, setError] = useState(null);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.sentinelGraduation(filter, page, 20);
      setTokens(data.tokens || []);
      setTotal(data.total || 0);
      setFilterCounts(data.filters || {});
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleFilterChange = (f) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div style={{ padding: '8px 12px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '8px',
        fontFamily: '"VT323", monospace', fontSize: '13px',
      }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            style={{
              padding: '4px 12px',
              background: filter === f ? 'rgba(51,255,51,0.1)' : 'transparent',
              border: `1px solid ${filter === f ? COLORS.green : COLORS.border}`,
              color: filter === f ? COLORS.green : COLORS.muted,
              fontFamily: '"VT323", monospace', fontSize: '12px',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {f} {filterCounts[f] != null ? `(${filterCounts[f]})` : ''}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={fetchTokens} style={{
          padding: '4px 12px', background: 'transparent',
          border: `1px solid ${COLORS.border}`, color: COLORS.muted,
          fontFamily: '"VT323", monospace', fontSize: '12px', cursor: 'pointer',
        }}>
          {'\u21BB'} Refresh
        </button>
      </div>

      {loading && <ScanProgressBar progress={60} label="Scanning MegaETH ecosystem..." />}

      {error && (
        <div style={{ color: COLORS.red, fontSize: '13px', padding: '8px' }}>
          {'>'} ERROR: {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {tokens.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '24px', color: COLORS.muted,
              fontFamily: '"VT323", monospace', fontSize: '14px',
            }}>
              No tokens found for this filter.
            </div>
          ) : (
            <table className="sentinel-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Token</th>
                  <th>Price</th>
                  <th>24h</th>
                  <th>Volume</th>
                  <th>Liquidity</th>
                  <th>MCap</th>
                  <th>Age</th>
                  <th>DEX</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ color: STATUS_COLORS[t.status] || COLORS.muted }}>
                        {STATUS_ICONS[t.status] || '\u25CB'} {t.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'bold', color: COLORS.text }}>{t.symbol || '???'}</div>
                      <div style={{ fontSize: '10px', color: COLORS.muted }}>{t.name || shortAddr(t.address)}</div>
                    </td>
                    <td style={{ color: COLORS.cyan }}>{fmtPrice(t.price)}</td>
                    <td style={{ color: t.priceChange24h >= 0 ? COLORS.green : COLORS.red }}>
                      {t.priceChange24h >= 0 ? '+' : ''}{t.priceChange24h?.toFixed(1) || '0'}%
                    </td>
                    <td>${fmt(t.volume24h)}</td>
                    <td>${fmt(t.liquidity)}</td>
                    <td>${fmt(t.marketCap)}</td>
                    <td>{t.ageDays ? `${t.ageDays}d` : '--'}</td>
                    <td style={{ fontSize: '10px', color: COLORS.muted }}>{t.dexId || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '8px',
          padding: '6px 0', fontFamily: '"VT323", monospace', fontSize: '12px',
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              color: page === 1 ? '#333' : COLORS.green, cursor: page === 1 ? 'default' : 'pointer',
              fontFamily: '"VT323", monospace', padding: '2px 8px',
            }}
          >
            {'<'} Prev
          </button>
          <span style={{ color: COLORS.muted, padding: '2px 8px' }}>
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 20 >= total}
            style={{
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              color: page * 20 >= total ? '#333' : COLORS.green, cursor: page * 20 >= total ? 'default' : 'pointer',
              fontFamily: '"VT323", monospace', padding: '2px 8px',
            }}
          >
            Next {'>'}
          </button>
        </div>
      )}
    </div>
  );
}
