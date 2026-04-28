import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../services/api';
import {
  addBuildingForDev,
  applyEvent,
  syncFleet,
} from '../renderer/nxCityRenderer.js';
import {
  POLL_DEVS_MS,
  POLL_STATS_MS,
  POLL_FEED_MS,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_CAP_MS,
} from '../../../constants/nxCity';

const MAX_DEBUG_WS_MSGS = 5;
const ERROR_SENTINEL_THRESHOLD = 5;

function reportSentinel(detail) {
  if (typeof window === 'undefined') return;
  if (window.__nxCityErrorReported) return;
  window.__nxCityErrorReported = true;
  // eslint-disable-next-line no-console
  console.error('[NX CITY] sustained errors after 5+ failures:', detail);
}

function lower(addr) {
  if (!addr) return null;
  const s = String(addr).toLowerCase();
  return s.length ? s : null;
}

function dispatchFeedEvent(rc, msg, devCountRef) {
  const type = String(msg.type || msg.action || msg.event || '').toUpperCase();
  if (!type) return;
  const devId = msg.token_id ?? msg.dev_id ?? msg.actor_id ?? msg.actor_token_id ?? null;
  const targetId = msg.target_token_id ?? msg.target_dev_id ?? null;
  const owner = lower(msg.owner_address || msg.owner || msg.wallet);

  if (type.includes('MINT')) {
    if (devId != null) {
      const next = Math.max(devCountRef.current, Number(devId) || 0);
      addBuildingForDev(rc, devId, owner, next);
      devCountRef.current = next;
    }
  } else if (type.includes('TRANSFER')) {
    if (devId != null && targetId != null) applyEvent(rc, 'transfer', devId, targetId);
  } else if (type.includes('PROTOCOL')) {
    if (devId != null) applyEvent(rc, 'protocol', devId);
  } else if (type.includes('MISSION')) {
    if (devId != null) applyEvent(rc, 'mission', devId);
  } else if (type.includes('HACK')) {
    if (devId != null && targetId != null) applyEvent(rc, 'hack', devId, targetId);
  } else if (type.includes('AI')) {
    if (devId != null) applyEvent(rc, 'ai', devId);
  }
}

/**
 * useNxCity — owns the live data flow for the city.
 *
 * Receives the render context (rc) created by NXCity.jsx and mutates
 * rc.state directly via the renderer's pure functions (addBuildingForDev,
 * applyEvent). React state in this hook is limited to values that drive
 * panel re-renders (devCount, stats, wsConnected, lastError, devs).
 *
 * Owns three async loops with explicit cleanup:
 *   1) Devs + count poll every 30s (idempotent, diffs by token_id).
 *   2) Stats poll every 10s.
 *   3) Dedicated WebSocket to /ws/feed with exponential reconnect
 *      backoff and a 6s polling fallback while disconnected.
 */
