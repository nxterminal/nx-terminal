import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import HackAnimation, { hackAnimationAlwaysSkip } from './HackAnimation';

// HackModal — Phase 5.15. Compact, pure-terminal redesign of the hack
// console. ~500×400, command-line styling: a mode is picked from inline
// chips (not tabs), the PLAYER mode searches + selects a target, and
// EXECUTE swaps the body for the inline HackAnimation (no takeover).
//
// Props unchanged from Phase 5.14 so MyDevs needs no edits:
//   dev, address, onResult(res), onError(detail), onClose()
// onResult / onError hand the outcome up (parent shows HackResultModal
// / HackErrorModal); onClose is a user-initiated close, select-phase
// only — once executing, the hack is committed.

const MINT = '#44ffaa';
const BG = '#0a0a0e';

const MODES = {
  player: {
    cost: 25,
    desc: '> search and target a specific developer.',
  },
  mainframe: {
    cost: 15,
    desc: '> hacking the mainframe extracts $NXT from the void.',
  },
  random: {
    cost: 25,
    desc: '> hacking random selects a target from active devs.',
  },
};
const MODE_ORDER = ['player', 'mainframe', 'random'];

export default function HackModal({ dev, address, onResult, onError, onClose }) {
  const [mode, setMode] = useState('player');
  const [phase, setPhase] = useState('select'); // 'select' | 'executing'

  // PLAYER search/select state.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState(null); // selected nickname
  const debounceRef = useRef(null);
  const seqRef = useRef(0);
  const inputRef = useRef(null);

  // Executing state.
  const [response, setResponse] = useState(null); // null=pending | {ok,...}
  const [animationDone, setAnimationDone] = useState(false);
  const [execTarget, setExecTarget] = useState('');
  const skipAnimRef = useRef(false);
  const finalizedRef = useRef(false);
  const [execHover, setExecHover] = useState(false);

  // Esc closes — select phase only.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && phase === 'select') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  useEffect(() => {
    if (mode === 'player' && phase === 'select' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode, phase]);

  // PLAYER search — 300ms debounce, stale responses dropped by seq.
  useEffect(() => {
    if (mode !== 'player') return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    setSearchError('');
    setSelected(null); // query changed → drop any prior target selection
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
        setSearchError(err?.message || 'search failed.');
        setResults([]);
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mode, address]);

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

  function changeMode(m) {
    setMode(m);
    setSelected(null);
  }

  function startHack() {
    let kind;
    let nickname = null;
    let animTarget;
    if (mode === 'player') {
      if (!selected) return;
      kind = 'player';
      nickname = selected;
      animTarget = selected;
    } else if (mode === 'mainframe') {
      kind = 'mainframe';
      animTarget = 'system';
    } else {
      kind = 'random';
      animTarget = 'random';
    }
    skipAnimRef.current = hackAnimationAlwaysSkip(address);
    setExecTarget(animTarget);
    setResponse(null);
    setAnimationDone(skipAnimRef.current); // skipped → animation already "done"
    setPhase('executing');

    const request = kind === 'mainframe'
      ? api.hackMainframe(address, dev.token_id)
      : api.hackPlayer(address, dev.token_id, nickname);
    request
      .then((res) => setResponse({ ok: true, data: res }))
      .catch((err) => setResponse({ ok: false, detail: err?.detail, err }));
  }

  const cost = MODES[mode].cost;
  const canExecute = mode !== 'player' || !!selected;
  const q = query.trim();

  // ── Executing phase — inline animation or minimal processing view ──
  if (phase === 'executing') {
    const showAnimation = !skipAnimRef.current && !animationDone;
    return (
      <Backdrop onClose={null}>
        <Dialog>
          {showAnimation ? (
            <HackAnimation
              mode={mode}
              target={execTarget}
              responseReady={response != null}
              onDone={() => setAnimationDone(true)}
              walletAddress={address}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', background: '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'VT323', monospace", fontSize: 'var(--text-xl)',
              color: MINT, textShadow: `0 0 6px ${MINT}66`,
            }}>
              {'> processing...'}
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
          padding: '8px 12px', borderBottom: `1px solid ${MINT}33`, flexShrink: 0,
        }}>
          <span style={{ color: MINT, fontSize: 'var(--text-lg)', letterSpacing: 1 }}>
            {'> HACK_TERMINAL_v5.13'}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: `1px solid ${MINT}55`, color: MINT,
            fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
            cursor: 'pointer', padding: '0 6px', lineHeight: 1.4,
          }}>X</button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px',
          color: MINT, fontSize: 'var(--text-lg)', lineHeight: 1.7,
        }}>
          {/* Mode chips */}
          <div>{'> select target_type:'}</div>
          <div style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
            {MODE_ORDER.map((m) => {
              const active = m === mode;
              return (
                <button key={m} onClick={() => changeMode(m)} style={{
                  fontFamily: "'VT323', monospace", fontSize: 'var(--text-base)',
                  cursor: 'pointer', padding: '2px 10px',
                  background: active ? MINT : 'transparent',
                  color: active ? '#000' : MINT,
                  border: `1px solid ${active ? MINT : MINT + '44'}`,
                }}>{`[ ${m} ]`}</button>
              );
            })}
          </div>

          {/* Cost */}
          <div style={{ marginBottom: 12 }}>
            {'> cost: '}
            <span style={{ color: '#ffdd44' }}>{`${cost} $NXT`}</span>
          </div>

          {/* Mode-specific area */}
          {mode === 'player' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{'> target:'}</span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="nickname or 0x wallet"
                  spellCheck={false}
                  autoComplete="off"
                  style={{
                    flex: 1, background: '#000', border: `1px solid ${MINT}44`,
                    color: MINT, caretColor: MINT, outline: 'none',
                    fontFamily: "'VT323', monospace", fontSize: 'var(--text-lg)',
                    padding: '2px 6px',
                  }}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <PlayerResults
                  q={q}
                  searching={searching}
                  searchError={searchError}
                  results={results}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.85 }}>{MODES[mode].desc}</div>
          )}
        </div>

        {/* EXECUTE */}
        <div style={{
          flexShrink: 0, padding: '10px', borderTop: `1px solid ${MINT}33`,
          display: 'flex', justifyContent: 'center',
        }}>
          <button
            onClick={startHack}
            disabled={!canExecute}
            onMouseEnter={() => setExecHover(true)}
            onMouseLeave={() => setExecHover(false)}
            style={{
              fontFamily: "'VT323', monospace", fontSize: 'var(--text-lg)',
              letterSpacing: 1, padding: '6px 22px',
              border: `1px solid ${canExecute ? MINT : '#444'}`,
              cursor: canExecute ? 'pointer' : 'not-allowed',
              background: canExecute && execHover ? MINT : 'transparent',
              color: !canExecute ? '#555' : (execHover ? '#000' : MINT),
              textShadow: canExecute && !execHover ? `0 0 6px ${MINT}55` : 'none',
            }}
          >{'[ > EXECUTE_HACK ]'}</button>
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
        background: 'rgba(0,0,0,0.75)', display: 'flex',
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
      width: 'min(500px, 90vw)', height: 'min(400px, 80vh)',
      background: BG, border: `1px solid ${MINT}66`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'VT323', monospace",
      boxShadow: `0 0 32px ${MINT}22`,
    }}>
      {children}
    </div>
  );
}

