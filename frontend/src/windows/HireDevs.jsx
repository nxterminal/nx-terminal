import { useState } from 'react';

const CORPORATIONS = [
  { id: 'closed-ai', name: 'Closed AI', color: '#ff4444', desc: 'Promised to be open. Lied. Now charges $200/month for access to their own promises.', stats: 'High code output, low ethics' },
  { id: 'misanthropic', name: 'Misanthropic', color: '#ff44ff', desc: 'Built safety-first AI. The AI is safe. The employees are not.', stats: 'High safety scores, high turnover' },
  { id: 'shallow-mind', name: 'Shallow Mind', color: '#4488ff', desc: 'Infinite compute. Zero shipping. Their best product is their press release.', stats: 'High research, low shipping' },
  { id: 'zuck-labs', name: 'Zuck Labs', color: '#00ffff', desc: 'Will pivot to whatever is trending. Currently pivoting to the concept of pivoting.', stats: 'High adaptability, low focus' },
  { id: 'y-ai', name: 'Y.AI', color: '#ffd700', desc: 'Tweets before building. Ships after tweeting. Debugging? That is a tweet too.', stats: 'High visibility, low substance' },
  { id: 'mistrial', name: 'Mistrial Systems', color: '#ffaa00', desc: 'Open source. When convenient. Their license agreement has a license agreement.', stats: 'High community, low clarity' },
];

const MINT_COST = '0.05 ETH';

export default function HireDevs({ onMint }) {
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [walletConnected] = useState(false);

  const handleMint = () => {
    if (!walletConnected) {
      if (onMint) onMint('no-wallet');
      return;
    }
    if (onMint) onMint(selected, quantity);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '8px 12px',
        background: 'var(--terminal-bg)',
        color: 'var(--terminal-amber)',
        fontFamily: "'VT323', monospace",
        fontSize: '14px',
        borderBottom: '1px solid var(--border-dark)',
      }}>
        {'>'} DEVELOPER RECRUITMENT TERMINAL — Select Corporation & Deploy
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {CORPORATIONS.map(corp => (
            <div
              key={corp.id}
              className={selected === corp.id ? 'win-panel' : 'win-raised'}
              style={{
                padding: '8px',
                cursor: 'pointer',
                border: selected === corp.id ? `2px solid ${corp.color}` : '2px solid transparent',
              }}
              onClick={() => setSelected(corp.id)}
            >
              <div style={{ fontWeight: 'bold', color: corp.color, fontSize: '12px', marginBottom: '4px' }}>
                {corp.name}
              </div>
              <div style={{ fontSize: '10px', color: '#444', marginBottom: '4px', lineHeight: 1.3 }}>
                {corp.desc}
              </div>
              <div style={{ fontSize: '9px', color: '#666', fontStyle: 'italic' }}>
                {corp.stats}
              </div>
            </div>
          ))}
        </div>

        <div className="win-panel" style={{ marginTop: '12px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Quantity:</span>
            <button className="win-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ padding: '2px 8px' }}>-</button>
            <span style={{ fontFamily: "'VT323', monospace", fontSize: '18px', minWidth: '30px', textAlign: 'center' }}>{quantity}</span>
            <button className="win-btn" onClick={() => setQuantity(q => Math.min(10, q + 1))} style={{ padding: '2px 8px' }}>+</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '11px' }}>
              Cost: <span style={{ fontWeight: 'bold', color: 'var(--gold)' }}>{MINT_COST} x {quantity} = {(0.05 * quantity).toFixed(2)} ETH</span>
            </div>
            <button
              className="win-btn"
              onClick={handleMint}
              disabled={!selected}
              style={{ padding: '4px 16px', fontWeight: 'bold' }}
            >
              {walletConnected ? 'DEPLOY DEVELOPERS' : 'Connect Wallet to Mint'}
            </button>
          </div>

          {!selected && (
            <div style={{ fontSize: '10px', color: '#999', marginTop: '6px' }}>
              Select a corporation above to proceed with recruitment.
            </div>
          )}
        </div>
      </div>

      <div style={{
        padding: '4px 8px',
        borderTop: '1px solid var(--border-dark)',
        fontSize: '10px',
        color: '#666',
        textAlign: 'center',
      }}>
        Each developer is a unique AI agent with randomized traits, archetype, and loyalty. No refunds. No guarantees. No mercy.
      </div>
    </div>
  );
}
