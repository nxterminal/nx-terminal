import { useState, useCallback, useEffect, useRef } from 'react';

const CORPORATIONS = [
  { name: 'CLOSED_AI', color: '#ff8800', initial: 'C', colorGroup: 'dark' },
  { name: 'MISANTHROPIC', color: '#33aa33', initial: 'M', colorGroup: 'dark' },
  { name: 'SHALLOW_MIND', color: '#0066cc', initial: 'S', colorGroup: 'dark' },
  { name: 'ZUCK_LABS', color: '#cc0000', initial: 'Z', colorGroup: 'light' },
  { name: 'Y_AI', color: '#cc9900', initial: 'Y', colorGroup: 'light' },
  { name: 'MISTRIAL', color: '#cc33cc', initial: 'T', colorGroup: 'light' },
];

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomCorps() {
  const shuffled = shuffle(CORPORATIONS);
  const picked = shuffled.slice(0, 4);
  const groups = { dark: 0, light: 0 };
  picked.forEach(c => groups[c.colorGroup]++);
  if (groups.dark === 0 || groups.light === 0) {
    return pickRandomCorps();
  }
  return picked;
}

function buildDeck(corps) {
  const deck = [];
  for (const corp of corps) {
    for (let r = 0; r < 13; r++) {
      deck.push({ suit: corp.name, suitColor: corp.color, suitInitial: corp.initial, colorGroup: corp.colorGroup, rank: RANKS[r], rankIndex: r, id: `${corp.initial}-${RANKS[r]}-${Math.random().toString(36).slice(2, 6)}`, faceUp: false });
    }
  }
  return shuffle(deck);
}

function initGame() {
  const corps = pickRandomCorps();
  const deck = buildDeck(corps);
  const tableau = [[], [], [], [], [], [], []];
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[idx] };
      card.faceUp = row === col;
      tableau[col].push(card);
      idx++;
    }
  }
  const stock = deck.slice(idx).map(c => ({ ...c, faceUp: false }));
  return {
    corps,
    tableau,
    foundations: [[], [], [], []],
    stock,
    waste: [],
    won: false,
  };
}

function canPlaceOnFoundation(card, foundation, corps) {
  if (foundation.length === 0) {
    return card.rankIndex === 0;
  }
  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && card.rankIndex === top.rankIndex + 1;
}

function canPlaceOnTableau(card, column) {
  if (column.length === 0) {
    return card.rankIndex === 12;
  }
  const top = column[column.length - 1];
  if (!top.faceUp) return false;
  return top.rankIndex === card.rankIndex + 1 && top.colorGroup !== card.colorGroup;
}

function checkWin(foundations) {
  return foundations.every(f => f.length === 13);
}

const CARD_W = 60;
const CARD_H = 84;
const GAP = 4;
const OVERLAP_FACEDOWN = 6;
const OVERLAP_FACEUP = 18;

const styles = {
  table: {
    width: '100%',
    height: '100%',
    background: '#0a5c0a',
    padding: '8px',
    boxSizing: 'border-box',
    fontFamily: "'VT323', monospace",
    userSelect: 'none',
    overflow: 'auto',
    position: 'relative',
  },
  topRow: {
    display: 'flex',
    gap: `${GAP}px`,
    marginBottom: '12px',
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  tableauRow: {
    display: 'flex',
    gap: `${GAP}px`,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  card: {
    width: `${CARD_W}px`,
    height: `${CARD_H}px`,
    borderRadius: '4px',
    border: '1px solid #333',
    boxSizing: 'border-box',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    position: 'relative',
    flexShrink: 0,
  },
  cardFaceUp: {
    background: '#fff',
  },
  cardFaceDown: {
    background: '#1a1a3e',
    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.04) 5px, rgba(255,255,255,0.04) 10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#334',
    fontSize: '14px',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },
  placeholder: {
    width: `${CARD_W}px`,
    height: `${CARD_H}px`,
    borderRadius: '4px',
    border: '2px dashed rgba(255,255,255,0.25)',
    boxSizing: 'border-box',
    flexShrink: 0,
  },
  foundationPlaceholder: {
    background: 'rgba(0,0,0,0.15)',
  },
  stockPlaceholder: {
    background: 'rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.3)',
    fontSize: '18px',
  },
  topLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '9px',
    textAlign: 'center',
    marginBottom: '2px',
  },
  dealBtn: {
    padding: '4px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    background: '#2a6e2a',
    color: '#fff',
    border: '1px solid #1a4e1a',
    borderRadius: '3px',
    fontFamily: "'VT323', monospace",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    padding: '0 4px',
  },
  title: {
    color: '#ccffcc',
    fontSize: '14px',
    fontFamily: "'VT323', monospace",
  },
  corpBadge: {
    display: 'inline-block',
    padding: '1px 4px',
    borderRadius: '2px',
    fontSize: '9px',
    marginLeft: '3px',
    color: '#fff',
  },
};

