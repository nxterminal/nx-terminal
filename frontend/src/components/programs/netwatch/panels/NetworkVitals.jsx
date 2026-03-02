import { useState, useEffect, useRef } from 'react';

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

function buildSparkline(data) {
  if (!data || data.length === 0) return '';
  const max = Math.max(...data, 1);
  return data.map((v) => {
    const idx = Math.min(Math.floor((v / max) * 7), 7);
    return SPARKLINE_CHARS[idx];
  }).join('');
}

export default function NetworkVitals({ data }) {
  const [flashFields, setFlashFields] = useState({});
  const prevRef = useRef({});

  useEffect(() => {
    const flashes = {};
    if (prevRef.current.blockNumber !== undefined) {
      if (data.blockNumber !== prevRef.current.blockNumber) flashes.blockNumber = true;
      if (data.tps !== prevRef.current.tps) flashes.tps = true;
      if (data.gasUsed !== prevRef.current.gasUsed) flashes.gasUsed = true;
      if (data.finality !== prevRef.current.finality) flashes.finality = true;
      if (data.pendingTx !== prevRef.current.pendingTx) flashes.pendingTx = true;
      if (data.validatorCount !== prevRef.current.validatorCount) flashes.validatorCount = true;
    }
    prevRef.current = { ...data };

    if (Object.keys(flashes).length > 0) {
      setFlashFields(flashes);
      const timer = setTimeout(() => setFlashFields({}), 300);
      return () => clearTimeout(timer);
    }
  }, [data.blockNumber, data.tps, data.gasUsed, data.finality, data.pendingTx, data.validatorCount]);

  const tpsBar = buildBar(data.tps, 50000);
  const gasBar = buildBar(data.gasUsed, 2.5);
  const sparkline = buildSparkline(data.tpsHistory);

  const fc = (field) => flashFields[field] ? 'nw-flash' : '';

  return (
    <div className="nw-panel nw-vitals" style={{ padding: '8px 10px', fontFamily: '"IBM Plex Mono", "Courier New", monospace', fontSize: '12px', color: '#00ff41', background: '#000', height: '100%', overflow: 'hidden' }}>
      <div style={{ color: '#888', fontSize: '9px', marginBottom: '8px', letterSpacing: '1px' }}>
        {'\u2550'.repeat(3)} NETWORK VITALS {'\u2550'.repeat(3)} PHAROS ATLANTIC TESTNET {'\u2550'.repeat(3)} CHAIN 688689
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', rowGap: '5px', columnGap: '8px', alignItems: 'center' }}>
        <span style={{ color: '#888', fontSize: '10px' }}>TPS</span>
        <span className={fc('tps')}>
          <span style={{ color: '#00ff41' }}>{tpsBar.filled}</span>
          <span style={{ color: '#333' }}>{tpsBar.empty}</span>
          <span style={{ color: '#00ff41', marginLeft: '6px' }}>{formatNumber(data.tps)}</span>
        </span>

        <span style={{ color: '#888', fontSize: '10px' }}>GAS</span>
        <span className={fc('gasUsed')}>
          <span style={{ color: '#00bfff' }}>{gasBar.filled}</span>
          <span style={{ color: '#333' }}>{gasBar.empty}</span>
          <span style={{ color: '#00bfff', marginLeft: '6px' }}>{data.gasUsed.toFixed(2)} Ggas</span>
        </span>

        <span style={{ color: '#888', fontSize: '10px' }}>BLK</span>
        <span className={fc('blockNumber')} style={{ color: '#fff' }}>
          #{formatNumber(data.blockNumber)}
        </span>

        <span style={{ color: '#888', fontSize: '10px' }}>FIN</span>
        <span className={fc('finality')} style={{ color: data.finality <= 0.5 ? '#00ff41' : '#ffff00' }}>
          {data.finality.toFixed(2)}s {data.finality <= 0.5 ? '\u2713' : ''}
        </span>

        <span style={{ color: '#888', fontSize: '10px' }}>VAL</span>
        <span className={fc('validatorCount')} style={{ color: '#888' }}>
          ~{data.validatorCount} active
        </span>

        <span style={{ color: '#888', fontSize: '10px' }}>PND</span>
        <span className={fc('pendingTx')} style={{ color: '#ff6600' }}>
          ~{formatNumber(data.pendingTx)} tx
        </span>
      </div>

      {data.tpsHistory.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '11px' }}>
          <span style={{ color: '#888', fontSize: '9px' }}>TPS 60s: </span>
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
      )}
    </div>
  );
}
