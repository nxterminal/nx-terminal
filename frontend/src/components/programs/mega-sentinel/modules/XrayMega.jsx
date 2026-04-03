import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../services/api';
import { COLORS, getRiskLevel } from '../constants';
import TerminalInput from '../components/TerminalInput';
import ScanProgressBar from '../components/ScanProgressBar';
import ThreatBadge from '../components/ThreatBadge';

function fmt(n) {
  if (n == null || n === '') return '--';
  const num = Number(n);
  if (isNaN(num)) return '--';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
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
  if (n >= 0.0001) return '$' + n.toFixed(6);
  return '$' + n.toFixed(8);
}

function shortAddr(a) {
  if (!a) return '--';
  return a.slice(0, 6) + '...' + a.slice(-4);
}

function CheckRow({ pass, warn, label }) {
  const icon = pass ? '\u2713' : warn ? '!' : '\u2717';
  const cls = pass ? 'sentinel-check--pass' : warn ? 'sentinel-check--warn' : 'sentinel-check--fail';
  return (
    <div className={`sentinel-check ${cls}`}>
      <span style={{ width: '16px', textAlign: 'center' }}>[{icon}]</span>
      <span>{label}</span>
    </div>
  );
}

function RiskBar({ score }) {
  const risk = getRiskLevel(score);
  const filled = Math.round(score / 100 * 24);
  const empty = 24 - filled;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      fontFamily: '"VT323", monospace', fontSize: '16px', padding: '8px 0',
    }}>
      <span style={{ color: COLORS.text }}>RISK SCORE:</span>
      <span style={{ color: risk.color, fontWeight: 'bold' }}>{score}/100</span>
      <span style={{ color: risk.color, letterSpacing: '1px' }}>
        [{'\u2588'.repeat(filled)}{'\u2591'.repeat(empty)}]
      </span>
      <ThreatBadge score={score} />
    </div>
  );
}

const SCAN_STEPS = [
  'Checking contract bytecode...',
  'Reading ERC-20 metadata...',
  'Scanning contract features...',
  'Querying DexScreener...',
  'Simulating buy/sell (honeypot check)...',
  'Calculating risk score...',
];

export default function XrayMega() {
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState('');
  const [error, setError] = useState(null);

  const handleScan = useCallback(async (address) => {
    setScanning(true);
    setResult(null);
    setError(null);
    setProgress(0);

    // Animate progress while API call runs
    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step < SCAN_STEPS.length) {
        setStepLabel(SCAN_STEPS[step]);
        setProgress(Math.min(15 + step * 15, 85));
      }
    }, 600);
    setStepLabel(SCAN_STEPS[0]);
    setProgress(10);

    try {
      const data = await api.sentinelXray(address);
      clearInterval(timer);
      setProgress(100);
      setStepLabel('Scan complete.');
      setTimeout(() => {
        setResult(data);
        setScanning(false);
      }, 300);
    } catch (e) {
      clearInterval(timer);
      setError(e.message || 'Scan failed');
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
          <ScanProgressBar progress={progress} label={stepLabel} />
        </div>
      )}

      {error && (
        <div className="sentinel-panel" style={{ marginTop: '12px', color: COLORS.red }}>
          {'>'} ERROR: {error}
        </div>
      )}

      {result && <XrayReport data={result} />}
    </div>
  );
}

