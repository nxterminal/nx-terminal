import { useState } from 'react';
import { COLORS, PROTOCOLS } from '../constants';
import { useWalletData } from '../hooks/useWalletData';
import DataCard from '../components/DataCard';
import ProtocolBadge from '../components/ProtocolBadge';

function formatUsd(val) {
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return '$' + (val / 1e3).toFixed(1) + 'K';
  return '$' + val.toFixed(2);
}

function formatBalance(val) {
  if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
  if (val >= 1) return val.toFixed(4);
  if (val > 0) return val.toFixed(6);
  return '0';
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (diff < 60) return Math.floor(diff) + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

export default function WalletXRay({ market }) {
  const { wallet, loading, error, lookup, clear } = useWalletData();
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const addr = input.trim();
    if (addr) lookup(addr);
  };

  const monUsd = wallet && market?.monPrice
    ? wallet.monBalance * market.monPrice
    : null;

  return (
    <div>
      {/* SEARCH BAR */}
      <form className="flow-wallet-search" onSubmit={handleSubmit}>
        <input
          className="flow-wallet-search__input"
          type="text"
          placeholder="Enter Monad wallet address (0x…)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
        />
        <button className="flow-wallet-search__btn" type="submit" disabled={loading}>
          {loading ? 'SCANNING…' : 'X-RAY'}
        </button>
      </form>

      {/* ERROR */}
      {error && (
        <div style={{ padding: '16px', color: COLORS.danger, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="flow-wallet-empty">
          <span style={{ color: COLORS.accent }}>Scanning wallet on Monad…</span>
        </div>
      )}

      {/* EMPTY STATE */}
      {!wallet && !loading && !error && (
        <div className="flow-wallet-empty">
          Enter a wallet address to analyze its on-chain activity
        </div>
      )}

      {/* WALLET PROFILE */}
      {wallet && !loading && (
        <div className="flow-wallet-profile">
          {/* Address + Type */}
          <DataCard title="WALLET" className="flow-wallet-profile__full">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#fff', userSelect: 'all' }}>
                {wallet.address}
              </span>
              <span className="flow-wallet-label">
                {wallet.isContract ? 'CONTRACT' : 'EOA'}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textDim, marginLeft: 'auto' }}>
                {wallet.txCount.toLocaleString()} txns
              </span>
            </div>
          </DataCard>

          {/* MON Balance */}
          <DataCard title="MON BALANCE">
            <div className="flow-pnl-value" style={{ color: COLORS.accent }}>
              {formatBalance(wallet.monBalance)}
            </div>
            {monUsd != null && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
                ≈ {formatUsd(monUsd)}
              </div>
            )}
          </DataCard>

          {/* Trade Activity */}
          <DataCard title="TRADE ACTIVITY">
            <div className="flow-pnl-value" style={{ color: COLORS.indigo }}>
              {wallet.stats.tradeCount}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textDim, marginTop: 4 }}>
              recent trades found
            </div>
            {wallet.stats.totalVolume > 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>
                <span style={{ color: COLORS.buy }}>BUY {formatUsd(wallet.stats.buyVolume)}</span>
                <span style={{ color: COLORS.sell }}>SELL {formatUsd(wallet.stats.sellVolume)}</span>
              </div>
            )}
          </DataCard>

          {/* Token Holdings */}
          <DataCard title="TOKEN HOLDINGS" className="flow-wallet-profile__full">
            {wallet.holdings.length === 0 ? (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textDim }}>
                No known token balances found
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {wallet.holdings.map(h => (
                  <span key={h.symbol} className="flow-token-badge">
                    {formatBalance(h.balance)} {h.symbol}
                  </span>
                ))}
              </div>
            )}
          </DataCard>

          {/* Recent Trades */}
          <DataCard title="RECENT TRADES" className="flow-wallet-profile__full">
            {wallet.recentTrades.length === 0 ? (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textDim }}>
                No recent trades found in top pools
              </div>
            ) : (
              wallet.recentTrades.map(trade => (
                <div key={trade.id} className="flow-recent-trade">
                  <span style={{
                    color: trade.side === 'buy' ? COLORS.buy : COLORS.sell,
                    fontWeight: 700,
                    width: 30,
                  }}>
                    {trade.side === 'buy' ? 'BUY' : 'SELL'}
                  </span>
                  <span style={{ color: '#fff' }}>{trade.pair}</span>
                  {PROTOCOLS[trade.protocol] && <ProtocolBadge protocol={trade.protocol} />}
                  <span style={{ color: '#fff', fontWeight: 700, marginLeft: 'auto' }}>
                    {formatUsd(trade.usd)}
                  </span>
                  <span style={{ color: COLORS.textMuted, fontSize: 9, minWidth: 50, textAlign: 'right' }}>
                    {timeAgo(trade.timestamp)}
                  </span>
                </div>
              ))
            )}
          </DataCard>

          {/* Clear button */}
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', paddingBottom: 16 }}>
            <button
              className="flow-pause-btn"
              onClick={() => { clear(); setInput(''); }}
              style={{ fontSize: 11 }}
            >
              CLEAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
