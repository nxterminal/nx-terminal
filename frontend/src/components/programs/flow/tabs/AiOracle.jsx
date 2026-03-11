import { useState, useRef, useEffect } from 'react';
import { COLORS } from '../constants';

const SYSTEM_MSG = {
  role: 'system',
  text: 'FLOW AI Oracle online. I analyze real-time Monad DeFi data — ask me about tokens, pools, wallets, or market conditions. Try: "What are the trending pools?" or "Is MON bullish?"',
};

// Local AI responses based on market data context
function generateResponse(query, market) {
  const q = query.toLowerCase();

  if (q.includes('trending') || q.includes('hot') || q.includes('pool')) {
    return `Based on current Monad data:\n\n• TPS: ${market?.tps || '--'} (network activity)\n• Block: #${(market?.blockNumber || 0).toLocaleString()}\n• MON: $${market?.monPrice?.toFixed(4) || '--'} (${market?.monChange24h > 0 ? '+' : ''}${market?.monChange24h?.toFixed(2) || '--'}% 24h)\n\nCheck the **Token Radar** tab for live pool rankings with safety scores. The trending pools are auto-scored based on liquidity, volume, age, and volatility.`;
  }

  if (q.includes('mon') && (q.includes('bull') || q.includes('bear') || q.includes('price'))) {
    const change = market?.monChange24h || 0;
    const sentiment = change > 5 ? 'strongly bullish' : change > 0 ? 'slightly bullish' : change > -5 ? 'slightly bearish' : 'bearish';
    return `MON is currently $${market?.monPrice?.toFixed(4) || '--'} with a ${change > 0 ? '+' : ''}${change?.toFixed(2)}% 24h change.\n\nSentiment: **${sentiment}**.\n\nMonad's ${market?.tps || '--'} TPS throughput and ${(market?.gasPrice || 0).toFixed(4)} Gwei gas suggest ${market?.tps > 500 ? 'high' : 'moderate'} network utilization. Check **The Stream** for real-time trade flow.`;
  }

  if (q.includes('wallet') || q.includes('address') || q.includes('0x')) {
    return 'Use the **Wallet X-Ray** tab to analyze any Monad address. It will show:\n\n• Native MON balance\n• ERC20 token holdings (WMON, USDC, USDT, WETH, AUSD)\n• Transaction count\n• Recent trade activity across top pools\n\nPaste any 0x address to get a full breakdown.';
  }

  if (q.includes('kuru') || q.includes('clob') || q.includes('orderbook') || q.includes('order book')) {
    return 'Kuru is Monad\'s native CLOB (Central Limit Order Book) DEX. Unlike AMMs, it matches orders directly.\n\nCheck the **CLOB Vision** tab for:\n• Live orderbook depth (bids & asks)\n• Spread analysis\n• Recent fills\n• Depth heatmap visualization\n\nSelect any trading pair to view its book.';
  }

  if (q.includes('gas') || q.includes('fee')) {
    return `Current Monad gas: **${(market?.gasPrice || 0).toFixed(4)} Gwei**\n\nMonad's parallel execution engine keeps gas extremely low even at ${market?.tps || '--'} TPS. Most DeFi transactions cost < $0.01.`;
  }

  if (q.includes('safe') || q.includes('scam') || q.includes('rug') || q.includes('security')) {
    return 'The **Token Radar** tab scores every token 0-100 based on:\n\n• **Liquidity depth** — higher reserves = safer\n• **Volume consistency** — healthy vol/liq ratio\n• **Token age** — older = more trusted\n• **Price stability** — less volatility = lower risk\n\nWarning flags: NEW (< 24h), LOW LIQ (< $5K), VOLATILE (> 50% swing), WASH? (suspicious volume).\n\nAlways DYOR before trading.';
  }

  if (q.includes('help') || q.includes('what can') || q.includes('how')) {
    return 'I can help you with:\n\n• **Market analysis** — "Is MON bullish?"\n• **Pool insights** — "What\'s trending?"\n• **Safety checks** — "How to spot scams?"\n• **Feature guides** — "How does Wallet X-Ray work?"\n• **Network stats** — "What\'s the gas fee?"\n• **CLOB info** — "Tell me about Kuru"\n\nI use live Monad data to inform my responses.';
  }

  return `Based on current Monad metrics:\n\n• MON: $${market?.monPrice?.toFixed(4) || '--'} (${market?.monChange24h > 0 ? '+' : ''}${market?.monChange24h?.toFixed(2) || '--'}%)\n• Network: ${market?.tps || '--'} TPS at block #${(market?.blockNumber || 0).toLocaleString()}\n• Gas: ${(market?.gasPrice || 0).toFixed(4)} Gwei\n\nFor more specific analysis, try asking about trending pools, token safety, wallet analysis, or market sentiment.`;
}

export default function AiOracle({ market }) {
  const [messages, setMessages] = useState([{ ...SYSTEM_MSG, id: 'sys' }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || typing) return;

    const userMsg = { role: 'user', text, id: 'u-' + Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Simulate thinking delay
    setTimeout(() => {
      const response = generateResponse(text, market);
      setMessages(prev => [...prev, { role: 'ai', text: response, id: 'ai-' + Date.now() }]);
      setTyping(false);
    }, 800 + Math.random() * 1200);
  };

  return (
    <div className="flow-ai-container">
      {/* MESSAGES */}
      <div className="flow-ai-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`flow-ai-message ${msg.role === 'user' ? 'flow-ai-message--user' : ''}`}>
            <div className={`flow-ai-avatar flow-ai-avatar--${msg.role}`}>
              {msg.role === 'ai' ? '◆' : msg.role === 'system' ? '⚙' : '▸'}
            </div>
            <div className={`flow-ai-bubble flow-ai-bubble--${msg.role}`}>
              {msg.text.split('\n').map((line, i) => (
                <span key={i}>
                  {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={j} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>
                      : part
                  )}
                  {i < msg.text.split('\n').length - 1 && <br />}
                </span>
              ))}
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

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <form className="flow-ai-input" onSubmit={handleSend}>
        <input
          className="flow-ai-input__field"
          type="text"
          placeholder="Ask about Monad DeFi…"
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
          {typing ? '…' : 'ASK'}
        </button>
      </form>
    </div>
  );
}
