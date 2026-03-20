import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Parallel Execution',
    content: 'Pharos executes transactions in parallel while maintaining sequential consistency. Multiple transactions process simultaneously across different cores, then results are committed in the original block order. This gives 30,000+ TPS while preserving deterministic state transitions.',
    takeaway: 'Your contracts work exactly as on Ethereum — parallelism is handled at the VM level. No code changes needed.',
    diagram: (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '16px 0' }}>
        {['#836EF9', '#38BDF8', '#22C55E', '#F59E0B'].map((color, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <div style={{ width: 48, height: 32, borderRadius: 6, background: color, opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 600 }}>
              TX {i + 1}
            </div>
            <div style={{ fontSize: 10, color: 'var(--mb-text-tertiary)' }}>Core {i + 1}</div>
          </div>
        ))}
        <div style={{ margin: '0 8px', color: 'var(--mb-text-tertiary)' }}>→</div>
        <div style={{ padding: '8px 16px', border: '1px solid var(--mb-accent-secondary)', borderRadius: 8, fontSize: 12, color: 'var(--mb-accent-secondary)' }}>
          Sequential Commit
        </div>
      </div>
    ),
  },
  {
    title: 'AsyncBFT Consensus',
    content: 'AsyncBFT is a pipelined HotStuff-based consensus protocol. While Round N\'s block is being voted on, Round N+1\'s block is already being proposed. This pipelining reduces latency to ~400ms per block.',
    takeaway: 'Block time is 400ms with 800ms finality — near-instant confirmation for your users.',
    diagram: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 0' }}>
        {['Round N: Propose', 'Round N+1: Vote', 'Round N+2: Commit'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 100, textAlign: 'right', fontSize: 12, color: 'var(--mb-text-tertiary)' }}>{label.split(':')[0]}</div>
            <div style={{
              flex: 1, height: 28, borderRadius: 6,
              background: `rgba(131,110,249,${0.15 + i * 0.15})`,
              display: 'flex', alignItems: 'center', paddingLeft: 12,
              fontSize: 12, color: 'var(--mb-accent-primary)',
              marginLeft: i * 24,
            }}>
              {label.split(':')[1]}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Deferred Execution',
    content: 'In Pharos, consensus and execution happen concurrently. Nodes reach consensus on transaction ordering first, then execute in parallel. This decoupling means consensus never waits for execution to complete.',
    takeaway: 'Transactions are ordered quickly, then executed — no execution bottleneck on consensus.',
    diagram: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 0' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 100, fontSize: 12, color: 'var(--mb-text-tertiary)', textAlign: 'right' }}>Consensus</div>
          <div style={{ flex: 1, height: 24, background: 'rgba(131,110,249,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 11, color: 'var(--mb-accent-primary)' }}>
            ████████████████████ (continuous)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 100, fontSize: 12, color: 'var(--mb-text-tertiary)', textAlign: 'right' }}>Execution</div>
          <div style={{ flex: 1, height: 24, background: 'rgba(34,197,94,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 11, color: 'var(--mb-accent-secondary)' }}>
            ████████████████████ (parallel)
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'PharosDb',
    content: 'PharosDb is a custom state database built from scratch for Pharos. Unlike Ethereum\'s LevelDB/PebbleDB which wrap a generic key-value store around a Merkle Patricia Trie, PharosDb implements the trie natively on SSD with async I/O for maximum throughput.',
    takeaway: 'State access is faster, enabling higher throughput — but cold SLOAD still costs more gas (8,100 vs 2,100).',
    diagram: (
      <div style={{ display: 'flex', gap: 24, padding: '16px 0' }}>
        <div style={{ flex: 1, padding: 12, border: '1px solid var(--mb-border)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--mb-text-tertiary)', marginBottom: 8 }}>Ethereum</div>
          <div style={{ fontSize: 11, color: 'var(--mb-text-secondary)' }}>Generic KV Store → Trie</div>
        </div>
        <div style={{ flex: 1, padding: 12, border: '1px solid var(--mb-accent-primary)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--mb-accent-primary)', marginBottom: 8 }}>Pharos</div>
          <div style={{ fontSize: 11, color: 'var(--mb-text-secondary)' }}>Native Trie on SSD</div>
        </div>
      </div>
    ),
  },
];

export default function MonadArchitecture() {
  const [openSections, setOpenSections] = useState({});

  function toggle(idx) {
    setOpenSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div>
      <h2 className="mb-h2 mb-mb-md">Pharos Architecture</h2>
      <p className="mb-text-sm mb-mb-lg">
        Pharos achieves 30,000+ TPS through four key innovations. Click each section to learn more.
      </p>

      {SECTIONS.map((section, i) => (
        <div className="mb-accordion" key={i}>
          <button
            className={`mb-accordion-header ${openSections[i] ? 'open' : ''}`}
            onClick={() => toggle(i)}
          >
            {section.title}
            <ChevronRight size={16} />
          </button>
          {openSections[i] && (
            <div className="mb-accordion-body mb-animate-in">
              {section.diagram}
              <p style={{ fontSize: 13, color: 'var(--mb-text-secondary)', margin: '12px 0' }}>
                {section.content}
              </p>
              <div className="mb-callout mb-callout-info">
                <span style={{ fontWeight: 600 }}>Key Takeaway:</span> {section.takeaway}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
