import { useState, useEffect, useRef } from 'react';
import Tooltip from '../components/Tooltip';

const SPARKLINE_CHARS = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';

function buildBar(value, max, width = 14) {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  return {
    filled: '\u2588'.repeat(Math.min(filled, width)),
    empty: '\u2591'.repeat(Math.max(empty, 0)),
  };
}

function formatNumber(n) {
  return n.toLocaleString();
}

function formatTotalTx(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

function buildSparkline(data) {
  if (!data || data.length === 0) return '';
  const max = Math.max(...data, 1);
  return data.map((v) => {
    const idx = Math.min(Math.floor((v / max) * 7), 7);
    return SPARKLINE_CHARS[idx];
  }).join('');
}

const METRIC_TOOLTIPS = {
  tps: 'Transactions Per Second \u2014 Rolling average TPS calculated over the last 10 blocks. MegaETH targets 30,000+ TPS.',
  gas: 'Gas Throughput \u2014 Amount of computational gas used per second, measured in Gigagas (Ggas). Higher values mean more complex transactions.',
  blk: 'Block Height \u2014 The current block number on MegaETH. Each block contains a batch of confirmed transactions.',
  blockTime: 'Block Time \u2014 Average time between consecutive blocks. MegaETH targets sub-second block time. Green means within target.',
  val: 'Active Validators \u2014 Estimated number of validators securing the network. Marked with ~ because this is estimated from block data, not directly reported by the RPC.',
  totalTx: 'Total Transactions \u2014 Cumulative number of transactions processed on MegaETH since genesis.',
  sparkline: 'TPS History (last 60 seconds) \u2014 Each bar represents the rolling average TPS at one polling interval (every 3 seconds). Taller bars = more transactions.',
};

const rowStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
const labelStyle = { color: '#cfcfcf', fontSize: '10px', width: '56px', flexShrink: 0 };

export default function NetworkVitals({ data }) {
  const [flashFields, setFlashFields] = useState({});
  const prevRef = useRef({});

  useEffect(() => {
    const flashes = {};
    if (prevRef.current.blockNumber !== undefined) {
      if (data.blockNumber !== prevRef.current.blockNumber) flashes.blockNumber = true;
      if (data.tps !== prevRef.current.tps) flashes.tps = true;
      if (data.gasUsed !== prevRef.current.gasUsed) flashes.gasUsed = true;
      if (data.blockTime !== prevRef.current.blockTime) flashes.blockTime = true;
      if (data.totalTx !== prevRef.current.totalTx) flashes.totalTx = true;
      if (data.validatorCount !== prevRef.current.validatorCount) flashes.validatorCount = true;
    }
    prevRef.current = { ...data };

    if (Object.keys(flashes).length > 0) {
      setFlashFields(flashes);
      const timer = setTimeout(() => setFlashFields({}), 300);
      return () => clearTimeout(timer);
    }
  }, [data.blockNumber, data.tps, data.gasUsed, data.blockTime, data.totalTx, data.validatorCount]);

  // Dynamic TPS bar scale
  const tpsBarMax = data.tps > 1000 ? 50000 :
                    data.tps > 100 ? 1000 :
                    data.tps > 10 ? 100 : 50;
  const tpsBar = buildBar(data.tps, tpsBarMax);
  const gasBar = buildBar(data.gasUsed, 2.5);
  const sparkline = buildSparkline(data.tpsHistory);

  const fc = (field) => flashFields[field] ? 'nw-flash' : '';

  // Block time color thresholds
  const blockTimeColor = data.blockTime < 1.0 ? '#00ff41' :
                          data.blockTime < 2.0 ? '#ffff00' : '#ff3333';

  return (
    <div className="nw-panel nw-vitals" style={{ padding: '8px 10px', fontFamily: '"IBM Plex Mono", "Courier New", monospace', fontSize: '12px', color: '#00ff41', background: '#000', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: '8px', fontSize: '9px', letterSpacing: '1px' }}>
        <span style={{ color: '#333' }}>{'\u2550'.repeat(3)} </span>
        <span style={{ color: '#00bfff', textShadow: '0 0 6px rgba(0,191,255,0.5)' }}>NETWORK VITALS</span>
        <span style={{ color: '#333' }}> {'\u2550'.repeat(3)} </span>
        <span style={{ color: '#fff' }}>MEGAETH</span>
        <span style={{ color: '#333' }}> {'\u2550'.repeat(3)} </span>
        <span style={{ color: '#cfcfcf' }}>CHAIN 4326</span>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <Tooltip text={METRIC_TOOLTIPS.tps}>
          <div style={rowStyle}>
            <span style={labelStyle}>TPS</span>
            <span className={fc('tps')}>
              <span style={{ color: '#00ff41' }}>{tpsBar.filled}</span>
              <span style={{ color: '#333' }}>{tpsBar.empty}</span>
              <span style={{ color: '#00ff41', marginLeft: '6px' }}>{data.tps.toFixed(2)}</span>
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.gas}>
          <div style={rowStyle}>
            <span style={labelStyle}>GAS</span>
            <span className={fc('gasUsed')}>
              <span style={{ color: '#00bfff' }}>{gasBar.filled}</span>
              <span style={{ color: '#333' }}>{gasBar.empty}</span>
              <span style={{ color: '#00bfff', marginLeft: '6px' }}>{data.gasUsed.toFixed(2)} Ggas</span>
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.blk}>
          <div style={rowStyle}>
            <span style={labelStyle}>BLK</span>
            <span className={fc('blockNumber')} style={{ color: '#fff' }}>
              #{formatNumber(data.blockNumber)}
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.blockTime}>
          <div style={rowStyle}>
            <span style={labelStyle}>BLK TIME</span>
            <span className={fc('blockTime')} style={{ color: blockTimeColor }}>
              {data.blockTime.toFixed(2)}s {data.blockTime > 0 && data.blockTime < 1.0 ? '\u2713' : ''}
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.val}>
          <div style={rowStyle}>
            <span style={labelStyle}>VAL</span>
            <span className={fc('validatorCount')} style={{ color: '#cfcfcf' }}>
              ~{data.validatorCount} active
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.totalTx}>
          <div style={rowStyle}>
            <span style={labelStyle}>TOTAL TX</span>
            <span className={fc('totalTx')} style={{ color: '#00ff41' }}>
              {formatTotalTx(data.totalTx)}
            </span>
          </div>
        </Tooltip>
      </div>

      {/* Sparkline */}
      {data.tpsHistory.length > 0 && (
        <Tooltip text={METRIC_TOOLTIPS.sparkline}>
          <div style={{ marginTop: '10px', fontSize: '11px' }}>
            <span style={{ color: '#cfcfcf', fontSize: '9px' }}>TPS 60s: </span>
            {sparkline.split('').map((ch, i) => (
              <span
                key={i}
                style={{
                  color: '#00ff41',
                  opacity: 0.3 + (i / sparkline.length) * 0.7,
                }}
              >
                {ch}
              </span>
            ))}
          </div>
        </Tooltip>
      )}
    </div>
  );
}
