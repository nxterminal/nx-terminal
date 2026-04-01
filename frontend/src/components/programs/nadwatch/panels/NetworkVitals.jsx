import { useState, useEffect, useRef } from 'react';
import Tooltip from '../components/Tooltip';
import { COLORS, TARGET_TPS } from '../constants';

const SPARKLINE_CHARS = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';

function buildBar(value, max, width = 14) {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  return {
    filled: '\u2588'.repeat(Math.min(filled, width)),
    empty: '\u2591'.repeat(Math.max(empty, 0)),
  };
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
  tps: 'Transactions Per Second — Rolling average. MegaETH targets 30,000+ TPS with parallel execution.',
  gas: 'Gas Throughput — Computational gas used per second. MegaETH targets much higher throughput than Ethereum.',
  blk: 'Block Height — Current block number on MegaETH Testnet. Blocks are produced at sub-second intervals.',
  blockTime: 'Block Time — Average time between blocks. MegaETH targets sub-second. Green = within target.',
  fin: 'Finality — Time to finality. MegaETH achieves sub-second finality with AsyncBFT.',
  par: 'Parallel Load — Estimated parallel execution lanes in use. 8 lanes total.',
  val: 'Active Validators — Estimated validator count. Marked with ~ because estimated.',
  sparkline: 'TPS History (last 30 samples) — Each bar represents TPS at one polling interval.',
};

const rowStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
const labelStyle = { color: COLORS.primary, fontSize: '10px', width: '40px', flexShrink: 0, fontWeight: 'bold' };

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
    }
    prevRef.current = { ...data };

    if (Object.keys(flashes).length > 0) {
      setFlashFields(flashes);
      const timer = setTimeout(() => setFlashFields({}), 300);
      return () => clearTimeout(timer);
    }
  }, [data.blockNumber, data.tps, data.gasUsed, data.blockTime]);

  const tpsBarMax = Math.max(TARGET_TPS, data.tps * 1.5);
  const tpsBar = buildBar(data.tps, tpsBarMax);
  const gasBar = buildBar(data.gasUsed, 2.5);
  const sparkline = buildSparkline(data.tpsHistory);

  const fc = (field) => flashFields[field] ? 'ndw-flash' : '';

  // Block time in ms for MegaETH
  const blockTimeMs = data.blockTime * 1000;
  const blockTimeColor = blockTimeMs < 450 ? COLORS.green :
                          blockTimeMs < 600 ? COLORS.yellow : COLORS.red;

  // TPS color gradient
  const tpsColor = data.tps > 6000 ? '#ffffff' :
                   data.tps > 2000 ? COLORS.primary : COLORS.green;

  // Parallel load estimate
  const txCount = data.latestBlock?.transactionCount || 0;
  const activeLanes = Math.min(8, Math.max(1, Math.ceil(txCount / (TARGET_TPS * 0.4 / 8))));

  return (
    <div className="ndw-panel" style={{ padding: '8px 10px', fontFamily: '"IBM Plex Mono", "Courier New", monospace', fontSize: '12px', color: COLORS.green, background: COLORS.bg, height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: '8px', fontSize: '9px', letterSpacing: '1px' }}>
        <span style={{ color: '#333' }}>{'═'.repeat(3)} </span>
        <span style={{ color: COLORS.primary, textShadow: `0 0 6px ${COLORS.primaryDim}` }}>NETWORK VITALS</span>
        <span style={{ color: '#333' }}> {'═'.repeat(3)} </span>
        <span style={{ color: '#fff' }}>MEGAETH</span>
        <span style={{ color: '#333' }}> {'═'.repeat(3)} </span>
        <span style={{ color: '#666' }}>CHAIN 4326</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <Tooltip text={METRIC_TOOLTIPS.tps}>
          <div style={rowStyle}>
            <span style={labelStyle}>TPS</span>
            <span className={fc('tps')}>
              <span style={{ color: tpsColor }}>{tpsBar.filled}</span>
              <span style={{ color: '#333' }}>{tpsBar.empty}</span>
              <span style={{ color: tpsColor, marginLeft: '6px' }}>{data.tps.toFixed(2)}</span>
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.blk}>
          <div style={rowStyle}>
            <span style={labelStyle}>BLK</span>
            <span className={fc('blockNumber')} style={{ color: '#fff' }}>
              #{data.blockNumber.toLocaleString()}
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.blockTime}>
          <div style={rowStyle}>
            <span style={labelStyle}>BLK</span>
            <span className={fc('blockTime')} style={{ color: blockTimeColor }}>
              {blockTimeMs.toFixed(0)}ms {blockTimeMs > 0 && blockTimeMs < 450 ? '\u2713' : ''}
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.fin}>
          <div style={rowStyle}>
            <span style={labelStyle}>FIN</span>
            <span style={{ color: COLORS.green }}>~800ms (2 blocks)</span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.gas}>
          <div style={rowStyle}>
            <span style={labelStyle}>GAS</span>
            <span className={fc('gasUsed')}>
              <span style={{ color: COLORS.cyan }}>{gasBar.filled}</span>
              <span style={{ color: '#333' }}>{gasBar.empty}</span>
              <span style={{ color: COLORS.cyan, marginLeft: '6px' }}>{data.gasUsed.toFixed(2)} Ggas</span>
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.par}>
          <div style={rowStyle}>
            <span style={labelStyle}>PAR</span>
            <span>
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} style={{
                  color: i < activeLanes ? COLORS.primary : '#333',
                  marginRight: '2px',
                  textShadow: i < activeLanes ? `0 0 4px ${COLORS.primaryDim}` : 'none',
                }}>
                  {i < activeLanes ? '\u25A0' : '\u25A1'}
                </span>
              ))}
              <span style={{ color: COLORS.primaryLight, marginLeft: '4px', fontSize: '10px' }}>
                {activeLanes}/8 LANES
              </span>
            </span>
          </div>
        </Tooltip>

        <Tooltip text={METRIC_TOOLTIPS.val}>
          <div style={rowStyle}>
            <span style={labelStyle}>VAL</span>
            <span style={{ color: '#888' }}>~175 active</span>
          </div>
        </Tooltip>
      </div>

      {data.tpsHistory.length > 0 && (
        <Tooltip text={METRIC_TOOLTIPS.sparkline}>
          <div style={{ marginTop: '10px', fontSize: '11px' }}>
            <span style={{ color: '#888', fontSize: '9px' }}>TPS: </span>
            {sparkline.split('').map((ch, i) => (
              <span
                key={i}
                style={{
                  color: COLORS.green,
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
