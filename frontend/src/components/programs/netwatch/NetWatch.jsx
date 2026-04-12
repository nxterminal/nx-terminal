import { useState, useEffect, useCallback } from 'react';
import './NetWatch.css';
import { useMegaETHRPC } from './hooks/useMegaETHRPC';
import BlockRain from './panels/BlockRain';
import NetworkVitals from './panels/NetworkVitals';
import TransactionFlow from './panels/TransactionFlow';

import BootSequence from './overlays/BootSequence';
import HelpDialog from './overlays/HelpDialog';

export default function NetWatch({ onClose }) {
  const [booted, setBooted] = useState(() => {
    return !!sessionStorage.getItem('netwatch_boot_seen');
  });
  const [showHelp, setShowHelp] = useState(false);
  const [showScanlines, setShowScanlines] = useState(true);
  const [paused, setPaused] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const rpc = useMegaETHRPC();

  useEffect(() => {
    if (paused) {
      rpc.pause();
    } else {
      rpc.resume();
    }
  }, [paused, rpc.pause, rpc.resume]);

  useEffect(() => {
    if (!rpc.isConnected && rpc.error && !rpc.isLoading) {
      setRetryCountdown(3);
      const interval = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [rpc.isConnected, rpc.error, rpc.isLoading, rpc.lastUpdated]);

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
    statusIcon = '\u23F8';
    statusText = 'FEED PAUSED \u2014 Press Resume to continue';
    statusColor = '#888';
  } else if (!rpc.isConnected && rpc.error) {
    statusIcon = '\u25CF';
    statusText = 'NETWORK OFFLINE \u2014 Reconnecting...';
    statusColor = '#ff3333';
  } else if (rpc.isConnected && timeSinceUpdate !== null && timeSinceUpdate > 10) {
    statusIcon = '\u25CF';
    statusText = `AWAITING NEW BLOCK... (last: ${timeSinceUpdate}s ago)`;
    statusColor = '#cc9900';
  } else {
    statusIcon = '\u25CF';
    statusText = 'SURVEILLANCE MODE \u2014 ALL SYSTEMS NOMINAL';
    statusColor = '#00aa00';
  }

  const showOffline = !rpc.isConnected && rpc.error && !rpc.isLoading && booted;

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
      <div className="nw-menubar" onClick={(e) => e.stopPropagation()}>
        <div className="nw-menu-item" onClick={() => handleMenuClick('file')}>
          FILE
          {openMenu === 'file' && (
            <div className="nw-dropdown">
              <div className="nw-dropdown-item" onClick={() => { closeMenu(); if (onClose) onClose(); }}>
                Exit
              </div>
            </div>
          )}
        </div>

        <div className="nw-menu-item" onClick={() => handleMenuClick('view')}>
          VIEW
          {openMenu === 'view' && (
            <div className="nw-dropdown">
              <div className="nw-dropdown-item" onClick={() => { closeMenu(); rpc.refresh(); }}>
                Refresh
              </div>
              <div className="nw-dropdown-item" onClick={() => { closeMenu(); setShowScanlines(!showScanlines); }}>
                {showScanlines ? '\u2713 ' : '  '}Toggle Scanlines
              </div>
              <div className="nw-dropdown-separator" />
              <div className="nw-dropdown-item nw-disabled" title="Coming soon">
                Switch to Mainnet (soon)
              </div>
            </div>
          )}
        </div>

        <div className="nw-menu-item" onClick={() => handleMenuClick('surveillance')}>
          SURVEILLANCE
          {openMenu === 'surveillance' && (
            <div className="nw-dropdown">
              {paused ? (
                <div className="nw-dropdown-item" onClick={() => { closeMenu(); setPaused(false); }}>
                  Start Feed
                </div>
              ) : (
                <div className="nw-dropdown-item" onClick={() => { closeMenu(); setPaused(true); }}>
                  Pause Feed
                </div>
              )}
              <div className="nw-dropdown-separator" />
              <div className="nw-dropdown-item nw-disabled" title="Available for NX Terminal holders">
                Track Wallet (holders only)
              </div>
            </div>
          )}
        </div>

        <div
          className="nw-menu-item nw-disabled"
          title="Available in Full Version for NX Terminal holders"
        >
          ALERTS
        </div>

        <div className="nw-menu-item" onClick={() => { closeMenu(); setShowHelp(true); }}>
          HELP
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
              <div className="nw-offline-text">
                {'\u26A0'} NETWORK OFFLINE
              </div>
              <div style={{ color: '#cfcfcf', fontSize: '12px', marginTop: '16px' }}>
                Unable to connect to MegaETH<br />RPC endpoint.
              </div>
              <div style={{ color: '#cfcfcf', fontSize: '12px', marginTop: '8px' }}>
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
                <div style={{ color: '#cfcfcf', fontSize: '12px', marginTop: '12px' }}>
                  Last data: {Math.round((Date.now() - rpc.lastUpdated) / 1000)}s ago
                </div>
              )}
            </div>
          </div>
        )}

        <div className="nw-main-grid" style={{ position: 'relative' }}>
          <div className="nw-rain-col nw-panel">
            <BlockRain blockNumber={rpc.blockNumber} />
          </div>
          <div className="nw-data-col">
            <div className="nw-vitals-row nw-panel">
              <NetworkVitals data={rpc} />
            </div>
            <div className="nw-txflow-row nw-panel">
              <TransactionFlow transactions={rpc.transactions} />
            </div>
          </div>
          {showScanlines && <div className="nw-scanlines" />}
        </div>


      </div>

      {/* Status bar */}
      <div className="nw-statusbar">
        <div className="nw-statusbar-left">
          <span style={{ color: statusColor }}>{statusIcon}</span>
          <span style={{ color: statusColor, fontSize: '11px' }}>{statusText}</span>
        </div>
        <div className="nw-statusbar-right">
          MEGAWATCH BETA {'\u00B7'} MEGAETH {'\u00B7'} CLEARANCE: OBSERVER {'\u2502'} NX TERMINAL
        </div>
      </div>

      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
    </div>
  );
}
