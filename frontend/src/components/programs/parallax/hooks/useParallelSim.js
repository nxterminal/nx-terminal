import { useState, useEffect, useRef, useCallback } from 'react';
import { useMonadRPC } from '../../nadwatch/hooks/useMonadRPC';
import { NUM_LANES, SIM_TICK_MS, EVENT_TYPES } from '../constants';

function hexToNumber(hex) {
  if (!hex || hex === '0x') return 0;
  return parseInt(hex, 16) || 0;
}

function addressToLane(address) {
  if (!address || address === '0x' || address.length < 10) return 0;
  return parseInt(address.slice(2, 10), 16) % NUM_LANES;
}

function createEmptyLanes() {
  return Array.from({ length: NUM_LANES }, (_, i) => ({
    laneId: i,
    transactions: [],
    utilization: 0,
    gasUsed: 0,
    conflictCount: 0,
  }));
}

let nextEventId = 0;

export function useParallelSim() {
  const rpc = useMonadRPC();

  const [snapshot, setSnapshot] = useState({
    lanes: createEmptyLanes(),
    events: [],
    metrics: {
      serialTime: 0,
      parallelTime: 0,
      parallelGain: 1,
      effectiveTPS: 0,
      totalConflicts: 0,
      totalReExecs: 0,
      laneEfficiency: 0,
    },
  });

  const lanesRef = useRef(createEmptyLanes());
  const eventsRef = useRef([]);
  const metricsRef = useRef(snapshot.metrics);
  const lastBlockRef = useRef(0);
  const pausedRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);

  // Distribute transactions across lanes when new block arrives
  useEffect(() => {
    if (rpc.blockNumber === 0 || rpc.blockNumber === lastBlockRef.current) return;
    lastBlockRef.current = rpc.blockNumber;

    const lanes = createEmptyLanes();
    const addressMap = new Map(); // address -> Set<laneId>
    let totalConflicts = 0;
    const now = Date.now();

    const txs = rpc.transactions.slice(0, 80); // cap per block for perf

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const targetAddr = (tx.to || '0x00000000').toLowerCase();
      const laneId = addressToLane(targetAddr);
      const gas = hexToNumber(tx.gas) || 21000;

      const simTx = {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        gas,
        progress: 0,
        state: 'pending',
        conflictWith: null,
        startTime: now + Math.random() * 200,
        conflictTime: 0,
      };

      // Check for conflict: same to address in different lane
      let hasConflict = false;
      if (addressMap.has(targetAddr)) {
        const existingLanes = addressMap.get(targetAddr);
        for (const otherLane of existingLanes) {
          if (otherLane !== laneId) {
            hasConflict = true;
            simTx.state = 'conflict';
            simTx.conflictWith = otherLane;
            simTx.conflictTime = now;
            totalConflicts++;

            // Mark first tx in the other lane with same address as conflict too
            const otherLaneTxs = lanes[otherLane].transactions;
            for (let j = otherLaneTxs.length - 1; j >= 0; j--) {
              if (otherLaneTxs[j].to && otherLaneTxs[j].to.toLowerCase() === targetAddr && otherLaneTxs[j].state !== 'conflict') {
                otherLaneTxs[j].state = 'conflict';
                otherLaneTxs[j].conflictWith = laneId;
                otherLaneTxs[j].conflictTime = now;
                lanes[otherLane].conflictCount++;
                break;
              }
            }

            eventsRef.current.push({
              id: nextEventId++,
              type: 'CONFLICT',
              timestamp: now,
              message: `L${laneId} \u2194 L${otherLane} — ${targetAddr.slice(0, 10)}... state conflict`,
            });
            break;
          }
        }
        existingLanes.add(laneId);
      } else {
        addressMap.set(targetAddr, new Set([laneId]));
      }

      if (hasConflict) {
        lanes[laneId].conflictCount++;
      }

      lanes[laneId].transactions.push(simTx);
      lanes[laneId].gasUsed += gas;
    }

    // Cap events
    if (eventsRef.current.length > 100) {
      eventsRef.current = eventsRef.current.slice(-100);
    }

    // Emit PARALLEL event for new block
    eventsRef.current.push({
      id: nextEventId++,
      type: 'PARALLEL',
      timestamp: now,
      message: `Block #${rpc.blockNumber.toLocaleString()} — ${txs.length} txs distributed across ${NUM_LANES} lanes`,
    });

    // Calculate metrics
    const totalGas = lanes.reduce((sum, l) => sum + l.gasUsed, 0);
    const maxLaneGas = Math.max(...lanes.map(l => l.gasUsed), 1);
    const serialTime = totalGas / 21000;
    const parallelTime = (maxLaneGas / 21000) + (totalConflicts * 0.5);
    const gain = parallelTime > 0 ? Math.min(8, Math.max(1, serialTime / parallelTime)) : 1;

    metricsRef.current = {
      serialTime,
      parallelTime,
      parallelGain: parseFloat(gain.toFixed(2)),
      effectiveTPS: parseFloat((rpc.tps * gain).toFixed(1)),
      totalConflicts,
      totalReExecs: 0,
      laneEfficiency: 0,
    };

    lanesRef.current = lanes;
  }, [rpc.blockNumber, rpc.transactions, rpc.tps]);

  // Simulation tick — advance tx progress, handle conflict lifecycle
  useEffect(() => {
    const interval = setInterval(() => {
      if (pausedRef.current) return;

      const now = Date.now();
      const lanes = lanesRef.current;
      let reExecCount = metricsRef.current.totalReExecs;
      let activeCount = 0;
      let totalCount = 0;

      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        let laneActive = 0;

        for (let j = 0; j < lane.transactions.length; j++) {
          const tx = lane.transactions[j];
          totalCount++;

          if (tx.state === 'pending' && now >= tx.startTime) {
            tx.state = 'executing';
            tx.progress = 0;
          }

          if (tx.state === 'executing') {
            tx.progress = Math.min(1, tx.progress + 0.05);
            laneActive++;
            if (tx.progress >= 1) {
              tx.state = 'done';
            }
          }

          if (tx.state === 'conflict' && now - tx.conflictTime > 300) {
            tx.state = 'reexecuting';
            tx.progress = Math.max(0, tx.progress * 0.5);
            reExecCount++;

            eventsRef.current.push({
              id: nextEventId++,
              type: 'RE_EXEC',
              timestamp: now,
              message: `L${i} re-executing ${tx.hash ? tx.hash.slice(0, 10) : '???'}...`,
            });
          }

          if (tx.state === 'reexecuting') {
            tx.progress = Math.min(1, tx.progress + 0.03);
            laneActive++;
            if (tx.progress >= 1) {
              tx.state = 'done';
              eventsRef.current.push({
                id: nextEventId++,
                type: 'CLEAR',
                timestamp: now,
                message: `L${i} conflict resolved — ${tx.hash ? tx.hash.slice(0, 10) : '???'}...`,
              });
            }
          }

          if (tx.state === 'executing' || tx.state === 'reexecuting') {
            activeCount++;
          }
        }

        lane.utilization = lane.transactions.length > 0
          ? laneActive / lane.transactions.length
          : 0;
      }

      // Cap events
      if (eventsRef.current.length > 100) {
        eventsRef.current = eventsRef.current.slice(-100);
      }

      metricsRef.current.totalReExecs = reExecCount;
      metricsRef.current.laneEfficiency = totalCount > 0
        ? parseFloat((activeCount / totalCount).toFixed(2))
        : 0;

      // Snapshot to state for consumers (~every 200ms = every 2 ticks)
      setSnapshot({
        lanes: lanes.map(l => ({
          ...l,
          transactions: l.transactions.map(t => ({ ...t })),
        })),
        events: [...eventsRef.current],
        metrics: { ...metricsRef.current },
      });
    }, SIM_TICK_MS);

    return () => clearInterval(interval);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    rpc.pause();
    setIsPaused(true);
  }, [rpc.pause]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    rpc.resume();
    setIsPaused(false);
  }, [rpc.resume]);

  return {
    rpc,
    lanes: snapshot.lanes,
    events: snapshot.events,
    metrics: snapshot.metrics,
    isPaused,
    pause,
    resume,
  };
}