// ── PLAYER results — compact terminal output lines ────────────────

function PlayerResults({ q, searching, searchError, results, selected, onSelect }) {
  if (q.length === 0) return null;
  const dim = { color: `${MINT}88` };
  if (q.length < 3) return <div style={dim}>{'  > type at least 3 chars...'}</div>;
  if (searching) return <div style={dim}>{'  > searching...'}</div>;
  if (searchError) return <div style={{ color: '#ff6666' }}>{`  > ${searchError}`}</div>;
  if (results.length === 0) {
    return <div style={dim}>{`  > no targets found for '${q}'.`}</div>;
  }
  return (
    <div>
      {results.map((r) => {
        const hackable = !!r.has_active_devs;
        const isSel = selected === r.nickname;
        return (
          <div
            key={r.nickname}
            onClick={() => { if (hackable) onSelect(r.nickname); }}
            title={hackable ? `select ${r.nickname}` : 'no active devs'}
            style={{
              padding: '1px 4px', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
              cursor: hackable ? 'pointer' : 'not-allowed',
              background: isSel ? MINT : 'transparent',
              color: isSel ? '#000' : (hackable ? MINT : '#5a6a64'),
            }}
          >
            {'  > '}
            <span>{r.nickname}</span>
            {'  '}
            <span style={{ opacity: 0.7 }}>{`[${r.corp || '???'}]`}</span>
            {' '}
            <span style={{ opacity: 0.7 }}>
              {`(${r.dev_count} dev${r.dev_count === 1 ? '' : 's'})`}
            </span>
            {!hackable && <span style={{ opacity: 0.7 }}>{'  -- no active devs'}</span>}
          </div>
        );
      })}
    </div>
  );
}
