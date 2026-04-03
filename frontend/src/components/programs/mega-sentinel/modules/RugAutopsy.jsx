import { useState, useCallback } from 'react';
import { api } from '../../../../services/api';
import { COLORS } from '../constants';
import TerminalInput from '../components/TerminalInput';
import ScanProgressBar from '../components/ScanProgressBar';

function shortAddr(a) {
  if (!a) return '--';
  return a.slice(0, 6) + '...' + a.slice(-4);
}

function fmt(n) {
  if (n == null) return '--';
  const num = Number(n);
  if (isNaN(num)) return '--';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
  return '$' + num.toLocaleString();
}

const VERDICT_COLORS = {
  LIKELY_RUG: COLORS.red,
  SERIAL_RUGGER: COLORS.red,
  SUSPICIOUS: COLORS.amber,
  INCONCLUSIVE: COLORS.muted,
  CLEAN: COLORS.green,
};

const EVENT_ICONS = {
  mint: '\u{1F4B0}',
  burn: '\u{1F525}',
  dex_listing: '\u{1F4CA}',
  liquidity_added: '\u{1F4B5}',
  liquidity_removed: '\u{26A0}',
};

export default function RugAutopsy() {
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleScan = useCallback(async (address) => {
    setScanning(true);
    setResult(null);
    setError(null);
    setProgress(0);

    const timer = setInterval(() => {
      setProgress(p => Math.min(p + 4, 85));
    }, 500);

    try {
      const data = await api.sentinelAutopsy(address);
      clearInterval(timer);
      setProgress(100);
      setTimeout(() => {
        setResult(data);
        setScanning(false);
      }, 300);
    } catch (e) {
      clearInterval(timer);
      setError(e.message || 'Analysis failed');
      setScanning(false);
    }
  }, []);

  return (
    <div style={{ padding: '8px 12px', height: '100%', overflow: 'auto' }}>
      <TerminalInput
        label="Enter token address:"
        placeholder="0x..."
        onSubmit={handleScan}
        disabled={scanning}
      />

      {scanning && (
        <div style={{ marginTop: '12px' }}>
          <ScanProgressBar progress={progress} label="Performing forensic analysis..." />
        </div>
      )}

      {error && (
        <div className="sentinel-panel" style={{ marginTop: '12px', color: COLORS.red }}>
          {'>'} ERROR: {error}
        </div>
      )}

      {result && <AutopsyReport data={result} />}
    </div>
  );
}

