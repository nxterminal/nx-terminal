import { useState, useRef, useEffect, useCallback } from 'react';
import { API } from '../constants';

const QUICK_ACTIONS = [
  { label: 'Top trending pools', query: 'trending' },
  { label: 'MON price analysis', query: 'mon price' },
  { label: 'Gas & network stats', query: 'gas' },
  { label: 'How to use FLOW', query: 'help' },
];

async function fetchTrendingPools() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(API.GECKOTERMINAL_TRENDING, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.slice(0, 5) || null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchNewPools() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(API.GECKOTERMINAL_NEW_POOLS, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.slice(0, 5) || null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function formatPoolData(pools) {
  if (!pools || pools.length === 0) return 'No pool data available right now.';
  return pools.map((p, i) => {
    const a = p.attributes;
    const vol = parseFloat(a.volume_usd?.h24) || 0;
    const liq = parseFloat(a.reserve_in_usd) || 0;
    const change = parseFloat(a.price_change_percentage?.h24) || 0;
    const volStr = vol >= 1e6 ? '$' + (vol / 1e6).toFixed(2) + 'M' : vol >= 1e3 ? '$' + (vol / 1e3).toFixed(1) + 'K' : '$' + vol.toFixed(0);
    const liqStr = liq >= 1e6 ? '$' + (liq / 1e6).toFixed(2) + 'M' : liq >= 1e3 ? '$' + (liq / 1e3).toFixed(1) + 'K' : '$' + liq.toFixed(0);
    return `${i + 1}. **${a.name}**\n   Vol: ${volStr} | Liq: ${liqStr} | 24h: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  }).join('\n\n');
}

async function generateResponse(query, market) {
  const q = query.toLowerCase();

  if (q.includes('trending') || q.includes('hot') || q.includes('top pool')) {
    const pools = await fetchTrendingPools();
    if (pools) {
      return `**Top Trending Pools on Monad** (live data):\n\n${formatPoolData(pools)}\n\nGo to **Token Radar** for full safety scores on each pool.`;
    }
    return 'Unable to fetch trending pools right now. Try again in a moment, or check **Token Radar** for cached data.';
  }

  if (q.includes('new pool') || q.includes('latest') || q.includes('recent pool')) {
    const pools = await fetchNewPools();
    if (pools) {
      return `**Newest Pools on Monad** (live data):\n\n${formatPoolData(pools)}\n\nNew pools carry higher risk. Check **Token Radar** for safety scores.`;
    }
    return 'Unable to fetch new pools right now. Try again shortly.';
  }

  if (q.includes('mon') && (q.includes('bull') || q.includes('bear') || q.includes('price') || q.includes('analysis'))) {
    const price = market?.monPrice;
    const change = market?.monChange24h;
    if (price != null && change != null) {
      const sentiment = change > 5 ? 'strongly bullish' : change > 1 ? 'moderately bullish' : change > -1 ? 'neutral' : change > -5 ? 'moderately bearish' : 'bearish';
      const tpsStatus = market?.tps > 500 ? 'high' : market?.tps > 100 ? 'moderate' : 'low';
      return `**MON Price Analysis** (live)\n\nPrice: **$${price.toFixed(4)}**\n24h Change: **${change >= 0 ? '+' : ''}${change.toFixed(2)}%**\nSentiment: **${sentiment}**\n\nNetwork Metrics:\n• TPS: ${market?.tps?.toFixed(0) || '--'} (${tpsStatus} activity)\n• Gas: ${market?.gasPrice?.toFixed(4) || '--'} Gwei\n• Block: #${(market?.blockNumber || 0).toLocaleString()}\n\nMonad's parallel execution keeps gas near zero even at high throughput.`;
    }
    return 'MON price data is loading. Try again in a few seconds.';
  }

  if (q.includes('gas') || q.includes('fee') || q.includes('network') || q.includes('tps') || q.includes('block')) {
    const gas = market?.gasPrice;
    const tps = market?.tps;
    const block = market?.blockNumber;
    if (gas != null || tps != null) {
      return `**Monad Network Status** (live)\n\n• Gas Price: **${gas?.toFixed(4) || '--'} Gwei** (~$0.001 per tx)\n• TPS: **${tps?.toFixed(0) || '--'}** transactions/second\n• Latest Block: **#${(block || 0).toLocaleString()}**\n• Block Time: **400ms** (finality)\n• Chain ID: **10143**\n\nMonad's parallel EVM execution enables sub-penny gas fees at thousands of TPS.`;
    }
    return 'Network data is still loading. Try again in a moment.';
  }

  if (q.includes('wallet') || q.includes('address') || q.includes('balance') || q.includes('0x')) {
    return '**Wallet X-Ray** can analyze any Monad address.\n\nSwitch to the **Wallet X-Ray** tab and paste a 0x address to see:\n• Native MON balance\n• ERC20 holdings (WMON, USDC, USDT, WETH, AUSD)\n• Transaction count\n• Recent DEX activity';
  }

  if (q.includes('kuru') || q.includes('clob') || q.includes('orderbook') || q.includes('order book') || q.includes('dex')) {
    return '**Kuru** is Monad\'s native CLOB (Central Limit Order Book) DEX.\n\nUnlike AMMs, Kuru matches buy/sell orders directly — similar to a traditional exchange.\n\nSwitch to **CLOB Vision** to see:\n• Live bid/ask orderbook depth\n• Spread analysis\n• Recent fills\n• Depth heatmap';
  }

  if (q.includes('safe') || q.includes('scam') || q.includes('rug') || q.includes('security') || q.includes('risk')) {
    return '**Token Safety Tips**\n\nThe **Token Radar** tab scores every pool 0-100 based on:\n• **Liquidity depth** — higher reserves = safer\n• **Volume consistency** — healthy vol/liq ratio\n• **Token age** — older = more trusted\n• **Price stability** — less volatility = lower risk\n\nWarning flags to watch:\n• **NEW** — less than 24 hours old\n• **LOW LIQ** — under $5K liquidity\n• **VOLATILE** — over 50% price swing\n• **WASH?** — suspicious volume patterns\n\nAlways DYOR (Do Your Own Research) before trading.';
  }

  if (q.includes('help') || q.includes('how') || q.includes('what can') || q.includes('guide') || q.includes('tutorial')) {
    return '**FLOW.exe Modules**\n\n• **The Stream** — real-time trade feed from all Monad DEXs. Filter by side, value, and protocol.\n• **Wallet X-Ray** — paste any 0x address to analyze holdings and activity.\n• **Token Radar** — pool scoring engine (0-100) for safety analysis.\n• **CLOB Vision** — live orderbook visualization for Kuru DEX.\n• **AI Oracle** — that\'s me! Ask about pools, prices, gas, or safety.\n• **? Help** — full documentation for each module.\n\nTry asking: "top trending pools" or "MON price analysis"';
  }

  if (q.includes('monad') || q.includes('chain')) {
    return `**About Monad**\n\nMonad is a high-performance EVM-compatible Layer 1 blockchain.\n\n• **Chain ID**: 10143\n• **Block Time**: 400ms\n• **Consensus**: MonadBFT\n• **Execution**: Parallel EVM\n• **Gas**: Near-zero fees (< $0.01)\n• **TPS**: Currently ${market?.tps?.toFixed(0) || '1000+'}+ transactions per second\n\nTop DEXs: Kuru (CLOB), Uniswap, PancakeSwap, Curve, Balancer, Nad.fun`;
  }

  return `I'm not sure how to answer that yet.\n\n**FLOW AI Oracle v1.0 (Beta)** — I can help with:\n• Pool data — "top trending pools" or "new pools"\n• Price analysis — "MON price analysis"\n• Network stats — "gas fees" or "network status"\n• Safety — "how to spot scams"\n• Guides — "how to use FLOW"\n\nThis is an early version. More capabilities are coming soon!`;
}

function renderText(text) {
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>
      {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={j} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>
          : part
      )}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

export default function AiOracleModal({ market, onMinimize, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const sendMessage = useCallback(async (text) => {
    if (!text || typing) return;
    const userMsg = { role: 'user', text, id: 'u-' + Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    try {
      const response = await generateResponse(text, market);
      setMessages(prev => [...prev, { role: 'ai', text: response, id: 'ai-' + Date.now() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'Sorry, I encountered an error. Please try again.',
        id: 'ai-err-' + Date.now(),
      }]);
    }
    setTyping(false);
  }, [typing, market]);

  const handleSend = (e) => {
    e.preventDefault();
    sendMessage(input.trim());
  };

  return (
    <div className="flow-ai-panel">
      {/* PANEL HEADER */}
      <div className="flow-ai-panel__header">
        <div className="flow-ai-panel__header-left">
          <span className="flow-ai-panel__icon">◆</span>
          <span className="flow-ai-panel__title">AI Oracle</span>
          <span className="flow-ai-panel__badge">BETA</span>
        </div>
        <div className="flow-ai-panel__header-actions">
          <button className="flow-ai-panel__btn" onClick={onMinimize} title="Minimize">─</button>
          <button className="flow-ai-panel__btn flow-ai-panel__btn--close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flow-ai-panel__body" ref={bodyRef}>
        {messages.length === 0 && (
          <div className="flow-ai-panel__welcome">
            <div className="flow-ai-panel__welcome-text">
              Real-time data from Monad DEXs.
            </div>
              <div className="flow-ai-chips">
                {QUICK_ACTIONS.map((q, i) => (
                  <button
                    key={i}
                    className="flow-ai-chip"
                    onClick={() => sendMessage(q.query)}
                    disabled={typing}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flow-ai-message ${msg.role === 'user' ? 'flow-ai-message--user' : ''}`}>
            <div className={`flow-ai-avatar flow-ai-avatar--${msg.role}`}>
              {msg.role === 'ai' ? '◆' : '▸'}
            </div>
            <div className={`flow-ai-bubble flow-ai-bubble--${msg.role}`}>
              {renderText(msg.text)}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flow-ai-message">
            <div className="flow-ai-avatar flow-ai-avatar--ai">◆</div>
            <div className="flow-ai-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

      </div>

      {/* INPUT */}
      <form className="flow-ai-panel__input" onSubmit={handleSend}>
        <input
          className="flow-ai-input__field"
          type="text"
          placeholder="Ask about Monad DeFi..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={typing}
        />
        <button
          className="flow-ai-input__btn"
          type="submit"
          disabled={typing || !input.trim()}
          style={typing ? { opacity: 0.5 } : undefined}
        >
          {typing ? '...' : 'ASK'}
        </button>
      </form>
    </div>
  );
}
