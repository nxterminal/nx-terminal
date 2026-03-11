import { COLORS, PROTOCOLS } from '../constants';
import { useClobData } from '../hooks/useClobData';
import ProtocolBadge from '../components/ProtocolBadge';

function formatPrice(p) {
  if (p == null || isNaN(p)) return '--';
  if (p >= 1) return '$' + p.toFixed(4);
  if (p >= 0.001) return '$' + p.toFixed(6);
  return '$' + p.toFixed(8);
}

function formatUsd(val) {
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return '$' + (val / 1e3).toFixed(1) + 'K';
  return '$' + val.toFixed(2);
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (diff < 60) return Math.floor(diff) + 's';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  return Math.floor(diff / 3600) + 'h';
}

export default function ClobVision() {
  const { pairs, selectedPair, setSelectedPair, orderbook, recentTrades, stats, loading } = useClobData();

  if (loading && !selectedPair) {
    return (
      <div className="flow-placeholder" style={{ color: COLORS.textDim }}>
        Loading CLOB pairs…
      </div>
    );
  }

  return (
    <>
      {/* HEADER — pair selector + stats */}
      <div className="flow-clob-header">
        <div className="flow-clob-header__left">
          {selectedPair && (
            <>
              <select
                value={selectedPair?.id || ''}
                onChange={(e) => {
                  const p = pairs.find(pp => pp.id === e.target.value);
                  if (p) setSelectedPair(p);
                }}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#fff',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 4,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {pairs.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#0D1117' }}>
                    {p.pair}
                  </option>
                ))}
              </select>
              {PROTOCOLS[selectedPair.protocol] && (
                <ProtocolBadge protocol={selectedPair.protocol} showType />
              )}
              <span className="flow-clob-header__label">
                {formatPrice(stats.midPrice)}
              </span>
            </>
          )}
        </div>
        <div className="flow-clob-header__right">
          <span>Spread <span style={{ color: COLORS.accent }}>{stats.spread.toFixed(3)}%</span></span>
          <span style={{ color: COLORS.textMuted }}>·</span>
          <span>Vol <span style={{ color: '#fff' }}>{formatUsd(stats.volume24h)}</span></span>
        </div>
      </div>

      {/* ORDERBOOK */}
      <div className="flow-orderbook" style={{ position: 'relative' }}>
        <div className="flow-orderbook__divider" />

        {/* BIDS (left) */}
        <div className="flow-orderbook__side">
          <div className="flow-orderbook__side-header" style={{ color: COLORS.buy }}>BIDS</div>
          <div className="flow-orderbook__col-headers">
            <span>PRICE</span>
            <span>SIZE ($)</span>
            <span>TOTAL</span>
          </div>
          {orderbook.bids.map((level, i) => (
            <div key={i} className="flow-orderbook__row">
              <div
                className="flow-orderbook__depth flow-orderbook__depth--bid"
                style={{ width: (level.total / orderbook.maxTotal * 100) + '%' }}
              />
              <span className="flow-orderbook__cell" style={{ color: COLORS.buy }}>
                {formatPrice(level.price)}
              </span>
              <span className="flow-orderbook__cell">{formatUsd(level.size)}</span>
              <span className="flow-orderbook__cell" style={{ color: COLORS.textDim }}>
                {formatUsd(level.total)}
              </span>
            </div>
          ))}
        </div>

        {/* ASKS (right) */}
        <div className="flow-orderbook__side">
          <div className="flow-orderbook__side-header" style={{ color: COLORS.sell }}>ASKS</div>
          <div className="flow-orderbook__col-headers">
            <span>PRICE</span>
            <span>SIZE ($)</span>
            <span>TOTAL</span>
          </div>
          {orderbook.asks.map((level, i) => (
            <div key={i} className="flow-orderbook__row">
              <div
                className="flow-orderbook__depth flow-orderbook__depth--ask"
                style={{ width: (level.total / orderbook.maxTotal * 100) + '%' }}
              />
              <span className="flow-orderbook__cell" style={{ color: COLORS.sell }}>
                {formatPrice(level.price)}
              </span>
              <span className="flow-orderbook__cell">{formatUsd(level.size)}</span>
              <span className="flow-orderbook__cell" style={{ color: COLORS.textDim }}>
                {formatUsd(level.total)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* DEPTH HEATMAP */}
      <div className="flow-depth-heatmap">
        <div className="flow-depth-heatmap__bar">
          {orderbook.bids.slice().reverse().map((level, i) => (
            <div
              key={'b' + i}
              className="flow-depth-heatmap__segment"
              style={{
                background: `rgba(34,197,94,${0.05 + (level.size / (orderbook.maxTotal || 1)) * 0.6})`,
              }}
            />
          ))}
          <div className="flow-depth-heatmap__center" />
          {orderbook.asks.map((level, i) => (
            <div
              key={'a' + i}
              className="flow-depth-heatmap__segment"
              style={{
                background: `rgba(239,68,68,${0.05 + (level.size / (orderbook.maxTotal || 1)) * 0.6})`,
              }}
            />
          ))}
        </div>
        <div className="flow-depth-heatmap__labels">
          <span style={{ color: COLORS.buy }}>BID DEPTH</span>
          <span style={{ color: COLORS.textMuted }}>MID</span>
          <span style={{ color: COLORS.sell }}>ASK DEPTH</span>
        </div>
      </div>

      {/* CLOB STATS + RECENT TRADES */}
      <div className="flow-clob-stats">
        <span>RECENT FILLS</span>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        {recentTrades.map(trade => (
          <div key={trade.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 0',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
          }}>
            <span style={{ color: trade.side === 'buy' ? COLORS.buy : COLORS.sell, fontWeight: 700, width: 28 }}>
              {trade.side === 'buy' ? 'BUY' : 'SELL'}
            </span>
            <span style={{ color: '#fff' }}>{formatUsd(trade.usd)}</span>
            <span style={{ color: COLORS.textDim, marginLeft: 'auto' }}>{timeAgo(trade.timestamp)}ago</span>
          </div>
        ))}
      </div>
    </>
  );
}
