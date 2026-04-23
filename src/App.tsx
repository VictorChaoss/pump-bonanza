import { useState, useCallback, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './App.css';

// ─── Configuration ────────────────────────────────────────────────────────────
const JACKPOT_ALREADY_CLAIMED = false;
const CASINO_MUSIC_URL = 'https://archive.org/download/78_maple-leaf-rag_scott-joplin/Maple_Leaf_Rag_-_Scott_Joplin.mp3';
const JACKPOT_WALLET = 'UPDATE_WITH_YOUR_JACKPOT_WALLET'; // ← replace with your prize wallet
const COMMUNITY_WALLET = 'UPDATE_WITH_COMMUNITY_WALLET';   // ← replace with community fund wallet
const RAGE_THRESHOLD = 50;
const RAGE_BOOST_SPINS = 10;
// ─────────────────────────────────────────────────────────────────────────────

// ─── Symbols ─────────────────────────────────────────────────────────────────
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
  alonIcon, pumpFunIcon, solanaIcon, alonIrlIcon, chillHouseIcon,
  michiIcon, icon67, pnutIcon, fwogIcon, tungtungIcon, trollIcon
];
const COLS = 6;
const ROWS = 5;
const COL_STOP_DELAYS = [700, 950, 1200, 1450, 1700, 1950];

// ─── Types ───────────────────────────────────────────────────────────────────
type CellState = 'idle' | 'spinning' | 'landing' | 'winning';
interface Cell { symbol: string; state: CellState; idleDelay: number; }
interface SpinEvent { id: number; wallet: string; ts: number; }

function makeGrid(): Cell[][] {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      state: 'idle' as CellState,
      idleDelay: (r * COLS + c) * 0.18,
    }))
  );
}

// ─── Reel Ticker ─────────────────────────────────────────────────────────────
function BlurTicker({ active }: { active: boolean }) {
  const [idx, setIdx] = useState(0);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (active) {
      rafRef.current = setInterval(() => setIdx(i => (i + 1) % SYMBOLS.length), 60);
    } else if (rafRef.current) clearInterval(rafRef.current);
    return () => { if (rafRef.current) clearInterval(rafRef.current); };
  }, [active]);
  if (!active) return null;
  return <img src={SYMBOLS[idx]} className="symbol spinning-blur" alt="spinning" aria-hidden />;
}

