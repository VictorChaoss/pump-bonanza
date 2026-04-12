import { useState, useCallback, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './App.css';

// ─── Symbols ────────────────────────────────────────────────────────────────
const SYMBOLS = ['🍭', '🍉', '🍇', '🍌', '🍎', '🍬', '🍒', '🍋', '🍊', '🫐'];
const COLS = 6;
const ROWS = 5;

// How long (ms) each column spins before stopping (staggered)
const COL_STOP_DELAYS = [700, 950, 1200, 1450, 1700, 1950];

// ─── Types ───────────────────────────────────────────────────────────────────
type CellState = 'idle' | 'spinning' | 'landing' | 'winning';

interface Cell {
  symbol: string;
  state: CellState;
  idleDelay: number; // stagger idle bob per cell
}

function makeGrid(): Cell[][] {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      state: 'idle' as CellState,
      idleDelay: (r * COLS + c) * 0.18,
    }))
  );
}

// ─── Reel Ticker Component ────────────────────────────────────────────────────
// Rapidly cycles through symbols visually (pure CSS + fast state updates)
function BlurTicker({ active }: { active: boolean }) {
  const [idx, setIdx] = useState(0);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      rafRef.current = setInterval(() => {
        setIdx(i => (i + 1) % SYMBOLS.length);
      }, 60);
    } else {
      if (rafRef.current) clearInterval(rafRef.current);
    }
    return () => { if (rafRef.current) clearInterval(rafRef.current); };
  }, [active]);

  if (!active) return null;
  return (
    <span className="symbol spinning-blur" aria-hidden>
      {SYMBOLS[idx]}
    </span>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { connected } = useWallet();
  const [grid, setGrid] = useState<Cell[][]>(makeGrid);
  const [colSpinning, setColSpinning] = useState<boolean[]>(Array(COLS).fill(false));
  const [isSpinning, setIsSpinning] = useState(false);
  const [showWinFlash, setShowWinFlash] = useState(false);
  const [credits, setCredits] = useState(99997.0);
  const [bet] = useState(1.0);
  const spinInProgress = useRef(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimeouts = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  };

  const spin = useCallback(() => {
    if (spinInProgress.current) return;
    if (!connected) {
      alert('🔒 Please connect your Solana wallet first!');
      return;
    }

    spinInProgress.current = true;
    setIsSpinning(true);
    setCredits(c => parseFloat((c - bet).toFixed(2)));
    clearAllTimeouts();

    // 1) Start ALL columns spinning
    const newGrid = makeGrid();
    setColSpinning(Array(COLS).fill(true));

    // 2) Stop each column one by one, applying landing state then idle
    COL_STOP_DELAYS.forEach((stopAt, col) => {
      const t = setTimeout(() => {
        // Stop spinning for this column
        setColSpinning(prev => {
          const next = [...prev];
          next[col] = false;
          return next;
        });

        // Set all cells in this column to 'landing'
        setGrid(prev => {
          const next = prev.map(row => row.map(cell => ({ ...cell })));
          for (let r = 0; r < ROWS; r++) {
            next[r][col] = {
              symbol: newGrid[r][col].symbol,
              state: 'landing',
              idleDelay: (r * COLS + col) * 0.18,
            };
          }
          return next;
        });

        // After bounce finishes, switch to idle
        const t2 = setTimeout(() => {
          setGrid(prev => {
            const next = prev.map(row => row.map(cell => ({ ...cell })));
            for (let r = 0; r < ROWS; r++) {
              if (next[r][col].state === 'landing') {
                next[r][col] = { ...next[r][col], state: 'idle' };
              }
            }
            return next;
          });

          // Last column — spin over
          if (col === COLS - 1) {
            const WIN = Math.random() < 0.000001;
            spinInProgress.current = false;
            setIsSpinning(false);

            if (WIN) {
              setShowWinFlash(true);
              setTimeout(() => setShowWinFlash(false), 1200);
              // Mark everything as winning briefly
              setGrid(prev =>
                prev.map(row => row.map(cell => ({ ...cell, state: 'winning' as CellState })))
              );
              setTimeout(() => {
                setGrid(prev =>
                  prev.map(row => row.map(cell => ({ ...cell, state: 'idle' as CellState })))
                );
                alert('🎉🎉 JACKPOT! You are the 1-in-a-million winner! 🎉🎉');
              }, 2100);
            }
          }
        }, 480);
        timeouts.current.push(t2);
      }, stopAt);
      timeouts.current.push(t);
    });
  }, [connected, bet]);

  // Keyboard: spacebar = spin (like real Sweet Bonanza)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); spin(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [spin]);

  return (
    <div className="sb-root">
      {showWinFlash && <div className="win-flash" />}

      {/* Clouds */}
      <div className="clouds">
        <div className="cloud c1" />
        <div className="cloud c2" />
        <div className="cloud c3" />
        <div className="cloud c4" />
      </div>

      {/* Brand Bar */}
      <div className="brand-bar">
        <span className="brand-dev">Solana Edition</span>
        <span className="brand-logo">Pump Bonanza 1000</span>
        <WalletMultiButton />
      </div>

      {/* Main */}
      <div className="sb-main">

        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="buy-btn-group">
            <button className="buy-btn buy-btn-free">
              <div className="buy-label">Buy Free Spins</div>
              <div className="buy-price">$100.00</div>
            </button>
            <button className="buy-btn buy-btn-super">
              <div className="buy-label">Buy Super Free Spins</div>
              <div className="buy-price">$500.00</div>
            </button>
          </div>
          <div className="bet-panel">
            <div className="bet-label">Bet</div>
            <div className="bet-amount">${bet.toFixed(2)}</div>
            <div className="double-chance-row">
              <div className="double-chance-label">DOUBLE CHANCE<br />TO WIN FEATURE</div>
              <button className="toggle-off">➜ OFF</button>
            </div>
          </div>
        </div>

        {/* GAME BOARD */}
        <div className="board-wrapper">
          <div className="slot-grid">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isColSpinning = colSpinning[c];
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`slot-cell${isColSpinning ? ' spinning' : ''}`}
                  >
                    <div className="symbol-wrap">
                      {isColSpinning ? (
                        <BlurTicker active={true} />
                      ) : (
                        <span
                          className={`symbol ${cell.state}`}
                          style={{
                            animationDuration:
                              cell.state === 'idle'
                                ? `${2.8 + ((r * COLS + c) % 5) * 0.4}s`
                                : cell.state === 'landing'
                                ? '0.45s'
                                : '0.7s',
                            animationDelay:
                              cell.state === 'idle' ? `${cell.idleDelay}s` : '0s',
                          }}
                        >
                          {cell.symbol}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <div className="jackpot-panel">
            <div className="jackpot-title">🏆 Jackpot Pool</div>
            <div className="jackpot-amount">10+ SOL</div>
            <div className="jackpot-sub">Base 10 SOL + Dev Fees</div>
          </div>
          <div className="odds-panel">
            <div className="odds-title">⚡ Win Chance</div>
            <div className="odds-value">1 in 1,000,000</div>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bottom-bar">
        <button className="icon-btn" title="Settings">⚙️</button>
        <button className="icon-btn" title="Info">ℹ️</button>

        <div className="credit-block">
          <span className="info-label">Credit</span>
          <span className="info-value">
            ${credits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bet-block">
          <span className="info-label">Bet</span>
          <span className="info-value">${bet.toFixed(2)}</span>
        </div>

        <div className="bottom-controls">
          <button className="adj-btn" title="Decrease bet">−</button>
          <div className="spin-ring">
            <button
              className="spin-button"
              onClick={spin}
              disabled={isSpinning}
              aria-label="Spin"
            >
              <span className={`spin-label${isSpinning ? ' spinning' : ''}`}>
                {isSpinning ? '⟳' : '▶'}
              </span>
            </button>
          </div>
          <button className="adj-btn" title="Increase bet">+</button>
        </div>

        <span className="turbo-label">HOLD SPACE<br />FOR TURBO SPIN</span>
      </div>

      <div className="candy-ground" />
    </div>
  );
}
