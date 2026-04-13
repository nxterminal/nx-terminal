import { useState, useEffect } from 'react';

// .Mega Domains resolver — https://dotmega.domains
//
// Resolves EVM wallet addresses to their registered .mega name (e.g.
// "bread.mega"). Used across the app to replace truncated wallet labels
// with human-readable names wherever possible.
//
// Design notes:
// - Two layers of cache: an in-memory Map for same-session dedup, and
//   localStorage with a 24h TTL so page reloads don't re-hit the API.
// - Negative caching: a wallet with no registered name (or a 5xx/429/
//   timeout) is still cached as null, so we don't retry on every render.
// - 429 responses cache null for THAT wallet only — the rest of the app
//   keeps resolving normally.
// - The API returns `{error: "not found"}` as a 200 body for misses; the
//   optional-chain `data?.name` handles that case by falling through to
//   null without blowing up.

const MEGA_API = 'https://api.dotmega.domains/resolve';
const LS_KEY = 'nx-mega-names';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Same-session in-memory cache: addr (lowercased) -> name | null
const memCache = new Map();

// Hydrate memCache from localStorage on module load so the first useMegaName
// in a new page session is already warm for whatever the user saw last time.
function loadPersistentCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const now = Date.now();
    for (const [addr, entry] of Object.entries(parsed || {})) {
      if (entry && typeof entry.ts === 'number' && now - entry.ts < TTL_MS) {
        memCache.set(addr, entry.name ?? null);
      }
    }
  } catch { /* corrupted json — ignore */ }
}

function persist(addr, name) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    obj[addr] = { name: name ?? null, ts: Date.now() };
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch { /* quota exceeded / json corrupted — best effort */ }
}

if (typeof window !== 'undefined') {
  loadPersistentCache();
}

async function fetchName(addr, signal) {
  const res = await fetch(`${MEGA_API}?address=${addr}`, { signal });
  // Any non-2xx (including 429) lands in negative cache for this wallet.
  if (!res.ok) return null;
  const data = await res.json();
  // API returns {error: "not found"} on miss — optional-chain handles it.
  return data?.name || null;
}

/**
 * React hook — resolves a single address.
 * Returns null until the first fetch finishes, then the .mega name or null.
 * Updates in place when the cache already has a value (no flicker).
 */
export function useMegaName(address) {
  const addr = address ? address.toLowerCase() : null;
  const [name, setName] = useState(() => (addr && memCache.has(addr) ? memCache.get(addr) : null));
  // Track the last addr we initialized state for, so we can reset the
  // name synchronously when the user switches wallets. This is the
  // React-documented pattern for deriving state from props without
  // setState-in-effect: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [lastAddr, setLastAddr] = useState(addr);
  if (lastAddr !== addr) {
    setLastAddr(addr);
    setName(addr && memCache.has(addr) ? memCache.get(addr) : null);
  }

  useEffect(() => {
    if (!addr) return undefined;
    // Already resolved (including known-null) — the derived-state block
    // above already synced `name` from the cache, so skip the fetch.
    if (memCache.has(addr)) return undefined;

    const controller = new AbortController();
    fetchName(addr, controller.signal)
      .then(resolved => {
        memCache.set(addr, resolved);
        persist(addr, resolved);
        setName(resolved);
      })
      .catch(err => {
        if (err?.name === 'AbortError') return;
        // Network error, DNS fail, etc. — negative-cache and move on.
        memCache.set(addr, null);
        persist(addr, null);
        setName(null);
      });

    return () => controller.abort();
  }, [addr]);

  return name;
}

/**
 * Non-hook resolver — use inside batch loops (e.g. WorldChat message list,
 * Leaderboard rows). Shares the same memCache + localStorage as the hook.
 */
export async function resolveMegaName(address) {
  if (!address) return null;
  const addr = address.toLowerCase();
  if (memCache.has(addr)) return memCache.get(addr);
  try {
    const name = await fetchName(addr);
    memCache.set(addr, name);
    persist(addr, name);
    return name;
  } catch {
    memCache.set(addr, null);
    persist(addr, null);
    return null;
  }
}

/**
 * Display helper: prefers the .mega name, falls back to the truncated
 * 0x… format, and returns '???' if both are missing.
 */
export function displayName(megaName, address) {
  if (megaName) return megaName;
  if (!address) return '???';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