// ─── Certificate Generator ───────────────────────────────────────────────────
function generateCertificate(winner: string) {
  const W = 900, H = 520;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a0533'); bg.addColorStop(1, '#0a0118');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const orb = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, 300);
  orb.addColorStop(0, 'rgba(168,85,247,0.15)'); orb.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, W-36, H-36);
  ctx.strokeStyle = 'rgba(251,191,36,0.25)'; ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, W-56, H-56);
  ctx.fillStyle = '#fbbf24'; ctx.font = '18px Arial'; ctx.textAlign = 'center';
  [[40,40],[W-40,40],[40,H-40],[W-40,H-40]].forEach(([x,y]) => ctx.fillText('✦', x, y+6));
  ctx.font = '48px Arial'; ctx.fillText('🎰', W/2, 95);
  ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 30px Arial';
  ctx.fillText('PUMP BONANZA 1000', W/2, 155);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px Arial';
  ctx.fillText('CERTIFIED JACKPOT LEGEND', W/2, 190);
  const div = ctx.createLinearGradient(100, 0, W-100, 0);
  div.addColorStop(0, 'transparent'); div.addColorStop(0.5, '#fbbf24'); div.addColorStop(1, 'transparent');
  ctx.fillStyle = div; ctx.fillRect(100, 205, W-200, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '15px Arial';
  ctx.fillText('This certifies that the following wallet address:', W/2, 245);
  ctx.fillStyle = '#c084fc'; ctx.font = '14px monospace';
  const addr = winner.length > 50 ? winner.slice(0,24)+'...'+winner.slice(-24) : winner;
  ctx.fillText(addr, W/2, 278);
  ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 22px Arial';
  ctx.fillText('⚡ Achieved 1 in 100,000 — The Jackpot! ⚡', W/2, 325);
  ctx.fillStyle = div; ctx.fillRect(100, 345, W-200, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '13px Arial';
  ctx.fillText(new Date().toLocaleString(), W/2, 378);
  ctx.fillText('pumpbonanza.fun', W/2, 402);
  const link = document.createElement('a');
  link.download = 'pump-bonanza-legend.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

const FAKE_WALLETS = [
  '3x7f...9a2c','8kLm...5p2q','Hj9d...3Rw5','QpLx...7Ym1',
  'mN4t...9cGs','vB8r...2Kp6','xW3s...1Fq8','yC6h...4Dt0',
  'aE2j...6Mn3','bR7k...8Vz5','gP5n...0Xu7','dS5m...2Yw9',
  'eK9p...4Zt3','fL3q...7Xw6','hM2r...1Vs8','iN6s...3Yr4',
];

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { connected, publicKey } = useWallet();
  const [hasEntered, setHasEntered] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoCredits, setDemoCredits] = useState(1000);
  const [musicOn, setMusicOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [grid, setGrid] = useState<Cell[][]>(makeGrid);
  const [colSpinning, setColSpinning] = useState<boolean[]>(Array(COLS).fill(false));
  const [isSpinning, setIsSpinning] = useState(false);
  const [isVerifying] = useState(false);
  const [showWinFlash, setShowWinFlash] = useState(false);
  const [jackpotWinner, setJackpotWinner] = useState<string | null>(null);
  const [showJackpotModal, setShowJackpotModal] = useState(false);
  const [bet] = useState(1.0);
  const spinInProgress = useRef(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Rage mode
  const [rageStreak, setRageStreak] = useState(0);
  const [rageActive, setRageActive] = useState(false);
  const [rageSpinsLeft, setRageSpinsLeft] = useState(0);
  // Daily free spin
  const [dailyFreeReady, setDailyFreeReady] = useState(false);
  // Spin feed
  const [spinFeed, setSpinFeed] = useState<SpinEvent[]>([]);
  // Live balances
  const [jackpotBalance, setJackpotBalance] = useState('10+');
  const [communityBalance, setCommunityBalance] = useState('0.00');

  // Casino music
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(CASINO_MUSIC_URL);
      audioRef.current.loop = true;
      audioRef.current.volume = 0.35;
    }
    if (musicOn) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
    return () => { audioRef.current?.pause(); };
  }, [musicOn]);

  // Daily free spin check
  useEffect(() => {
    const last = localStorage.getItem('pb_free_spin_ts');
    if (!last || Date.now() - parseInt(last) > 24 * 60 * 60 * 1000) setDailyFreeReady(true);
  }, []);

  // Simulated spin feed
  useEffect(() => {
    let feedId = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      timeout = setTimeout(() => {
        const wallet = FAKE_WALLETS[Math.floor(Math.random() * FAKE_WALLETS.length)];
        setSpinFeed(prev => [{ id: feedId++, wallet, ts: Date.now() }, ...prev].slice(0, 20));
        scheduleNext();
      }, 2500 + Math.random() * 4500);
    };
    scheduleNext();
    return () => clearTimeout(timeout);
  }, []);

  // Live Solana balance
  useEffect(() => {
    const fetchSOL = async (address: string, setter: (v: string) => void) => {
      if (address.startsWith('UPDATE')) return;
      try {
        const res = await fetch('https://api.mainnet-beta.solana.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
        });
        const data = await res.json();
        if (data.result?.value !== undefined) setter((data.result.value / 1e9).toFixed(2));
      } catch { /* keep default */ }
    };
    fetchSOL(JACKPOT_WALLET, setJackpotBalance);
    fetchSOL(COMMUNITY_WALLET, setCommunityBalance);
    const iv = setInterval(() => {
      fetchSOL(JACKPOT_WALLET, setJackpotBalance);
      fetchSOL(COMMUNITY_WALLET, setCommunityBalance);
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const clearAllTimeouts = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  };

  // ─── Spin ────────────────────────────────────────────────────────────────
  const spin = useCallback(async () => {
    if (spinInProgress.current || isVerifying) return;

    // DEMO MODE
    if (demoMode) {
      if (demoCredits <= 0) {
        alert('💸 Out of demo credits! Connect your wallet to play for real.');
        return;
      }
      spinInProgress.current = true;
      setIsSpinning(true);
      clearAllTimeouts();
      setDemoCredits(c => c - 1);
      const isJackpot = Math.random() < 0.002;
      const newGrid = isJackpot
        ? Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => ({ symbol: SYMBOLS[0], state: 'idle' as CellState, idleDelay: (r * COLS + c) * 0.18 })))
        : makeGrid();
      setSpinFeed(prev => [{ id: Date.now(), wallet: 'Demo...mode', ts: Date.now() }, ...prev].slice(0, 20));
      setColSpinning(Array(COLS).fill(true));
      COL_STOP_DELAYS.forEach((stopAt, col) => {
        const t = setTimeout(() => {
          setColSpinning(prev => { const n = [...prev]; n[col] = false; return n; });
          setGrid(prev => {
            const next = prev.map(row => row.map(cell => ({ ...cell })));
            for (let r = 0; r < ROWS; r++) next[r][col] = { symbol: newGrid[r][col].symbol, state: 'landing', idleDelay: (r * COLS + col) * 0.18 };
            return next;
          });
          const t2 = setTimeout(() => {
            setGrid(prev => {
              const next = prev.map(row => row.map(cell => ({ ...cell })));
              for (let r = 0; r < ROWS; r++) if (next[r][col].state === 'landing') next[r][col] = { ...next[r][col], state: 'idle' };
              return next;
            });
            if (col === COLS - 1) {
              spinInProgress.current = false; setIsSpinning(false);
              if (isJackpot) {
                setShowWinFlash(true); setTimeout(() => setShowWinFlash(false), 1200);
                setGrid(prev => prev.map(row => row.map(cell => ({ ...cell, state: 'winning' as CellState }))));
                setTimeout(() => { setGrid(prev => prev.map(row => row.map(cell => ({ ...cell, state: 'idle' as CellState })))); setShowJackpotModal(true); }, 2100);
              }
            }
          }, 480);
          timeouts.current.push(t2);
        }, stopAt);
        timeouts.current.push(t);
      });
      return;
    }

    // DAILY FREE SPIN
    const isFreeSpin = dailyFreeReady;
    if (isFreeSpin) {
      setDailyFreeReady(false);
      localStorage.setItem('pb_free_spin_ts', String(Date.now()));
    } else if (!connected || !publicKey) {
      alert('🔒 Please connect your Solana wallet first!');
      return;
    }

    // ODDS
    const jackpotOdds = (rageActive || isFreeSpin) ? 0.00002 : 0.00001;

    spinInProgress.current = true;
    setIsSpinning(true);
    clearAllTimeouts();

    const localClaimed = localStorage.getItem('pump_bonanza_jackpot_claimed') === 'true';
    const isJackpot = !JACKPOT_ALREADY_CLAIMED && !localClaimed && Math.random() < jackpotOdds;

    // Rage streak update
    if (!isJackpot) {
      const newStreak = rageStreak + 1;
      setRageStreak(newStreak);
      if (rageActive) {
        const newLeft = rageSpinsLeft - 1;
        setRageSpinsLeft(newLeft);
        if (newLeft <= 0) { setRageActive(false); setRageStreak(0); }
      } else if (newStreak >= RAGE_THRESHOLD) {
        setRageActive(true); setRageSpinsLeft(RAGE_BOOST_SPINS);
      }
    } else {
      setRageStreak(0); setRageActive(false); setRageSpinsLeft(0);
    }

    // Push to feed
    const walletStr = publicKey
      ? `${publicKey.toBase58().slice(0,4)}...${publicKey.toBase58().slice(-4)}`
      : 'Free...spin';
    setSpinFeed(prev => [{ id: Date.now(), wallet: walletStr, ts: Date.now() }, ...prev].slice(0, 20));

    const newGrid: Cell[][] = isJackpot
      ? Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => ({ symbol: SYMBOLS[0], state: 'idle' as CellState, idleDelay: (r * COLS + c) * 0.18 })))
      : makeGrid();

    setColSpinning(Array(COLS).fill(true));
    COL_STOP_DELAYS.forEach((stopAt, col) => {
      const t = setTimeout(() => {
        setColSpinning(prev => { const next = [...prev]; next[col] = false; return next; });
        setGrid(prev => {
          const next = prev.map(row => row.map(cell => ({ ...cell })));
          for (let r = 0; r < ROWS; r++) next[r][col] = { symbol: newGrid[r][col].symbol, state: 'landing', idleDelay: (r * COLS + col) * 0.18 };
          return next;
        });
        const t2 = setTimeout(() => {
          setGrid(prev => {
            const next = prev.map(row => row.map(cell => ({ ...cell })));
            for (let r = 0; r < ROWS; r++) if (next[r][col].state === 'landing') next[r][col] = { ...next[r][col], state: 'idle' };
            return next;
          });
          if (col === COLS - 1) {
            spinInProgress.current = false; setIsSpinning(false);
            if (isJackpot) {
              setShowWinFlash(true); setTimeout(() => setShowWinFlash(false), 1200);
              setGrid(prev => prev.map(row => row.map(cell => ({ ...cell, state: 'winning' as CellState }))));
              const winner = publicKey ? publicKey.toBase58() : 'Free Spin Winner';
              setJackpotWinner(winner);
              localStorage.setItem('pump_bonanza_jackpot_claimed', 'true');
              localStorage.setItem('pump_bonanza_winner_address', winner);
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
  }, [connected, bet, demoMode, demoCredits, dailyFreeReady, rageActive, rageStreak, rageSpinsLeft]);

  // Keyboard spacebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); spin(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [spin]);

  // ─── Landing Page ─────────────────────────────────────────────────────────
  if (!hasEntered) {
    const floatIcons = [
      alonIcon, fwogIcon, trollIcon, solanaIcon, pumpFunIcon,
      michiIcon, icon67, chillHouseIcon, pnutIcon, tungtungIcon,
      fwogIcon, trollIcon, alonIcon, solanaIcon, michiIcon, icon67,
    ];
    const savedWinner = localStorage.getItem('pump_bonanza_winner_address');
    const SHARE_TEXT = encodeURIComponent(
      "I just found the most degenerate casino on Solana \u{1F3B0}\n\nPump Bonanza 1000 — 1 in 100,000 jackpot, free daily spins, rage mode.\n\npumpbonanza.fun"
    );

    return (
      <div className="lp-root" style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'#060410' }}>
        <div className="lp-icons-bg" aria-hidden>
          {floatIcons.map((src, i) => (
            <img key={i} src={src} className="lp-float-icon" alt=""
              style={{ left: `${(i * 6.5) % 96}%`, animationDuration: `${9+(i%6)*1.5}s`, animationDelay: `-${(i*1.7)%14}s`, width: `${48+(i%5)*16}px`, animationName: i%2===0?"lp-drift-a":"lp-drift-b" }}
            />
          ))}
        </div>
        <div className="lp-orb lp-orb-a" aria-hidden />
        <div className="lp-orb lp-orb-b" aria-hidden />

        <header className="lp-bar" style={{ position:'absolute', top:0, left:0, right:0, height:'40px', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', zIndex:10, boxSizing:'border-box' }}>
          <span className="lp-bar-badge">🎰 Solana Casino</span>
          <a href="https://x.com/PumpBonanza" target="_blank" rel="noreferrer" className="lp-bar-x">@PumpBonanza&nbsp;↗</a>
        </header>

        <main className="lp-hero" style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', width:'100%', maxWidth:'680px', height:'calc(100dvh - 40px)', marginTop:'40px', justifyContent:'space-evenly', overflow:'hidden', boxSizing:'border-box', padding:'0 16px' }}>

          <div className="lp-jackpot-badge">
            <span className="lp-jb-pulse" />
            🏆&nbsp; JACKPOT: <strong>{jackpotBalance} SOL</strong>
            &nbsp;·&nbsp; ⚡ Daily: <strong>1 SOL</strong>
            &nbsp;·&nbsp; 1 in 100,000
          </div>

          <div className="lp-logo-wrap">
            <div className="lp-logo-halo" />
            <img src={mainLogo} className="lp-logo" alt="Pump Bonanza 1000" style={{ height:'clamp(60px,13dvh,160px)', width:'auto', maxWidth:'88vw' }} />
          </div>

          <div className="lp-tagblock">
            <p className="lp-tagline">The most degenerate slot machine on Solana.</p>
            <p className="lp-steps-line">Connect wallet → Spin → Win {jackpotBalance} SOL · Free daily spin · Rage mode</p>
          </div>

          <button className="lp-cta" onClick={() => { setDemoMode(false); setHasEntered(true); }} id="enter-casino-btn">
            <span className="lp-cta-shine" />🎰&nbsp; ENTER CASINO
          </button>

          <button className="lp-demo-btn" onClick={() => { setDemoMode(true); setDemoCredits(1000); setHasEntered(true); }} id="try-demo-btn">
            🎮&nbsp; Try Demo — No Wallet Needed
          </button>

          <div className="lp-footer-line">
            <a href={`https://twitter.com/intent/tweet?text=${SHARE_TEXT}`} target="_blank" rel="noreferrer" className="lp-share-btn">𝕏 Share</a>
            <span>·</span>
            <button className="lp-terms-link" onClick={() => setShowTerms(true)}>How it works &amp; T&amp;Cs</button>
            <span>·</span>
            <span>18+ · Play responsibly</span>
          </div>

        </main>

        <div className="lp-candy-bar" />

        {showTerms && (
          <div className="terms-overlay" onClick={() => setShowTerms(false)}>
            <div className="terms-modal" onClick={e => e.stopPropagation()}>
              <button className="terms-close" onClick={() => setShowTerms(false)}>\u2715</button>
              <h2 className="terms-title">\u{1F3B0} How Pump Bonanza Works &amp; Terms</h2>
              <div className="terms-body">
                <section><h3>How the Game Works</h3><p>Pump Bonanza 1000 is a browser-based slot machine. Each spin generates a random outcome using JavaScript's <code>Math.random()</code> function. No spin outcome is predetermined or stored before you click.</p></section>
                <section><h3>The Jackpot Mechanism</h3><p>Every spin has an independent <strong>1 in 100,000</strong> chance of hitting the jackpot. Each spin is completely independent — previous spins have zero effect on future outcomes.</p><p>Demo mode uses 1 in 500 for demonstration only.</p></section>
                <section><h3>Rage Mode &amp; Daily Free Spin</h3><p>After <strong>50 consecutive spins</strong> without a jackpot, Rage Mode activates — your odds double to 1 in 50,000 for the next 10 spins. Every 24 hours you get one <strong>Daily Free Spin</strong> with 2x odds and a 1 SOL daily jackpot. No wallet needed.</p></section>
                <section><h3>Wallet Connection</h3><p>We use the Solana Wallet Adapter. We only read your <strong>public key</strong> — we never request signing authority or access to your funds.</p></section>
                <section><h3>Jackpot Prize &amp; Payout</h3><p>Main jackpot: <strong>{jackpotBalance}+ SOL</strong>. Daily jackpot: <strong>1 SOL</strong>. Winners post publicly on X tagging <strong>@PumpBonanza</strong>. Dev verifies on-chain and pays within 24 hours.</p></section>
                <section><h3>Jackpot Growth &amp; Updates</h3><p>Prize starts at 10+ SOL and grows as the community expands. The bigger the player base, the bigger the prizes. Updates announced via <strong>@PumpBonanza</strong> before taking effect.</p></section>
                <section><h3>Fairness &amp; Transparency</h3><p>RNG runs entirely in your browser. Every spin is independent. Jackpot odds and mechanics will never change without public announcement.</p></section>
                <section><h3>Disclaimers</h3><ul><li>Entertainment product — not a regulated gambling service.</li><li>18+ only.</li><li>Free to play — no SOL or tokens required to spin.</li><li>SOL value may fluctuate.</li><li>Not available where prohibited by law.</li><li>Developer may modify or discontinue at any time.</li></ul></section>
                <section><h3>Contact</h3><p><strong>@PumpBonanza</strong> on X</p></section>
              </div>
              <button className="terms-accept" onClick={() => setShowTerms(false)}>Got it \u2014 Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Game View ────────────────────────────────────────────────────────────
  const ragePct = rageActive ? 100 : Math.min((rageStreak / RAGE_THRESHOLD) * 100, 100);

  return (
    <div className={`sb-root${rageActive ? ' rage-active' : ''}`} style={demoMode ? { paddingTop: '40px' } : {}}>
      {showWinFlash && <div className="win-flash" />}
      {rageActive && <div className="rage-overlay" />}

      <div className="clouds">
        <div className="cloud c1" /><div className="cloud c2" />
        <div className="cloud c3" /><div className="cloud c4" />
      </div>

      {demoMode && (
        <div className="demo-banner">
          <span className="demo-badge">🎮 DEMO MODE</span>
          <span className="demo-credits">Credits: <strong>{demoCredits}</strong></span>
          <a href="https://pump.fun" target="_blank" rel="noreferrer" className="demo-upgrade-btn">Connect wallet to play for real →</a>
        </div>
      )}

      {dailyFreeReady && !demoMode && (
        <div className="free-spin-banner">
          ⚡ <strong>DAILY FREE SPIN READY</strong> — Hit spin for 2× odds, no wallet needed!
        </div>
      )}

      <div className="sb-main">
        <div className="left-panel">
          <img src={mainLogo} className="brand-logo" alt="Main Logo" />
          {!demoMode && <div className="wallet-wrap"><WalletMultiButton /></div>}
          {rageActive && (
            <div className="rage-badge">
              🔥 RAGE MODE<br/><small>{rageSpinsLeft} boosted spins left</small>
            </div>
          )}
        </div>

        <div className="board-wrapper">
          <div className="slot-grid">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isColSpinning = colSpinning[c];
                return (
                  <div key={`${r}-${c}`} className={`slot-cell${isColSpinning ? ' spinning' : ''}`}>
                    <div className="symbol-wrap">
                      {isColSpinning ? (
                        <BlurTicker active={true} />
                      ) : (
                        <img src={cell.symbol} className={`symbol ${cell.state}`} alt="slot symbol"
                          style={{
                            animationDuration: cell.state === 'idle' ? `${2.8 + ((r * COLS + c) % 5) * 0.4}s` : cell.state === 'landing' ? '0.45s' : '0.7s',
                            animationDelay: cell.state === 'idle' ? `${cell.idleDelay}s` : '0s',
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

      <div className="bottom-bar">
        <div className="bb-left">
          <button className="bottom-home-btn" onClick={() => setHasEntered(false)}>« BACK</button>
          <button className={`music-btn${musicOn ? ' on' : ''}`} onClick={() => setMusicOn(p => !p)} aria-label="Toggle music">
            {musicOn ? '🔊' : '🔇'}
          </button>
        </div>
        <div className="bb-center">
          {dailyFreeReady && !demoMode
            ? <span className="free-spin-label">⚡ FREE SPIN — 2× ODDS!</span>
            : <span className="turbo-label">HOLD SPACE FOR TURBO SPIN</span>
          }
          <div className="rage-meter-wrap">
            <div className="rage-meter-bar" style={{ width: `${ragePct}%` }} />
            <span className="rage-meter-label">
              {rageActive ? `🔥 RAGE ACTIVE — ${rageSpinsLeft} left` : `RAGE: ${rageStreak}/${RAGE_THRESHOLD}`}
            </span>
          </div>
        </div>
        <div className="bb-right">
          <div className="spin-container">
            <button
              className={`spin-button${rageActive ? ' rage-spin' : ''}${dailyFreeReady && !demoMode ? ' free-spin-glow' : ''}`}
              onClick={spin} disabled={isSpinning || isVerifying} aria-label="Spin"
            >
              <span className={`spin-icon${isSpinning ? ' spinning' : ''}`}>↻</span>
            </button>
          </div>
        </div>
      </div>

      <div className="candy-ground" />

      {showJackpotModal && !demoMode && jackpotWinner && (
        <div className="jackpot-modal-overlay">
          <div className="jackpot-modal-content">
            <h1 className="jw-title">🎉 JACKPOT WINNER 🎉</h1>
            <p className="jw-subtitle">1-in-100,000 achieved!</p>
            <div className="jw-address">
              Wallet Verified:<br/><span className="address-highlight">{jackpotWinner}</span>
            </div>
            <div className="jw-action-row">
              <a href={`https://twitter.com/intent/tweet?text=I%20just%20hit%20the%20Jackpot%20on%20Pump%20Bonanza!%20%F0%9F%8E%B0%0AMy%20wallet:%20${jackpotWinner}%0A@PumpBonanza`} target="_blank" rel="noreferrer" className="jw-x-btn">
                UPLOAD TO 𝕏
              </a>
              <button className="jw-x-btn" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border:'none', cursor:'pointer' }} onClick={() => generateCertificate(jackpotWinner)}>
                ⬇ Certificate
              </button>
              <button className="jw-close-btn" onClick={() => setShowJackpotModal(false)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {showJackpotModal && demoMode && (
        <div className="jackpot-modal-overlay">
          <div className="jackpot-modal-content demo-jackpot">
            <h1 className="jw-title">🎉 DEMO JACKPOT! 🎉</h1>
            <p className="jw-subtitle">You'd have won <strong style={{color:'#fbbf24'}}>10+ SOL</strong> for real!</p>
            <p className="demo-jw-body">Demo spin only. Connect your wallet to play for real.</p>
            <div className="jw-action-row">
              <button className="jw-x-btn" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border:'none', cursor:'pointer' }} onClick={() => generateCertificate('DEMO-' + Date.now())}>
                ⬇ Demo Certificate
              </button>
              <button className="jw-close-btn" onClick={() => setShowJackpotModal(false)}>KEEP PLAYING</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
