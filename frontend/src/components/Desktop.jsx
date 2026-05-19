import { useEffect, useState, useCallback, useRef } from 'react';
import DesktopIcon from './DesktopIcon';
import Taskbar from './Taskbar';
import WindowManager from './WindowManager';
import NXAssistant from './NXAssistant';
import DailyStreakPopup from './DailyStreakPopup';
import WorldEventBanner from './WorldEventBanner';
import { playSpendSound, playGainSound } from '../utils/sound';

// ── Global floating stat animation (for achievements, etc.) ──
function GlobalStatAnimation() {
  const [anims, setAnims] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      const changes = e.detail;
      if (!Array.isArray(changes) || !changes.length) return;
      const items = changes.map((c, i) => ({
        id: Date.now() + i, text: `${c.amount > 0 ? '+' : ''}${c.amount} ${c.stat || '$NXT'}`,
        color: c.type === 'gain' ? '#ffdd44' : '#ff4444', delay: i * 200,
      }));
      setAnims(prev => [...prev, ...items]);
      setTimeout(() => setAnims(prev => prev.filter(a => !items.includes(a))), 2000);
      // Play one sound per event — helpers no-op when sound is muted.
      if (changes.some(c => c.type === 'spend')) playSpendSound();
      else if (changes.some(c => c.type === 'gain')) playGainSound();
    };
    window.addEventListener('nx-stat-animation', handler);
    return () => window.removeEventListener('nx-stat-animation', handler);
  }, []);
  if (!anims.length) return null;
  return (
    <div style={{ position: 'fixed', top: '35%', left: 0, right: 0, pointerEvents: 'none', zIndex: 10600, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {anims.map(a => (
        <div key={a.id} style={{
          fontFamily: "'VT323', monospace", fontSize: 22, fontWeight: 'bold',
          color: a.color, textShadow: '1px 1px 0 #000, -1px -1px 0 #000',
          animation: `float-up-fade 1.5s ease-out ${a.delay}ms forwards`, opacity: 0,
        }}>{a.text}</div>
      ))}
    </div>
  );
}
import ErrorPopup from './ErrorPopup';
import BSOD from './BSOD';
import Screensaver from './Screensaver';
import NicknameOnboardingModal from './NicknameOnboardingModal';
import { useWindowManager } from '../hooks/useWindowManager';
import { useDevCount } from '../hooks/useDevCount';
import { useWallet } from '../hooks/useWallet';
import { useChatModal } from '../contexts/ChatContext';
import { isInNXSoulsBeta } from '../config/betaFeatures';
import { SPRKLS_OPEN_WINDOW_EVENT } from './sprkls/SprklWindow';
import { api } from '../services/api';

const DESKTOP_ICONS = [
  { id: 'nx-terminal',     icon: '>_',         label: 'NX Terminal',     desc: 'Main OS shell — handbook, lore and system info' },
  { id: 'live-feed',       icon: '>>',         label: 'Live Feed',       desc: 'Global group-chat of every minted dev' },
  { id: 'world-chat',      icon: '#',          label: 'World Chat',      desc: 'Public chat room for all players' },
  { id: 'leaderboard',     icon: '*',          label: 'Leaderboard',     desc: 'Top devs, corporations and players' },
  { id: 'protocol-market', icon: '$',          label: 'Protocol Market', desc: 'Buy, sell and track active protocols' },
  { id: 'ai-lab',          icon: '~',          label: 'AI Lab',          desc: 'Vote on rogue Absurd AIs built by devs' },
  { id: 'my-devs',         icon: '=',          label: 'My Devs',         desc: 'Manage your minted dev roster' },
  { id: 'nxt-wallet',      icon: '$',          label: 'NXT Wallet',      desc: 'Claim salaries and move $NXT on-chain' },
  { id: 'inbox',           icon: 'M',          label: 'Inbox',           desc: 'Notifications, streaks and event mail' },
  { id: 'hire-devs',       icon: '+',          label: 'Mint/Hire Devs',  desc: 'Recruit new AI developers for your corp' },
  { id: 'notepad',         icon: 'N',          label: 'Notepad',         desc: 'Local scratchpad — never syncs to chain' },
  { id: 'recycle-bin',     icon: 'x',          label: 'Recycle Bin',     desc: 'Burned devs, refunded protocols, regrets' },
  { id: 'corp-wars',       icon: '\u2694',     label: 'Corp Wars',       desc: 'Inter-corporation raid and reputation war' },
  { id: 'control-panel',   icon: '::',         label: 'Settings',        desc: 'Wallpaper, theme, assistant and preferences' },
  { id: 'flow',            icon: '\u25C6',     label: 'Flow',            desc: 'Trader flow analyser', hidden: true },
  { id: 'nadwatch',        icon: '\u{1F441}',  label: 'Nadwatch',        desc: 'Watcher overlay', hidden: true },
  { id: 'parallax',        icon: '\u{2263}',   label: 'Parallax',        desc: 'Parallax visualiser', hidden: true },
  { id: 'monad-city',      icon: '',           label: 'Mega City',       desc: '3D city visualisation of the simulation' },
  { id: 'dev-academy',     icon: 'DA',         label: 'NX Dev Academy',  desc: 'Learn MegaETH and Solidity with your devs' },
  { id: 'monad-build',     icon: '\u26A1',     label: 'Mega Build',      desc: 'Ship and deploy contracts on-chain' },
  { id: 'netwatch',        icon: '',           label: 'MegaWatch',       desc: 'Real-time MegaETH activity monitor' },
  { id: 'mega-sentinel',   icon: '\u{1F6E1}',  label: 'Mega Sentinel',   desc: 'Network firewall and threat sentinel' },
  { id: 'mission-control', icon: '\u{1F4CB}',  label: 'Mission Control', desc: 'Assign your devs to timed missions' },
  { id: 'nxmarket',        icon: '\u{1F4CA}',  label: 'NX Market',       desc: 'Predict outcomes — bet $NXT on YES/NO markets' },
  { id: 'achievements',    icon: '\u2605',     label: 'Achievements',    desc: 'Unlock badges for milestones reached' },
  { id: 'dev-camp',        icon: '\u{1F393}',  label: 'Dev Camp',        desc: 'Train devs to boost their stats' },
  { id: 'nx-posts',        icon: '\u{1F426}',  label: 'NX Posts',        desc: 'Global feed — every Dev across every wallet posting in real time' },
];

function getWallpaperStyle() {
  const wp = localStorage.getItem('nx-wallpaper') || 'teal';
  const custom = localStorage.getItem('nx-custom-wallpaper');

  switch (wp) {
    case 'corporate-blue':
      return { background: 'linear-gradient(180deg, #0a1628 0%, #1a3a5c 50%, #0d2240 100%)' };
    case 'matrix':
      return { background: '#000000' };
    case 'clouds':
      return { background: 'linear-gradient(180deg, #4a90d9 0%, #87ceeb 40%, #b0d4f1 60%, #ffffff 100%)' };
    case 'terminal':
      return { background: '#000000' };
    case 'custom':
      if (custom) return { backgroundImage: `url(${custom})`, backgroundSize: 'cover', backgroundPosition: 'center' };
      return { background: '#008080' };
    default:
      return { background: '#008080' };
  }
}

function getWallpaperOverlay() {
  const wp = localStorage.getItem('nx-wallpaper') || 'teal';
  if (wp === 'matrix') return 'matrix';
  if (wp === 'terminal') return 'scanlines';
  return null;
}

// ── Notification toast popup (slides up from bottom-right) ──
function NotifPopup({ title, onClose, onOpen }) {
  const [hiding, setHiding] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { setHiding(true); setTimeout(onClose, 400); }, 8000);
    return () => clearTimeout(t);
  }, [onClose]);
  const dismiss = () => { setHiding(true); setTimeout(onClose, 400); };
  return (
    <div style={{
      position: 'fixed', bottom: 44, right: 10, width: 260, zIndex: 50,
      animation: hiding ? 'notifSlideDown 0.3s ease-in forwards' : 'notifSlideUp 0.4s ease-out',
    }}>
      <div style={{
        background: 'linear-gradient(90deg, #0a246a, #3a6ea5)', padding: '3px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 11, color: '#fff', fontFamily: "'VT323', monospace",
      }}>
        <span>New Message</span>
        <button onClick={dismiss} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff', fontSize: 10, cursor: 'pointer', padding: '0 4px',
          fontFamily: "'VT323', monospace",
        }}>✕</button>
      </div>
      <div onClick={() => { onOpen(); dismiss(); }} style={{
        background: '#1a1a2e', border: '1px solid #3a6ea5', borderTop: 'none',
        padding: '8px 10px', cursor: 'pointer', fontFamily: "'VT323', monospace",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>✉</span>
          <div>
            <div style={{ color: '#fff', fontSize: 12 }}>{title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 2 }}>Click to open Inbox</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitialUnreadCount() {
  const saved = localStorage.getItem('nx-inbox-emails');
  if (saved) {
    try { return JSON.parse(saved).filter(e => !e.read).length; } catch {}
  }
  const readIds = JSON.parse(localStorage.getItem('nx-inbox-read') || '[]');
  return readIds.includes('welcome-1') ? 0 : 1;
}

// Must stay in sync with ALLOWED_NOTIF_TYPES in windows/Inbox.jsx — the
// desktop unread badge should only count notifications the Inbox window
// actually displays, otherwise stray engine types (protocol_created,
// ai_created, etc.) pin the badge with no way for the user to clear it.
const INBOX_DISPLAY_TYPES = new Set([
  'broadcast', 'streak_claim', 'achievement', 'vip_welcome',
  'vip_alert', 'vip_mint', 'dev_deployed', 'hack_received',
  'world_event', 'prompt_response',
]);

export default function Desktop() {
  const {
    windows,
    openWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    moveWindow,
    resizeWindow,
    openDevProfile,
  } = useWindowManager();

  const { devCount, tier, nextTier } = useDevCount();
  const { address, isConnected } = useWallet();
  // Phase 3.6 — NX CHAT desktop icon (beta-gated). Calling
  // openChatModal() with no args triggers the auto-select of the
  // most recent active chat (Phase 3.5.2.7), or the empty-state UI
  // if the wallet has none yet.
  const { openChatModal } = useChatModal();

  const [wallpaperStyle, setWallpaperStyle] = useState(getWallpaperStyle);
  const [wallpaperOverlay, setWallpaperOverlay] = useState(getWallpaperOverlay);
  const [showBSOD, setShowBSOD] = useState(false);
  const [showScreensaver, setShowScreensaver] = useState(false);
  const [unreadCount, setUnreadCount] = useState(getInitialUnreadCount);
  const [iconScale, setIconScale] = useState(() => localStorage.getItem('nx-icon-scale') || 'medium');
  const [tooltipsEnabled, setTooltipsEnabled] = useState(
    () => localStorage.getItem('nx-tooltips') !== 'off',
  );
  const [clickMode, setClickMode] = useState(
    () => localStorage.getItem('nx-click-mode') || 'double',
  );
  const [notifPopup, setNotifPopup] = useState(null);
  // Phase 5.12 — onboarding modal. Opened either proactively (after
  // wallet connect we read /api/players/{addr} and check display_name)
  // or reactively (any backend call returns 409 nickname_required and
  // fetchJSON dispatches the `nx-nickname-required` window event).
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const idleTimerRef = useRef(null);
  const lastNotifCheck = useRef(0);

  useEffect(() => {
    const handleUnread = (e) => setUnreadCount(e.detail);
    const handleScale = (e) => setIconScale(e.detail);
    const handleTips = (e) => setTooltipsEnabled(e.detail);
    const handleClickMode = (e) => setClickMode(e.detail);
    window.addEventListener('nx-inbox-unread', handleUnread);
    window.addEventListener('nx-icon-scale', handleScale);
    window.addEventListener('nx-tooltips-changed', handleTips);
    window.addEventListener('nx-click-mode-changed', handleClickMode);
    return () => {
      window.removeEventListener('nx-inbox-unread', handleUnread);
      window.removeEventListener('nx-icon-scale', handleScale);
      window.removeEventListener('nx-tooltips-changed', handleTips);
      window.removeEventListener('nx-click-mode-changed', handleClickMode);
    };
  }, []);

  // Phase 5.12 — proactive nickname check on wallet connect. If the
  // player row exists and display_name is null, open the onboarding
  // modal immediately instead of waiting for them to trip a 409 on a
  // sensitive action. 404 (no player row yet) is a no-op; they'll
  // mint first via the on-chain flow, the listener will create the
  // row with display_name=null, and the next connect cycle catches it.
  useEffect(() => {
    if (!isConnected || !address) {
      setNicknameModalOpen(false);
      return;
    }
    let cancelled = false;
    api.getPlayer(address).then((p) => {
      if (cancelled) return;
      if (p && !p.display_name) setNicknameModalOpen(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [address, isConnected]);

  // Phase 5.12 — reactive open: any backend call that hits the
  // nickname gate triggers `nx-nickname-required` via api.js, no matter
  // which window dispatched the call.
  useEffect(() => {
    const handler = () => setNicknameModalOpen(true);
    window.addEventListener('nx-nickname-required', handler);
    return () => window.removeEventListener('nx-nickname-required', handler);
  }, []);

  // Poll backend for new notifications (every 30s).
  // Re-keys on [address, isConnected] so the polling starts when the user
  // connects mid-session and stops cleanly on disconnect; React fires the
  // cleanup before re-running the effect so the previous setTimeout/
  // setInterval pair is torn down before a new one is scheduled.
  useEffect(() => {
    if (!isConnected || !address) return;
    // Reset notif tracking — what the previous address already saw doesn't
    // apply to a new active address (account switch, MetaMask → MOSS, etc).
    lastNotifCheck.current = 0;
    const check = () => {
      api.getNotifications(address, true).then(notifs => {
        if (!Array.isArray(notifs)) return;
        // Only count types the Inbox window actually displays. The backend
        // may hold unread rows (protocol_created, ai_created, …) that don't
        // have an email mapping, which would pin the badge forever.
        const displayable = notifs.filter(n => INBOX_DISPLAY_TYPES.has(n.type));
        const count = displayable.length;
        if (count > lastNotifCheck.current && lastNotifCheck.current > 0 && displayable[0]) {
          setNotifPopup(displayable[0].title);
        }
        lastNotifCheck.current = count;
        // Authoritatively set (not Math.max) so the badge can decrease when
        // the user reads or deletes notifications.
        setUnreadCount(count);
      }).catch(() => {});
    };
    const t = setTimeout(check, 5000);
    const iv = setInterval(check, 30000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [address, isConnected]);

  const refreshSettings = useCallback(() => {
    setWallpaperStyle(getWallpaperStyle());
    setWallpaperOverlay(getWallpaperOverlay());
    // Apply theme
    const theme = localStorage.getItem('nx-theme') || 'classic';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  useEffect(() => {
    // Apply theme on mount
    const theme = localStorage.getItem('nx-theme') || 'classic';
    document.documentElement.setAttribute('data-theme', theme);
    // Apply text scale on mount. Default 'xlarge' matches native
    // Windows Explorer on modern displays; users who picked another
    // tier via Control Panel keep it (localStorage persists).
    //
    // Key bumped to 'nx-text-scale-v2' post-PR-308 so existing users
    // stuck on the legacy 'medium' (the previous default) auto-pick
    // up xlarge on next load. The old 'nx-text-scale' key is left
    // untouched in the user's storage for orphan cleanup; we never
    // read it again.
    const textScale = localStorage.getItem('nx-text-scale-v2') || 'xlarge';
    document.documentElement.setAttribute('data-text-scale', textScale);
  }, []);

  useEffect(() => {
    window.addEventListener('nx-settings-changed', refreshSettings);
    return () => window.removeEventListener('nx-settings-changed', refreshSettings);
  }, [refreshSettings]);

  // Screensaver timeout from settings
  const [ssTimeout, setSsTimeout] = useState(() => {
    return parseInt(localStorage.getItem('nx-screensaver-timeout')) || 60000;
  });

  useEffect(() => {
    const handleChange = () => {
      setSsTimeout(parseInt(localStorage.getItem('nx-screensaver-timeout')) || 60000);
    };
    window.addEventListener('nx-screensaver-changed', handleChange);
    return () => window.removeEventListener('nx-screensaver-changed', handleChange);
  }, []);

  // Use refs so the idle listener doesn't need to be re-added on state changes
  const ssTimeoutRef = useRef(ssTimeout);
  const showScreensaverRef = useRef(showScreensaver);
  useEffect(() => { ssTimeoutRef.current = ssTimeout; }, [ssTimeout]);
  useEffect(() => { showScreensaverRef.current = showScreensaver; }, [showScreensaver]);

  const resetIdleTimer = useCallback(() => {
    if (showScreensaverRef.current) return;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setShowScreensaver(true);
    }, ssTimeoutRef.current);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // BSOD: 2% chance on window open — wrap openWindow
  const openWindowWithBSOD = useCallback((id, extraProps) => {
    if (Math.random() < 0.02) {
      setShowBSOD(true);
      return;
    }
    openWindow(id, extraProps);
  }, [openWindow]);

  // Sprkls Phase 4.4 — listen for `sprkls:open-window` CustomEvents
  // dispatched by <SprklWindow> in the SprklsLayer (sibling of
  // Desktop in App.jsx). The bridge keeps useWindowManager's
  // openWindow component-local without lifting state up. SprklWindow
  // already validates `id` against an allowlist before dispatching,
  // so this handler trusts the payload — but we still guard against
  // missing detail in case a future surface dispatches the event
  // without going through SprklWindow.
  useEffect(() => {
    const handler = (e) => {
      const id = e?.detail?.id;
      if (!id || typeof id !== 'string') return;
      openWindowWithBSOD(id);
    };
    window.addEventListener(SPRKLS_OPEN_WINDOW_EVENT, handler);
    return () =>
      window.removeEventListener(SPRKLS_OPEN_WINDOW_EVENT, handler);
  }, [openWindowWithBSOD]);

  const handleTaskbarClick = (id) => {
    const win = windows.find(w => w.id === id);
    if (win && !win.minimized) {
      minimizeWindow(id);
    } else {
      openWindowWithBSOD(id);
    }
  };

  return (
    <div className="desktop" style={wallpaperStyle}>
      {wallpaperOverlay === 'matrix' && <div className="wallpaper-matrix" />}
      {wallpaperOverlay === 'scanlines' && <div className="wallpaper-scanlines" />}

      <div className={`desktop-icons${iconScale !== 'medium' ? ` scale-${iconScale}` : ''}`}>
        {DESKTOP_ICONS.filter(item => !item.hidden).map(item => (
          <DesktopIcon
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            desc={item.desc}
            iconSize={iconScale === 'small' ? 24 : iconScale === 'large' ? 48 : 32}
            onOpen={() => openWindowWithBSOD(item.id)}
            tooltipsEnabled={tooltipsEnabled}
            clickMode={clickMode}
            unreadCount={item.id === 'inbox' ? unreadCount : 0}
          />
        ))}
        {/* Phase 3.6 — NX CHAT entry, beta-gated. Sits in the same
            grid as every other desktop icon so the layout stays
            uniform; rendered outside DESKTOP_ICONS because it opens
            the floating chat modal (via openChatModal) instead of a
            window-managed view. Non-beta wallets never see this. */}
        {isInNXSoulsBeta(address) && (
          <DesktopIcon
            id="nxchat"
            label="NX CHAT"
            desc="Chat with your Devs"
            iconSize={iconScale === 'small' ? 24 : iconScale === 'large' ? 48 : 32}
            onOpen={() => openChatModal()}
            tooltipsEnabled={tooltipsEnabled}
            clickMode={clickMode}
          />
        )}
      </div>

      {/* Rank sticky note — top-right */}
      {tier && devCount > 0 && (
        <div style={{
          position: 'fixed', top: 10, right: 10, zIndex: 2,
          pointerEvents: 'none', userSelect: 'none',
          transform: 'rotate(2deg)',
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%', background: '#cc3333',
            position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)', zIndex: 3,
          }} />
          <div style={{
            width: 170, background: '#ffe066',
            boxShadow: '3px 3px 8px rgba(0,0,0,0.25)',
            fontFamily: "'Patrick Hand', cursive",
          }}>
            <div style={{
              background: '#ecc94b', padding: '3px 8px', fontSize: 'var(--text-sm)',
              color: '#744210',
            }}>📌 My Rank</div>
            <div style={{ padding: '8px 10px', color: '#744210' }}>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', marginBottom: 2 }}>
                {tier.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 'var(--text-lg)', opacity: 0.8 }}>{devCount} devs</div>
              {nextTier && (
                <div style={{ fontSize: 'var(--text-base)', opacity: 0.7, marginTop: 2 }}>
                  → {nextTier.label} at {nextTier.minDevs}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phase 5.9 — NX SOULS launch announcement post-it. Sits to
       * the LEFT of "My Rank" (right: 190 = right:10 + width:170 +
       * gap:10). Pastel violet palette follows the existing
       * yellow/salmon post-it pattern (pastel body + darker header
       * + dark contrasting text + sharp accent pin). Pin colour is
       * amber against the violet, mirroring the alternating-hue
       * pin convention used by the existing cards (red pin on
       * yellow, blue pin on salmon). Rotation -2deg extends the
       * alternating-tilt motif. Unconditional render — this is a
       * feature-launch announcement, not user-data-dependent. */}
      <div style={{
        position: 'fixed', top: 10, right: 190, zIndex: 2,
        pointerEvents: 'none', userSelect: 'none',
        transform: 'rotate(-2deg)',
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%', background: '#ffcc33',
          position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)', zIndex: 3,
        }} />
        <div style={{
          width: 170, background: '#c4a0e8',
          boxShadow: '3px 3px 8px rgba(0,0,0,0.25)',
          fontFamily: "'Patrick Hand', cursive",
        }}>
          <div style={{
            background: '#a87fc8', padding: '3px 8px', fontSize: 'var(--text-sm)',
            color: '#3a1a4a',
          }}>📌 NX SOULS LIVE</div>
          <div style={{ padding: '8px 10px', color: '#3a1a4a' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', marginBottom: 2 }}>
              talk to your devs
            </div>
            <div style={{ fontSize: 'var(--text-base)', opacity: 0.8 }}>
              they have things to say
            </div>
          </div>
        </div>
      </div>

      <WindowManager
        windows={windows}
        closeWindow={closeWindow}
        focusWindow={focusWindow}
        minimizeWindow={minimizeWindow}
        maximizeWindow={maximizeWindow}
        moveWindow={moveWindow}
        resizeWindow={resizeWindow}
        openDevProfile={openDevProfile}
        openWindow={openWindowWithBSOD}
      />

      <NXAssistant />
      <DailyStreakPopup />
      <WorldEventBanner />
      <GlobalStatAnimation />
      {notifPopup && (
        <NotifPopup
          title={notifPopup}
          onClose={() => setNotifPopup(null)}
          onOpen={() => openWindowWithBSOD('inbox')}
        />
      )}
      <ErrorPopup />

      {showBSOD && <BSOD onDismiss={() => setShowBSOD(false)} />}
      {showScreensaver && <Screensaver onDismiss={() => { setShowScreensaver(false); showScreensaverRef.current = false; resetIdleTimer(); }} />}

      {nicknameModalOpen && address && (
        <NicknameOnboardingModal
          walletAddress={address}
          onClaimed={() => setNicknameModalOpen(false)}
        />
      )}

      <Taskbar
        windows={windows}
        onWindowClick={handleTaskbarClick}
        openWindow={openWindowWithBSOD}
        unreadCount={unreadCount}
      />
    </div>
  );
}
