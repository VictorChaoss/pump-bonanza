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
    return (
      <div className="landing-page-container">
        <div className="landing-content">
          <img src={mainLogo} className="landing-hero-logo" alt="Token Logo" />
          
          <div className="landing-socials">
            <a href="https://x.com/PumpBonanza" target="_blank" rel="noreferrer" className="social-link x-link">
              FOLLOW US ON 𝕏
            </a>
          </div>

          <div className="landing-ca-box">
            <span className="ca-label">CONTRACT ADDRESS:</span>
            <span className="ca-value ca-coming-soon">🔜 Coming Soon</span>
          </div>

          <div className="landing-instructions">
            <h2>🎰 HOW TO PLAY & WIN 🎰</h2>
            <ul>
               <li><strong>1. Hold $Pump1000:</strong> You must hold the coin to spin.</li>
               <li><strong>2. Connect Wallet:</strong> Verify your holdings on-chain.</li>
               <li><strong>3. Spin the Reels:</strong> Hit the 1 in 100,000 chance to win 10 SOL + Dev Fees!</li>
               <li><strong>4. Claim Prize:</strong> The Jackpot statically verifies your winning wallet instantly!</li>
            </ul>
          </div>

          <button className="landing-enter-btn" onClick={() => setHasEntered(true)}>
            ENTER CASINO
          </button>
        </div>
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

      {/* Main */}
      <div className="sb-main">
        {/* LEFT PANEL */}
        <div className="left-panel">
          <img src={mainLogo} className="brand-logo" alt="Main Logo" />
          <div className="wallet-wrap"><WalletMultiButton /></div>
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

      {/* 🎰 Jackpot Modal 🎰 */}
      {showJackpotModal && jackpotWinner && (
        <div className="jackpot-modal-overlay">
          <div className="jackpot-modal-content">
            <h1 className="jw-title">🎉 JACKPOT WINNER 🎉</h1>
            <p className="jw-subtitle">A staggering 1-in-10,000,000 hit!</p>
            <div className="jw-address">
              Wallet Assessed & Verified:<br/>
              <span className="address-highlight">{jackpotWinner}</span>
            </div>
            <div className="jw-action-row">
              <a 
                href={`https://twitter.com/intent/tweet?text=I%20just%20hit%20the%20Jackpot%20on%20Pump%20Bonanza!%20%F0%9F%8E%B0%F0%9F%9A%80%0A%0AMy%20wallet:%20${jackpotWinner}%0A%0A%5BAttach%20Screenshot%20of%20this%20Window%20Here%5D%0A@PumpBonanza`} 
                target="_blank" 
                rel="noreferrer" 
                className="jw-x-btn"
              >
                UPLOAD SCREENSHOT TO 𝕏
              </a>
              <button className="jw-close-btn" onClick={() => setShowJackpotModal(false)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
