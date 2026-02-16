import { useState, useCallback } from 'react';

const ROWS = 9;
const COLS = 9;
const MINES = 10;

function createBoard() {
  const board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  );
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (!board[r][c].mine) {
      board[r][c].mine = true;
      placed++;
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) count++;
        }
      }
      board[r][c].adjacent = count;
    }
  }
  return board;
}

function cloneBoard(board) {
  return board.map(row => row.map(cell => ({ ...cell })));
}

function reveal(board, r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  if (board[r][c].revealed || board[r][c].flagged) return;
  board[r][c].revealed = true;
  if (board[r][c].adjacent === 0 && !board[r][c].mine) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        reveal(board, r + dr, c + dc);
      }
    }
  }
}

const NUM_COLORS = ['', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000', '#808080'];

export default function BugSweeper() {
  const [board, setBoard] = useState(() => createBoard());
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);

  const flagCount = board.flat().filter(c => c.flagged).length;

  const checkWin = useCallback((b) => {
    const allNonMinesRevealed = b.flat().every(c => c.mine || c.revealed);
    if (allNonMinesRevealed) {
      setWon(true);
      setGameOver(true);
    }
  }, []);

  const handleClick = (r, c) => {
    if (gameOver) return;
    if (board[r][c].flagged || board[r][c].revealed) return;
    if (!started) setStarted(true);

    const newBoard = cloneBoard(board);
    if (newBoard[r][c].mine) {
      newBoard.forEach(row => row.forEach(cell => { if (cell.mine) cell.revealed = true; }));
      setBoard(newBoard);
      setGameOver(true);
      return;
    }
    reveal(newBoard, r, c);
    setBoard(newBoard);
    checkWin(newBoard);
  };

  const handleRightClick = (e, r, c) => {
    e.preventDefault();
    if (gameOver || board[r][c].revealed) return;
    const newBoard = cloneBoard(board);
    newBoard[r][c].flagged = !newBoard[r][c].flagged;
    setBoard(newBoard);
  };

  const reset = () => {
    setBoard(createBoard());
    setGameOver(false);
    setWon(false);
    setStarted(false);
  };

  const getCellContent = (cell) => {
    if (cell.flagged && !cell.revealed) return '🚩';
    if (!cell.revealed) return '';
    if (cell.mine) return '🐛';
    if (cell.adjacent === 0) return '';
    return cell.adjacent;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', width: '100%', justifyContent: 'center' }}>
        <div className="win-panel" style={{ padding: '4px 8px', fontFamily: "'Courier New', monospace", fontSize: '16px', color: 'var(--terminal-red)', background: '#000', minWidth: '40px', textAlign: 'center' }}>
          {String(MINES - flagCount).padStart(3, '0')}
        </div>
        <button className="win-btn" onClick={reset} style={{ fontSize: '18px', padding: '2px 8px', lineHeight: 1 }}>
          {gameOver ? (won ? '😎' : '💀') : '🙂'}
        </button>
        <div className="win-panel" style={{ padding: '4px 8px', fontFamily: "'Courier New', monospace", fontSize: '16px', color: 'var(--terminal-red)', background: '#000', minWidth: '40px', textAlign: 'center' }}>
          {ROWS}x{COLS}
        </div>
      </div>

      <div className="win-panel" style={{ padding: '2px', display: 'inline-block' }}>
        {board.map((row, r) => (
          <div key={r} style={{ display: 'flex' }}>
            {row.map((cell, c) => (
              <button
                key={c}
                onClick={() => handleClick(r, c)}
                onContextMenu={(e) => handleRightClick(e, r, c)}
                style={{
                  width: '28px',
                  height: '28px',
                  padding: 0,
                  border: 'none',
                  outline: 'none',
                  fontSize: cell.revealed && !cell.mine && cell.adjacent > 0 ? '13px' : '14px',
                  fontWeight: 'bold',
                  fontFamily: "'Tahoma', sans-serif",
                  cursor: 'pointer',
                  textAlign: 'center',
                  lineHeight: '28px',
                  color: cell.revealed && !cell.mine ? (NUM_COLORS[cell.adjacent] || '#000') : '#000',
                  background: cell.revealed
                    ? (cell.mine ? '#ff4444' : '#c0c0c0')
                    : 'var(--win-bg)',
                  boxShadow: cell.revealed
                    ? 'inset 0 0 0 1px var(--border-dark)'
                    : 'inset -1px -1px 0 var(--border-darker), inset 1px 1px 0 var(--border-light), inset -2px -2px 0 var(--border-dark), inset 2px 2px 0 #dfdfdf',
                }}
              >
                {getCellContent(cell)}
              </button>
            ))}
          </div>
        ))}
      </div>

      {gameOver && (
        <div style={{ marginTop: '8px', fontWeight: 'bold', fontSize: '12px', color: won ? 'var(--terminal-green)' : 'var(--terminal-red)' }}>
          {won ? '🎉 All bugs found! Network secured!' : '💥 You hit a bug! System compromised!'}
        </div>
      )}
    </div>
  );
}
