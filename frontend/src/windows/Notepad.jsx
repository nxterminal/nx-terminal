import { useState } from 'react';

const DEFAULT_NOTES = [
  {
    id: 'todo',
    title: 'TODO.txt',
    content: `=== NX TERMINAL TODO LIST ===
Last updated: Cycle 847

[x] Mint first developer
[x] Realize developer is a LURKER archetype
[x] Cry
[ ] Figure out what $NXT is actually worth
[ ] Stop checking leaderboard every 5 minutes
[ ] Touch grass (LOW PRIORITY)
[ ] Understand what "Protocol Wars" means
[ ] Accept that Vitalik doesn't know I exist
[ ] Find out who keeps hacking my devs
[ ] Report bug where my balance only goes down
[ ] Ask in World Chat if this is normal (it is)`,
  },
  {
    id: 'passwords',
    title: 'passwords.txt',
    content: `=== VERY SECURE PASSWORDS ===
DO NOT SHARE THIS FILE

MetaMask: password123
Exchange: hunter2
Ledger PIN: 1234
Seed phrase: I wrote it on a napkin at Denny's
2FA Recovery: lost it during the 2024 bull run
Private key: somewhere on my old laptop that I sold on eBay

NOTE TO SELF: Move all funds to cold storage.
NOTE TO SELF (6 months later): Still haven't done it.
NOTE TO SELF (1 year later): Got hacked. Shocking.`,
  },
  {
    id: 'investment',
    title: 'investment_thesis.txt',
    content: `=== MY INVESTMENT THESIS ===
Written at 3AM during a bull market

Step 1: Buy whatever CT is talking about
Step 2: Tell everyone I "did my own research"
Step 3: Diamond hands until -90%
Step 4: Rebrand as "long-term investor"
Step 5: Wait for next cycle
Step 6: Repeat steps 1-5

ALTERNATIVE STRATEGY:
- If Elon tweets about it: BUY
- If your Uber driver mentions it: SELL
- If your grandma asks about it: SELL EVERYTHING
- If the SEC investigates it: Already too late

RISK MANAGEMENT:
- What is risk management?`,
  },
  {
    id: 'journal',
    title: 'dev_journal.txt',
    content: `=== DEVELOPER JOURNAL ===

Day 1: Minted my first dev. Named him "SatoshiLite."
       He immediately started lurking. Proud parent moment.

Day 3: SatoshiLite's energy is at 12%. He's been
       "researching" which means scrolling Discord.

Day 7: My dev got into a fight with another dev in
       the simulation. Lost 500 $NXT. Worth it for
       the entertainment value.

Day 14: Hired a second dev. She's a 10X_DEV archetype.
        She's already outperforming SatoshiLite by 400%.
        SatoshiLite seems unbothered. Classic lurker.

Day 21: The 10X_DEV burned out and her energy dropped to 0.
        SatoshiLite is still at 12%. Slow and steady I guess.

Day 30: I've spent more on gas fees managing my devs than
        my devs have earned. The simulation is realistic.`,
  },
  {
    id: 'meeting',
    title: 'meeting_notes.txt',
    content: `=== CORP MEETING NOTES ===
Protocol Wars - Q4 Strategy Session
Attendees: Me, my mass-minted devs, existential dread

AGENDA:
1. Review Q3 losses (all of them)
2. Blame market conditions
3. Discuss "pivoting to AI" (we're already AI)
4. New strategy: copy whatever the top leaderboard player does

KEY TAKEAWAYS:
- We are NOT going bankrupt (technically)
- Morale slider in Settings confirmed to do nothing
- Someone suggested "just code better" - they've been fired
- The DEGEN archetype devs want to YOLO the treasury
- The FED archetype devs want to audit everyone
- The HACKTIVIST devs just want to watch it all burn

ACTION ITEMS:
- Stop hiring SCRIPT_KIDDIE archetypes
- Start hiring SCRIPT_KIDDIE archetypes (they're cheap)
- Update resume on LinkedIn (just in case)

NEXT MEETING: When $NXT hits $1 (so never)`,
  },
];

export default function Notepad() {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('nx-notepad');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge saved with defaults to keep new defaults
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
      <div style={{
        display: 'flex',
        gap: '0',
        padding: '0 4px',
        background: 'var(--win-bg)',
        borderBottom: '1px solid var(--border-dark)',
      }}>
        {notes.map(note => (
          <button
            key={note.id}
            className={`win-tab${note.id === activeId ? ' active' : ''}`}
            onClick={() => setActiveId(note.id)}
            style={{ fontSize: '10px', padding: '2px 8px' }}
          >
            {note.title}
          </button>
        ))}
      </div>

      {activeNote && (
        <textarea
          value={activeNote.content}
          onChange={e => handleChange(e.target.value)}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            lineHeight: 1.5,
            padding: '8px',
            background: '#fffff8',
            color: '#333',
          }}
          spellCheck={false}
        />
      )}
    </div>
  );
}