function XrayReport({ data }) {
  const { contract, checks, market, honeypot, risk } = data;

  return (
    <div className="sentinel-fade-in" style={{ marginTop: '12px' }}>
      {/* Header */}
      <div className="sentinel-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '18px', color: COLORS.green, fontWeight: 'bold' }}>
              {contract.name || 'Unknown'} ({contract.symbol || '???'})
            </div>
            <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '2px' }}>
              {contract.address}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {market && (
              <div style={{ fontSize: '20px', color: COLORS.cyan, fontWeight: 'bold' }}>
                {fmtPrice(market.price)}
              </div>
            )}
            {market?.priceChange24h != null && (
              <div style={{
                fontSize: '12px',
                color: Number(market.priceChange24h) >= 0 ? COLORS.green : COLORS.red,
              }}>
                {Number(market.priceChange24h) >= 0 ? '+' : ''}{Number(market.priceChange24h).toFixed(2)}% (24h)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contract Analysis */}
      <div className="sentinel-panel">
        <div className="sentinel-panel__title">{'>'} CONTRACT ANALYSIS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
          <CheckRow pass={contract.hasCode} label="Contract exists" />
          <CheckRow pass={checks.ownerRenounced} label={checks.ownerRenounced ? 'Owner renounced' : `Owner: ${shortAddr(contract.owner)}`} />
          <CheckRow pass={!checks.isPausable} warn={checks.isPausable} label={checks.isPausable ? 'Has pause() function' : 'No pause function'} />
          <CheckRow pass={!checks.hasBlacklist} warn={checks.hasBlacklist} label={checks.hasBlacklist ? 'Has blacklist function' : 'No blacklist'} />
          <CheckRow pass={!checks.isProxy} warn={checks.isProxy} label={checks.isProxy ? 'Proxy contract (upgradeable)' : 'Not a proxy'} />
        </div>
        {contract.totalSupplyFormatted != null && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: COLORS.muted }}>
            Supply: {fmt(contract.totalSupplyFormatted)} | Decimals: {contract.decimals}
          </div>
        )}
      </div>

      {/* Honeypot Check */}
      <div className="sentinel-panel">
        <div className="sentinel-panel__title">{'>'} HONEYPOT CHECK</div>
        {honeypot?.error ? (
          <div style={{ color: COLORS.amber, fontSize: '13px' }}>
            {honeypot.error}
          </div>
        ) : honeypot?.isHoneypot === true ? (
          <div>
            <div style={{ color: COLORS.red, fontSize: '14px', fontWeight: 'bold' }}>
              {'\u26A0'} HONEYPOT DETECTED — Sell transaction reverts!
            </div>
            <div style={{ color: COLORS.muted, fontSize: '12px', marginTop: '4px' }}>
              Buy succeeds but sell fails. Tokens cannot be sold.
            </div>
          </div>
        ) : honeypot?.isHoneypot === false ? (
          <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
            <div>
              <span style={{ color: COLORS.green }}>{'\u2713'} Buy: Success</span>
              {honeypot.buyTax != null && <span style={{ color: COLORS.muted }}> Tax: {honeypot.buyTax}%</span>}
            </div>
            <div>
              <span style={{ color: COLORS.green }}>{'\u2713'} Sell: Success</span>
              {honeypot.sellTax != null && <span style={{ color: COLORS.muted }}> Tax: {honeypot.sellTax}%</span>}
            </div>
            {honeypot.feeTier && (
              <div style={{ color: COLORS.muted }}>
                Pool fee: {honeypot.feeTier / 10000}%
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: COLORS.muted, fontSize: '13px' }}>
            Unable to perform honeypot check (no pool found).
          </div>
        )}
      </div>

      {/* Market Data */}
      <div className="sentinel-panel">
        <div className="sentinel-panel__title">{'>'} MARKET DATA</div>
        {market ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '13px' }}>
            <div>
              <div style={{ color: COLORS.muted, fontSize: '11px' }}>Liquidity</div>
              <div style={{ color: COLORS.cyan }}>${fmt(market.liquidity)}</div>
            </div>
            <div>
              <div style={{ color: COLORS.muted, fontSize: '11px' }}>Volume 24h</div>
              <div style={{ color: COLORS.cyan }}>${fmt(market.volume24h)}</div>
            </div>
            <div>
              <div style={{ color: COLORS.muted, fontSize: '11px' }}>Market Cap</div>
              <div style={{ color: COLORS.cyan }}>${fmt(market.marketCap)}</div>
            </div>
            <div>
              <div style={{ color: COLORS.muted, fontSize: '11px' }}>Token Age</div>
              <div>{market.tokenAge || '--'}</div>
            </div>
            <div>
              <div style={{ color: COLORS.muted, fontSize: '11px' }}>DEX</div>
              <div>{market.dexId || '--'}</div>
            </div>
            <div>
              <div style={{ color: COLORS.muted, fontSize: '11px' }}>Pair</div>
              <div style={{ fontSize: '11px' }}>{shortAddr(market.pairAddress)}</div>
            </div>
          </div>
        ) : (
          <div style={{ color: COLORS.amber, fontSize: '13px' }}>
            Not listed on any DEX. No market data available.
          </div>
        )}
      </div>

      {/* Risk Score */}
      <div className="sentinel-panel" style={{ borderColor: getRiskLevel(risk.score).color }}>
        <RiskBar score={risk.score} />
        {risk.flags.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ color: COLORS.muted, fontSize: '11px', marginBottom: '4px' }}>Flags:</div>
            {risk.flags.map((flag, i) => (
              <div key={i} style={{ color: COLORS.amber, fontSize: '12px', paddingLeft: '8px' }}>
                {'\u25B8'} {flag}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
