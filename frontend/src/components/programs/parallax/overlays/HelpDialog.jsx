import { useState } from 'react';
import { COLORS } from '../constants';

const TABS = ['About', 'Lanes', 'Pharos'];

const TAB_CONTENT = {
  'About': `${'═'.repeat(45)}
PARALLAX.exe — Parallel Execution Visualizer
Version 1.0
${'═'.repeat(45)}

PARALLAX is a real-time visualizer for Pharos's
parallel transaction execution, built as part
of the NX Terminal: Protocol Wars ecosystem.

It shows how transactions are distributed across
8 execution lanes, detects state conflicts, and
measures parallel speedup vs serial execution.

${'═'.repeat(45)}
DISCLAIMER
${'═'.repeat(45)}

This is an EDUCATIONAL VISUALIZATION. Lane
assignment is simulated by hashing the target
address. Real Pharos uses PharosDb with read/write
set tracking for optimistic parallel execution.

The conflict detection shown here is simplified.
Actual Pharos conflict resolution is more
sophisticated and handles edge cases that this
visualization does not model.

${'═'.repeat(45)}
CONTROLS
${'═'.repeat(45)}

SPACE     — Pause/Resume simulation
Ctrl+R    — Force refresh
F5        — Force refresh
ESC       — Close this dialog

nxterminal.com`,

  'Lanes': `${'═'.repeat(45)}
LANE GUIDE
${'═'.repeat(45)}

EXECUTION LANES (main canvas)
  8 horizontal swim lanes (L0-L7).
  Transactions flow left to right.
  Block width = proportional to gas used.
  Colors = unique per lane.

TRANSACTION STATES:
  Dim block    — Pending (not yet started)
  Bright block — Executing (progressing)
  RED block    — Conflict detected!
  YELLOW block — Re-executing after conflict
  Faded block  — Done (completed)

CONFLICT LINES:
  Red dashed lines connect transactions in
  different lanes that access the same state.
  These conflicts trigger re-execution.

SERIAL ORDER COLUMN:
  Right side shows done/total tx count per
  lane for ordering reference.

CONFLICT LOG (bottom panel)
  Real-time feed of conflict events:
  [CONFLICT] — State conflict detected
  [RE-EXEC]  — Transaction re-executing
  [CLEAR]    — Conflict resolved
  [PARALLEL] — New block distributed

PERFORMANCE METRICS (right sidebar)
  Sequential vs Effective TPS comparison.
  PARALLEL GAIN shows the speedup factor.
  Lane efficiency = % of active execution.`,

  'Pharos': `${'═'.repeat(45)}
ABOUT PHAROS
${'═'.repeat(45)}

Pharos is a high-performance EVM-compatible
Layer 1 blockchain with parallel execution.

KEY FEATURES:
  • 30,000+ TPS with parallel execution
  • Sub-second block time
  • Sub-second finality
  • AsyncBFT consensus (pipelined)
  • PharosDb custom database for SSDs
  • RaptorCast erasure-coded propagation
  • EVM bytecode compatible

PARALLEL EXECUTION:
  Pharos executes transactions in parallel
  using optimistic concurrency. If two txs
  conflict (access same state), one is
  re-executed. Results are deterministic.

  This approach achieves near-linear speedup
  when most transactions access independent
  state, which is the common case.

ASYNCBFT PIPELINE:
  Four stages run simultaneously:
  PROPOSE → VOTE → FINALIZE → EXECUTE
  Each stage processes a different block,
  maximizing throughput.

Learn more: docs.pharos.xyz`,
};

export default function HelpDialog({ onClose, initialTab = 'About' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '500px',
        maxWidth: '95%',
        height: '400px',
        background: '#c0c0c0',
        border: '2px solid',
        borderColor: '#dfdfdf #808080 #808080 #dfdfdf',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 2px 0 #000',
      }}>
        {/* Title bar */}
        <div style={{
          background: `linear-gradient(90deg, ${COLORS.primary}, #4a148c)`,
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '22px',
          flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'Tahoma, sans-serif', fontWeight: 'bold' }}>
            PARALLAX Help
          </span>
          <button
            onClick={onClose}
            style={{
              width: '16px',
              height: '14px',
              background: '#c0c0c0',
              border: '1px solid',
              borderColor: '#dfdfdf #808080 #808080 #dfdfdf',
              fontSize: '10px',
              fontWeight: 'bold',
              lineHeight: '10px',
              cursor: 'pointer',
              color: '#000',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            x
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '6px 6px 0', gap: '2px', flexShrink: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? '#c0c0c0' : '#a0a0a0',
                border: '2px solid',
                borderColor: activeTab === tab
                  ? '#dfdfdf #808080 #c0c0c0 #dfdfdf'
                  : '#dfdfdf #808080 #808080 #dfdfdf',
                borderBottom: activeTab === tab ? 'none' : undefined,
                padding: '3px 12px',
                fontSize: '11px',
                fontFamily: 'Tahoma, sans-serif',
                color: '#000',
                cursor: 'pointer',
                position: 'relative',
                top: activeTab === tab ? '2px' : '0',
                marginBottom: activeTab === tab ? '-2px' : '0',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          margin: '0 6px',
          border: '2px solid',
          borderColor: '#808080 #dfdfdf #dfdfdf #808080',
          background: '#000',
          color: COLORS.green,
          fontFamily: '"Courier New", monospace',
          fontSize: '11px',
          padding: '8px',
          overflow: 'auto',
          whiteSpace: 'pre',
          lineHeight: '1.4',
        }}>
          {TAB_CONTENT[activeTab]}
        </div>

        {/* OK button */}
        <div style={{ padding: '6px', textAlign: 'center', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              background: '#c0c0c0',
              border: '2px solid',
              borderColor: '#dfdfdf #808080 #808080 #dfdfdf',
              padding: '3px 24px',
              fontSize: '12px',
              fontFamily: 'Tahoma, sans-serif',
              color: '#000',
              cursor: 'pointer',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.borderColor = '#808080 #dfdfdf #dfdfdf #808080';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.borderColor = '#dfdfdf #808080 #808080 #dfdfdf';
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
