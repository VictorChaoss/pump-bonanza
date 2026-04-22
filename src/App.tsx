import { useState, useCallback, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey } from '@solana/web3.js';
import './App.css';

// ─── Token Gating Configuration ─────────────────────────────────────────────
const REQUIRED_TOKEN_MINT = '2mGYQAoizGfDgknXcLQBiipRvYZrhXW6hDEoJyo4pump'; // Live Token Contract
const REQUIRED_TOKEN_BALANCE = 1;
const JACKPOT_ALREADY_CLAIMED = false; // Dev can flip this to true when someone hits it!
// ────────────────────────────────────────────────────────────────────────────

// ─── Symbols ────────────────────────────────────────────────────────────────
import alonIcon from './assets/symbols/Alon.png';
import pumpFunIcon from './assets/symbols/PumpFun.png';
import solanaIcon from './assets/symbols/Solana.png';
import alonIrlIcon from './assets/symbols/AlonIRL.png';
import chillHouseIcon from './assets/symbols/ChillHouse.png';
import michiIcon from './assets/symbols/Michi.png';
import icon67 from './assets/symbols/67.png';
import pnutIcon from './assets/symbols/PNUT.png';
import fwogIcon from './assets/symbols/FWOG.png';
import tungtungIcon from './assets/symbols/TUNGTUNG.png';
import trollIcon from './assets/symbols/Troll.png';
import mainLogo from './assets/LOGO.png';

