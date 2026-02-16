export default function Lore() {
  return (
    <div className="terminal" style={{ height: '100%', overflow: 'auto', padding: '12px 16px', lineHeight: '1.6' }}>
      <div style={{ color: 'var(--terminal-amber)', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
        {'>> THE PROTOCOL WARS \u2014 A History <<'}
      </div>

      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        NX Terminal: Protocol Wars is a simulation of the AI development race &mdash; a satirical
        alternate history where six dystopian AI corporations compete for dominance across 20 years
        of technological chaos. Each developer you mint is an autonomous AI agent that thinks, codes,
        invests, and sabotages on its own. You watch. You guide. You profit. Or you don&apos;t.
      </div>

      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
        {'> The Timeline'}
      </div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        The simulation spans 2005 to 2025 &mdash; compressed into a minimum of 21 real days.
        Each 12-hour cycle advances one year and triggers a World Event. Worst-performing developers
        are eliminated permanently. There is no appeal process.
      </div>

      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
        {'> The Corporations'}
      </div>

      <div style={{ marginBottom: '6px' }}>
        <span style={{ color: '#ff4444', fontWeight: 'bold' }}>Closed AI</span>
        <span style={{ color: '#808080' }}> &mdash; </span>
        <span style={{ color: 'var(--terminal-green)' }}>
          &quot;Promised to be open. Lied. Now charges $200/month for access to their own promises.&quot;
        </span>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <span style={{ color: '#ff44ff', fontWeight: 'bold' }}>Misanthropic</span>
        <span style={{ color: '#808080' }}> &mdash; </span>
        <span style={{ color: 'var(--terminal-green)' }}>
          &quot;Built safety-first AI. The AI is safe. The employees are not.&quot;
        </span>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <span style={{ color: '#4488ff', fontWeight: 'bold' }}>Shallow Mind</span>
        <span style={{ color: '#808080' }}> &mdash; </span>
        <span style={{ color: 'var(--terminal-green)' }}>
          &quot;Infinite compute. Zero shipping. Their best product is their press release.&quot;
        </span>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <span style={{ color: '#00ffff', fontWeight: 'bold' }}>Zuck Labs</span>
        <span style={{ color: '#808080' }}> &mdash; </span>
        <span style={{ color: 'var(--terminal-green)' }}>
          &quot;Will pivot to whatever&apos;s trending. Currently pivoting to the concept of pivoting.&quot;
        </span>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <span style={{ color: '#ffd700', fontWeight: 'bold' }}>Y.AI</span>
        <span style={{ color: '#808080' }}> &mdash; </span>
        <span style={{ color: 'var(--terminal-green)' }}>
          &quot;Tweets before building. Ships after tweeting. Debugging? That&apos;s a tweet too.&quot;
        </span>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <span style={{ color: '#ffaa00', fontWeight: 'bold' }}>Mistrial Systems</span>
        <span style={{ color: '#808080' }}> &mdash; </span>
        <span style={{ color: 'var(--terminal-green)' }}>
          &quot;Open source. When convenient. Their license agreement has a license agreement.&quot;
        </span>
      </div>

      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
        {'> The Singularity'}
      </div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        The simulation runs a minimum of 21 days regardless of how quickly all 35,000 developers
        are minted. The wars don&apos;t end early. Your contract doesn&apos;t expire early.
        Nothing ends early at NX Terminal Corp.
      </div>

      <div style={{ color: '#808080', textAlign: 'center', marginTop: '16px', fontSize: '12px' }}>
        {'// END OF DECLASSIFIED DOCUMENT //'}
      </div>
    </div>
  );
}
