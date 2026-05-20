import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import HackAnimation, { hackAnimationAlwaysSkip } from './HackAnimation';

// HackModal — Phase 5.14. Unified hack experience: one big dark-terminal
// window with three tabs (MAINFRAME / PLAYER / RANDOM), replacing the
// old HACK dropdown + small HackTargetingModal.
//
// Flow: pick a tab → EXECUTE → the request fires and the HackAnimation
// plays in parallel → when BOTH finish, the modal hands the result up
// via onResult / onError (the parent then shows HackResultModal /
// HackErrorModal). onClose is only for a user-initiated close during
// the select phase — once executing, the modal is committed.

const GREEN = '#44ffaa';
const ACCENT = '#44ccff';

const TABS = [
  { id: 'mainframe', label: 'MAINFRAME', cost: 15,
    desc: 'Hack the system. Steal $NXT from the void.' },
  { id: 'player', label: 'PLAYER', cost: 25,
    desc: 'Search and target a specific developer.' },
  { id: 'random', label: 'RANDOM', cost: 25,
    desc: 'Classic chaos. Random target from the network.' },
];

export default function HackModal({ dev, address, onResult, onError, onClose }) {
  const [tab, setTab] = useState('player'); // PLAYER is the default tab
  const [phase, setPhase] = useState('select'); // 'select' | 'executing'

  // PLAYER-tab search state.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef(null);
  const seqRef = useRef(0);
  const inputRef = useRef(null);

  // Executing-phase state.
  const [response, setResponse] = useState(null); // null=pending | {ok,data} | {ok:false,...}
  const [animationDone, setAnimationDone] = useState(false);
  const skipAnimationRef = useRef(false);
  const finalizedRef = useRef(false);

  // Esc closes the modal — select phase only (executing is committed).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && phase === 'select') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  useEffect(() => {
    if (tab === 'player' && phase === 'select' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [tab, phase]);

  // PLAYER search — 300ms debounce, stale responses dropped by seq.
  useEffect(() => {
    if (tab !== 'player') return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    setSearchError('');
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const mySeq = ++seqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.searchPlayers(q, address);
        if (mySeq !== seqRef.current) return; // a newer query superseded this
        setResults(Array.isArray(res) ? res : []);
        setSearching(false);
      } catch (err) {
        if (mySeq !== seqRef.current) return;
        setSearchError(err?.message || 'Search failed.');
        setResults([]);
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, tab, address]);

  // Finalize once the animation AND the response are both ready.
  useEffect(() => {
    if (phase !== 'executing' || finalizedRef.current) return;
    if (!animationDone || response == null) return;
    finalizedRef.current = true;
    if (response.ok) {
      onResult(response.data);
    } else if (response.detail) {
      onError(response.detail);
    } else {
      onError({
        error: 'hack_failed',
        message: response.err?.message || 'Hack failed. Try again.',
      });
    }
  }, [phase, animationDone, response, onResult, onError]);

  function startHack(kind, targetNickname) {
    skipAnimationRef.current = hackAnimationAlwaysSkip(address);
    setResponse(null);
    // When the animation is skipped, treat it as already-done so the
    // finalize effect only waits on the network response.
    setAnimationDone(skipAnimationRef.current);
    setPhase('executing');

    const request = kind === 'mainframe'
      ? api.hackMainframe(address, dev.token_id)
      : api.hackPlayer(address, dev.token_id, targetNickname || null);

    request
      .then((res) => setResponse({ ok: true, data: res }))
      .catch((err) => setResponse({ ok: false, detail: err?.detail, err }));
  }

  const activeTab = TABS.find((t) => t.id === tab);
  const q = query.trim();

  // ── Executing phase — animation or a minimal "processing" view ──
  if (phase === 'executing') {
    const showAnimation = !skipAnimationRef.current && !animationDone;
    return (
      <Backdrop onClose={null}>
        <Dialog>
          {showAnimation ? (
            <HackAnimation
              responseReady={response != null}
              onDone={() => setAnimationDone(true)}
              walletAddress={address}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', background: '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'VT323', monospace", fontSize: 'var(--text-xl)',
              color: GREEN, textShadow: `0 0 6px ${GREEN}66`,
            }}>
              {'> PROCESSING...'}
            </div>
          )}
        </Dialog>
      </Backdrop>
    );
  }

  // ── Select phase ────────────────────────────────────────────────
  return (
    <Backdrop onClose={onClose}>
      <Dialog>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: '#0a0a1e',
          borderBottom: `2px solid ${ACCENT}`, flexShrink: 0,
        }}>
          <span style={{ fontSize: 'var(--text-xl)', letterSpacing: 2, color: ACCENT }}>
            {'> HACK'}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #555', color: '#cfcfcf',
            fontFamily: "'VT323', monospace", fontSize: 'var(--text-lg)',
            cursor: 'pointer', padding: '2px 8px',
          }}>X</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexShrink: 0, background: '#0a0a1e' }}>
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer',
                background: active ? '#1a1a2e' : 'transparent',
                color: active ? ACCENT : 'var(--text-secondary)',
                fontFamily: "'VT323', monospace", fontSize: 'var(--text-lg)',
                letterSpacing: 1,
                borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
              }}>{t.label}</button>
            );
          })}
        </div>

        {/* Cost + descriptor */}
        <div style={{
          padding: '8px 14px', flexShrink: 0,
          fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
          color: 'var(--text-secondary)', borderBottom: '1px solid #2a2a4e',
        }}>
          <span style={{ color: '#ffdd44' }}>{activeTab.cost} $NXT</span>
          {' — '}{activeTab.desc}
        </div>

        {/* Tab body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
          {tab === 'player' && (
            <PlayerTab
              query={query}
              setQuery={setQuery}
              inputRef={inputRef}
              searching={searching}
              searchError={searchError}
              results={results}
              q={q}
              onExecute={(nickname) => startHack('player', nickname)}
            />
          )}
          {tab === 'mainframe' && (
            <SimpleTab
              body="Breach the corporate mainframe and siphon $NXT straight from the system treasury. No rival player involved — success scales with your dev's hacking skill."
              buttonLabel="EXECUTE MAINFRAME HACK"
              onExecute={() => startHack('mainframe')}
            />
          )}
          {tab === 'random' && (
            <SimpleTab
              body="Random target from active developers across the network, excluding your own devs. The classic matchmaker — you don't pick who, the network does."
              buttonLabel="EXECUTE RANDOM HACK"
              onExecute={() => startHack('random')}
            />
          )}
        </div>
      </Dialog>
    </Backdrop>
  );
}

// ── Shared chrome ─────────────────────────────────────────────────

function Backdrop({ children, onClose }) {
  return (
    <div
      onClick={onClose || undefined}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      {children}
    </div>
  );
}

function Dialog({ children }) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      width: 'min(880px, 80vw)', height: 'min(600px, 82vh)',
      background: '#1a1a2e', border: `2px solid ${ACCENT}55`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'VT323', monospace",
      boxShadow: 'inset -3px -3px 0 #0a0a1e, inset 3px 3px 0 #2a2a4e, 0 0 36px rgba(68,204,255,0.14)',
    }}>
      {children}
    </div>
  );
}

// ── MAINFRAME / RANDOM tab — descriptor + one big EXECUTE button ───

function SimpleTab({ body, buttonLabel, onExecute }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
      textAlign: 'center',
    }}>
      <div style={{
        maxWidth: 420, color: '#cfcfcf', fontSize: 'var(--text-lg)',
        lineHeight: 1.6,
      }}>{body}</div>
      <button onClick={onExecute} style={{
        background: '#2a2a4e', border: `2px solid ${GREEN}`, color: GREEN,
        fontFamily: "'VT323', monospace", fontSize: 'var(--text-xl)',
        letterSpacing: 1, cursor: 'pointer', padding: '12px 28px',
        textShadow: `0 0 6px ${GREEN}55`,
      }}>{buttonLabel}</button>
    </div>
  );
}

// ── PLAYER tab — search box + result cards ────────────────────────

function PlayerTab({
  query, setQuery, inputRef, searching, searchError, results, q, onExecute,
}) {
  let emptyMessage = '';
  if (q.length === 0) {
    emptyMessage = 'Search by nickname to select a target.';
  } else if (q.length < 3) {
    emptyMessage = 'Type at least 3 characters.';
  } else if (searching) {
    emptyMessage = 'Searching…';
  } else if (searchError) {
    emptyMessage = searchError;
  } else if (results.length === 0) {
    emptyMessage = `No players found matching '${q}'.`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search nickname or 0x wallet…"
        spellCheck={false}
        autoComplete="off"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px',
          background: '#0a0a1e', border: `1px solid ${ACCENT}55`, color: '#cfcfcf',
          fontFamily: "'VT323', monospace", fontSize: 'var(--text-xl)', outline: 'none',
        }}
      />
      {emptyMessage && (
        <div style={{
          color: searchError ? '#ff6666' : 'var(--text-secondary)',
          fontSize: 'var(--text-lg)', padding: '8px 2px',
        }}>{emptyMessage}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {results.map((r) => (
          <TargetCard key={r.nickname} result={r} onExecute={onExecute} />
        ))}
      </div>
    </div>
  );
}

function TargetCard({ result, onExecute }) {
  const hackable = !!result.has_active_devs;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, padding: '12px 14px',
      background: '#0a0a1e', border: '1px solid #2a2a4e',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 'var(--text-xl)', color: GREEN,
            textShadow: `0 0 6px ${GREEN}55`,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{result.nickname}</span>
          {result.corp && (
            <span style={{
              flexShrink: 0, fontSize: 'var(--text-sm)', color: '#ffdd44',
              border: '1px solid #ffdd4455', padding: '1px 6px',
            }}>{result.corp}</span>
          )}
        </div>
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginTop: 2 }}>
          {result.dev_count} dev{result.dev_count === 1 ? '' : 's'}
        </div>
      </div>
      <button
        onClick={() => { if (hackable) onExecute(result.nickname); }}
        disabled={!hackable}
        title={hackable ? `Hack ${result.nickname}` : 'no active devs'}
        style={{
          flexShrink: 0,
          background: hackable ? '#2a2a4e' : '#141422',
          border: `2px solid ${hackable ? '#ff6644' : '#444'}`,
          color: hackable ? '#ff8866' : '#555',
          fontFamily: "'VT323', monospace", fontSize: 'var(--text-lg)',
          letterSpacing: 1, padding: '8px 16px',
          cursor: hackable ? 'pointer' : 'not-allowed',
        }}
      >EXECUTE HACK</button>
    </div>
  );
}
