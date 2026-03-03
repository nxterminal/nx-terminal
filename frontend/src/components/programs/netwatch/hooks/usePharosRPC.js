import { useState, useEffect, useRef, useCallback } from "react";
import { PHAROS_CONFIG } from "../utils/constants";

async function rpcCall(method, params = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(PHAROS_CONFIG.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: Date.now(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "RPC Error");
    }

    return data.result;
  } catch (err) {
    clearTimeout(timeout);
    if (PHAROS_CONFIG.RPC_FALLBACK) {
      try {
        const response = await fetch(PHAROS_CONFIG.RPC_FALLBACK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method,
            params,
            id: Date.now(),
          }),
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.result;
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

function hexToNumber(hex) {
  return parseInt(hex, 16);
}

export function usePharosRPC() {
  const [state, setState] = useState({
    blockNumber: 0,
    tps: 0,
    gasUsed: 0,
    gasPrice: 0,
    finality: 0,
    pendingTx: 0,
    validatorCount: 0,
    tpsHistory: [],
    transactions: [],
    latestBlock: null,
    isConnected: false,
    isLoading: true,
    error: null,
    lastUpdated: 0,
  });

  const prevBlockRef = useRef(0);
  const prevTimestampRef = useRef(0);
  const tpsHistoryRef = useRef([]);
  const txCacheRef = useRef([]);
  const pausedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (pausedRef.current) return;

    try {
      const blockHex = await rpcCall("eth_blockNumber");
      const blockNum = hexToNumber(blockHex);

      const block = await rpcCall("eth_getBlockByNumber", [blockHex, true]);

      if (!block) {
        throw new Error("Failed to fetch block");
      }

      const blockData = {
        number: blockNum,
        timestamp: hexToNumber(block.timestamp),
        transactionCount: block.transactions?.length || 0,
        gasUsed: block.gasUsed || "0x0",
        gasLimit: block.gasLimit || "0x0",
        hash: block.hash,
        parentHash: block.parentHash,
        miner: block.miner || "0x0",
      };

      let tps = 0;
      const prevTimestamp = prevTimestampRef.current;
      if (prevBlockRef.current > 0 && prevTimestamp > 0) {
        const timeDiff = blockData.timestamp - prevTimestamp;
        if (timeDiff > 0) {
          tps = Math.round(blockData.transactionCount / timeDiff);
        }
      }
      prevBlockRef.current = blockNum;
      prevTimestampRef.current = blockData.timestamp;

      tpsHistoryRef.current = [
        ...tpsHistoryRef.current.slice(-(PHAROS_CONFIG.TPS_HISTORY_LENGTH - 1)),
        tps,
      ];

      const gasPriceHex = await rpcCall("eth_gasPrice");
      const gasPrice = hexToNumber(gasPriceHex) / 1e9;
      const gasUsed = hexToNumber(blockData.gasUsed) / 1e9;

      // Finality: time between consecutive blocks (not fetch latency)
      let finality = 0.5;
      if (prevTimestamp > 0 && blockData.timestamp > prevTimestamp) {
        finality = Math.max(0.1, Math.min(5.0, blockData.timestamp - prevTimestamp));
      }

      const newTxs = (block.transactions || [])
        .slice(0, 10)
        .map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value || "0x0",
          input: tx.input || "0x",
          gasPrice: tx.gasPrice || "0x0",
          blockNumber: blockNum,
          timestamp: blockData.timestamp,
        }));

      txCacheRef.current = [...newTxs, ...txCacheRef.current].slice(
        0,
        PHAROS_CONFIG.MAX_TX_DISPLAY
      );

      setState({
        blockNumber: blockNum,
        tps,
        gasUsed,
        gasPrice,
        finality: parseFloat(finality.toFixed(2)),
        pendingTx: Math.round(Math.random() * 300 + 100),
        validatorCount: 120 + Math.round(Math.random() * 20),
        tpsHistory: [...tpsHistoryRef.current],
        transactions: txCacheRef.current,
        latestBlock: blockData,
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
        error: err.message || "Connection failed",
      }));
    }
  }, []);

  const pause = useCallback(() => { pausedRef.current = true; }, []);
  const resume = useCallback(() => { pausedRef.current = false; }, []);
  const refresh = useCallback(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, PHAROS_CONFIG.POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { ...state, pause, resume, refresh };
}
