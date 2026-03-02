import { useRef, useEffect, useState } from 'react';
import { decodeTx } from '../utils/txDecoder';

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

    if (seenRef.current.size > 200) {
      const arr = Array.from(seenRef.current);
      seenRef.current = new Set(arr.slice(-100));
    }

    setDisplayTxs(decoded);
  }, [transactions]);

  return (
    <div className="nw-panel nw-tx-flow" style={{ padding: '8px 10px', fontFamily: '"IBM Plex Mono", "Courier New", monospace', fontSize: '11px', color: '#00ff41', background: '#000', height: '100%', overflow: 'hidden' }}>
      <div style={{ color: '#888', fontSize: '9px', marginBottom: '6px', letterSpacing: '1px' }}>
        {'\u2550'.repeat(3)} TRANSACTION FLOW {'\u2550'.repeat(3)} LIVE FEED
      </div>

      <div style={{ overflow: 'hidden' }}>
        {displayTxs.length === 0 && (
          <div style={{ color: '#555', fontStyle: 'italic', padding: '10px 0' }}>
            Awaiting transactions...
          </div>
        )}
        {displayTxs.map((tx, i) => {
          const opacity = Math.max(0.2, 1 - i * 0.06);
          const isNewest = i === 0;
          return (
            <div
              key={tx.hash}
              className={tx.isNew ? 'nw-tx-enter' : ''}
              style={{
                opacity,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: '1.6',
                textShadow: isNewest ? `0 0 6px ${tx.typeColor}` : 'none',
              }}
            >
              <span style={{ color: '#555' }}>{'\u25B6'} </span>
              <span style={{ color: '#666' }}>{tx.fromShort}</span>
              <span style={{ color: '#555' }}> {'\u2192'} </span>
              <span style={{ color: tx.typeColor, display: 'inline-block', width: '80px' }}>
                {tx.typeName}
              </span>
              <span style={{ color: '#aaa' }}>
                {tx.valueEth !== '0' ? tx.valueEth + '\u039E' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
