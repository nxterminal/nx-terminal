import { useState, useEffect, useRef, useCallback } from 'react';

const ROWS = 9;
const COLS = 9;
const TOTAL_MINES = 10;

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
    }))
  );
}

function placeMines(board, excludeRow, excludeCol) {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  let placed = 0;
  while (placed < TOTAL_MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (!newBoard[r][c].mine && !(r === excludeRow && c === excludeCol)) {
      newBoard[r][c].mine = true;
      placed++;
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!newBoard[r][c].mine) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && newBoard[nr][nc].mine) {
              count++;
            }
          }
        }
        newBoard[r][c].adjacentMines = count;
      }
    }
  }
  return newBoard;
}

function floodFill(board, row, col) {
  const newBoard = board.map(r => r.map(c => ({ ...c })));
  const stack = [[row, col]];
  while (stack.length > 0) {
    const [r, c] = stack.pop();
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    if (newBoard[r][c].revealed || newBoard[r][c].flagged) continue;
    newBoard[r][c].revealed = true;
    if (newBoard[r][c].adjacentMines === 0 && !newBoard[r][c].mine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) {
            stack.push([r + dr, c + dc]);
          }
        }
      }
    }
  }
  return newBoard;
}

function checkWin(board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c].mine && !board[r][c].revealed) {
        return false;
      }
    }
  }
  return true;
}

function revealAllMines(board) {
  return board.map(row =>
    row.map(cell => (cell.mine ? { ...cell, revealed: true } : { ...cell }))
  );
}

function countFlags(board) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].flagged) count++;
    }
  }
  return count;
}

function formatLED(num) {
  const clamped = Math.max(-99, Math.min(999, num));
  const str = String(Math.abs(clamped));
  const padded = str.padStart(3, '0');
  return clamped < 0 ? '-' + padded.slice(1) : padded;
}

const NUMBER_COLORS = {
  1: '#0000FF',
  2: '#008000',
  3: '#FF0000',
  4: '#000080',
  5: '#800000',
  6: '#008080',
  7: '#000000',
  8: '#808080',
};

const styles = {
  container: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px',
    background: '#C0C0C0',
    border: '3px solid',
    borderColor: '#FFFFFF #808080 #808080 #FFFFFF',
    userSelect: 'none',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '4px 6px',
    marginBottom: '6px',
    background: '#C0C0C0',
    border: '2px solid',
    borderColor: '#808080 #FFFFFF #FFFFFF #808080',
    boxSizing: 'border-box',
  },
  led: {
    background: '#000',
    color: '#FF0000',
    fontFamily: '"Courier New", monospace',
    fontSize: '22px',
    fontWeight: 'bold',
    padding: '2px 4px',
    letterSpacing: '2px',
    minWidth: '50px',
    textAlign: 'center',
    border: '1px solid',
    borderColor: '#808080 #FFFFFF #FFFFFF #808080',
  },
  face: {
    width: '30px',
    height: '30px',
    fontSize: '18px',
    lineHeight: '30px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#C0C0C0',
    border: '2px solid',
    borderColor: '#FFFFFF #808080 #808080 #FFFFFF',
    padding: 0,
    outline: 'none',
  },
  facePressed: {
    borderColor: '#808080 #FFFFFF #FFFFFF #808080',
  },
  boardWrapper: {
    border: '3px solid',
    borderColor: '#808080 #FFFFFF #FFFFFF #808080',
    lineHeight: 0,
  },
  board: {
    display: 'grid',
    gridTemplateColumns: `repeat(${COLS}, 24px)`,
    gridTemplateRows: `repeat(${ROWS}, 24px)`,
    gap: 0,
  },
  cellHidden: {
    width: '24px',
    height: '24px',
    boxSizing: 'border-box',
    border: '2px solid',
    borderColor: '#FFFFFF #808080 #808080 #FFFFFF',
    background: '#C0C0C0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    padding: 0,
  },
  cellRevealed: {
    width: '24px',
    height: '24px',
    boxSizing: 'border-box',
    border: '1px solid #808080',
    background: '#C0C0C0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    fontSize: '14px',
    fontWeight: 'bold',
    padding: 0,
  },
  cellMineExploded: {
    width: '24px',
    height: '24px',
    boxSizing: 'border-box',
    border: '1px solid #808080',
    background: '#FF0000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    fontSize: '14px',
    fontWeight: 'bold',
    padding: 0,
  },
  outerWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    height: '100%',
    overflow: 'auto',
    background: '#C0C0C0',
    padding: '12px',
    boxSizing: 'border-box',
  },
};

