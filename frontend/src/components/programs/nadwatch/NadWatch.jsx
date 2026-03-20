import { useState, useEffect, useCallback } from 'react';
import './NadWatch.css';
import { useMonadRPC } from './hooks/useMonadRPC';
import { COLORS } from './constants';
import BlockRain from './panels/BlockRain';
import NetworkVitals from './panels/NetworkVitals';
import TransactionFlow from './panels/TransactionFlow';
import ParallelLoad from './panels/ParallelLoad';
import ConsensusPipeline from './panels/ConsensusPipeline';
import CorpActivityBar from './panels/CorpActivityBar';

import BootSequence from './overlays/BootSequence';
import HelpDialog from './overlays/HelpDialog';

export default function NadWatch({ onClose }) {
  const [booted, setBooted] = useState(() => {
    return !!sessionStorage.getItem('nadwatch_boot_seen');
  });
  const [showHelp, setShowHelp] = useState(false);
  const [helpTab, setHelpTab] = useState('About');
  const [showScanlines, setShowScanlines] = useState(true);
  const [paused, setPaused] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const rpc = useMonadRPC();

  useEffect(() => {
    if (paused) {
      rpc.pause();
    } else {
      rpc.resume();
    }
  }, [paused, rpc.pause, rpc.resume]);

  useEffect(() => {
    if (!rpc.isConnected && rpc.error && !rpc.isLoading) {
      setRetryCountdown(5);
      const interval = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            rpc.refresh();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [rpc.isConnected, rpc.error, rpc.isLoading, rpc.lastUpdated]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === ' ' && !showHelp) {
        e.preventDefault();
        setPaused(p => !p);
      }
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
      }
      if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
        e.preventDefault();
        rpc.refresh();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showHelp, rpc.refresh]);

  const handleBootComplete = useCallback(() => {
    setBooted(true);
  }, []);

  const handleMenuClick = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const closeMenu = () => setOpenMenu(null);

  const timeSinceUpdate = rpc.lastUpdated
    ? Math.round((Date.now() - rpc.lastUpdated) / 1000)
    : null;

  let statusIcon, statusText, statusColor;
  if (paused) {
    statusIcon = '[PAUSED]';
    statusText = 'FEED PAUSED';
    statusColor = '#888';
  } else if (!rpc.isConnected && rpc.error) {
    statusIcon = '[OFFLINE]';
    statusText = `NETWORK OFFLINE — Reconnecting in ${retryCountdown}s...`;
    statusColor = '#ff3333';
  } else if (rpc.isConnected && timeSinceUpdate !== null && timeSinceUpdate > 5) {
    statusIcon = '[WAITING]';
    statusText = `AWAITING NEW BLOCK... (last: ${timeSinceUpdate}s ago)`;
    statusColor = '#cc9900';
  } else {
    statusIcon = '[ONLINE]';
    statusText = 'SURVEILLANCE MODE — PHAROS TESTNET — ALL SYSTEMS NOMINAL';
    statusColor = '#00aa00';
  }

  const showOffline = !rpc.isConnected && rpc.error && !rpc.isLoading && booted;
  const txCount = rpc.latestBlock?.transactionCount || 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      background: '#c0c0c0',
    }}
      onClick={() => { if (openMenu) closeMenu(); }}
    >
      {!booted && <BootSequence onComplete={handleBootComplete} />}

      {/* Menu bar */}
      <div className="ndw-menubar" onClick={(e) => e.stopPropagation()}>
        <div className="ndw-menu-item" onClick={() => handleMenuClick('file')}>
          FILE
          {openMenu === 'file' && (
            <div className="ndw-dropdown">
              <div className="ndw-dropdown-item" onClick={() => { closeMenu(); if (onClose) onClose(); }}>
                Exit
              </div>
            </div>
          )}
        </div>

        <div className="ndw-menu-item" onClick={() => handleMenuClick('view')}>
          VIEW
          {openMenu === 'view' && (
            <div className="ndw-dropdown">
              <div className="ndw-dropdown-item" onClick={() => { closeMenu(); rpc.refresh(); }}>
                Refresh
              </div>
              <div className="ndw-dropdown-item" onClick={() => { closeMenu(); setShowScanlines(!showScanlines); }}>
                {showScanlines ? '\u2713 ' : '  '}Toggle Scanlines
              </div>
            </div>
          )}
        </div>

        <div className="ndw-menu-item" onClick={() => handleMenuClick('surveillance')}>
          SURVEILLANCE
          {openMenu === 'surveillance' && (
            <div className="ndw-dropdown">
              {paused ? (
                <div className="ndw-dropdown-item" onClick={() => { closeMenu(); setPaused(false); }}>
                  Resume Feed
                </div>
              ) : (
                <div className="ndw-dropdown-item" onClick={() => { closeMenu(); setPaused(true); }}>
                  Pause Feed
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ndw-menu-item" onClick={() => handleMenuClick('help')}>
          HELP
          {openMenu === 'help' && (
            <div className="ndw-dropdown">
              <div className="ndw-dropdown-item" onClick={() => { closeMenu(); setHelpTab('About'); setShowHelp(true); }}>
                About NadWatch
              </div>
              <div className="ndw-dropdown-item" onClick={() => { closeMenu(); setHelpTab('Panels'); setShowHelp(true); }}>
                How to Use
              </div>
              <div className="ndw-dropdown-item" onClick={() => { closeMenu(); setHelpTab('Pharos'); setShowHelp(true); }}>
                About Pharos
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {showOffline && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: '#000',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="ndw-offline-text">
                {'[!]'} NETWORK OFFLINE
              </div>
              <div style={{ color: '#888', fontSize: '12px', marginTop: '16px' }}>
                Unable to connect to Pharos<br />RPC endpoint.
              </div>
              <div style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>
                {retryCountdown > 0
                  ? `Retrying in ${retryCountdown} seconds...`
                  : 'Retrying...'
                }
              </div>
              <button
                onClick={() => rpc.refresh()}
                style={{
                  marginTop: '16px',
                  background: '#c0c0c0',
                  border: '2px solid',
                  borderColor: '#dfdfdf #808080 #808080 #dfdfdf',
                  padding: '4px 16px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                [RETRY NOW]
              </button>
              {rpc.lastUpdated > 0 && (
                <div style={{ color: '#888', fontSize: '12px', marginTop: '12px' }}>
                  Last block: #{rpc.blockNumber.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="ndw-main-grid" style={{ position: 'relative' }}>
          <div className="ndw-rain-col ndw-panel">
            <BlockRain blockNumber={rpc.blockNumber} />
          </div>
          <div className="ndw-data-col">
            <div className="ndw-vitals-row ndw-panel">
              <NetworkVitals data={rpc} />
            </div>
            <div className="ndw-txflow-row ndw-panel">
              <TransactionFlow transactions={rpc.transactions} />
            </div>
          </div>
          {showScanlines && <div className="ndw-scanlines" />}
        </div>

        {/* Bottom panels */}
        <div className="ndw-bottom-bar">
          <ParallelLoad txCount={txCount} />
          <ConsensusPipeline blockNumber={rpc.blockNumber} />
          <CorpActivityBar />
        </div>
      </div>

      {/* Status bar */}
      <div className="ndw-statusbar">
        <div className="ndw-statusbar-left">
          <span style={{ color: statusColor }}>{statusIcon}</span>
          <span style={{ color: statusColor, fontSize: '11px' }}>{statusText}</span>
        </div>
        <div className="ndw-statusbar-right">
          NADWATCH v1.0 {'\u00B7'} PHAROS TESTNET {'\u00B7'} CLEARANCE: OBSERVER {'\u2502'} NX TERMINAL {'\u00D7'} PHAROS
        </div>
      </div>

      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} initialTab={helpTab} />}
    </div>
  );
}
