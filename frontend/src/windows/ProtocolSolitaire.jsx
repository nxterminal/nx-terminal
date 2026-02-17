import { useState, useEffect, useCallback, useRef } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': '#000', '♥': '#cc0000', '♦': '#cc0000', '♣': '#000' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const CARD_W = 71;
const CARD_H = 96;
const STACK_OFFSET_HIDDEN = 4;
const STACK_OFFSET_VISIBLE = 20;

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let r = 0; r < RANKS.length; r++) {
      deck.push({ suit, rank: RANKS[r], value: r + 1, faceUp: false });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function isRed(suit) { return suit === '♥' || suit === '♦'; }
function cardKey(card) { return `${card.rank}${card.suit}`; }

function canPlaceOnTableau(card, target) {
  if (!target) return card.rank === 'K';
  return isRed(card.suit) !== isRed(target.suit) && card.value === target.value - 1;
}

function canPlaceOnFoundation(card, topCard) {
  if (!topCard) return card.rank === 'A';
  return card.suit === topCard.suit && card.value === topCard.value + 1;
}

function createGame() {
  const deck = shuffleDeck(makeDeck());
  const tableau = [[], [], [], [], [], [], []];
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[idx++] };
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }
  return {
    tableau,
    foundations: [[], [], [], []],
    stock: deck.slice(idx).map(c => ({ ...c, faceUp: false })),
    waste: [],
  };
}

function CardBack() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(135deg, #1a3a6a 0%, #1a2a4a 50%, #1a3a6a 100%)',
      border: '2px solid #4a6a9a', borderRadius: '3px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: '3px',
        border: '1px solid #4a6a9a', borderRadius: '2px',
        background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(74,106,154,0.15) 3px, rgba(74,106,154,0.15) 4px)',
      }} />
      <svg width="32" height="24" viewBox="0 0 60 40" style={{ position: 'relative', zIndex: 1 }}>
        <text x="3" y="30" fontFamily="monospace" fontWeight="bold" fontSize="28" fill="#6a9adf" stroke="#3a6aaf" strokeWidth="0.5">NX</text>
      </svg>
    </div>
  );
}

function CardFace({ card }) {
  const color = SUIT_COLORS[card.suit];
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#fffff8', border: '1px solid #888', borderRadius: '3px',
      boxSizing: 'border-box', position: 'relative',
      fontFamily: "'Georgia', serif", userSelect: 'none',
    }}>
      <div style={{ position: 'absolute', top: '2px', left: '4px', color, fontSize: '12px', fontWeight: 'bold', lineHeight: 1 }}>
        <div>{card.rank}</div>
        <div style={{ fontSize: '11px' }}>{card.suit}</div>
      </div>
      <div style={{ position: 'absolute', bottom: '2px', right: '4px', color, fontSize: '12px', fontWeight: 'bold', lineHeight: 1, transform: 'rotate(180deg)' }}>
        <div>{card.rank}</div>
        <div style={{ fontSize: '11px' }}>{card.suit}</div>
      </div>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '26px', color }}>
        {card.suit}
      </div>
    </div>
  );
}