const bounceKeyframes = `
@keyframes solBounce {
  0% { transform: translateY(-600px) rotate(0deg); opacity: 1; }
  20% { transform: translateY(0px) rotate(72deg); opacity: 1; }
  40% { transform: translateY(-200px) rotate(144deg); opacity: 1; }
  55% { transform: translateY(0px) rotate(216deg); opacity: 1; }
  70% { transform: translateY(-80px) rotate(288deg); opacity: 1; }
  85% { transform: translateY(0px) rotate(324deg); opacity: 0.8; }
  100% { transform: translateY(20px) rotate(360deg); opacity: 0.6; }
}
`;

function Card({ card, style, onClick, onMouseDown, className, isDragging }) {
  if (!card) return null;
  const cls = ['sol-card'];
  if (!card.faceUp) cls.push('face-down');
  if (className) cls.push(className);

  if (!card.faceUp) {
    return (
      <div
        className={cls.join(' ')}
        style={{ ...styles.card, ...styles.cardFaceDown, ...style, opacity: isDragging ? 0.4 : 1 }}
        onClick={onClick}
      >
        NX
      </div>
    );
  }

  return (
    <div
      className={cls.join(' ')}
      style={{ ...styles.card, ...styles.cardFaceUp, ...style, opacity: isDragging ? 0.4 : 1 }}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      <div style={{ position: 'absolute', top: '2px', left: '3px', color: card.suitColor, lineHeight: 1 }}>
        <div style={{ fontSize: '12px' }}>{card.rank}</div>
        <div style={{ fontSize: '10px' }}>{card.suitInitial}</div>
      </div>
      <div style={{ position: 'absolute', bottom: '2px', right: '3px', color: card.suitColor, lineHeight: 1, transform: 'rotate(180deg)' }}>
        <div style={{ fontSize: '12px' }}>{card.rank}</div>
        <div style={{ fontSize: '10px' }}>{card.suitInitial}</div>
      </div>
    </div>
  );
}

