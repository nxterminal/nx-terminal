import { useState } from 'react';

const TABS = ['About', 'Beta Info', 'Legend'];

const TAB_CONTENT = {
  'About': `${'═'.repeat(45)}
NETWATCH.exe \u2014 Protocol Surveillance Terminal
Version: 1.0 BETA
${'═'.repeat(45)}

NETWATCH is a real-time network monitor for Pharos
blockchain. It visualizes live data from the Pharos
testnet including blocks, transactions, TPS, gas
metrics, and more.

Developed by NX Terminal Corp\u2122 as part of the
Protocol Wars ecosystem.

STATUS: BETA
This version connects to Pharos testnet.
Data refreshes every 3 seconds.
Some values marked with ~ are estimated.

NETWORK: Pharos Testnet
CHAIN ID: 688688
RPC: https://testnet.dplabs-internal.com

Built with \uD83E\uDD0D by Ember Labs
nxterminal.com \u00B7 @nxterminalcorp`,

  'Beta Info': `${'═'.repeat(45)}
BETA VERSION \u2014 WHAT'S INCLUDED
${'═'.repeat(45)}

\u2713 Live block feed with Matrix visualization
\u2713 Real-time network metrics (TPS, gas, blocks)
\u2713 Transaction flow with type detection
\u2713 Corporation activity monitor
\u2713 CRT display effects

${'═'.repeat(45)}
FULL VERSION \u2014 FOR NX TERMINAL HOLDERS
${'═'.repeat(45)}

The full version of NETWATCH will be available
exclusively for NX Terminal NFT holders after
mainnet mint. Features include:

\u25C6 Wallet Surveillance \u2014 Track any address
  in real-time with activity alerts

\u25C6 Alert System \u2014 Custom notifications for
  TPS thresholds, gas prices, whale txs

\u25C6 Historical Data \u2014 Charts and analytics
  for 24h, 7d, 30d network performance

\u25C6 Contract Inspector \u2014 Decode any transaction
  with full input data and event logs

\u25C6 Corp Leaderboard \u2014 Real Protocol Wars
  corporation rankings based on on-chain
  activity from NX Terminal devs

\u25C6 Export Tools \u2014 Download data as CSV
  (with retro "SAVING TO FLOPPY..." animation)

\u25C6 Mainnet Mode \u2014 Switch between testnet
  and mainnet monitoring

Mint your NX Terminal dev NFT to unlock.
nxterminal.com/mint`,

  'Legend': `${'═'.repeat(45)}
TRANSACTION TYPE LEGEND
${'═'.repeat(45)}

\u25A0 Transfer    Standard token/ETH transfer
\u25A0 Swap        DEX token swap
\u25A0 Deploy      New smart contract deployment
\u25A0 Mint        Token/NFT minting
\u25A0 Burn        Token burning
\u25A0 Stake       Token staking
\u25A0 Approve     Token spending approval
\u25A0 Contract    Other contract interaction

${'═'.repeat(45)}
METRIC INDICATORS
${'═'.repeat(45)}

\u2588 Filled bar   \u2014 current value
\u2591 Empty bar    \u2014 remaining to max
~ Prefix       \u2014 estimated value
\u2713 Checkmark    \u2014 within target
\u25B6 Arrow        \u2014 transaction entry

${'═'.repeat(45)}
CORPORATIONS
${'═'.repeat(45)}

\u25C6 NexaCorp      Financial Division
\u25C8 CipherDyne    Security Division
\u25C9 OmniVault     Storage Division
\u25CA SynthLabs     AI Division
\u25CB VoidFrame     Network Division
\u25CE Quantum Dyn   Research Division`,
};

const LEGEND_COLORS = {
  'Transfer': '#00ff41',
  'Swap': '#ffff00',
  'Deploy': '#00ffff',
  'Mint': '#ff00ff',
  'Burn': '#ff3333',
  'Stake': '#ff6600',
  'Approve': '#888888',
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
