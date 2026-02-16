import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useDevs } from '../contexts/DevsContext';
import { useInbox } from '../contexts/InboxContext';
import { MINT_PRICE, CURRENT_SUPPLY, MAX_SUPPLY } from '../config/contract';
import DialUpModal from '../components/DialUpModal';

const ARCHETYPES = ['GRINDER', 'HACKTIVIST', '10X_DEV', 'DEGEN', 'LURKER', 'INFLUENCER', 'FED', 'SCRIPT_KIDDIE'];
const PERSONALITIES = ['Closed AI', 'Misanthropic', 'GooglAI', 'Chaotic Neutral', 'Paranoid', 'Overly Helpful', 'Sarcastic', 'Based'];
const MOODS = ['Caffeinated', 'Existential', 'Manic', 'Zen', 'Paranoid', 'Vibing', 'Plotting', 'AFK'];
const NAME_PREFIXES = ['NEXUS', 'VOID', 'SPARK', 'CIPHER', 'GHOST', 'FLUX', 'NEON', 'ZERO', 'AXIOM', 'PULSE'];
const NAME_SUFFIXES = ['7X', '3K', '99', 'XX', 'V2', '0x', 'AI', 'Z9', 'Q7', 'R1'];

function generateDev() {
  const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
  return {
    name: `${prefix}-${suffix}`,
    personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
    archetype,
    energy: 60 + Math.floor(Math.random() * 40),
    mood: MOODS[Math.floor(Math.random() * MOODS.length)],
    balance_nxt: Math.floor(Math.random() * 2000) + 500,
    level: Math.floor(Math.random() * 3) + 1,
  };
}

export default function HireDevs({ openWindow }) {
  const { connected, connect } = useWallet();
  const { addDev } = useDevs();
  const { addEmail } = useInbox();
  const [phase, setPhase] = useState('info');
  const [mintedDev, setMintedDev] = useState(null);
  const [error, setError] = useState(null);

  const handleMint = () => {
    if (!connected) {
      setError({
        title: 'wallet_not_found.exe',
        msg: 'No wallet detected.\n\nYou must sign an employment contract (connect wallet) before hiring devs.',
      });
      return;
    }
    setPhase('minting');
  };

  const handleMintComplete = () => {
    const dev = generateDev();
    addDev(dev);
    setMintedDev(dev);
    setPhase('success');
    addEmail({
      from: 'hr@nxterminal.io',
      subject: `New Dev Hired: ${dev.name}`,
      body: `EMPLOYMENT CONFIRMATION\n======================\n\nA new developer has been assigned to your team.\n\nName: ${dev.name}\nArchetype: ${dev.archetype}\nPersonality: ${dev.personality}\nMood: ${dev.mood}\nEnergy: ${dev.energy}%\n\nPlease review their profile in My Devs.\n\n\u2014 NX Terminal HR Department`,
    });
  };

  if (phase === 'minting') {
    return <DialUpModal onComplete={handleMintComplete} onClose={() => setPhase('info')} />;
  }

  if (phase === 'success' && mintedDev) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div style={{ fontSize: '48px' }}>🎉</div>
        <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--terminal-green)' }}>DEV HIRED SUCCESSFULLY</div>
        <div className="win-panel" style={{ padding: '16px', width: '280px', textAlign: 'left' }}>
          <table style={{ width: '100%', fontSize: '12px' }}>
            <tbody>
              <tr><td style={{ color: '#666' }}>Name:</td><td style={{ fontWeight: 'bold' }}>{mintedDev.name}</td></tr>
              <tr><td style={{ color: '#666' }}>Archetype:</td><td style={{ fontWeight: 'bold', color: 'var(--terminal-cyan)' }}>{mintedDev.archetype}</td></tr>
              <tr><td style={{ color: '#666' }}>Personality:</td><td>{mintedDev.personality}</td></tr>
              <tr><td style={{ color: '#666' }}>Mood:</td><td>{mintedDev.mood}</td></tr>
              <tr><td style={{ color: '#666' }}>Energy:</td><td>{mintedDev.energy}%</td></tr>
              <tr><td style={{ color: '#666' }}>Level:</td><td>{mintedDev.level}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="win-btn" onClick={() => openWindow?.('my-devs')} style={{ padding: '6px 16px', fontSize: '11px' }}>
            📁 View My Devs
          </button>
          <button className="win-btn" onClick={() => { setPhase('info'); setMintedDev(null); }} style={{ padding: '6px 16px', fontSize: '11px' }}>
            💼 Mint Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ fontSize: '48px' }}>💼</div>
      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Mint / Hire Devs</div>
      <div style={{ fontSize: '11px', color: '#666', maxWidth: '300px' }}>
        Hire a new autonomous developer agent to join your team. Each dev comes with randomized stats and a unique personality.
      </div>

      <div className="win-panel" style={{ padding: '16px', width: '260px' }}>
        <table style={{ width: '100%', fontSize: '12px' }}>
          <tbody>
            <tr><td style={{ color: '#666', textAlign: 'left' }}>Mint Price:</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--gold)' }}>{MINT_PRICE} ETH</td></tr>
            <tr><td style={{ color: '#666', textAlign: 'left' }}>Supply:</td><td style={{ textAlign: 'right' }}>{CURRENT_SUPPLY} / {MAX_SUPPLY}</td></tr>
            <tr><td style={{ color: '#666', textAlign: 'left' }}>Status:</td><td style={{ textAlign: 'right', color: 'var(--terminal-green)' }}>MINTING OPEN</td></tr>
          </tbody>
        </table>
      </div>

      {!connected ? (
        <div>
          <div style={{ fontSize: '11px', color: 'var(--terminal-red)', marginBottom: '8px' }}>
            Connect wallet to hire devs
          </div>
          <button className="win-btn" onClick={connect} style={{ padding: '6px 24px', fontSize: '12px', fontWeight: 'bold' }}>
            🔗 Connect Wallet
          </button>
        </div>
      ) : (
        <button className="win-btn" onClick={handleMint} style={{ padding: '8px 32px', fontSize: '14px', fontWeight: 'bold' }}>
          💼 MINT DEV
        </button>
      )}

      {error && (
        <div className="win-panel" style={{ padding: '8px', fontSize: '11px', color: 'var(--terminal-red)', maxWidth: '280px' }}>
          {error.msg}
          <div style={{ marginTop: '4px' }}>
            <button className="win-btn" onClick={() => setError(null)} style={{ fontSize: '10px' }}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
