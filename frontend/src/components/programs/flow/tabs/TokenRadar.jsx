import { COLORS, PROTOCOLS, TOOLTIPS } from '../constants';
import { useTokenRadar } from '../hooks/useTokenRadar';
import ProtocolBadge from '../components/ProtocolBadge';
import Tooltip from '../components/Tooltip';

function formatUsd(val) {
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return '$' + (val / 1e3).toFixed(1) + 'K';
  return '$' + val.toFixed(2);
}

function scoreColor(score) {
  if (score >= 70) return COLORS.accent;
  if (score >= 40) return COLORS.warning;
  return COLORS.danger;
}

export default function TokenRadar() {
  const { tokens, loading, source, setSource } = useTokenRadar();

  const safe = tokens.filter(t => t.score >= 70).length;
  const risky = tokens.filter(t => t.score < 40).length;

  return (
    <>
      {/* HEADER */}
      <div className="flow-radar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="flow-filter-group">
            <button
              className={`flow-filter-btn ${source === 'trending' ? 'flow-filter-btn--active' : ''}`}
              onClick={() => setSource('trending')}
            >
              TRENDING
            </button>
            <button
              className={`flow-filter-btn ${source === 'new' ? 'flow-filter-btn--active' : ''}`}
              onClick={() => setSource('new')}
            >
              NEW POOLS
            </button>
          </div>
          <span className="flow-radar-header__label">
            {tokens.length} tokens scanned
          </span>
        </div>
        <div className="flow-radar-header__stats">
          <span style={{ color: COLORS.accent }}>{safe} safe</span>
          <span style={{ color: COLORS.textMuted }}>·</span>
          <span style={{ color: COLORS.danger }}>{risky} risky</span>
        </div>
      </div>

      {/* TOKEN LIST */}
      <div className="flow-radar-list">
        {loading && tokens.length === 0 && (
          <div className="flow-placeholder" style={{ color: COLORS.textDim }}>
            Scanning MegaETH token pools…
          </div>
        )}

        {tokens.map(token => (
          <div
            key={token.id}
            className="flow-token-card"
            style={{ borderColor: scoreColor(token.score) + '20', background: scoreColor(token.score) + '06' }}
          >
            <div className="flow-token-card__left">
              <div className="flow-token-card__row1">
                <span className="flow-token-card__name">{token.symbol}</span>
                <span style={{ color: COLORS.textDim, fontSize: 11 }}>/ {token.quote}</span>
                {PROTOCOLS[token.protocol] && <ProtocolBadge protocol={token.protocol} />}
                <span className="flow-token-card__age">{token.age.label} old</span>
                {token.warnings.map(w => (
                  <span key={w} className="flow-token-card__warning">{w}</span>
                ))}
              </div>
              <div className="flow-token-card__stats">
                <span>LIQ {formatUsd(token.reserveUsd)}</span>
                <span style={{ margin: '0 6px', color: COLORS.textMuted }}>·</span>
                <span>VOL {formatUsd(token.volume24h)}</span>
                <span style={{ margin: '0 6px', color: COLORS.textMuted }}>·</span>
                <span>FDV {formatUsd(token.fdv)}</span>
                <span style={{ margin: '0 6px', color: COLORS.textMuted }}>·</span>
                <span style={{ color: token.priceChange24h >= 0 ? COLORS.buy : COLORS.sell }}>
                  {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}% 24h
                </span>
                {token.priceChange1h !== 0 && (
                  <>
                    <span style={{ margin: '0 6px', color: COLORS.textMuted }}>·</span>
                    <span style={{ color: token.priceChange1h >= 0 ? COLORS.buy : COLORS.sell }}>
                      {token.priceChange1h >= 0 ? '+' : ''}{token.priceChange1h.toFixed(1)}% 1h
                    </span>
                  </>
                )}
              </div>
            </div>

            <Tooltip text={TOOLTIPS.safetyScore}>
            <div className="flow-token-card__right">
              <div className="flow-token-card__score-label">SCORE</div>
              <div className="flow-token-card__score" style={{ color: scoreColor(token.score) }}>
                {token.score}
              </div>
              <div className="flow-token-card__score-bar">
                <div
                  className="flow-token-card__score-fill"
                  style={{ width: token.score + '%', background: scoreColor(token.score) }}
                />
              </div>
            </div>
            </Tooltip>
          </div>
        ))}
      </div>
    </>
  );
}