export default function ProtocolSolitaire() {
  const [game, setGame] = useState(createGame);
  const [dragState, setDragState] = useState(null);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [drawCount, setDrawCount] = useState(() => {
    const saved = localStorage.getItem('nx-solitaire-draw');
    return saved === '3' ? 3 : 1;
  });
  const boardRef = useRef(null);

  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  useEffect(() => {
    if (game.foundations.every(f => f.length === 13)) setWon(true);
  }, [game]);

  const newGame = useCallback(() => {
    setGame(createGame());
    setDragState(null);
    setMoves(0);
    setTime(0);
    setStarted(false);
    setWon(false);
  }, []);

  const toggleDrawCount = useCallback(() => {
    setDrawCount(prev => {
      const next = prev === 1 ? 3 : 1;
      localStorage.setItem('nx-solitaire-draw', String(next));
      return next;
    });
    newGame();
  }, [newGame]);

  // Stock click — draw 1 or 3 cards
  const handleStockClick = useCallback(() => {
    if (!started) setStarted(true);
    setGame(prev => {
      if (prev.stock.length === 0) {
        if (prev.waste.length === 0) return prev;
        return { ...prev, stock: prev.waste.map(c => ({ ...c, faceUp: false })).reverse(), waste: [] };
      }
      const count = Math.min(drawCount, prev.stock.length);
      const drawn = prev.stock.slice(-count).map(c => ({ ...c, faceUp: true }));
      return {
        ...prev,
        stock: prev.stock.slice(0, -count),
        waste: [...prev.waste, ...drawn],
      };
    });
  }, [started, drawCount]);

  const tryAutoFoundation = useCallback((card, source, sourceIdx) => {
    setGame(prev => {
      for (let fi = 0; fi < 4; fi++) {
        const top = prev.foundations[fi].length > 0 ? prev.foundations[fi][prev.foundations[fi].length - 1] : null;
        if (canPlaceOnFoundation(card, top)) {
          const newState = { ...prev };
          const newFoundations = prev.foundations.map((f, i) => i === fi ? [...f, { ...card, faceUp: true }] : [...f]);
          if (source === 'waste') {
            newState.waste = prev.waste.slice(0, -1);
          } else if (source === 'tableau') {
            const newCol = [...prev.tableau[sourceIdx]];
            newCol.pop();
            if (newCol.length > 0 && !newCol[newCol.length - 1].faceUp) {
              newCol[newCol.length - 1] = { ...newCol[newCol.length - 1], faceUp: true };
            }
            newState.tableau = prev.tableau.map((col, i) => i === sourceIdx ? newCol : [...col]);
          }
          newState.foundations = newFoundations;
          return newState;
        }
      }
      return prev;
    });
    setMoves(m => m + 1);
  }, []);

  const handleDragStart = useCallback((e, source, sourceIdx, cardIdx) => {
    if (!started) setStarted(true);
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let cards;
    if (source === 'waste') {
      cards = [game.waste[game.waste.length - 1]];
    } else if (source === 'tableau') {
      cards = game.tableau[sourceIdx].slice(cardIdx);
    } else if (source === 'foundation') {
      cards = [game.foundations[sourceIdx][game.foundations[sourceIdx].length - 1]];
    } else return;

    if (!cards[0] || !cards[0].faceUp) return;

    setDragState({ cards, source, sourceIdx, cardIdx, startX: clientX, startY: clientY, currentX: clientX, currentY: clientY });
  }, [game, started]);

  const applyMove = useCallback((drag, targetType, targetIdx) => {
    setGame(prev => {
      const newState = {
        tableau: prev.tableau.map(col => [...col]),
        foundations: prev.foundations.map(f => [...f]),
        stock: [...prev.stock],
        waste: [...prev.waste],
      };
      if (drag.source === 'waste') {
        newState.waste.pop();
      } else if (drag.source === 'tableau') {
        newState.tableau[drag.sourceIdx] = newState.tableau[drag.sourceIdx].slice(0, drag.cardIdx);
        const col = newState.tableau[drag.sourceIdx];
        if (col.length > 0 && !col[col.length - 1].faceUp) {
          col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
        }
      } else if (drag.source === 'foundation') {
        newState.foundations[drag.sourceIdx].pop();
      }
      if (targetType === 'foundation') {
        newState.foundations[targetIdx].push(...drag.cards.map(c => ({ ...c, faceUp: true })));
      } else if (targetType === 'tableau') {
        newState.tableau[targetIdx].push(...drag.cards.map(c => ({ ...c, faceUp: true })));
      }
      return newState;
    });
    setMoves(m => m + 1);
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setDragState(prev => prev ? { ...prev, currentX: clientX, currentY: clientY } : null);
    };
    const handleEnd = () => {
      setDragState(prev => {
        if (!prev) return null;
        const board = boardRef.current;
        if (!board) return null;
        const dropX = prev.currentX;
        const dropY = prev.currentY;

        for (let fi = 0; fi < 4; fi++) {
          const fEl = board.querySelector(`[data-foundation="${fi}"]`);
          if (fEl) {
            const fRect = fEl.getBoundingClientRect();
            if (dropX >= fRect.left && dropX <= fRect.right && dropY >= fRect.top && dropY <= fRect.bottom) {
              if (prev.cards.length === 1) {
                const card = prev.cards[0];
                const top = game.foundations[fi].length > 0 ? game.foundations[fi][game.foundations[fi].length - 1] : null;
                if (canPlaceOnFoundation(card, top)) { applyMove(prev, 'foundation', fi); return null; }
              }
            }
          }
        }
        for (let ti = 0; ti < 7; ti++) {
          const tEl = board.querySelector(`[data-tableau="${ti}"]`);
          if (tEl) {
            const tRect = tEl.getBoundingClientRect();
            if (dropX >= tRect.left && dropX <= tRect.right && dropY >= tRect.top && dropY <= tRect.bottom) {
              const col = game.tableau[ti];
              const topCard = col.length > 0 ? col[col.length - 1] : null;
              if (canPlaceOnTableau(prev.cards[0], topCard)) { applyMove(prev, 'tableau', ti); return null; }
            }
          }
        }
        return null;
      });
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [dragState, game, applyMove]);

  const renderCard = (card, props = {}) => {
    const { style = {}, isDragging, ...rest } = props;
    return (
      <div style={{ width: CARD_W, height: CARD_H, position: 'relative', cursor: card.faceUp ? 'grab' : 'default', opacity: isDragging ? 0.4 : 1, flexShrink: 0, ...style }} {...rest}>
        {card.faceUp ? <CardFace card={card} /> : <CardBack />}
      </div>
    );
  };

  const renderEmptySlot = (props = {}) => {
    const { style = {}, children, ...rest } = props;
    return (
      <div style={{ width: CARD_W, height: CARD_H, border: '2px dashed rgba(255,255,255,0.25)', borderRadius: '4px', boxSizing: 'border-box', ...style }} {...rest}>
        {children}
      </div>
    );
  };

  const isDragged = (card, source, sourceIdx, cardIdx) => {
    if (!dragState) return false;
    if (dragState.source !== source) return false;
    if (source === 'waste') return cardKey(card) === cardKey(dragState.cards[0]);
    if (source === 'tableau') return dragState.sourceIdx === sourceIdx && cardIdx >= dragState.cardIdx;
    if (source === 'foundation') return dragState.sourceIdx === sourceIdx && cardKey(card) === cardKey(dragState.cards[0]);
    return false;
  };

  // Visible waste cards (show up to 3 in draw-3 mode)
  const visibleWaste = drawCount === 3
    ? game.waste.slice(-3)
    : game.waste.slice(-1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a6e1a', overflow: 'hidden', userSelect: 'none' }}>
      <div style={{
        display: 'flex', gap: '12px', alignItems: 'center', padding: '4px 8px',
        background: 'var(--win-bg, #c0c0c0)', borderBottom: '1px solid var(--border-dark, #808080)', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '11px' }}>Moves: <b>{moves}</b></div>
        <button className="win-btn" onClick={newGame} style={{ fontSize: '10px' }}>New Game</button>
        <button className="win-btn" onClick={toggleDrawCount} style={{ fontSize: '10px' }}>
          Draw {drawCount === 1 ? '3' : '1'}
        </button>
        <div style={{ fontSize: '11px' }}>Time: <b>{time}s</b></div>
        <div style={{ fontSize: '10px', color: '#666' }}>Mode: Draw {drawCount}</div>
      </div>

      {won && (
        <div style={{
          textAlign: 'center', padding: '8px', background: '#004400', color: '#33ff33',
          fontFamily: "'VT323', monospace", fontSize: '16px', fontWeight: 'bold',
        }}>
          YOU WIN! Completed in {moves} moves ({time}s)
        </div>
      )}

      <div ref={boardRef} style={{ flex: 1, position: 'relative', padding: '10px', overflow: 'auto', minWidth: (CARD_W + 8) * 7 + 20 }}>
        {/* Top row */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-start' }}>
          {/* Stock */}
          <div onClick={handleStockClick} style={{ cursor: 'pointer' }}>
            {game.stock.length > 0 ? renderCard(game.stock[game.stock.length - 1]) : renderEmptySlot({
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '24px' },
              children: '↺',
            })}
          </div>

          {/* Waste — show up to 3 fanned in draw-3 mode */}
          <div style={{ position: 'relative', width: drawCount === 3 ? CARD_W + 30 : CARD_W, height: CARD_H }}>
            {visibleWaste.length > 0 ? (
              visibleWaste.map((card, i) => {
                const isTop = i === visibleWaste.length - 1;
                const offset = drawCount === 3 ? i * 15 : 0;
                return (
                  <div
                    key={cardKey(card)}
                    style={{ position: 'absolute', left: offset, top: 0, zIndex: i }}
                    onMouseDown={isTop ? (e) => handleDragStart(e, 'waste', 0, game.waste.length - 1) : undefined}
                    onTouchStart={isTop ? (e) => handleDragStart(e, 'waste', 0, game.waste.length - 1) : undefined}
                    onDoubleClick={isTop ? () => tryAutoFoundation(card, 'waste', 0) : undefined}
                  >
                    {renderCard(card, { isDragging: isTop && isDragged(card, 'waste', 0, 0) })}
                  </div>
                );
              })
            ) : renderEmptySlot()}
          </div>

          <div style={{ width: drawCount === 3 ? CARD_W - 30 : CARD_W }} />

          {/* Foundations */}
          {game.foundations.map((foundation, fi) => (
            <div key={fi} data-foundation={fi}>
              {foundation.length > 0 ? (
                <div
                  onMouseDown={(e) => handleDragStart(e, 'foundation', fi, foundation.length - 1)}
                  onTouchStart={(e) => handleDragStart(e, 'foundation', fi, foundation.length - 1)}
                >
                  {renderCard(foundation[foundation.length - 1], { isDragging: isDragged(foundation[foundation.length - 1], 'foundation', fi, 0) })}
                </div>
              ) : renderEmptySlot({
                style: { display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '22px' },
                children: SUITS[fi],
              })}
            </div>
          ))}
        </div>

        {/* Tableau */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          {game.tableau.map((col, ti) => (
            <div key={ti} data-tableau={ti} style={{ position: 'relative', width: CARD_W, minHeight: CARD_H + 100 }}>
              {col.length === 0 ? renderEmptySlot() : col.map((card, ci) => {
                const offset = col.slice(0, ci).reduce((sum, c) => sum + (c.faceUp ? STACK_OFFSET_VISIBLE : STACK_OFFSET_HIDDEN), 0);
                const beingDragged = isDragged(card, 'tableau', ti, ci);
                return (
                  <div
                    key={cardKey(card)}
                    style={{ position: 'absolute', top: offset, left: 0, zIndex: ci }}
                    onMouseDown={card.faceUp ? (e) => handleDragStart(e, 'tableau', ti, ci) : undefined}
                    onTouchStart={card.faceUp ? (e) => handleDragStart(e, 'tableau', ti, ci) : undefined}
                    onDoubleClick={card.faceUp && ci === col.length - 1 ? () => tryAutoFoundation(card, 'tableau', ti) : undefined}
                  >
                    {renderCard(card, { isDragging: beingDragged })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Drag ghost */}
        {dragState && (
          <div style={{ position: 'fixed', left: dragState.currentX - CARD_W / 2, top: dragState.currentY - 10, zIndex: 10000, pointerEvents: 'none' }}>
            {dragState.cards.map((card, i) => (
              <div key={cardKey(card)} style={{ position: 'absolute', top: i * STACK_OFFSET_VISIBLE, left: 0 }}>
                {renderCard(card, { style: { boxShadow: '3px 3px 8px rgba(0,0,0,0.5)' } })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
