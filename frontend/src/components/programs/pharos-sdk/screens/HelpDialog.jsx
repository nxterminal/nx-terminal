import { useState } from 'react';

const TABS = ['About', 'Beta Info', 'Corporations'];

const TAB_CONTENT = {
  'About': [
    { type: 'heading', text: 'PHAROS_SDK.exe \u2014 Developer Training Simulator' },
    { type: 'text', text: 'Version: 1.0 BETA' },
    { type: 'text', text: '' },
    { type: 'text', text: 'PHAROS_SDK is an interactive training program that teaches blockchain development through gamified coding exercises.' },
    { type: 'text', text: '' },
    { type: 'text', text: 'Complete missions to learn:' },
    { type: 'text', text: '\u2022 Smart contract basics (Solidity)\n\u2022 Wallet and key management\n\u2022 DeFi mechanics (AMMs, lending)\n\u2022 Pharos Network architecture\n\u2022 On-chain data reading (JSON-RPC)' },
    { type: 'text', text: '' },
    { type: 'text', text: 'Each mission is assigned by one of the six Protocol Wars corporations, with unique briefings and storylines.' },
    { type: 'text', text: '' },
    { type: 'label', text: 'STATUS: BETA' },
    { type: 'text', text: 'Progress saved locally in your browser.' },
    { type: 'text', text: '' },
    { type: 'mono', text: 'Network: Pharos Atlantic Testnet\nChain ID: 688689' },
    { type: 'text', text: '' },
    { type: 'text', text: 'Built by Ember Labs\nnxterminal.com \u00B7 @nxterminalcorp' },
  ],
  'Beta Info': [
    { type: 'heading', text: 'BETA VERSION \u2014 What\'s Included' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u2713 Track 1: Basic Training (5 missions)' },
    { type: 'text', text: '  Blockchain fundamentals, wallet & key security, ERC-20 token development, DEX mechanics, on-chain data queries.' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u2713 Features' },
    { type: 'text', text: '  XP and rank progression system\n  Retro compiler animations\n  Corporation-themed briefings\n  Progress saved in browser' },
    { type: 'text', text: '' },
    { type: 'heading', text: 'FULL VERSION \u2014 For NX Terminal Holders' },
    { type: 'text', text: '' },
    { type: 'text', text: 'The full version will be available exclusively for NX Terminal NFT holders after mint.' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u25C6 Track 2: Corporate Warfare (10 missions)' },
    { type: 'text', text: '  Write contracts from scratch, AMM liquidity provision, lending protocol interaction, security & vulnerability hunting, Pharos parallel execution, RWA tokenization, gas optimization, CTF challenges.' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u25C6 Track 3: Pharos Deep Dive (ongoing)' },
    { type: 'text', text: '  New missions as Pharos adds features, community challenges, mainnet-specific content.' },
    { type: 'text', text: '' },
    { type: 'text', text: '\u25C6 On-chain progress tracking\n\u25C6 Leaderboard with rankings\n\u25C6 Completion certificates as NFT badges\n\u25C6 Real testnet deployments from exercises' },
    { type: 'text', text: '' },
    { type: 'label', text: 'Mint your NX Terminal dev to unlock.' },
  ],
  'Corporations': [
    { type: 'heading', text: 'The Six Corporations' },
    { type: 'text', text: 'Each mission is assigned by a corporation. Their personality affects briefing style.' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u25C6 Closed AI' },
    { type: 'text', text: '  CEO: Scam Altwoman\n  "We promised to be open. Then we got funding."\n  Style: Ship fast, fix never.' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u25C8 Misanthropic' },
    { type: 'text', text: '  CEO: Dario Annoyed-ei\n  "Safe AI. We hate everyone equally."\n  Style: 14 safety reviews per deploy.' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u25C9 Shallow Mind' },
    { type: 'text', text: '  CEO: Sundial Richy\n  "Infinite compute. Zero products."\n  Style: Publish papers, never ship.' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u25CA Zuck Labs' },
    { type: 'text', text: '  CEO: Mark Zuckatron\n  "We\'ll pivot to whatever is trending."\n  Style: Learn everything, pivot tomorrow.' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u25CB Y.AI' },
    { type: 'text', text: '  CEO: FelonUsk\n  "Tweets before building."\n  Style: Ship broken, tweet it works.' },
    { type: 'text', text: '' },
    { type: 'label', text: '\u25CE Mistrial Systems' },
    { type: 'text', text: '  CEO: Pierre-Antoine du Code\n  "Open source. When convenient."\n  Style: Fork everything, document nothing.' },
    { type: 'text', text: '' },
    { type: 'heading', text: 'Ranks' },
    { type: 'mono', text: 'RECRUIT      0 XP      Starting rank\nOPERATIVE    150 XP    You can follow orders\nSPECIALIST   350 XP    You understand the code\nAGENT        600 XP    You operate independently\nCOMMANDER    900 XP    You lead the team\nARCHITECT    1300 XP   You design the system' },
  ],
};

function renderContent(items) {
  return items.map((item, i) => {
    if (item.type === 'heading') {
      return <div key={i} style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px', borderBottom: '1px solid #999', paddingBottom: '2px' }}>{item.text}</div>;
    }
    if (item.type === 'label') {
      return <div key={i} style={{ fontWeight: 'bold', fontSize: '11px', color: '#000' }}>{item.text}</div>;
    }
    if (item.type === 'mono') {
      return <pre key={i} style={{ fontFamily: '"Courier New", monospace', fontSize: '10px', margin: '4px 0', whiteSpace: 'pre', lineHeight: '1.5', background: '#e8e8e8', padding: '4px 6px', border: '1px solid #ccc' }}>{item.text}</pre>;
    }
    if (item.text === '') {
      return <div key={i} style={{ height: '6px' }} />;
    }
    return <div key={i} style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>{item.text}</div>;
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
        width: '550px',
        maxWidth: '95%',
        height: '420px',
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
              width: '16px', height: '14px', background: '#c0c0c0',
              border: '1px solid', borderColor: '#dfdfdf #808080 #808080 #dfdfdf',
              fontSize: '10px', fontWeight: 'bold', lineHeight: '10px',
              cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >x</button>
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
                padding: '3px 12px', fontSize: '11px', fontFamily: 'Tahoma, sans-serif',
                cursor: 'pointer', position: 'relative',
                top: activeTab === tab ? '2px' : '0',
                marginBottom: activeTab === tab ? '-2px' : '0',
              }}
            >{tab}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          margin: '0 6px',
          border: '2px solid',
          borderColor: '#808080 #dfdfdf #dfdfdf #808080',
          background: '#f0f0f0',
          color: '#000',
          fontFamily: 'Tahoma, sans-serif',
          fontSize: '11px',
          padding: '8px 10px',
          overflow: 'auto',
          lineHeight: '1.4',
        }}>
          {renderContent(TAB_CONTENT[activeTab])}
        </div>

        {/* OK */}
        <div style={{ padding: '6px', textAlign: 'center', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              background: '#c0c0c0', border: '2px solid',
              borderColor: '#dfdfdf #808080 #808080 #dfdfdf',
              padding: '3px 24px', fontSize: '12px', fontFamily: 'Tahoma, sans-serif', cursor: 'pointer',
            }}
            onMouseDown={(e) => { e.currentTarget.style.borderColor = '#808080 #dfdfdf #dfdfdf #808080'; }}
            onMouseUp={(e) => { e.currentTarget.style.borderColor = '#dfdfdf #808080 #808080 #dfdfdf'; }}
          >OK</button>
        </div>
      </div>
    </div>
  );
}
