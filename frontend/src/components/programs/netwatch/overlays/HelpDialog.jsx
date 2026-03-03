import { useState } from 'react';

const TABS = ['About', 'Beta Info', 'Legend'];

const TAB_CONTENT = {
  'About': `${'═'.repeat(45)}
NETWATCH.exe \u2014 Protocol Surveillance Terminal
Version 1.0 BETA
${'═'.repeat(45)}

NETWATCH is a real-time network monitor for
Pharos blockchain, built as part of the
NX Terminal: Protocol Wars ecosystem.

It visualizes live data from the Pharos Atlantic
Testnet including blocks, transactions, TPS, gas
throughput, and network health metrics.

${'═'.repeat(45)}
HOW IT WORKS
${'═'.repeat(45)}

NETWATCH connects directly to the Pharos Atlantic
Testnet via JSON-RPC and polls for new data every
3 seconds. All data is fetched client-side \u2014 no
backend server required.

The Block Rain visualization shows real blockchain
activity. Characters flash cyan each time a new
block is confirmed.

Transactions are decoded by reading the first 4
bytes of input data (method signature) to infer
the transaction type (Transfer, Swap, Deploy,
Mint, etc.)

${'═'.repeat(45)}
NETWORK INFO
${'═'.repeat(45)}

Network:   Pharos Atlantic Testnet
Chain ID:  688689
RPC:       atlantic.dplabs-internal.com
Explorer:  atlantic.pharosscan.xyz
Consensus: AsyncBFT
Target TPS: 30,000+
Finality:  Sub-second

STATUS: BETA
Connected to testnet. Data refreshes every
3 seconds. Values marked with ~ are estimated.

nxterminal.com`,

  'Beta Info': `${'═'.repeat(45)}
BETA VERSION \u2014 WHAT'S INCLUDED
${'═'.repeat(45)}

\u2713 Live block visualization (Matrix rain)
  Blocks confirmed with cyan flash effect
\u2713 Real-time network metrics
  TPS, gas, block height, finality
\u2713 Transaction flow with type detection
  Transfer, Swap, Deploy, Mint, and more
\u2713 Corporation activity monitor
  Six Protocol Wars corps tracked
\u2713 Hover tooltips on all metrics
  Hover any metric to learn what it shows
\u2713 CRT display effects and retro aesthetics

${'═'.repeat(45)}
FULL VERSION \u2014 FOR NX TERMINAL HOLDERS
${'═'.repeat(45)}

The full version of NETWATCH will be available
exclusively for NX Terminal NFT holders after
mainnet mint:

\u25C6 Wallet Surveillance
  Track any address in real-time with
  activity alerts and transaction history

\u25C6 Alert System
  Custom notifications for TPS thresholds,
  gas price changes, and whale transactions

\u25C6 Historical Data
  Network performance charts and analytics
  for 24h, 7d, and 30d time windows

\u25C6 Contract Inspector
  Decode any transaction with full input
  data parsing and event log display

\u25C6 Corp Leaderboard
  Real Protocol Wars rankings for Closed AI,
  Misanthropic, Shallow Mind, Zuck Labs,
  Y.AI, and Mistrial Systems based on
  on-chain activity from NX Terminal devs

\u25C6 Export Tools
  Download network data as CSV

\u25C6 Mainnet Mode
  Switch between testnet and mainnet
  monitoring after Pharos mainnet launches

Mint your NX Terminal dev NFT to unlock.
nxterminal.com/mint`,

  'Legend': `${'═'.repeat(45)}
TRANSACTION TYPES
${'═'.repeat(45)}

\u25A0 Transfer     Standard token or ETH transfer
\u25A0 Swap         DEX token swap (FaroSwap, etc.)
\u25A0 Deploy       New smart contract deployment
\u25A0 Mint         Token or NFT minting
\u25A0 Burn         Token burning
\u25A0 Stake        Token staking
\u25A0 Approve      Token spending approval
\u25A0 Execute      Universal Router execution
\u25A0 Withdraw     Token/ETH withdrawal
\u25A0 Contract     Other contract interaction

(Colors match the transaction feed display)

${'═'.repeat(45)}
METRIC INDICATORS
${'═'.repeat(45)}

\u2588 Filled bar   Current value relative to max
\u2591 Empty bar    Remaining capacity to maximum
~ Prefix       Estimated value (not from RPC)
\u2713 Checkmark    Value within expected target
\u25CF Blinking dot Live data indicator

${'═'.repeat(45)}
CORPORATIONS (Protocol Wars)
${'═'.repeat(45)}

\u25C6 Closed AI
  "We promised to be open. Then we got funding."

\u25C8 Misanthropic
  "Safe AI. We hate everyone equally."

\u25C9 Shallow Mind
  "Infinite compute. Zero products."

\u25CA Zuck Labs
  "We'll pivot to whatever is trending."

\u25CB Y.AI
  "Tweets before building."

\u25CE Mistrial Systems
  "Open source. When convenient."

Corporation activity bars are currently
simulated. Full version tracks real on-chain
activity from NX Terminal dev NFTs.`,
};

const LEGEND_COLORS = {
  'Transfer': '#00ff41',
  'Swap': '#ffff00',
  'Deploy': '#00ffff',
  'Mint': '#ff00ff',
  'Burn': '#ff3333',
  'Stake': '#ff6600',
  'Approve': '#888888',
  'Execute': '#00bfff',
  'Withdraw': '#ffff00',
  'Contract': '#aaaaaa',
};

function renderLegendContent(text) {
  return text.split('\n').map((line, i) => {
    for (const [typeName, color] of Object.entries(LEGEND_COLORS)) {
      if (line.includes('\u25A0 ' + typeName)) {
        const parts = line.split('\u25A0');
        return (
          <div key={i}>
            <span style={{ color }}>{'\u25A0'}</span>
            <span>{parts[1]}</span>
          </div>
        );
      }
    }
    return <div key={i}>{line || '\u00A0'}</div>;
  });
}

export default function HelpDialog({ onClose }) {
  const [activeTab, setActiveTab] = useState('About');

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
          background: 'linear-gradient(90deg, #000080, #1084d0)',
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '22px',
          flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'Tahoma, sans-serif', fontWeight: 'bold' }}>
            NETWATCH Help
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
          color: '#00ff41',
          fontFamily: '"Courier New", monospace',
          fontSize: '11px',
          padding: '8px',
          overflow: 'auto',
          whiteSpace: 'pre',
          lineHeight: '1.4',
        }}>
          {activeTab === 'Legend'
            ? renderLegendContent(TAB_CONTENT[activeTab])
            : TAB_CONTENT[activeTab]
          }
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
