import { COLORS } from '../constants';
import InfoTooltip from '../components/InfoTooltip';

function buildBar(value, max, width = 16) {
  const filled = Math.round((value / Math.max(max, 1)) * width);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
}

export default function PerformanceMetrics({ metrics, rpc }) {
  const {
    parallelGain = 1,
    effectiveTPS = 0,
    totalConflicts = 0,
    totalReExecs = 0,
    laneEfficiency = 0,
    serialTime = 0,
    parallelTime = 0,
  } = metrics;

  return (
    <div style={{
      height: '100%',
      padding: '8px 10px',
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      color: COLORS.text,
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      overflow: 'auto',
    }}>
      {/* Header */}
      <InfoTooltip text="Performance Metrics — Real-time performance dashboard showing throughput, parallelism gains, conflict rates, and gas efficiency comparisons.">
        <div style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: '10px', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '4px' }}>
          PERFORMANCE METRICS
        </div>
      </InfoTooltip>

      {/* TPS */}
      <InfoTooltip text="Sequential TPS — Transactions per second if executed one-by-one in serial order. This is the baseline throughput without parallelism.">
        <div>
          <div style={{ color: '#888', fontSize: '9px' }}>SEQUENTIAL TPS</div>
          <div style={{ color: COLORS.text, fontSize: '14px' }}>{rpc.tps.toFixed(1)}</div>
        </div>
      </InfoTooltip>
      <InfoTooltip text="Effective TPS — Actual throughput with parallel execution enabled. Equals sequential TPS multiplied by the parallel gain factor.">
        <div>
          <div style={{ color: '#888', fontSize: '9px' }}>EFFECTIVE TPS</div>
          <div style={{ color: COLORS.green, fontSize: '14px', fontWeight: 'bold' }}>
            {effectiveTPS.toFixed(1)}
          </div>
        </div>
      </InfoTooltip>

      {/* Parallel Gain */}
      <InfoTooltip text="Parallel Gain — Speedup factor from parallel execution. A gain of 4.0x means transactions are processed 4 times faster than serial. Max theoretical: 8x (one per lane).">
        <div style={{ borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, padding: '6px 0', textAlign: 'center' }}>
          <div style={{ color: COLORS.primary, fontSize: '9px', fontWeight: 'bold' }}>
            {'>>'} PARALLEL GAIN
          </div>
          <div className="plx-gain-pulse" style={{
            color: COLORS.primary,
            fontSize: '24px',
            fontWeight: 'bold',
            lineHeight: '1.2',
          }}>
            {parallelGain.toFixed(2)}x
          </div>
        </div>
      </InfoTooltip>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <InfoTooltip text="Conflicts — State access conflicts detected between lanes. Occurs when two lanes read/write the same storage slot concurrently.">
          <div>
            <div style={{ color: '#888', fontSize: '9px' }}>CONFLICTS</div>
            <div style={{ color: COLORS.red, fontSize: '12px' }}>{totalConflicts}</div>
          </div>
        </InfoTooltip>
        <InfoTooltip text="Re-Execs — Transactions re-executed after a conflict. The conflicting tx replays with updated state to ensure deterministic results.">
          <div>
            <div style={{ color: '#888', fontSize: '9px' }}>RE-EXECS</div>
            <div style={{ color: COLORS.yellow, fontSize: '12px' }}>{totalReExecs}</div>
          </div>
        </InfoTooltip>
      </div>

      <InfoTooltip text="Lane Efficiency — Average utilization across all 8 lanes. 100% means every lane is fully occupied. Higher efficiency = better parallelism.">
        <div>
          <div style={{ color: '#888', fontSize: '9px' }}>LANE EFFICIENCY</div>
          <div style={{ color: COLORS.green, fontSize: '12px' }}>
            {(laneEfficiency * 100).toFixed(0)}%
          </div>
          <div style={{ color: COLORS.green, fontSize: '10px', letterSpacing: '1px' }}>
            {buildBar(laneEfficiency, 1, 18)}
          </div>
        </div>
      </InfoTooltip>

      {/* Gas comparison */}
      <InfoTooltip text="Gas Comparison — Compares gas processing time: serial (all txs queued) vs parallel (distributed across lanes). Lower parallel time = higher throughput.">
        <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '6px' }}>
          <div style={{ color: '#888', fontSize: '9px', marginBottom: '4px' }}>GAS COMPARISON</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <span style={{ color: '#888' }}>SERIAL:</span>
          <span style={{ color: COLORS.text }}>{serialTime.toFixed(0)} units</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <span style={{ color: '#888' }}>PARALLEL:</span>
          <span style={{ color: COLORS.green }}>{parallelTime.toFixed(0)} units</span>
        </div>
        <div style={{ marginTop: '4px' }}>
          <div style={{ display: 'flex', height: '8px', gap: '2px' }}>
            <div style={{
              flex: serialTime,
              background: '#555',
              minWidth: serialTime > 0 ? '2px' : 0,
            }} />
            <div style={{
              flex: parallelTime,
              background: COLORS.primary,
              minWidth: parallelTime > 0 ? '2px' : 0,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginTop: '2px' }}>
            <span style={{ color: '#555' }}>SERIAL</span>
            <span style={{ color: COLORS.primary }}>PARALLEL</span>
          </div>
        </div>
      </div>
      </InfoTooltip>
    </div>
  );
}
