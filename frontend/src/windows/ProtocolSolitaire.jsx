import { useState, useEffect, useCallback } from 'react';

const PROTOCOLS = [
  { name: 'NeoSwap', color: '#ff4444' },
  { name: 'DarkYield', color: '#ffd700' },
  { name: 'QuantumVault', color: '#4488ff' },
  { name: 'ApexLend', color: '#33ff33' },
  { name: 'ZeroChain', color: '#ff44ff' },
  { name: 'CipherDAO', color: '#00ffff' },
  { name: 'NullByte', color: '#ffaa00' },
  { name: 'PhantomFi', color: '#c0c0c0' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createCards() {
  const pairs = PROTOCOLS.map((p, i) => [
    { id: i * 2, pairId: i, ...p, flipped: false, matched: false },
    { id: i * 2 + 1, pairId: i, ...p, flipped: false, matched: false },
  ]).flat();
  return shuffle(pairs);
}

export default function ProtocolSolitaire() {
  const [cards, setCards] = useState(createCards);
  const [selected, setSelected] = useState([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);

  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  const handleClick = useCallback((card) => {
    if (won || card.flipped || card.matched || selected.length >= 2) return;
    if (!started) setStarted(true);

    const newSelected = [...selected, card];
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, flipped: true } : c));
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setMoves(m => m + 1);
      if (newSelected[0].pairId === newSelected[1].pairId) {
        setTimeout(() => {
          setCards(prev => {
            const next = prev.map(c => c.pairId === newSelected[0].pairId ? { ...c, matched: true } : c);
            if (next.every(c => c.matched)) setWon(true);
            return next;
          });
          setSelected([]);
        }, 300);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            (c.id === newSelected[0].id || c.id === newSelected[1].id) ? { ...c, flipped: false } : c
          ));
          setSelected([]);
        }, 800);
      }
    }
  }, [selected, started, won]);

  const reset = () => {
    setCards(createCards());
    setSelected([]);
    setMoves(0);
    setTime(0);
    setStarted(false);
    setWon(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', background: 'var(--win-bg)' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px', justifyContent: 'center' }}>
        <div style={{ fontSize: '11px' }}>Moves: <b>{moves}</b></div>
        <button className="win-btn" onClick={reset} style={{ fontSize: '10px' }}>New Game</button>
        <div style={{ fontSize: '11px' }}>Time: <b>{time}s</b></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', flex: 1, alignContent: 'center', maxWidth: '320px', margin: '0 auto' }}>
        {cards.map(card => (
          <button
            key={card.id}
            className={card.flipped || card.matched ? '' : 'win-btn'}
            onClick={() => handleClick(card)}
            style={{
              width: '70px', height: '52px', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: card.matched ? 'default' : 'pointer',
              background: card.matched ? '#90EE90' : card.flipped ? '#1a1a2e' : undefined,
              color: card.flipped ? card.color : undefined,
              border: card.flipped || card.matched ? '2px solid #404040' : undefined,
              opacity: card.matched ? 0.6 : 1,
              fontFamily: "'VT323', monospace",
              fontSize: card.flipped || card.matched ? '11px' : '16px',
            }}
          >
            {card.flipped || card.matched ? card.name : '?'}
          </button>
        ))}
      </div>
      {won && (
        <div style={{ textAlign: 'center', marginTop: '8px', fontWeight: 'bold', color: 'var(--terminal-green)' }}>
          ALL PROTOCOLS MATCHED in {moves} moves! ({time}s)
        </div>
      )}
    </div>
  );
}
