import { useState, useCallback } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': '#000', '♥': '#cc0000', '♦': '#cc0000', '♣': '#000' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({ suit, rank: RANKS[i], value: i + 1, color: SUIT_COLORS[suit] === '#000' ? 'black' : 'red', faceUp: false });
    }
  }
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initGame() {
  const deck = shuffle(createDeck());
  const tableau = Array.from({ length: 7 }, () => []);
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[idx++] };
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(idx).map(c => ({ ...c, faceUp: false }));
  return { tableau, foundations: [[], [], [], []], stock, waste: [], selected: null };
}

function canPlaceOnTableau(card, targetCol) {
  if (targetCol.length === 0) return card.rank === 'K';
  const top = targetCol[targetCol.length - 1];
  if (!top.faceUp) return false;
  return top.color !== card.color && top.value === card.value + 1;
}

function canPlaceOnFoundation(card, foundation) {
  if (foundation.length === 0) return card.rank === 'A';
  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && top.value === card.value - 1;
}

const CARD_W = 52;
const CARD_H = 72;

function CardFace({ card, onClick, style, dimmed }) {
  return (
    <div onClick={onClick} style={{
      width: CARD_W, height: CARD_H, borderRadius: '3px', border: '1px solid #444',
      background: '#fff', cursor: 'pointer', userSelect: 'none', position: 'relative',
      fontSize: '11px', fontFamily: "'Tahoma', sans-serif", fontWeight: 'bold',
      boxShadow: '1px 1px 2px rgba(0,0,0,0.3)',
      opacity: dimmed ? 0.6 : 1,
      ...style,
    }}>
      <div style={{ position: 'absolute', top: '2px', left: '3px', color: card.color === 'red' ? '#cc0000' : '#000', lineHeight: 1 }}>
        <div style={{ fontSize: '13px' }}>{card.rank}</div>
        <div style={{ fontSize: '11px' }}>{card.suit}</div>
      </div>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '20px', color: card.color === 'red' ? '#cc0000' : '#000' }}>
        {card.suit}
      </div>
      <div style={{ position: 'absolute', bottom: '2px', right: '3px', color: card.color === 'red' ? '#cc0000' : '#000', lineHeight: 1, transform: 'rotate(180deg)' }}>
        <div style={{ fontSize: '13px' }}>{card.rank}</div>
        <div style={{ fontSize: '11px' }}>{card.suit}</div>
      </div>
    </div>
  );
}

