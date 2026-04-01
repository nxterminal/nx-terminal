import { COLORS } from '../constants';

const SECTIONS = [
  {
    title: 'The Stream',
    icon: '>>',
    desc: 'Real-time trade feed from all MegaETH DEXs (Kuru, Uniswap, PancakeSwap, Balancer, Curve, Nad.fun, Perpl).',
    features: [
      'Filter trades by side (BUY/SELL), value ($100+, $1K+, etc.), or protocol',
      'Custom $ filter for specific minimum trade amounts',
      'Whale alerts automatically tag trades over $10K',
      'Pause/resume the feed without losing data',
      'Trades color-coded: green = BUY, red = SELL',
    ],
  },
  {
    title: 'Wallet X-Ray',
    icon: '{}',
    desc: 'Analyze any MegaETH wallet address to see holdings and activity.',
    features: [
      'Paste any 0x address to view native ETH balance',
      'ERC20 token holdings: WMON, USDC, USDT, WETH, AUSD',
      'Transaction count and network activity',
      'Recent trade history across top DEX pools',
      'Balance cards with automatic formatting (K, M)',
    ],
  },
  {
    title: 'Token Radar',
    icon: '(i)',
    desc: 'Pool scoring engine that rates every pool 0-100 for safety and quality.',
    features: [
      'Safety score based on: liquidity depth, volume consistency, token age, price stability',
      'Warning flags: NEW (< 24h), LOW LIQ (< $5K), VOLATILE (> 50% swing), WASH?',
      'Sort by score, volume, or liquidity',
      'Filter by minimum safety score (0-100)',
      'Live data from GeckoTerminal trending + new pools',
    ],
  },
  {
    title: 'CLOB Vision',
    icon: '||',
    desc: 'Live orderbook visualization for Kuru, MegaETH\'s native CLOB DEX.',
    features: [
      'Select any Kuru trading pair from the dropdown',
      'Visual depth bars showing bid/ask sizes',
      'Spread percentage and mid-price display',
      'Depth heatmap showing order concentration',
      'Recent fills with side, amount, and timestamp',
    ],
  },
  {
    title: 'AI Oracle',
    icon: '◆',
    desc: 'Conversational assistant powered by live MegaETH market data.',
    features: [
      'Ask about trending pools, ETH price, gas fees, or any DeFi topic',
      'Responses include real-time network stats (TPS, block, gas)',
      'Quick action chips for common questions',
      'Guides you to the right tab for deeper analysis',
    ],
  },
  {
    title: 'Header Bar',
    icon: '--',
    desc: 'Live network status strip at the top of FLOW.',
    features: [
      'Green dot = LIVE connection, red = OFFLINE',
      'TPS: transactions per second on MegaETH',
      'Block: current block number (sub-second finality)',
      'ETH: live price with 24h change color',
      'Gas: current gas price in Gwei (usually < 0.01)',
    ],
  },
];

const SHORTCUTS = [
  { key: 'Tabs', desc: 'Click any tab to switch between modules' },
  { key: 'Stream badge', desc: 'Green number on "The Stream" tab shows unseen trades while on other tabs' },
  { key: 'Hover tooltips', desc: 'Hover over stats, headers, and badges to see explanations' },
  { key: 'Pause', desc: 'Click PAUSE on The Stream to freeze the feed for analysis' },
];

export default function HelpGuide() {
  return (
    <div style={{ padding: '16px 20px', maxHeight: '100%' }}>
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 18,
        fontWeight: 700,
        color: '#fff',
        marginBottom: 4,
      }}>
        FLOW.exe User Guide
      </div>
      <div style={{
        fontSize: 12,
        color: COLORS.textDim,
        marginBottom: 20,
      }}>
        DeFi Intelligence Terminal for MegaETH Network — v1.0
      </div>

      {SECTIONS.map((section, i) => (
        <div key={i} style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: COLORS.accent,
              background: 'rgba(34,197,94,0.1)',
              padding: '2px 6px',
              borderRadius: 3,
            }}>{section.icon}</span>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
            }}>{section.title}</span>
          </div>
          <div style={{
            fontSize: 11,
            color: COLORS.text,
            marginBottom: 8,
            lineHeight: 1.5,
          }}>{section.desc}</div>
          <ul style={{
            margin: 0,
            padding: '0 0 0 16px',
            fontSize: 10,
            color: COLORS.textDim,
            lineHeight: 1.8,
          }}>
            {section.features.map((f, j) => (
              <li key={j}>{f}</li>
            ))}
          </ul>
        </div>
      ))}

      <div style={{
        marginBottom: 16,
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
      }}>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 8,
        }}>Tips & Shortcuts</div>
        {SHORTCUTS.map((s, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: 8,
            fontSize: 11,
            marginBottom: 4,
            lineHeight: 1.5,
          }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: COLORS.accent,
              fontWeight: 600,
              minWidth: 100,
              flexShrink: 0,
            }}>{s.key}</span>
            <span style={{ color: COLORS.textDim }}>{s.desc}</span>
          </div>
        ))}
      </div>

      <div style={{
        fontSize: 10,
        color: COLORS.textMuted,
        textAlign: 'center',
        padding: '8px 0 16px',
      }}>
        Data provided by GeckoTerminal & CoinGecko APIs — MegaETH Chain ID 4326
      </div>
    </div>
  );
}