export function useNxCity(rc) {
  const [devs, setDevs] = useState([]);
  const [devCount, setDevCount] = useState(0);
  const [stats, setStats] = useState({
    totalNxt: 0,
    protocols: 0,
    missions: 0,
    hacks: 0,
    ais: 0,
    nxtEarned24h: 0,
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);

  const devCountRef = useRef(0);
  const errorCountRef = useRef(0);
  const wsDebugCountRef = useRef(0);
  const processedEventsRef = useRef(new Set());

  const trackError = useCallback((source, err) => {
    errorCountRef.current += 1;
    const detail = `${source}: ${err?.message || err}`;
    setLastError(detail);
    if (errorCountRef.current > ERROR_SENTINEL_THRESHOLD) {
      reportSentinel(detail);
    }
  }, []);

  const trackOk = useCallback(() => {
    if (errorCountRef.current !== 0) errorCountRef.current = 0;
    setLastError((prev) => (prev == null ? prev : null));
  }, []);

  // ---- Devs + count polling ----
  useEffect(() => {
    if (!rc) return undefined;
    let cancelled = false;

    async function loadDevs() {
      try {
        const results = await Promise.allSettled([
          api.getDevs({ limit: 500 }),
          api.getDevCount(),
        ]);
        if (cancelled) return;
        const [devsRes, countRes] = results;

        if (devsRes.status === 'fulfilled') {
          const data = devsRes.value;
          const list = Array.isArray(data) ? data : (data?.devs || data?.results || []);
          for (const d of list) {
            const id = d.token_id ?? d.id;
            if (id == null) continue;
            if (rc.state.buildingsByDevId.has(id)) continue;
            const owner = lower(d.owner_address || d.owner || d.wallet);
            const next = Math.max(devCountRef.current, Number(id) || 0);
            addBuildingForDev(rc, id, owner, next);
            devCountRef.current = next;
          }
          setDevs(list);
          syncFleet(rc, devCountRef.current);
        }

        if (countRes.status === 'fulfilled') {
          const v = countRes.value;
          const n = Number(v?.count ?? v?.total ?? v?.devs ?? v) || 0;
          if (n > devCountRef.current) devCountRef.current = n;
        }
        setDevCount(devCountRef.current);

        if (devsRes.status === 'rejected' && countRes.status === 'rejected') {
          trackError('devs', devsRes.reason);
        } else {
          trackOk();
        }
      } catch (err) {
        if (!cancelled) trackError('devs', err);
      }
    }

    loadDevs();
    const id = setInterval(loadDevs, POLL_DEVS_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [rc, trackError, trackOk]);

  // ---- Stats polling ----
  useEffect(() => {
    if (!rc) return undefined;
    let cancelled = false;

    async function loadStats() {
      try {
        const data = await api.getSimulationStats();
        if (cancelled) return;
        if (data && typeof data === 'object') {
          setStats((prev) => ({
            totalNxt:    data.total_nxt    ?? data.totalNxt   ?? prev.totalNxt,
            protocols:   data.protocols    ?? prev.protocols,
            missions:    data.missions     ?? prev.missions,
            hacks:       data.hacks        ?? prev.hacks,
            ais:         data.ais          ?? prev.ais,
            nxtEarned24h: data.nxt_earned_24h ?? data.nxtEarned24h ?? prev.nxtEarned24h,
          }));
          trackOk();
        }
      } catch (err) {
        if (!cancelled) trackError('stats', err);
      }
    }

    loadStats();
    const id = setInterval(loadStats, POLL_STATS_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [rc, trackError, trackOk]);

  // ---- WebSocket /ws/feed with reconnect + polling fallback ----
  useEffect(() => {
    if (!rc) return undefined;
    let cancelled = false;
    let ws = null;
    let pollFallbackId = null;
    let reconnectDelay = WS_RECONNECT_BASE_MS;
    let reconnectTimer = null;

    function consume(msg) {
      const key =
        msg.id ??
        msg.event_id ??
        `${msg.timestamp || ''}_${msg.type || msg.action || ''}_${msg.token_id ?? msg.dev_id ?? ''}`;
      if (key && processedEventsRef.current.has(key)) return;
      if (key) {
        processedEventsRef.current.add(key);
        if (processedEventsRef.current.size > 500) {
          const first = processedEventsRef.current.values().next().value;
          processedEventsRef.current.delete(first);
        }
      }
      dispatchFeedEvent(rc, msg, devCountRef);
    }

    function startPollFallback() {
      if (pollFallbackId || cancelled) return;
      const tick = async () => {
        try {
          const data = await api.getFeed(50);
          if (cancelled) return;
          const feed = Array.isArray(data) ? data : (data?.feed || data?.actions || data?.events || []);
          for (const ev of feed) consume(ev);
        } catch (err) {
          if (!cancelled) trackError('feed-poll', err);
        }
      };
      tick();
      pollFallbackId = setInterval(tick, POLL_FEED_MS);
    }

    function stopPollFallback() {
      if (pollFallbackId) {
        clearInterval(pollFallbackId);
        pollFallbackId = null;
      }
    }

    function scheduleReconnect() {
      if (cancelled || reconnectTimer) return;
      const delay = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * 2, WS_RECONNECT_CAP_MS);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    function connect() {
      if (cancelled) return;
      let socket;
      try {
        socket = new WebSocket(api.wsUrl);
      } catch (err) {
        trackError('ws-create', err);
        scheduleReconnect();
        return;
      }
      ws = socket;

      socket.onopen = () => {
        if (cancelled) return;
        setWsConnected(true);
        reconnectDelay = WS_RECONNECT_BASE_MS;
        stopPollFallback();
        trackOk();
      };

      socket.onmessage = (ev) => {
        if (cancelled) return;
        if (ev.data === 'pong' || ev.data === 'ping') return;
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (wsDebugCountRef.current < MAX_DEBUG_WS_MSGS) {
          wsDebugCountRef.current += 1;
          // eslint-disable-next-line no-console
          console.debug('[NX CITY] ws msg', wsDebugCountRef.current, msg);
        }
        consume(msg);
      };

      socket.onerror = () => {
        // close handler does the bookkeeping
      };

      socket.onclose = () => {
        if (cancelled) return;
        setWsConnected(false);
        startPollFallback();
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      cancelled = true;
      stopPollFallback();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          ws.close();
        } catch {
          // ignore
        }
      }
      setWsConnected(false);
    };
  }, [rc, trackError, trackOk]);

  return {
    buildings: rc?.state?.buildingsByDevId ?? null,
    devs,
    devCount,
    stats,
    wsConnected,
    lastError,
  };
}
