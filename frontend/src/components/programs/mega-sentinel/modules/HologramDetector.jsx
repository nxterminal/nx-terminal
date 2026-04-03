import { useState, useCallback } from 'react';
import { api } from '../../../../services/api';
import { COLORS } from '../constants';
import TerminalInput from '../components/TerminalInput';
import ScanProgressBar from '../components/ScanProgressBar';

const LEVEL_COLORS = {
  LEGITIMATE: COLORS.green,
  LIKELY_LEGIT: '#88cc44',
  SUSPICIOUS: COLORS.amber,
  LIKELY_FAKE: COLORS.red,
};

function ScoreCircle({ score, level }) {
  const color = LEVEL_COLORS[level] || COLORS.muted;
  const filled = Math.round(score / 100 * 20);
  const empty = 20 - filled;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color, fontFamily: '"VT323", monospace' }}>
        {score}%
      </div>
      <div style={{ color, fontSize: '12px', letterSpacing: '2px' }}>
        [{'\u2588'.repeat(filled)}{'\u2591'.repeat(empty)}]
      </div>
      <div style={{
        marginTop: '4px', padding: '2px 8px', fontSize: '12px', fontWeight: 'bold',
        color, border: `1px solid ${color}`, display: 'inline-block',
      }}>
        {level.replace(/_/g, ' ')}
      </div>
    </div>
  );
}

export default function HologramDetector() {
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleScan = useCallback(async (address) => {
    setScanning(true);
    setResult(null);
    setError(null);
    setProgress(0);

    const timer = setInterval(() => setProgress(p => Math.min(p + 6, 85)), 400);

    try {
      const data = await api.sentinelHologram(address);
      clearInterval(timer);
      setProgress(100);
      setTimeout(() => { setResult(data); setScanning(false); }, 300);
    } catch (e) {
      clearInterval(timer);
      setError(e.message || 'Check failed');
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
          <ScanProgressBar progress={progress} label="Verifying legitimacy..." />
        </div>
      )}

      {error && (
        <div className="sentinel-panel" style={{ marginTop: '12px', color: COLORS.red }}>
          {'>'} ERROR: {error}
        </div>
      )}

      {result && <HologramReport data={result} />}
    </div>
  );
}

function HologramReport({ data }) {
  const checks = data.checks || {};
  const sortedChecks = Object.entries(checks).sort((a, b) => b[1].weight - a[1].weight);

  return (
    <div className="sentinel-fade-in" style={{ marginTop: '12px' }}>
      {/* Header */}
      <div className="sentinel-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '16px', color: COLORS.green, fontWeight: 'bold' }}>
            {data.name || 'Unknown'} ({data.symbol || '???'})
          </div>
          <div style={{ fontSize: '11px', color: COLORS.muted }}>{data.contract}</div>
          {data.isVerifiedProject && data.verifiedInfo && (
            <div style={{ color: COLORS.green, fontSize: '12px', marginTop: '4px' }}>
              {'\u2713'} Verified MegaETH Project: {data.verifiedInfo.name} ({data.verifiedInfo.type})
            </div>
          )}
        </div>
        <ScoreCircle score={data.score} level={data.level} />
      </div>

      {/* Checks grid */}
      <div className="sentinel-panel">
        <div className="sentinel-panel__title">{'>'} LEGITIMACY CHECKS</div>
        {sortedChecks.map(([key, check]) => (
          <div key={key} className={`sentinel-check ${check.pass ? 'sentinel-check--pass' : 'sentinel-check--fail'}`}
            style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '16px', textAlign: 'center' }}>[{check.pass ? '\u2713' : '\u2717'}]</span>
              <span>{check.label}</span>
            </div>
            <span style={{ color: COLORS.muted, fontSize: '11px' }}>+{check.weight}pts</span>
          </div>
        ))}
        <div style={{
          marginTop: '8px', paddingTop: '6px', borderTop: `1px solid ${COLORS.border}`,
          fontSize: '13px', color: COLORS.text,
        }}>
          Total: {data.rawScore} / {data.maxScore} points ({data.score}%)
        </div>
      </div>
    </div>
  );
}
