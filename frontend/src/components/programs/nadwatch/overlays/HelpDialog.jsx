import { useState } from 'react';
import { COLORS } from '../constants';

const TABS = ['About', 'Panels', 'Monad'];

const TAB_CONTENT = {
  'About': `${'═'.repeat(45)}
NADWATCH.exe — Monad Network Surveillance
Version 1.0
${'═'.repeat(45)}

NADWATCH is a real-time network monitor for
the Monad blockchain, built as part of the
NX Terminal: Protocol Wars ecosystem.

It visualizes live data from Monad Testnet
including blocks, transactions, TPS, gas,
parallel execution load, and consensus pipeline.

${'═'.repeat(45)}
HOW IT WORKS
${'═'.repeat(45)}

NADWATCH connects to Monad via JSON-RPC and
polls every 400ms (matching block time). All
data is fetched client-side.

The Block Rain shows purple/green bicolor
columns with Monanimal easter eggs. Characters
flash purple when a new block is confirmed.

${'═'.repeat(45)}
NETWORK INFO
${'═'.repeat(45)}

Network:   Monad Testnet
Chain ID:  10143
RPC:       monad-testnet.drpc.org
Block Time: 400ms
Target TPS: 10,000
Consensus:  MonadBFT
Finality:   ~800ms (2 blocks)

nxterminal.com`,

  'Panels': `${'═'.repeat(45)}
PANEL GUIDE
${'═'.repeat(45)}

BLOCK RAIN (left panel)
  Purple/green matrix rain visualization.
  30% purple columns, 70% green columns.
  Monanimal words appear as easter eggs.

NETWORK VITALS (top right)
  TPS, block time, gas, parallel load,
  validator count, and TPS sparkline.

TRANSACTION FLOW (bottom right)
  Live feed of decoded transactions.
  Shows type, addresses, value in MON.
  Timestamps include milliseconds.

PARALLEL LOAD (bottom bar)
  8 lanes showing estimated parallel
  execution utilization.

CONSENSUS PIPELINE (bottom bar)
  MonadBFT pipeline: PROPOSE, VOTE,
  FINALIZE, EXECUTE. Click to expand.

CORP ACTIVITY (bottom)
  Protocol Wars corporation activity.`,

  'Monad': `${'═'.repeat(45)}
ABOUT MONAD
${'═'.repeat(45)}

Monad is a high-performance EVM-compatible
Layer 1 blockchain with parallel execution.

KEY FEATURES:
  • 10,000 TPS with parallel execution
  • 400ms block time
  • ~800ms finality (2 blocks)
  • MonadBFT consensus (pipelined)
  • MonadDb custom database for SSDs
  • RaptorCast erasure-coded propagation
  • EVM bytecode compatible

PARALLEL EXECUTION:
  Monad executes transactions in parallel
  using optimistic concurrency. If two txs
  conflict (access same state), one is
  re-executed. Results are deterministic.

MONADBFT PIPELINE:
  Four stages run simultaneously:
  PROPOSE → VOTE → FINALIZE → EXECUTE
  Each stage processes a different block.

Learn more: docs.monad.xyz

GMONAD.`,
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
            NADWATCH Help
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