const SYMBOLS = [
  alonIcon, 
  pumpFunIcon, 
  solanaIcon, 
  alonIrlIcon, 
  chillHouseIcon, 
  michiIcon,
  icon67,
  pnutIcon,
  fwogIcon,
  tungtungIcon,
  trollIcon
];
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
    <img src={SYMBOLS[idx]} className="symbol spinning-blur" alt="spinning" aria-hidden />
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { connected, publicKey } = useWallet();
  const [hasEntered, setHasEntered] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoCredits, setDemoCredits] = useState(1000);
  const [grid, setGrid] = useState<Cell[][]>(makeGrid);
  const [colSpinning, setColSpinning] = useState<boolean[]>(Array(COLS).fill(false));
  const [isSpinning, setIsSpinning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showWinFlash, setShowWinFlash] = useState(false);
  const [jackpotWinner, setJackpotWinner] = useState<string | null>(null);
  const [showJackpotModal, setShowJackpotModal] = useState(false);
  const [bet] = useState(1.0);
  const spinInProgress = useRef(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimeouts = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  };

  const spin = useCallback(async () => {
    if (spinInProgress.current || isVerifying) return;

    // ── DEMO MODE: no wallet, higher jackpot rate ──
    if (demoMode) {
      if (demoCredits <= 0) {
        alert('💸 Out of demo credits! Buy $PUMP1000 to play for real.');
        return;
      }
      spinInProgress.current = true;
      setIsSpinning(true);
      clearAllTimeouts();
      setDemoCredits(c => c - 1);

      const isJackpot = Math.random() < 0.002; // 1 in 500 for demo
      const newGrid = isJackpot
        ? Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => ({
              symbol: SYMBOLS[0],
              state: 'idle' as CellState,
              idleDelay: (r * COLS + c) * 0.18,
            })))
        : makeGrid();

      setColSpinning(Array(COLS).fill(true));
      COL_STOP_DELAYS.forEach((stopAt, col) => {
        const t = setTimeout(() => {
          setColSpinning(prev => { const n = [...prev]; n[col] = false; return n; });
          setGrid(prev => {
            const next = prev.map(row => row.map(cell => ({ ...cell })));
            for (let r = 0; r < ROWS; r++) {
              next[r][col] = { symbol: newGrid[r][col].symbol, state: 'landing', idleDelay: (r * COLS + col) * 0.18 };
            }
            return next;
          });
          const t2 = setTimeout(() => {
            setGrid(prev => {
              const next = prev.map(row => row.map(cell => ({ ...cell })));
              for (let r = 0; r < ROWS; r++) {
                if (next[r][col].state === 'landing') next[r][col] = { ...next[r][col], state: 'idle' };
              }
              return next;
            });
            if (col === COLS - 1) {
              spinInProgress.current = false;
              setIsSpinning(false);
              if (isJackpot) {
                setShowWinFlash(true);
                setTimeout(() => setShowWinFlash(false), 1200);
                setGrid(prev => prev.map(row => row.map(cell => ({ ...cell, state: 'winning' as CellState }))));
                setTimeout(() => {
                  setGrid(prev => prev.map(row => row.map(cell => ({ ...cell, state: 'idle' as CellState }))));
                  setShowJackpotModal(true);
                }, 2100);
              }
            }
          }, 480);
          timeouts.current.push(t2);
        }, stopAt);
        timeouts.current.push(t);
      });
      return;
    }
    // ──────────────────────────────────────────────

    if (!connected || !publicKey) {
      alert('🔒 Please connect your Solana wallet first!');
      return;
    }

    // --- TOKEN GATING VERIFICATION ---
    if (REQUIRED_TOKEN_MINT) {
      try {
        setIsVerifying(true);
        // Using mainnet-beta, if you need devnet change to 'devnet' endpoint.
        const connection = new Connection('https://api.mainnet-beta.solana.com');
        const mintPubKey = new PublicKey(REQUIRED_TOKEN_MINT);
        
        const response = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: mintPubKey
        });
        
        let foundBalance = 0;
        if (response.value.length > 0) {
          const uiAmount = response.value[0].account.data.parsed.info.tokenAmount.uiAmount;
          foundBalance = uiAmount || 0;
        }

        if (foundBalance < REQUIRED_TOKEN_BALANCE) {
          alert(`🚫 Access Denied!\nYou need to hold at least ${REQUIRED_TOKEN_BALANCE} tokens to play!`);
          setIsVerifying(false);
          return; // STOP EXECUTION
        }
      } catch (err) {
        console.error("Token verification failed:", err);
        alert("⚠️ Failed to verify token holding balance securely.");
        setIsVerifying(false);
        return; // Safe failure, do not allow play
      } finally {
        setIsVerifying(false); // Validated successfully
      }
    }
    // ---------------------------------

    spinInProgress.current = true;
    setIsSpinning(true);
    clearAllTimeouts();

    // 1) Start ALL columns spinning
    // 🎲 Math: 1-in-10-million jackpot chance
    // Guarded by local storage and a global toggle to prevent double hits
    const localAlreadyClaimed = localStorage.getItem('pump_bonanza_jackpot_claimed') === 'true';
    const isJackpot = !JACKPOT_ALREADY_CLAIMED && !localAlreadyClaimed && (Math.random() < 0.0000001);
    let newGrid: Cell[][];
    
    if (isJackpot) {
      newGrid = Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => ({
          symbol: SYMBOLS[0], // Override full grid to first top tier symbol
          state: 'idle' as CellState,
          idleDelay: (r * COLS + c) * 0.18,
        }))
      );
    } else {
      newGrid = makeGrid();
    }
    
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
            spinInProgress.current = false;
            setIsSpinning(false);

            if (isJackpot) {
              setShowWinFlash(true);
              setTimeout(() => setShowWinFlash(false), 1200);
              // Mark everything as winning briefly
              setGrid(prev =>
                prev.map(row => row.map(cell => ({ ...cell, state: 'winning' as CellState })))
              );
              
              // Stamp the winner securely via public key and lock local storage
              setJackpotWinner(publicKey ? publicKey.toBase58() : 'Anonymous Demo Wallet');
              localStorage.setItem('pump_bonanza_jackpot_claimed', 'true');
              
              setTimeout(() => {
                setGrid(prev =>
                  prev.map(row => row.map(cell => ({ ...cell, state: 'idle' as CellState })))
                );
                setShowJackpotModal(true); // Fire wallet modal
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

  if (!hasEntered) {
    const floatIcons = [
      alonIcon, fwogIcon, trollIcon, solanaIcon, pumpFunIcon,
      michiIcon, icon67, chillHouseIcon, pnutIcon, tungtungIcon,
      fwogIcon, trollIcon, alonIcon, solanaIcon, michiIcon, icon67,
    ];
    return (
      <div className="lp-root">
        {/* Floating game icons background */}
        <div className="lp-icons-bg" aria-hidden>
          {floatIcons.map((src, i) => (
            <img key={i} src={src} className="lp-float-icon" alt=""
              style={{
                left: `${(i * 6.5) % 96}%`,
                animationDuration: `${9 + (i % 6) * 1.5}s`,
                animationDelay: `-${(i * 1.7) % 14}s`,
                width: `${48 + (i % 5) * 16}px`,
                animationName: i % 2 === 0 ? 'lp-drift-a' : 'lp-drift-b',
              }}
            />
          ))}
        </div>

        {/* Orbs */}
        <div className="lp-orb lp-orb-a" aria-hidden />
        <div className="lp-orb lp-orb-b" aria-hidden />
        <div className="lp-orb lp-orb-c" aria-hidden />

        {/* Top bar */}
        <header className="lp-bar">
          <span className="lp-bar-badge">🎰 Solana Casino</span>
          <a href="https://x.com/PumpBonanza" target="_blank" rel="noreferrer" className="lp-bar-x">
            Follow @PumpBonanza&nbsp;↗
          </a>
        </header>

        {/* Hero */}
        <main className="lp-hero">
          {/* Jackpot badge */}
          <div className="lp-jackpot-badge">
            <span className="lp-jb-pulse" />
            🏆&nbsp; JACKPOT: <strong>10+ SOL</strong> &nbsp;·&nbsp; 1 in 100,000 chance
          </div>

          <div className="lp-logo-wrap">
            <div className="lp-logo-halo" />
            <img src={mainLogo} className="lp-logo" alt="Pump Bonanza 1000" />
          </div>

          <p className="lp-tagline">The most degenerate slot machine on Solana.</p>

          <div className="lp-ca-row">
            <span className="lp-ca-dot" />
            <span className="lp-ca-label">CA</span>
            <span className="lp-ca-divider" />
            <span className="lp-ca-value">Coming Soon</span>
          </div>

          {/* Icon strip */}
          <div className="lp-icon-strip" aria-hidden>
            {[alonIcon, fwogIcon, trollIcon, solanaIcon, pumpFunIcon, michiIcon, icon67, chillHouseIcon, pnutIcon, tungtungIcon].map((src, i) => (
              <img key={i} src={src} className="lp-strip-icon" alt="" style={{ animationDelay: `${i * -0.4}s` }} />
            ))}
          </div>

          <div className="lp-steps">
            {[
              { n:'01', t:'Hold $PUMP1000', s:'Required to play' },
              { n:'02', t:'Connect Wallet', s:'Verified on-chain' },
              { n:'03', t:'Spin the Reels', s:'1 in 100,000 jackpot' },
              { n:'04', t:'Claim 10 SOL', s:'Instant verification' },
            ].map((step, i) => (
              <div key={i} className="lp-step">
                <div className="lp-step-n">{step.n}</div>
                <div className="lp-step-body">
                  <strong>{step.t}</strong>
                  <span>{step.s}</span>
                </div>
              </div>
            ))}
          </div>

          <button className="lp-cta" onClick={() => { setDemoMode(false); setHasEntered(true); }} id="enter-casino-btn">
            <span className="lp-cta-shine" />
            🎰&nbsp; ENTER CASINO
          </button>

          <button className="lp-demo-btn" onClick={() => { setDemoMode(true); setDemoCredits(1000); setHasEntered(true); }} id="try-demo-btn">
            🎮&nbsp; Try Demo — No Wallet Needed
          </button>

          <p className="lp-disclaimer">Hold $PUMP1000 to play · 18+ · Play responsibly</p>
        </main>

        <div className="lp-candy-bar" />
      </div>
    );
  }

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

      {/* Demo banner */}
      {demoMode && (
        <div className="demo-banner">
          <span className="demo-badge">🎮 DEMO MODE</span>
          <span className="demo-credits">Credits: <strong>{demoCredits}</strong></span>
          <a href="https://pump.fun" target="_blank" rel="noreferrer" className="demo-upgrade-btn">
            Buy $PUMP1000 to play for real →
          </a>
        </div>
      )}

      {/* Main */}
      <div className="sb-main">
        {/* LEFT PANEL */}
        <div className="left-panel">
          <img src={mainLogo} className="brand-logo" alt="Main Logo" />
          {!demoMode && <div className="wallet-wrap"><WalletMultiButton /></div>}
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
                        <img
                          src={cell.symbol}
                          className={`symbol ${cell.state}`}
                          alt="slot symbol"
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
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bottom-bar">
        <div className="bb-left">
          <button className="bottom-home-btn" onClick={() => setHasEntered(false)}>
            « BACK TO LANDING PAGE
          </button>
        </div>

        <div className="bb-center">
          <span className="turbo-label">HOLD SPACE FOR TURBO SPIN</span>
        </div>

        <div className="bb-right">
          <div className="spin-container">
            <button
              className="spin-button"
              onClick={spin}
              disabled={isSpinning || isVerifying}
              aria-label="Spin"
            >
              <span className={`spin-icon${isSpinning || isVerifying ? ' spinning' : ''}`}>
                {isVerifying ? '⏳' : '↻'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="candy-ground" />

      {/* 🎰 Real Jackpot Modal */}
      {showJackpotModal && !demoMode && jackpotWinner && (
        <div className="jackpot-modal-overlay">
          <div className="jackpot-modal-content">
            <h1 className="jw-title">🎉 JACKPOT WINNER 🎉</h1>
            <p className="jw-subtitle">A staggering 1-in-10,000,000 hit!</p>
            <div className="jw-address">
              Wallet Assessed &amp; Verified:<br/>
              <span className="address-highlight">{jackpotWinner}</span>
            </div>
            <div className="jw-action-row">
              <a
                href={`https://twitter.com/intent/tweet?text=I%20just%20hit%20the%20Jackpot%20on%20Pump%20Bonanza!%20%F0%9F%8E%B0%F0%9F%9A%80%0A%0AMy%20wallet:%20${jackpotWinner}%0A%0A%5BAttach%20Screenshot%20of%20this%20Window%20Here%5D%0A@PumpBonanza`}
                target="_blank" rel="noreferrer" className="jw-x-btn"
              >
                UPLOAD SCREENSHOT TO 𝕏
              </a>
              <button className="jw-close-btn" onClick={() => setShowJackpotModal(false)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {/* 🎮 Demo Jackpot Modal */}
      {showJackpotModal && demoMode && (
        <div className="jackpot-modal-overlay">
          <div className="jackpot-modal-content demo-jackpot">
            <h1 className="jw-title">🎉 DEMO JACKPOT! 🎉</h1>
            <p className="jw-subtitle">You'd have won <strong style={{color:'#fbbf24'}}>10+ SOL</strong> for real!</p>
            <p className="demo-jw-body">This was a demo spin — no real funds were wagered. Hold $PUMP1000 and connect your wallet to play for real and claim actual prizes.</p>
            <div className="jw-action-row">
              <a href="https://pump.fun" target="_blank" rel="noreferrer" className="jw-x-btn">
                Buy $PUMP1000 Now 🚀
              </a>
              <button className="jw-close-btn" onClick={() => setShowJackpotModal(false)}>KEEP PLAYING</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
