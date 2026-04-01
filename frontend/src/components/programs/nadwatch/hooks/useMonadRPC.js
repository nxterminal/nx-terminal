import { useState, useEffect, useRef, useCallback } from 'react';
import { MEGAETH_RPC, POLL_INTERVAL, MAX_TX_DISPLAY, TPS_HISTORY_LENGTH } from '../constants';

const MAX_BLOCKS_PER_POLL = 3;

function hexToNumber(hex) {
  return parseInt(hex, 16);
}

function numberToHex(num) {
  return '0x' + num.toString(16);
}

async function rpcCall(method, params = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(MEGAETH_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'RPC Error');
    return data.result;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export function useMonadRPC() {
  const [state, setState] = useState({
    blockNumber: 0,
    tps: 0,
    gasUsed: 0,
    gasPrice: 0,
    blockTime: 0,
    tpsHistory: [],
    transactions: [],
    latestBlock: null,
    isConnected: false,
    isLoading: true,
    error: null,
    lastUpdated: 0,
  });

  const recentBlocksRef = useRef([]);
  const lastProcessedBlockRef = useRef(0);
  const tpsHistoryRef = useRef([]);
  const txCacheRef = useRef([]);
  const pausedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (pausedRef.current) return;

    try {
      const blockHex = await rpcCall('eth_blockNumber');
      const currentBlock = hexToNumber(blockHex);

      if (currentBlock === lastProcessedBlockRef.current && lastProcessedBlockRef.current > 0) {
        return;
      }

      const lastProcessed = lastProcessedBlockRef.current;
      const gap = lastProcessed > 0 ? currentBlock - lastProcessed : 1;
      const blocksToFetch = Math.min(gap, MAX_BLOCKS_PER_POLL);
      const startBlock = currentBlock - blocksToFetch + 1;

      const blockPromises = [];
      for (let bn = startBlock; bn <= currentBlock; bn++) {
        const hex = numberToHex(bn);
        const includeTx = bn === currentBlock;
        blockPromises.push(
          rpcCall('eth_getBlockByNumber', [hex, includeTx]).then(block => ({
            blockNum: bn,
            block,
            isLatest: bn === currentBlock,
          }))
        );
      }

      const results = await Promise.all(blockPromises);

      let latestBlockData = null;
      let latestRawBlock = null;

      for (const { blockNum, block, isLatest } of results) {
        if (!block) continue;

        const timestamp = hexToNumber(block.timestamp);
        const txCount = Array.isArray(block.transactions) ? block.transactions.length : 0;

        recentBlocksRef.current.push({ number: blockNum, timestamp, txCount });

        if (isLatest) {
          latestBlockData = {
            number: blockNum,
            timestamp,
            transactionCount: txCount,
            gasUsed: block.gasUsed || '0x0',
            gasLimit: block.gasLimit || '0x0',
            hash: block.hash,
            parentHash: block.parentHash,
            miner: block.miner || '0x0',
          };
          latestRawBlock = block;
        }
      }

      if (recentBlocksRef.current.length > 30) {
        recentBlocksRef.current = recentBlocksRef.current.slice(-30);
      }

      if (!latestBlockData) {
        throw new Error('Failed to fetch block');
      }

      lastProcessedBlockRef.current = currentBlock;

      const blocks = recentBlocksRef.current;

      // TPS: total txs in window / time span
      let tps = 0;
      if (blocks.length >= 2) {
        const oldest = blocks[0];
        const newest = blocks[blocks.length - 1];
        const timeDiff = newest.timestamp - oldest.timestamp;
        const totalTxInWindow = blocks.slice(1).reduce((sum, b) => sum + b.txCount, 0);
        if (timeDiff > 0) {
          tps = totalTxInWindow / timeDiff;
        }
      }

      tpsHistoryRef.current = [
        ...tpsHistoryRef.current.slice(-(TPS_HISTORY_LENGTH - 1)),
        tps,
      ];

      // Block time: average of consecutive diffs
      let blockTime = 0;
      if (blocks.length >= 2) {
        let totalTime = 0;
        let count = 0;
        for (let i = 1; i < blocks.length; i++) {
          const diff = blocks[i].timestamp - blocks[i - 1].timestamp;
          if (diff > 0) {
            totalTime += diff;
            count++;
          }
        }
        if (count > 0) blockTime = totalTime / count;
      }

      const gasPriceHex = await rpcCall('eth_gasPrice');
      const gasPrice = hexToNumber(gasPriceHex) / 1e9;
      const gasUsed = hexToNumber(latestBlockData.gasUsed) / 1e9;

      // Transaction flow from latest block
      const newTxs = (latestRawBlock.transactions || [])
        .slice(0, 20)
        .map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value || '0x0',
          input: tx.input || '0x',
          gas: tx.gas || '0x0',
          gasUsed: tx.gasUsed || null,
          gasPrice: tx.gasPrice || '0x0',
          blockNumber: currentBlock,
          timestamp: Date.now(),
        }));

      txCacheRef.current = [...newTxs, ...txCacheRef.current].slice(0, MAX_TX_DISPLAY);

      setState({
        blockNumber: currentBlock,
        tps: parseFloat(tps.toFixed(2)),
        gasUsed,
        gasPrice,
        blockTime: parseFloat(blockTime.toFixed(2)),
        tpsHistory: [...tpsHistoryRef.current],
        transactions: txCacheRef.current,
        latestBlock: latestBlockData,
        isConnected: true,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        error: err.message || 'Connection failed',
      }));
    }
  }, []);

  const pause = useCallback(() => { pausedRef.current = true; }, []);
  const resume = useCallback(() => { pausedRef.current = false; }, []);
  const refresh = useCallback(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { ...state, pause, resume, refresh };
}
