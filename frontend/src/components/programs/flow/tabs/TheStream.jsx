import { useMemo } from 'react';
import { PROTOCOLS, COLORS } from '../constants';
import { useStreamData } from '../hooks/useStreamData';
import ProtocolBadge from '../components/ProtocolBadge';

const SIDE_FILTERS = [
  { value: 'all', label: 'ALL' },
  { value: 'buy', label: 'BUY' },
  { value: 'sell', label: 'SELL' },
];

const VALUE_FILTERS = [
  { value: 0, label: 'ALL' },
  { value: 100, label: '$100+' },
  { value: 500, label: '$500+' },
  { value: 1000, label: '$1K+' },
  { value: 10000, label: '$10K+' },
];

function formatUsd(val) {
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return '$' + (val / 1e3).toFixed(1) + 'K';
  return '$' + val.toFixed(2);
}

function shortAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (diff < 60) return Math.floor(diff) + 's';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

export default function TheStream({ streamFilters, setStreamFilter, isPaused, togglePause }) {
  const { trades, loading, tradeCount } = useStreamData(isPaused);

  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (streamFilters.side !== 'all' && t.side !== streamFilters.side) return false;
      if (streamFilters.minValue > 0 && t.usd < streamFilters.minValue) return false;
      if (streamFilters.protocol !== 'all' && t.protocol !== streamFilters.protocol) return false;
      return true;
    });
  }, [trades, streamFilters]);

  return (
    <>
      {/* FILTER BAR */}
      <div className="flow-stream-filters">
        {/* Side filter */}
        <div className="flow-filter-group">
          {SIDE_FILTERS.map(f => (
            <button
              key={f.value}
              className={`flow-filter-btn ${streamFilters.side === f.value ? 'flow-filter-btn--active' : ''}`}
              onClick={() => setStreamFilter('side', f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Value filter */}
        <div className="flow-filter-group">
          {VALUE_FILTERS.map(f => (
            <button
              key={f.value}
              className={`flow-filter-btn ${streamFilters.minValue === f.value ? 'flow-filter-btn--active' : ''}`}
              onClick={() => setStreamFilter('minValue', f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Protocol filter */}
        <div className="flow-filter-group">
          <button
            className={`flow-filter-btn ${streamFilters.protocol === 'all' ? 'flow-filter-btn--active' : ''}`}
            onClick={() => setStreamFilter('protocol', 'all')}
          >
            ALL DEX
          </button>
          {Object.entries(PROTOCOLS).slice(0, 4).map(([key, p]) => (
            <button
              key={key}
              className={`flow-filter-btn ${streamFilters.protocol === key ? 'flow-filter-btn--active' : ''}`}
              onClick={() => setStreamFilter('protocol', key)}
              style={streamFilters.protocol === key ? { borderColor: p.color + '60', color: p.color } : undefined}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Meta: count + pause */}
        <div className="flow-stream-meta">
          <span>{filteredTrades.length} trades</span>
          <span style={{ color: COLORS.textMuted }}>|</span>
          <span>{tradeCount} total</span>
          <button
            className="flow-pause-btn"
            onClick={togglePause}
            style={isPaused ? { borderColor: COLORS.warning + '40', color: COLORS.warning } : undefined}
          >
            {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
          </button>
        </div>
      </div>

      {/* TRADE LIST */}
      <div className="flow-trade-list">
        {loading && trades.length === 0 && (
          <div className="flow-placeholder" style={{ color: COLORS.textDim }}>
            Connecting to Monad pools…
          </div>
        )}

        {!loading && trades.length === 0 && (
          <div className="flow-placeholder" style={{ color: COLORS.textDim }}>
            No trades yet — waiting for activity…
          </div>
        )}

        {filteredTrades.map((trade, i) => (
          <div
            key={trade.id}
            className={`flow-trade-item ${trade.isWhale ? 'flow-trade-item--whale' : ''} ${i < 3 ? 'flow-trade-item--new' : ''}`}
            style={{ borderLeftColor: trade.side === 'buy' ? COLORS.buy : COLORS.sell }}
          >
            <span
              className="flow-trade-item__side"
              style={{ color: trade.side === 'buy' ? COLORS.buy : COLORS.sell }}
            >
              {trade.side === 'buy' ? 'BUY' : 'SELL'}
            </span>

            <span className="flow-trade-item__pair">
              {trade.base}
              <span className="flow-trade-item__pair-arrow"> → </span>
              {trade.quote}
            </span>

            <ProtocolBadge protocol={trade.protocol} />

            {trade.isWhale && (
              <span className="flow-trade-item__whale-badge">🐋 WHALE</span>
            )}

            <span className="flow-trade-item__value">
              {formatUsd(trade.usd)}
            </span>

            <span className="flow-trade-item__meta">
              {timeAgo(trade.timestamp)} ago
            </span>

            <span className="flow-trade-item__address">
              {shortAddr(trade.from)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