export default function ProtocolSolitaire() {
  const [game, setGame] = useState(() => initGame());
  const [dragState, setDragState] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [winAnimCards, setWinAnimCards] = useState([]);
  const tableRef = useRef(null);
  const colRefs = useRef([]);
  const foundRefs = useRef([]);

  const deal = useCallback(() => {
    setGame(initGame());
    setDragState(null);
    setWinAnimCards([]);
  }, []);

  const tryAutoMove = useCallback((card, sourceType, sourceIndex, cardIndex) => {
    setGame(prev => {
      if (prev.won) return prev;
      const g = {
        tableau: prev.tableau.map(col => [...col]),
        foundations: prev.foundations.map(f => [...f]),
        stock: [...prev.stock],
        waste: [...prev.waste],
        corps: prev.corps,
        won: prev.won,
      };

      let sourceCards;
      if (sourceType === 'tableau') {
        sourceCards = g.tableau[sourceIndex].splice(cardIndex);
      } else if (sourceType === 'waste') {
        sourceCards = [g.waste.pop()];
      } else {
        return prev;
      }

      if (!sourceCards || sourceCards.length === 0) return prev;

      if (sourceCards.length === 1) {
        for (let fi = 0; fi < 4; fi++) {
          if (canPlaceOnFoundation(sourceCards[0], g.foundations[fi], g.corps)) {
            const fc = { ...sourceCards[0], faceUp: true };
            g.foundations[fi].push(fc);
            if (sourceType === 'tableau' && g.tableau[sourceIndex].length > 0) {
              const last = g.tableau[sourceIndex][g.tableau[sourceIndex].length - 1];
              if (!last.faceUp) g.tableau[sourceIndex][g.tableau[sourceIndex].length - 1] = { ...last, faceUp: true };
            }
            g.won = checkWin(g.foundations);
            return g;
          }
        }
      }

      for (let ti = 0; ti < 7; ti++) {
        if (sourceType === 'tableau' && ti === sourceIndex) continue;
        if (canPlaceOnTableau(sourceCards[0], g.tableau[ti])) {
          g.tableau[ti].push(...sourceCards.map(c => ({ ...c, faceUp: true })));
          if (sourceType === 'tableau' && g.tableau[sourceIndex].length > 0) {
            const last = g.tableau[sourceIndex][g.tableau[sourceIndex].length - 1];
            if (!last.faceUp) g.tableau[sourceIndex][g.tableau[sourceIndex].length - 1] = { ...last, faceUp: true };
          }
          g.won = checkWin(g.foundations);
          return g;
        }
      }

      if (sourceType === 'tableau') {
        g.tableau[sourceIndex].splice(cardIndex, 0, ...sourceCards);
      } else if (sourceType === 'waste') {
        g.waste.push(sourceCards[0]);
      }
      return prev;
    });
  }, []);

  const flipStock = useCallback(() => {
    setGame(prev => {
      if (prev.won) return prev;
      const g = {
        ...prev,
        tableau: prev.tableau.map(col => [...col]),
        foundations: prev.foundations.map(f => [...f]),
        stock: [...prev.stock],
        waste: [...prev.waste],
      };
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
  }, []);

  const handleCardClick = useCallback((card, sourceType, sourceIndex, cardIndex) => {
    if (!card.faceUp) return;
    tryAutoMove(card, sourceType, sourceIndex, cardIndex);
  }, [tryAutoMove]);

  const startDrag = useCallback((e, cards, sourceType, sourceIndex, cardIndex) => {
    if (!cards[0].faceUp) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragState({
      cards,
      sourceType,
      sourceIndex,
      cardIndex,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;
    setMousePos({ x: e.clientX, y: e.clientY });
  }, [dragState]);

  const handleMouseUp = useCallback((e) => {
    if (!dragState) return;

    const { cards, sourceType, sourceIndex, cardIndex } = dragState;
    const dropX = e.clientX;
    const dropY = e.clientY;

    setGame(prev => {
      if (prev.won) return prev;
      const g = {
        tableau: prev.tableau.map(col => [...col]),
        foundations: prev.foundations.map(f => [...f]),
        stock: [...prev.stock],
        waste: [...prev.waste],
        corps: prev.corps,
        won: prev.won,
      };

      let dropped = false;

      for (let fi = 0; fi < 4; fi++) {
        const el = foundRefs.current[fi];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (dropX >= rect.left && dropX <= rect.right && dropY >= rect.top && dropY <= rect.bottom) {
          if (cards.length === 1 && canPlaceOnFoundation(cards[0], g.foundations[fi], g.corps)) {
            if (sourceType === 'tableau') {
              g.tableau[sourceIndex].splice(cardIndex);
            } else if (sourceType === 'waste') {
              g.waste.pop();
            }
            g.foundations[fi].push({ ...cards[0], faceUp: true });
            if (sourceType === 'tableau' && g.tableau[sourceIndex].length > 0) {
              const last = g.tableau[sourceIndex][g.tableau[sourceIndex].length - 1];
              if (!last.faceUp) g.tableau[sourceIndex][g.tableau[sourceIndex].length - 1] = { ...last, faceUp: true };
            }
            dropped = true;
            break;
          }
        }
      }

      if (!dropped) {
        for (let ti = 0; ti < 7; ti++) {
          const el = colRefs.current[ti];
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (dropX >= rect.left && dropX <= rect.right && dropY >= rect.top && dropY <= rect.bottom) {
            if (sourceType === 'tableau' && ti === sourceIndex) break;
            if (canPlaceOnTableau(cards[0], g.tableau[ti])) {
              if (sourceType === 'tableau') {
                g.tableau[sourceIndex].splice(cardIndex);
              } else if (sourceType === 'waste') {
                g.waste.pop();
              }
              g.tableau[ti].push(...cards.map(c => ({ ...c, faceUp: true })));
              if (sourceType === 'tableau' && g.tableau[sourceIndex].length > 0) {
                const last = g.tableau[sourceIndex][g.tableau[sourceIndex].length - 1];
                if (!last.faceUp) g.tableau[sourceIndex][g.tableau[sourceIndex].length - 1] = { ...last, faceUp: true };
              }
              dropped = true;
              break;
            }
          }
        }
      }

      if (dropped) {
        g.won = checkWin(g.foundations);
        return g;
      }
      return prev;
    });

    setDragState(null);
  }, [dragState]);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (game.won && winAnimCards.length === 0) {
      const allCards = [];
      game.foundations.forEach(f => {
        f.forEach(c => allCards.push({ ...c }));
      });
      const animCards = shuffle(allCards).map((c, i) => ({
        ...c,
        animDelay: i * 0.08,
        animLeft: 10 + Math.random() * 80,
      }));
      setWinAnimCards(animCards);
    }
  }, [game.won, winAnimCards.length]);

  const { tableau, foundations, stock, waste, corps, won } = game;

  const wasteTop = waste.length > 0 ? waste[waste.length - 1] : null;

  return (
    <div className="sol-table" style={styles.table} ref={tableRef}>
      <style>{bounceKeyframes}</style>

      <div style={styles.header}>
        <div style={styles.title}>
          PROTOCOL SOLITAIRE
          {corps.map(c => (
            <span key={c.name} style={{ ...styles.corpBadge, background: c.color }}>{c.initial}</span>
          ))}
        </div>
        <button className="win-btn" style={styles.dealBtn} onClick={deal}>Deal</button>
      </div>

      <div style={styles.topRow}>
        <div>
          <div style={styles.topLabel}>STOCK</div>
          <div
            className="sol-stock"
            style={{
              ...styles.placeholder,
              ...styles.stockPlaceholder,
              ...(stock.length > 0 ? { ...styles.card, ...styles.cardFaceDown, cursor: 'pointer' } : {}),
            }}
            onClick={flipStock}
          >
            {stock.length > 0 ? 'NX' : '\u21BB'}
          </div>
        </div>

        <div>
          <div style={styles.topLabel}>WASTE</div>
          <div className="sol-waste" style={{ width: `${CARD_W}px`, height: `${CARD_H}px`, position: 'relative' }}>
            {wasteTop ? (
              <Card
                card={wasteTop}
                style={{ position: 'absolute', top: 0, left: 0 }}
                onClick={() => handleCardClick(wasteTop, 'waste', 0, waste.length - 1)}
                onMouseDown={(e) => startDrag(e, [wasteTop], 'waste', 0, waste.length - 1)}
                isDragging={dragState && dragState.sourceType === 'waste'}
              />
            ) : (
              <div style={{ ...styles.placeholder, ...styles.foundationPlaceholder }} />
            )}
          </div>
        </div>

        <div style={{ width: `${CARD_W}px` }} />

        {foundations.map((found, fi) => (
          <div key={fi} ref={el => foundRefs.current[fi] = el}>
            <div style={styles.topLabel}>{fi < corps.length ? corps[fi].name.slice(0, 6) : `F${fi + 1}`}</div>
            <div className="sol-foundation" style={{ width: `${CARD_W}px`, height: `${CARD_H}px`, position: 'relative' }}>
              {found.length > 0 ? (
                <Card
                  card={found[found.length - 1]}
                  style={{ position: 'absolute', top: 0, left: 0 }}
                />
              ) : (
                <div style={{ ...styles.placeholder, ...styles.foundationPlaceholder }} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.tableauRow}>
        {tableau.map((col, ci) => (
          <div
            key={ci}
            className="sol-tableau-col"
            ref={el => colRefs.current[ci] = el}
            style={{ width: `${CARD_W}px`, minHeight: `${CARD_H + 100}px`, position: 'relative' }}
          >
            {col.length === 0 && (
              <div style={{ ...styles.placeholder, ...styles.foundationPlaceholder }} />
            )}
            {col.map((card, ri) => {
              const top = col.slice(0, ri).reduce((acc, c) => acc + (c.faceUp ? OVERLAP_FACEUP : OVERLAP_FACEDOWN), 0);
              const isDragSource = dragState && dragState.sourceType === 'tableau' && dragState.sourceIndex === ci && ri >= dragState.cardIndex;
              return (
                <Card
                  key={card.id}
                  card={card}
                  style={{ position: 'absolute', top: `${top}px`, left: 0, zIndex: ri }}
                  onClick={() => handleCardClick(card, 'tableau', ci, ri)}
                  onMouseDown={(e) => {
                    if (!card.faceUp) return;
                    const grabbed = col.slice(ri);
                    startDrag(e, grabbed, 'tableau', ci, ri);
                  }}
                  isDragging={isDragSource}
                />
              );
            })}
          </div>
        ))}
      </div>

      {dragState && (
        <div style={{ position: 'fixed', left: mousePos.x - dragState.offsetX, top: mousePos.y - dragState.offsetY, zIndex: 10000, pointerEvents: 'none' }}>
          {dragState.cards.map((card, i) => (
            <Card
              key={card.id}
              card={{ ...card, faceUp: true }}
              style={{ position: 'absolute', top: `${i * OVERLAP_FACEUP}px`, left: 0 }}
            />
          ))}
        </div>
      )}

      {won && winAnimCards.length > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 9999 }}>
          <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', color: '#ffdd00', fontSize: '28px', fontFamily: "'VT323', monospace", textShadow: '2px 2px 4px #000', zIndex: 10001, textAlign: 'center' }}>
            PROTOCOL COMPLETE!
            <div style={{ fontSize: '14px', color: '#ccffcc', marginTop: '4px' }}>All corporations secured.</div>
          </div>
          {winAnimCards.map((card, i) => (
            <div
              key={card.id}
              className="sol-bounce"
              style={{
                position: 'absolute',
                left: `${card.animLeft}%`,
                bottom: '0px',
                animation: `solBounce 2s ease-in ${card.animDelay}s both`,
              }}
            >
              <Card card={{ ...card, faceUp: true }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
