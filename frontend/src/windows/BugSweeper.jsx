import { useState, useCallback, useEffect } from 'react';

const GRID_SIZE = 9;
const MINE_COUNT = 10;

function createBoard() {
  const board = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  );
  let placed = 0;
  while (placed < MINE_COUNT) {
    const r = Math.floor(Math.random() * GRID_SIZE);
    const c = Math.floor(Math.random() * GRID_SIZE);
    if (!board[r][c].mine) {
      board[r][c].mine = true;
      placed++;
    }
  }
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && board[nr][nc].mine) count++;
        }
      }
      board[r][c].adjacent = count;
    }
  }
  return board;
}

const ADJ_COLORS = ['', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000', '#808080'];

export default function BugSweeper() {
  const [board, setBoard] = useState(createBoard);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);

  const flagCount = board.flat().filter(c => c.flagged).length;

  useEffect(() => {
    if (!started || gameOver || won) return;
    const id = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [started, gameOver, won]);

  const checkWin = useCallback((b) => {
    const allRevealed = b.flat().every(c => c.mine ? !c.revealed : c.revealed);
    if (allRevealed) setWon(true);
  }, []);

  const reveal = useCallback((r, c) => {
    if (gameOver || won) return;
    setBoard(prev => {
      const b = prev.map(row => row.map(cell => ({ ...cell })));
      if (b[r][c].flagged || b[r][c].revealed) return prev;
      if (!started) setStarted(true);
      if (b[r][c].mine) {
        b.forEach(row => row.forEach(cell => { if (cell.mine) cell.revealed = true; }));
        setGameOver(true);
        return b;
      }
      const flood = (rr, cc) => {
        if (rr < 0 || rr >= GRID_SIZE || cc < 0 || cc >= GRID_SIZE) return;
        if (b[rr][cc].revealed || b[rr][cc].flagged || b[rr][cc].mine) return;
        b[rr][cc].revealed = true;
        if (b[rr][cc].adjacent === 0) {
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) flood(rr + dr, cc + dc);
        }
      };
      flood(r, c);
      checkWin(b);
      return b;
    });
  }, [gameOver, won, started, checkWin]);

  const flag = useCallback((e, r, c) => {
    e.preventDefault();
    if (gameOver || won) return;
    setBoard(prev => {
      const b = prev.map(row => row.map(cell => ({ ...cell })));
      if (b[r][c].revealed) return prev;
      b[r][c].flagged = !b[r][c].flagged;
      return b;
    });
  }, [gameOver, won]);

  const reset = () => {
    setBoard(createBoard());
    setGameOver(false);
    setWon(false);
    setTime(0);
    setStarted(false);
  };

  const smiley = gameOver ? '\u{1F635}' : won ? '\u{1F60E}' : '\u{1F642}';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px', background: 'var(--win-bg)', height: '100%' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px', width: '100%', justifyContent: 'center' }}>
        <div className="win-panel" style={{ padding: '2px 6px', fontFamily: "'VT323', monospace", fontSize: '20px', color: 'var(--terminal-red)', minWidth: '50px', textAlign: 'center' }}>
          {String(MINE_COUNT - flagCount).padStart(3, '0')}
        </div>
        <button className="win-btn" onClick={reset} style={{ fontSize: '18px', padding: '2px 6px', lineHeight: 1 }}>{smiley}</button>
        <div className="win-panel" style={{ padding: '2px 6px', fontFamily: "'VT323', monospace", fontSize: '20px', color: 'var(--terminal-red)', minWidth: '50px', textAlign: 'center' }}>
          {String(Math.min(time, 999)).padStart(3, '0')}
        </div>
      </div>
      <div className="win-panel" style={{ display: 'inline-block', padding: '3px' }}>
        {board.map((row, r) => (
          <div key={r} style={{ display: 'flex' }}>
            {row.map((cell, c) => {
              let content = '';
              let bg = '#c0c0c0';
              let color = '#000';
              let style = {
                width: '24px', height: '24px', border: 'none', cursor: 'pointer', padding: 0,
                fontWeight: 'bold', fontSize: '14px', fontFamily: "'Tahoma', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              };
              if (cell.revealed) {
                style.boxShadow = 'inset 1px 1px 0 #808080';
                bg = '#c0c0c0';
                if (cell.mine) { content = '\u{1F4A3}'; }
                else if (cell.adjacent > 0) { content = cell.adjacent; color = ADJ_COLORS[cell.adjacent]; }
              } else {
                style.boxShadow = 'inset -1px -1px 0 #808080, inset 1px 1px 0 #fff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf';
                if (cell.flagged) content = '\u{1F6A9}';
              }
              return (
                <button key={c} style={{ ...style, background: bg, color }} onClick={() => reveal(r, c)} onContextMenu={(e) => flag(e, r, c)}>
                  {content}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {(gameOver || won) && (
        <div style={{ marginTop: '8px', fontWeight: 'bold', color: gameOver ? 'var(--terminal-red)' : 'var(--terminal-green)' }}>
          {gameOver ? 'SYSTEM COMPROMISED — Bugs found you!' : 'ALL BUGS ELIMINATED — System secure!'}
        </div>
      )}
    </div>
  );
}