function CardBack({ onClick, style }) {
  return (
    <div onClick={onClick} style={{
      width: CARD_W, height: CARD_H, borderRadius: '3px', border: '1px solid #444',
      background: 'linear-gradient(135deg, #000080 25%, #0000b3 25%, #0000b3 50%, #000080 50%, #000080 75%, #0000b3 75%)',
      backgroundSize: '8px 8px',
      cursor: 'pointer', userSelect: 'none',
      boxShadow: '1px 1px 2px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      <div style={{ background: '#000080', border: '1px solid #4444aa', borderRadius: '2px', padding: '2px 4px', color: '#ffd700', fontSize: '8px', fontWeight: 'bold', fontFamily: "'Press Start 2P', monospace" }}>
        NX
      </div>
    </div>
  );
}

function EmptySlot({ onClick, style, label }) {
  return (
    <div onClick={onClick} style={{
      width: CARD_W, height: CARD_H, borderRadius: '3px', border: '1px dashed #666',
      background: 'rgba(0,100,0,0.3)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#4a4', fontSize: '16px',
      ...style,
    }}>
      {label || ''}
    </div>
  );
}

export default function Solitaire() {
  const [game, setGame] = useState(() => initGame());

  const select = useCallback((source) => {
    setGame(prev => {
      const g = JSON.parse(JSON.stringify(prev));

      if (g.selected === null) {
        g.selected = source;
        return g;
      }

      const sel = g.selected;
      g.selected = null;

      // Try to move selected to target
      if (source.zone === 'foundation') {
        const fi = source.index;
        let cards = [];
        if (sel.zone === 'waste' && g.waste.length > 0) {
          cards = [g.waste[g.waste.length - 1]];
          if (canPlaceOnFoundation(cards[0], g.foundations[fi])) {
            g.foundations[fi].push(g.waste.pop());
            return g;
          }
        } else if (sel.zone === 'tableau') {
          const col = g.tableau[sel.col];
          if (col.length > 0 && col[col.length - 1].faceUp) {
            const card = col[col.length - 1];
            if (canPlaceOnFoundation(card, g.foundations[fi])) {
              g.foundations[fi].push(col.pop());
              if (col.length > 0 && !col[col.length - 1].faceUp) col[col.length - 1].faceUp = true;
              return g;
            }
          }
        }
        return g;
      }

      if (source.zone === 'tableau') {
        const targetCol = g.tableau[source.col];
        let cards = [];
        let sourceCards = null;

        if (sel.zone === 'waste' && g.waste.length > 0) {
          const card = g.waste[g.waste.length - 1];
          if (canPlaceOnTableau(card, targetCol)) {
            targetCol.push(g.waste.pop());
            return g;
          }
        } else if (sel.zone === 'tableau') {
          const srcCol = g.tableau[sel.col];
          const startIdx = sel.cardIdx != null ? sel.cardIdx : srcCol.length - 1;
          if (startIdx >= 0 && startIdx < srcCol.length && srcCol[startIdx].faceUp) {
            const movingCards = srcCol.slice(startIdx);
            if (canPlaceOnTableau(movingCards[0], targetCol)) {
              g.tableau[sel.col] = srcCol.slice(0, startIdx);
              targetCol.push(...movingCards);
              const newSrc = g.tableau[sel.col];
              if (newSrc.length > 0 && !newSrc[newSrc.length - 1].faceUp) newSrc[newSrc.length - 1].faceUp = true;
              return g;
            }
          }
        } else if (sel.zone === 'foundation') {
          const fnd = g.foundations[sel.index];
          if (fnd.length > 0) {
            const card = fnd[fnd.length - 1];
            if (canPlaceOnTableau(card, targetCol)) {
              targetCol.push(fnd.pop());
              return g;
            }
          }
        }
      }

      return g;
    });
  }, []);

  const drawStock = () => {
    setGame(prev => {
      const g = JSON.parse(JSON.stringify(prev));
      g.selected = null;
      if (g.stock.length === 0) {
        g.stock = g.waste.reverse().map(c => ({ ...c, faceUp: false }));
        g.waste = [];
      } else {
        const card = g.stock.pop();
        card.faceUp = true;
        g.waste.push(card);
      }
      return g;
    });
  };

  const autoFoundation = () => {
    setGame(prev => {
      const g = JSON.parse(JSON.stringify(prev));
      g.selected = null;
      let moved = true;
      while (moved) {
        moved = false;
        // Try waste
        if (g.waste.length > 0) {
          for (let fi = 0; fi < 4; fi++) {
            if (canPlaceOnFoundation(g.waste[g.waste.length - 1], g.foundations[fi])) {
              g.foundations[fi].push(g.waste.pop());
              moved = true;
              break;
            }
          }
        }
        // Try tableau tops
        for (let ci = 0; ci < 7; ci++) {
          const col = g.tableau[ci];
          if (col.length > 0 && col[col.length - 1].faceUp) {
            for (let fi = 0; fi < 4; fi++) {
              if (canPlaceOnFoundation(col[col.length - 1], g.foundations[fi])) {
                g.foundations[fi].push(col.pop());
                if (col.length > 0 && !col[col.length - 1].faceUp) col[col.length - 1].faceUp = true;
                moved = true;
                break;
              }
            }
          }
        }
      }
      return g;
    });
  };

  const isWon = game.foundations.every(f => f.length === 13);
  const selKey = game.selected ? `${game.selected.zone}-${game.selected.col ?? ''}-${game.selected.index ?? ''}-${game.selected.cardIdx ?? ''}` : null;

  const isSelected = (zone, col, index, cardIdx) => {
    if (!game.selected) return false;
    const s = game.selected;
    if (s.zone !== zone) return false;
    if (zone === 'waste') return true;
    if (zone === 'foundation') return s.index === index;
    if (zone === 'tableau') return s.col === col && (s.cardIdx == null ? cardIdx === game.tableau[col].length - 1 : cardIdx >= s.cardIdx);
    return false;
  };

  return (
    <div style={{ background: '#006400', height: '100%', padding: '8px', overflow: 'auto' }}>
      {/* Top row: Stock, Waste, gap, Foundations */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', alignItems: 'flex-start' }}>
        {/* Stock */}
        {game.stock.length > 0 ? (
          <CardBack onClick={drawStock} />
        ) : (
          <EmptySlot onClick={drawStock} label="↻" />
        )}
        {/* Waste */}
        {game.waste.length > 0 ? (
          <CardFace
            card={game.waste[game.waste.length - 1]}
            onClick={() => select({ zone: 'waste' })}
            style={{ outline: isSelected('waste') ? '2px solid #ffd700' : 'none' }}
          />
        ) : (
          <EmptySlot />
        )}
        <div style={{ width: CARD_W }} />
        {/* Foundations */}
        {game.foundations.map((fnd, fi) => (
          <div key={fi}>
            {fnd.length > 0 ? (
              <CardFace
                card={fnd[fnd.length - 1]}
                onClick={() => select({ zone: 'foundation', index: fi })}
                style={{ outline: isSelected('foundation', null, fi) ? '2px solid #ffd700' : 'none' }}
              />
            ) : (
              <EmptySlot onClick={() => select({ zone: 'foundation', index: fi })} label={SUITS[fi]} />
            )}
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {game.tableau.map((col, ci) => (
          <div key={ci} style={{ position: 'relative', width: CARD_W, minHeight: CARD_H }}>
            {col.length === 0 ? (
              <EmptySlot onClick={() => select({ zone: 'tableau', col: ci })} />
            ) : (
              col.map((card, ri) => (
                <div key={ri} style={{ position: ri === 0 ? 'relative' : 'absolute', top: ri === 0 ? 0 : ri * 18, left: 0, zIndex: ri }}>
                  {card.faceUp ? (
                    <CardFace
                      card={card}
                      onClick={() => select({ zone: 'tableau', col: ci, cardIdx: ri })}
                      style={{ outline: isSelected('tableau', ci, null, ri) ? '2px solid #ffd700' : 'none' }}
                    />
                  ) : (
                    <CardBack onClick={() => {}} />
                  )}
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
        <button className="win-btn" onClick={() => setGame(initGame())} style={{ fontSize: '10px' }}>New Game</button>
        <button className="win-btn" onClick={autoFoundation} style={{ fontSize: '10px' }}>Auto-Move</button>
      </div>

      {isWon && (
        <div style={{ textAlign: 'center', marginTop: '16px', color: '#ffd700', fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}>
          YOU WIN!
        </div>
      )}
    </div>
  );
}
