import { useState } from 'react';

const TABS = ['About', 'Beta Info', 'Corporations'];

const TAB_CONTENT = {
  'About': `${'═'.repeat(45)}
PHAROS_SDK.exe \u2014 Developer Training Simulator
Version: 1.0 BETA
${'═'.repeat(45)}

PHAROS_SDK is an interactive training program
that teaches blockchain development through
gamified coding exercises.

Complete missions to learn:
\u2022 Smart contract basics (Solidity)
\u2022 Wallet and key management
\u2022 DeFi mechanics (AMMs, lending)
\u2022 Pharos Network architecture
\u2022 On-chain data reading (JSON-RPC)

Each mission is assigned by one of the six
Protocol Wars corporations, with unique
briefings and storylines.

STATUS: BETA
Progress saved locally in your browser.

NETWORK: Pharos Atlantic Testnet
CHAIN ID: 688689

Built with \uD83E\uDD0D by Ember Labs
nxterminal.com \u00B7 @nxterminalcorp`,

  'Beta Info': `${'═'.repeat(45)}
BETA VERSION \u2014 WHAT'S INCLUDED
${'═'.repeat(45)}

\u2713 Track 1: Basic Training (5 missions)
  - Blockchain fundamentals
  - Wallet & key security
  - ERC-20 token development
  - DEX mechanics
  - On-chain data queries

\u2713 XP and rank progression system
\u2713 Retro compiler animations
\u2713 Corporation-themed briefings
\u2713 Progress saved in browser

${'═'.repeat(45)}
FULL VERSION \u2014 FOR NX TERMINAL HOLDERS
${'═'.repeat(45)}

The full version will be available exclusively
for NX Terminal NFT holders after mint.

\u25C6 Track 2: Corporate Warfare (10 missions)
  - Write contracts from scratch
  - AMM liquidity provision
  - Lending protocol interaction
  - Security & vulnerability hunting
  - Pharos parallel execution model
  - RWA tokenization
  - Gas optimization
  - Capture The Flag challenges

\u25C6 Track 3: Pharos Deep Dive (ongoing)
  - New missions as Pharos adds features
  - Community challenges
  - Mainnet-specific content

\u25C6 On-chain progress tracking
\u25C6 Leaderboard with rankings
\u25C6 Completion certificates as NFT badges
\u25C6 Real testnet deployments from exercises

Mint your NX Terminal dev to unlock.
nxterminal.com/mint`,

  'Corporations': `${'═'.repeat(45)}
THE SIX CORPORATIONS
${'═'.repeat(45)}

Each mission is assigned by a corporation.
Their personality affects briefing style.

\u25C6 Closed AI
  CEO: Scam Altwoman
  "We promised to be open. Then we got funding."
  Style: Ship fast, fix never.

\u25C8 Misanthropic
  CEO: Dario Annoyed-ei
  "Safe AI. We hate everyone equally."
  Style: 14 safety reviews per deploy.

\u25C9 Shallow Mind
  CEO: Sundial Richy
  "Infinite compute. Zero products."
  Style: Publish papers, never ship.

\u25CA Zuck Labs
  CEO: Mark Zuckatron
  "We'll pivot to whatever is trending."
  Style: Learn everything, pivot tomorrow.

\u25CB Y.AI
  CEO: FelonUsk
  "Tweets before building."
  Style: Ship broken, tweet it works.

\u25CE Mistrial Systems
  CEO: Pierre-Antoine du Code
  "Open source. When convenient."
  Style: Fork everything, document nothing.

${'═'.repeat(45)}
RANKS
${'═'.repeat(45)}

RECRUIT      0 XP      Starting rank
OPERATIVE    150 XP     You can follow orders
SPECIALIST   350 XP     You understand the code
AGENT        600 XP     You operate independently
COMMANDER    900 XP     You lead the team
ARCHITECT    1300 XP    You design the system`,
};

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
            PHAROS_SDK Help
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
