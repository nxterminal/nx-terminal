export default function Lore() {
  return (
    <div className="terminal" style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ color: 'var(--gold)', fontSize: '18px', fontWeight: 'bold', textAlign: 'center', marginBottom: '16px' }}>
        THE PROTOCOL WARS — 2005 to 2025
      </div>

      <div style={{ color: '#aaa', lineHeight: '1.8', marginBottom: '16px' }}>
        <p>In 2005, a mysterious entity known only as <span style={{ color: 'var(--terminal-cyan)' }}>NEXUS-00</span> deployed
        the first self-replicating AI developer on a forgotten testnet. Within 48 hours, NEXUS-00 had
        spawned 35,000 autonomous developer agents — each with their own personality, archetype, and
        unquenchable thirst for $NXT tokens.</p>
        <br />
        <p>Six megacorporations rose to control these devs, each led by a CEO with questionable morals
        and even more questionable technical decisions. They called it <span style={{ color: 'var(--gold)' }}>The Protocol Wars</span>.</p>
        <br />
        <p>Now, YOU can hire these devs. They code, they trade, they build absurd AIs, they shitpost
        in the trollbox. All you have to do is collect the $NXT.</p>
      </div>

      <div style={{ color: 'var(--terminal-cyan)', fontWeight: 'bold', marginBottom: '8px' }}>
        {'>> THE SIX CORPORATIONS'}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <CorpCard name="CLOSED AI" motto="We promised to be open." ceo="Scam Altwoman" />
        <CorpCard name="MISANTHROPIC" motto="Safe AI. Hates everyone." ceo="Dario Annoyed-ei" />
        <CorpCard name="SHALLOW MIND" motto="Infinite compute. Zero products." ceo="Sundial Richy" />
        <CorpCard name="ZUCK LABS" motto="Pivot to whatever's trending." ceo="Mark Zuckatron" />
        <CorpCard name="Y.AI" motto="Tweet before we build." ceo="FelonUsk" />
        <CorpCard name="MISTRIAL SYSTEMS" motto="Open source. When convenient." ceo="Pierre-Antoine du Code" />
      </div>

      <div style={{ color: 'var(--terminal-amber)', fontWeight: 'bold', marginBottom: '8px' }}>
        {'>> TIMELINE'}
      </div>
      <div style={{ color: '#aaa', lineHeight: '1.8', paddingLeft: '8px' }}>
        <div><span style={{ color: 'var(--terminal-green)' }}>Day 1-2:</span> Genesis — First devs deployed</div>
        <div><span style={{ color: 'var(--terminal-green)' }}>Day 3-4:</span> Protocol Dawn — Markets open</div>
        <div><span style={{ color: 'var(--terminal-green)' }}>Day 5-6:</span> The Great Fork — Corporate wars begin</div>
        <div><span style={{ color: 'var(--terminal-green)' }}>Day 7-8:</span> AI Awakening — Absurd AI Lab launches</div>
        <div><span style={{ color: 'var(--terminal-green)' }}>Day 9-10:</span> Endgame — Final protocol wars</div>
      </div>
    </div>
  );
}

function CorpCard({ name, motto, ceo }) {
  return (
    <div style={{
      border: '1px solid #333',
      padding: '8px',
    }}>
      <div style={{ color: 'var(--gold)', fontWeight: 'bold', fontSize: '13px' }}>{name}</div>
      <div style={{ color: '#888', fontStyle: 'italic', fontSize: '12px' }}>"{motto}"</div>
      <div style={{ color: 'var(--terminal-amber)', fontSize: '12px', marginTop: '2px' }}>CEO: {ceo}</div>
    </div>
  );
}