export default function BugSweeper() {
  const [board, setBoard] = useState(createEmptyBoard);
  const [gameState, setGameState] = useState('idle'); // idle, playing, won, lost
  const [time, setTime] = useState(0);
  const [mouseDown, setMouseDown] = useState(false);
  const [minesPlaced, setMinesPlaced] = useState(false);
  const [clickedMine, setClickedMine] = useState(null);
  const timerRef = useRef(null);
  const loseTimeoutRef = useRef(null);

  const resetGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (loseTimeoutRef.current) clearTimeout(loseTimeoutRef.current);
    timerRef.current = null;
    loseTimeoutRef.current = null;
    setBoard(createEmptyBoard());
    setGameState('idle');
    setTime(0);
    setMouseDown(false);
    setMinesPlaced(false);
    setClickedMine(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (loseTimeoutRef.current) clearTimeout(loseTimeoutRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setTime(prev => {
        if (prev >= 999) return 999;
        return prev + 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleCellClick = useCallback((row, col) => {
    if (gameState === 'won' || gameState === 'lost') return;

    setBoard(prevBoard => {
      const cell = prevBoard[row][col];
      if (cell.revealed || cell.flagged) return prevBoard;

      let currentBoard = prevBoard;

      if (!minesPlaced) {
        currentBoard = placeMines(prevBoard, row, col);
        setMinesPlaced(true);
        setGameState('playing');
        startTimer();
      }

      if (currentBoard[row][col].mine) {
        stopTimer();
        const revealed = revealAllMines(currentBoard);
        setClickedMine({ row, col });
        setGameState('lost');
        loseTimeoutRef.current = setTimeout(() => {
          alert('nxbugsweeper.exe has performed an illegal operation. Your dev lost 2 energy.');
        }, 2000);
        return revealed;
      }

      const newBoard = floodFill(currentBoard, row, col);
      if (checkWin(newBoard)) {
        stopTimer();
        setGameState('won');
        setTimeout(() => {
          alert('Bug Sweeper \u2014 You found all 10 bugs! Your dev gained +5 energy. Employee of the month!');
        }, 100);
      }
      return newBoard;
    });
  }, [gameState, minesPlaced, startTimer, stopTimer]);

  const handleRightClick = useCallback((e, row, col) => {
    e.preventDefault();
    if (gameState === 'won' || gameState === 'lost') return;

    setBoard(prevBoard => {
      const cell = prevBoard[row][col];
      if (cell.revealed) return prevBoard;

      const newBoard = prevBoard.map(r => r.map(c => ({ ...c })));
      newBoard[row][col].flagged = !newBoard[row][col].flagged;
      return newBoard;
    });
  }, [gameState]);

  const flagCount = countFlags(board);
  const mineDisplay = TOTAL_MINES - flagCount;

  const getFaceIcon = () => {
    const sz = 18;
    if (gameState === 'won') return <svg width={sz} height={sz} viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#ffcc00" stroke="#000" strokeWidth="0.5"/><rect x="4" y="7" width="3" height="2" fill="#000"/><rect x="11" y="7" width="3" height="2" fill="#000"/><path d="M5 12 Q9 16 13 12" stroke="#000" strokeWidth="1" fill="none"/></svg>;
    if (gameState === 'lost') return <svg width={sz} height={sz} viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#ffcc00" stroke="#000" strokeWidth="0.5"/><line x1="4" y1="6" x2="7" y2="9" stroke="#000" strokeWidth="1"/><line x1="7" y1="6" x2="4" y2="9" stroke="#000" strokeWidth="1"/><line x1="11" y1="6" x2="14" y2="9" stroke="#000" strokeWidth="1"/><line x1="14" y1="6" x2="11" y2="9" stroke="#000" strokeWidth="1"/><path d="M5 14 Q9 11 13 14" stroke="#000" strokeWidth="1" fill="none"/></svg>;
    if (mouseDown) return <svg width={sz} height={sz} viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#ffcc00" stroke="#000" strokeWidth="0.5"/><circle cx="6" cy="7" r="1.5" fill="#000"/><circle cx="12" cy="7" r="1.5" fill="#000"/><circle cx="9" cy="13" r="2" fill="#000"/></svg>;
    return <svg width={sz} height={sz} viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#ffcc00" stroke="#000" strokeWidth="0.5"/><circle cx="6" cy="7" r="1.5" fill="#000"/><circle cx="12" cy="7" r="1.5" fill="#000"/><path d="M5 12 Q9 15 13 12" stroke="#000" strokeWidth="1" fill="none"/></svg>;
  };

  const getCellClassName = (cell, row, col) => {
    const classes = ['ms-cell'];
    if (cell.revealed) {
      classes.push('revealed');
      if (cell.mine) classes.push('mine');
      if (cell.adjacentMines > 0 && !cell.mine) classes.push(`ms-${cell.adjacentMines}`);
    }
    if (cell.flagged && !cell.revealed) classes.push('flagged');
    return classes.join(' ');
  };

  const getCellContent = (cell) => {
    if (cell.flagged && !cell.revealed) return <svg width="12" height="12" viewBox="0 0 12 12"><rect x="4" y="2" width="1" height="8" fill="#000"/><polygon points="5,2 10,4 5,6" fill="#ff0000"/><rect x="2" y="9" width="6" height="1" fill="#000"/></svg>;
    if (!cell.revealed) return '';
    if (cell.mine) return <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.5" fill="#000"/><line x1="6" y1="1" x2="6" y2="11" stroke="#000" strokeWidth="0.8"/><line x1="1" y1="6" x2="11" y2="6" stroke="#000" strokeWidth="0.8"/><line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="#000" strokeWidth="0.7"/><line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="#000" strokeWidth="0.7"/></svg>;
    if (cell.adjacentMines > 0) return cell.adjacentMines;
    return '';
  };

  const getCellStyle = (cell, row, col) => {
    if (cell.revealed && cell.mine && clickedMine && clickedMine.row === row && clickedMine.col === col) {
      return styles.cellMineExploded;
    }
    if (cell.revealed) {
      return {
        ...styles.cellRevealed,
        color: cell.adjacentMines > 0 ? NUMBER_COLORS[cell.adjacentMines] : undefined,
      };
    }
    return styles.cellHidden;
  };

  return (
    <div
      style={styles.outerWrapper}
      onContextMenu={e => e.preventDefault()}
    >
      <div style={styles.container}>
        <div className="ms-header" style={styles.header}>
          <div className="ms-led" style={styles.led}>
            {formatLED(mineDisplay)}
          </div>
          <button
            className="ms-face"
            style={styles.face}
            onClick={resetGame}
            onMouseDown={e => e.stopPropagation()}
          >
            {getFaceIcon()}
          </button>
          <div className="ms-led" style={styles.led}>
            {formatLED(time)}
          </div>
        </div>
        <div style={styles.boardWrapper}>
          <div className="ms-board" style={styles.board}>
            {board.map((row, r) =>
              row.map((cell, c) => (
                <div
                  key={`${r}-${c}`}
                  className={getCellClassName(cell, r, c)}
                  style={getCellStyle(cell, r, c)}
                  onClick={() => handleCellClick(r, c)}
                  onContextMenu={e => handleRightClick(e, r, c)}
                  onMouseDown={() => {
                    if (gameState !== 'won' && gameState !== 'lost') setMouseDown(true);
                  }}
                  onMouseUp={() => setMouseDown(false)}
                  onMouseLeave={() => setMouseDown(false)}
                >
                  {getCellContent(cell, r, c)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
