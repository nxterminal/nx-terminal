import { useState, useCallback, useRef } from 'react';
import { API, DEX_ID_MAP } from '../constants';

const MONAD_RPC = 'https://atlantic.dplabs-internal.com';

// Top ERC20 tokens on Pharos with their contract addresses
const KNOWN_TOKENS = [
  { symbol: 'WMON',  address: '0x3bd359c1119da7da1d913d1c4d2b7c461115433a', decimals: 18 },
  { symbol: 'USDC',  address: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea', decimals: 6 },
  { symbol: 'USDT',  address: '0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D', decimals: 6 },
  { symbol: 'WETH',  address: '0xB5a30b0FDc5F8d7bD0C1B0BC74eDa8B3F2DB5c70', decimals: 18 },
  { symbol: 'AUSD',  address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a', decimals: 18 },
];

// ERC20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = '0x70a08231';

async function rpcCall(method, params = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(MONAD_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'RPC Error');
    return data.result;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function padAddress(addr) {
  return '0x' + addr.replace('0x', '').toLowerCase().padStart(64, '0');
}

function hexToNumber(hex) {
  if (!hex || hex === '0x' || hex === '0x0') return 0;
  return parseInt(hex, 16);
}

function hexToBigFloat(hex, decimals) {
  if (!hex || hex === '0x' || hex === '0x0') return 0;
  const big = BigInt(hex);
  const divisor = BigInt(10 ** decimals);
  const whole = big / divisor;
  const remainder = big % divisor;
  return Number(whole) + Number(remainder) / Number(divisor);
}

function parsePoolName(name) {
  const match = name.match(/^(.+?)\s*\/\s*(.+?)(?:\s+[\d.]+%)?$/);
  if (!match) return { base: '???', quote: '???' };
  return { base: match[1].trim(), quote: match[2].trim() };
}

export function useWalletData() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const lookup = useCallback(async (address) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Invalid address — enter a 0x… Pharos address');
      return;
    }

    // Cancel previous lookup
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setWallet(null);

    try {
      // 1) Fetch native PHRS balance
      const monHex = await rpcCall('eth_getBalance', [address, 'latest']);
      const monBalance = hexToBigFloat(monHex, 18);

      // 2) Fetch TX count (nonce) as activity indicator
      const nonceHex = await rpcCall('eth_getTransactionCount', [address, 'latest']);
      const txCount = hexToNumber(nonceHex);

      // 3) Fetch ERC20 balances in parallel
      const tokenBalances = await Promise.allSettled(
        KNOWN_TOKENS.map(async (token) => {
          const data = BALANCE_OF_SELECTOR + padAddress(address).slice(2);
          const result = await rpcCall('eth_call', [
            { to: token.address, data },
            'latest',
          ]);
          const balance = hexToBigFloat(result, token.decimals);
          return { ...token, balance };
        })
      );

      const holdings = tokenBalances
        .filter(r => r.status === 'fulfilled' && r.value.balance > 0)
        .map(r => r.value);

      // 4) Check if address is a contract
      const code = await rpcCall('eth_getCode', [address, 'latest']);
      const isContract = code && code !== '0x' && code !== '0x0';

      // 5) Fetch recent pool activity (trades involving this wallet)
      let recentTrades = [];
      try {
        const poolsRes = await fetch(API.GECKOTERMINAL_TRENDING, {
          signal: controller.signal,
        });
        if (poolsRes.ok) {
          const poolsJson = await poolsRes.json();
          const topPools = (poolsJson.data || []).slice(0, 5);

          for (const pool of topPools) {
            if (controller.signal.aborted) break;
            try {
              const tradesRes = await fetch(
                API.GECKOTERMINAL_TRADES(pool.attributes.address),
                { signal: controller.signal }
              );
              if (!tradesRes.ok) continue;
              const tradesJson = await tradesRes.json();
              const dexId = pool.relationships?.dex?.data?.id || '';
              const { base, quote } = parsePoolName(pool.attributes.name);
              const protocol = DEX_ID_MAP[dexId] || dexId.split('-')[0] || 'unknown';

              for (const t of tradesJson.data || []) {
                if (t.attributes.tx_from_address?.toLowerCase() === address.toLowerCase()) {
                  recentTrades.push({
                    id: t.id,
                    side: t.attributes.kind,
                    pair: `${base}/${quote}`,
                    usd: parseFloat(t.attributes.volume_in_usd) || 0,
                    timestamp: t.attributes.block_timestamp,
                    protocol,
                    txHash: t.attributes.tx_hash,
                  });
                }
              }
            } catch {
              // skip pool on error
            }
          }
        }
      } catch {
        // pool fetch failed, that's ok
      }

      recentTrades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Compute total USD from recent trades
      const totalVolume = recentTrades.reduce((sum, t) => sum + t.usd, 0);
      const buyVolume = recentTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.usd, 0);
      const sellVolume = recentTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.usd, 0);

      if (!controller.signal.aborted) {
        setWallet({
          address,
          monBalance,
          txCount,
          isContract,
          holdings,
          recentTrades: recentTrades.slice(0, 20),
          stats: {
            totalVolume,
            buyVolume,
            sellVolume,
            tradeCount: recentTrades.length,
          },
        });
        setLoading(false);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError('Failed to fetch wallet data — check address and try again');
        setLoading(false);
      }
    }
  }, []);

  const clear = useCallback(() => {
    setWallet(null);
    setError(null);
  }, []);

  return { wallet, loading, error, lookup, clear };
}