function AutopsyReport({ data }) {
  const { token, timeline, deployer, damage, verdict } = data;

  return (
    <div className="sentinel-fade-in" style={{ marginTop: '12px' }}>
      {/* Verdict banner */}
      <div className="sentinel-panel" style={{
        borderColor: VERDICT_COLORS[verdict] || COLORS.muted,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '16px', color: COLORS.green, fontWeight: 'bold' }}>
            {token.name || 'Unknown'} ({token.symbol || '???'})
          </div>
          <div style={{ fontSize: '11px', color: COLORS.muted }}>{token.address}</div>
        </div>
        <div style={{
          padding: '4px 12px', fontWeight: 'bold', fontSize: '14px',
          color: VERDICT_COLORS[verdict] || COLORS.muted,
          border: `1px solid ${VERDICT_COLORS[verdict] || COLORS.muted}`,
          background: 'rgba(0,0,0,0.3)',
        }}>
          {verdict.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Deployer info */}
      <div className="sentinel-panel">
        <div className="sentinel-panel__title">{'>'} DEPLOYER PROFILE</div>
        <div style={{ fontSize: '13px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: COLORS.muted }}>Address: </span>
              <span style={{ color: COLORS.cyan }}>{deployer.address ? shortAddr(deployer.address) : 'Unknown'}</span>
            </div>
            <div>
              <span style={{ color: COLORS.muted }}>Tokens deployed: </span>
              <span style={{ color: deployer.totalTokensDeployed > 3 ? COLORS.amber : COLORS.text }}>
                {deployer.totalTokensDeployed}
              </span>
            </div>
            <div>
              <span style={{ color: COLORS.muted }}>Rug count: </span>
              <span style={{ color: deployer.rugCount > 0 ? COLORS.red : COLORS.green }}>
                {deployer.rugCount}
              </span>
            </div>
          </div>

          {deployer.isSerialDeployer && (
            <div style={{ color: COLORS.red, marginTop: '6px', fontWeight: 'bold' }}>
              {'\u26A0'} SERIAL DEPLOYER — Has deployed {deployer.totalTokensDeployed} tokens
            </div>
          )}

          {deployer.previousTokens.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ color: COLORS.muted, fontSize: '11px', marginBottom: '4px' }}>Previous tokens:</div>
              {deployer.previousTokens.map((t, i) => (
                <div key={i} style={{ paddingLeft: '8px', fontSize: '12px' }}>
                  <span style={{ color: t.status === 'rugged' ? COLORS.red : COLORS.text }}>
                    {'\u25B8'} {t.name || t.symbol || shortAddr(t.address)}
                  </span>
                  {t.status && (
                    <span style={{
                      marginLeft: '8px', fontSize: '10px', padding: '1px 4px',
                      background: t.status === 'rugged' ? 'rgba(255,51,51,0.15)' : 'rgba(85,85,85,0.2)',
                      color: t.status === 'rugged' ? COLORS.red : COLORS.muted,
                    }}>
                      {t.status.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Damage estimate */}
      <div className="sentinel-panel">
        <div className="sentinel-panel__title">{'>'} DAMAGE ESTIMATE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '13px' }}>
          <div>
            <div style={{ color: COLORS.muted, fontSize: '11px' }}>Est. Liquidity Lost</div>
            <div style={{ color: COLORS.red, fontSize: '16px', fontWeight: 'bold' }}>
              {fmt(damage.estimatedLossUsd)}
            </div>
          </div>
          <div>
            <div style={{ color: COLORS.muted, fontSize: '11px' }}>Affected Wallets</div>
            <div style={{ color: COLORS.amber, fontSize: '16px', fontWeight: 'bold' }}>
              {damage.affectedWallets.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ color: COLORS.muted, fontSize: '11px' }}>Current Price</div>
            <div>{damage.currentPrice ? '$' + Number(damage.currentPrice).toFixed(8) : '$0'}</div>
          </div>
          <div>
            <div style={{ color: COLORS.muted, fontSize: '11px' }}>Current Liquidity</div>
            <div>{fmt(damage.currentLiquidity)}</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="sentinel-panel">
        <div className="sentinel-panel__title">{'>'} EVENT TIMELINE ({timeline.length} events)</div>
        {timeline.length === 0 ? (
          <div style={{ color: COLORS.muted, fontSize: '13px' }}>No events found in recent blocks.</div>
        ) : (
          <div style={{ maxHeight: '200px', overflow: 'auto' }}>
            {timeline.map((ev, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '3px 0', fontSize: '12px',
                borderLeft: `2px solid ${ev.event === 'burn' ? COLORS.red : ev.event === 'mint' ? COLORS.green : COLORS.cyan}`,
                paddingLeft: '8px', marginLeft: '4px',
              }}>
                <span>{EVENT_ICONS[ev.event] || '\u25CB'}</span>
                <span style={{ color: COLORS.amber, minWidth: '80px' }}>Block {ev.block || '?'}</span>
                <span style={{ color: COLORS.text, textTransform: 'capitalize' }}>{ev.event.replace(/_/g, ' ')}</span>
                {ev.to && <span style={{ color: COLORS.muted }}>{'\u2192'} {shortAddr(ev.to)}</span>}
                {ev.from && <span style={{ color: COLORS.muted }}>{'\u2190'} {shortAddr(ev.from)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
