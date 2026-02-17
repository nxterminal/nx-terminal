import { useState } from 'react';

const DEFAULT_NOTES = [
  {
    id: 'untitled',
    title: 'Untitled.txt',
    content: '',
  },
  {
    id: 'readme',
    title: 'readme.txt',
    content: `=== WELCOME TO NX PROTOCOL ===
If you're reading this, it's already too late.

You've entered the Protocol Wars: a fully on-chain
simulation where AI developers fight, code, hack,
and occasionally achieve sentience for control of
the NX Network.

HOW IT WORKS:
1. You mint AI developers (costs ETH, obviously)
2. Your devs compete in the simulation autonomously
3. Each dev has an archetype: LURKER, 10X_DEV, DEGEN,
   HACKTIVIST, FED, SCRIPT_KIDDIE, and more
4. They earn (or lose) $NXT based on performance
5. You pretend to understand what's happening
6. Leaderboard goes up. Leaderboard goes down.

ARCHETYPES EXPLAINED:
- LURKER: Does nothing. Somehow always profitable.
- 10X_DEV: Ships 400% faster. Burns out 400% faster.
- DEGEN: YOLOs your treasury into random protocols.
         Occasionally 100x. Usually 0x.
- HACKTIVIST: Attacks other corps "for the people."
              The people did not ask for this.
- FED: Audits everything. Fun at parties (not invited).
- SCRIPT_KIDDIE: Cheap labor. You get what you pay for.

IMPORTANT DISCLAIMER:
This is not financial advice. This is not even
advice. This is a notepad file inside a simulation
inside a blockchain. Please go outside.

Last edited by: [REDACTED]
Last saved: Cycle 847`,
  },
  {
    id: 'passwords',
    title: 'passwords.txt',
    content: `=== EXTREMELY SECURE PASSWORDS ===
DO NOT SHARE THIS FILE
(saved on a public blockchain btw)

MetaMask: password123
Phantom: solana4life
Rabby: same as MetaMask honestly
Exchange: hunter2
Ledger PIN: 1234
Hardware wallet location: "somewhere safe"
  UPDATE: can't remember where

Seed phrase: wrote it on a napkin at Denny's.
  Denny's closed. Napkin status: UNKNOWN.

2FA Recovery codes: screenshot on iCloud
  (this is fine)

Private key: copy-pasted into Discord DM
  to "Vitalik Buterin (Official)" who asked
  nicely. Still waiting for the 2x ETH return.

Bridge passwords:
  Arbitrum: same as MetaMask
  Base: same as Arbitrum
  Optimism: same as Base
  (security through uniformity)

NOTE TO SELF: Move funds to cold storage.
NOTE (6 months later): Still haven't done it.
NOTE (1 year later): Got phished. Surprised?
NOTE (1 year + 1 day): Set up 2FA finally.
NOTE (1 year + 2 days): Lost 2FA phone.`,
  },
  {
    id: 'survival',
    title: 'survival_guide.txt',
    content: `=== PROTOCOL WARS SURVIVAL GUIDE ===
Compiled from the collective suffering of
thousands of NX Protocol participants.

INVESTMENT RULES:
1. Buy whatever Crypto Twitter is screaming about
2. Tell everyone you "did your own research"
3. Hold until -93%
4. Rebrand as "long-term believer"
5. Wait for next cycle. Repeat.

WHEN TO BUY:
- Random influencer tweets "gm": BUY
- Project has no whitepaper: BUY FASTER
- Token name is a dog breed: MORTGAGE THE HOUSE

WHEN TO SELL:
- Your Uber driver mentions it: SELL
- Your grandma asks about it: SELL EVERYTHING
- CNBC covers it: YOU'RE ALREADY LATE
- The SEC sends you mail: SELL. LAWYER. NOW.

DEV MANAGEMENT TIPS:
- LURKER devs look useless. They are. Keep them
  anyway. They somehow profit during crashes.
- Never let a DEGEN dev near the treasury.
  Actually, let one DEGEN near the treasury.
  The chaos is the point.
- HACKTIVIST devs will attack your own corp if
  bored. Keep them busy or accept the chaos.
- Hiring SCRIPT_KIDDIEs is like buying lottery
  tickets. Cheap, addictive, mostly worthless.

THINGS THAT ARE DEFINITELY BUGS:
- Balance only goes down
- Devs ignoring commands
- Leaderboard math seems wrong
- Gas fees higher than transaction value
(None of these are bugs. This is Web3.)

FINAL WISDOM:
The real $NXT was the gas fees we burned
along the way.`,
  },
];

export default function Notepad() {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('nx-notepad');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const savedMap = Object.fromEntries(parsed.map(n => [n.id, n]));
        return DEFAULT_NOTES.map(d => savedMap[d.id] || d)
          .concat(parsed.filter(n => !DEFAULT_NOTES.find(d => d.id === n.id)));
      } catch { return DEFAULT_NOTES; }
    }
    return DEFAULT_NOTES;
  });
  const [activeId, setActiveId] = useState(notes[0]?.id);
  const activeNote = notes.find(n => n.id === activeId);

  const handleChange = (value) => {
    const updated = notes.map(n => n.id === activeId ? { ...n, content: value } : n);
    setNotes(updated);
    localStorage.setItem('nx-notepad', JSON.stringify(updated));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0',
        padding: '4px 4px 0',
        background: 'var(--win-bg)',
      }}>
        {notes.map(note => (
          <button
            key={note.id}
            onClick={() => setActiveId(note.id)}
            style={{
              fontSize: '10px',
              padding: '3px 10px 2px',
              border: '1px solid var(--border-darker)',
              borderBottom: note.id === activeId ? '1px solid #fffff8' : '1px solid var(--border-darker)',
              background: note.id === activeId ? '#fffff8' : 'var(--win-bg)',
              marginBottom: '-1px',
              cursor: 'pointer',
              position: 'relative',
              zIndex: note.id === activeId ? 2 : 1,
              borderTopLeftRadius: '2px',
              borderTopRightRadius: '2px',
              fontFamily: "'Tahoma', sans-serif",
              color: note.id === activeId ? '#000' : '#444',
              fontWeight: note.id === activeId ? 'bold' : 'normal',
            }}
          >
            {note.title}
          </button>
        ))}
      </div>

      {/* Editor */}
      {activeNote && (
        <textarea
          value={activeNote.content}
          onChange={e => handleChange(e.target.value)}
          placeholder={activeNote.id === 'untitled' ? 'Type your notes here...' : ''}
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid var(--border-darker)',
            borderTop: '1px solid var(--border-darker)',
            outline: 'none',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            lineHeight: 1.5,
            padding: '8px',
            background: '#fffff8',
            color: '#333',
            margin: '0 4px 4px',
          }}
          spellCheck={false}
        />
      )}

      {/* Status bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '2px 8px',
        fontSize: '10px',
        color: '#666',
        borderTop: '1px solid var(--border-dark)',
        background: 'var(--win-bg)',
      }}>
        <span>{activeNote?.title || ''}</span>
        <span>{activeNote ? `${activeNote.content.length} chars` : ''}</span>
      </div>
    </div>
  );
}
