import { useRef, useEffect, useState } from 'react';
import { decodeTx } from '../utils/txDecoder';
import { COLORS } from '../constants';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export default function TransactionFlow({ transactions }) {
  const [displayTxs, setDisplayTxs] = useState([]);
  const seenRef = useRef(new Set());

  useEffect(() => {
    const decoded = transactions.map((tx) => {
      const d = decodeTx(tx);
      const isNew = !seenRef.current.has(tx.hash);
      if (isNew) seenRef.current.add(tx.hash);
      return { ...d, isNew };
    });

    if (seenRef.current.size > 300) {
      const arr = Array.from(seenRef.current);
      seenRef.current = new Set(arr.slice(-150));
    }

    setDisplayTxs(decoded);
  }, [transactions]);

  return (
    <div className="ndw-panel" style={{ padding: '8px 10px', fontFamily: '"IBM Plex Mono", "Courier New", monospace', fontSize: '11px', color: COLORS.green, background: COLORS.bg, height: '100%', overflow: 'hidden' }}>
      <div style={{ fontSize: '9px', marginBottom: '6px', letterSpacing: '1px' }}>
        <span style={{ color: '#333' }}>{'═'.repeat(3)} </span>
        <span style={{ color: COLORS.primary, textShadow: `0 0 6px ${COLORS.primaryDim}` }}>TRANSACTION FLOW</span>
        <span style={{ color: '#333' }}> {'═'.repeat(3)} </span>
        <span className="ndw-live-dot">{'\u25CF'}</span>
        <span style={{ color: COLORS.green }}> LIVE FEED</span>
      </div>

      <div style={{ overflow: 'hidden' }}>
        {displayTxs.length === 0 && (
          <div style={{ color: '#555', fontStyle: 'italic', padding: '10px 0' }}>
            Awaiting transactions...
          </div>
        )}
        {displayTxs.slice(0, 100).map((tx, i) => {
          const opacity = Math.max(0.2, 1 - i * 0.04);
          const isNewest = i === 0;
          return (
            <div
              key={tx.hash}
              className={tx.isNew ? 'ndw-tx-enter' : ''}
              style={{
                opacity,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: '1.6',
                textShadow: isNewest ? `0 0 6px ${tx.typeColor}` : 'none',
              }}
            >
              <span style={{ color: '#555', fontSize: '10px' }}>
                [{tx.timestamp ? formatTime(tx.timestamp) : '---'}]
              </span>
              {' '}
              <span style={{ color: tx.typeColor, display: 'inline-block', width: '72px' }}>
                {tx.typeName}
              </span>
              <span style={{ color: '#666' }}>{tx.fromShort}</span>
              <span style={{ color: '#555' }}> {'\u2192'} </span>
              <span style={{ color: '#666' }}>{tx.toShort}</span>
              <span style={{ color: '#aaa', marginLeft: '4px' }}>
                {tx.valueMon !== '0' ? tx.valueMon + ' MON' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
