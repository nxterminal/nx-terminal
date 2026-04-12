import { useState, useEffect, useCallback } from 'react';
import './Parallax.css';
import { useParallelSim } from './hooks/useParallelSim';
import { COLORS } from './constants';
import ExecutionLanes from './panels/ExecutionLanes';
import ConflictLog from './panels/ConflictLog';
import PerformanceMetrics from './panels/PerformanceMetrics';
import PipelineStatus from './panels/PipelineStatus';
import BootSequence from './overlays/BootSequence';
import HelpDialog from './overlays/HelpDialog';

export default function Parallax({ onClose }) {
  const [booted, setBooted] = useState(() => {
    return !!sessionStorage.getItem('parallax_boot_seen');
  });
  const [showHelp, setShowHelp] = useState(false);
  const [helpTab, setHelpTab] = useState('About');
  const [showScanlines, setShowScanlines] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const sim = useParallelSim();
  const { rpc, lanes, events, metrics, isPaused } = sim;

  // Retry logic on disconnect
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
        if (isPaused) sim.resume();
        else sim.pause();
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
  }, [showHelp, isPaused, sim, rpc.refresh]);

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
  if (isPaused) {
    statusIcon = '[PAUSED]';
    statusText = 'SIMULATION PAUSED';
    statusColor = '#888';
  } else if (!rpc.isConnected && rpc.error) {
    statusIcon = '[OFFLINE]';
    statusText = `NETWORK OFFLINE \u2014 Reconnecting in ${retryCountdown}s...`;
    statusColor = '#ff3333';
  } else if (rpc.isConnected && timeSinceUpdate !== null && timeSinceUpdate > 5) {
    statusIcon = '[WAITING]';
    statusText = `AWAITING NEW BLOCK... (last: ${timeSinceUpdate}s ago)`;
    statusColor = '#cc9900';
  } else {
    statusIcon = '[ONLINE]';
    statusText = `PARALLAX MODE \u2014 ${metrics.parallelGain.toFixed(1)}x GAIN \u2014 ${lanes.reduce((s, l) => s + l.transactions.length, 0)} TXS IN FLIGHT`;
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
      <div className="plx-menubar" onClick={(e) => e.stopPropagation()}>
        <div className="plx-menu-item" onClick={() => handleMenuClick('file')}>
          FILE
          {openMenu === 'file' && (
            <div className="plx-dropdown">
              <div className="plx-dropdown-item" onClick={() => { closeMenu(); if (onClose) onClose(); }}>
                Exit
              </div>
            </div>
          )}
        </div>

        <div className="plx-menu-item" onClick={() => handleMenuClick('view')}>
          VIEW
          {openMenu === 'view' && (
            <div className="plx-dropdown">
              <div className="plx-dropdown-item" onClick={() => { closeMenu(); rpc.refresh(); }}>
                Refresh
              </div>
              <div className="plx-dropdown-item" onClick={() => { closeMenu(); setShowScanlines(!showScanlines); }}>
                {showScanlines ? '\u2713 ' : '  '}Toggle Scanlines
              </div>
            </div>
          )}
        </div>

        <div className="plx-menu-item" onClick={() => handleMenuClick('simulation')}>
          SIMULATION
          {openMenu === 'simulation' && (
            <div className="plx-dropdown">
              {isPaused ? (
                <div className="plx-dropdown-item" onClick={() => { closeMenu(); sim.resume(); }}>
                  Resume Simulation
                </div>
              ) : (
                <div className="plx-dropdown-item" onClick={() => { closeMenu(); sim.pause(); }}>
                  Pause Simulation
                </div>
              )}
            </div>
          )}
        </div>

        <div className="plx-menu-item" onClick={() => handleMenuClick('help')}>
          HELP
          {openMenu === 'help' && (
            <div className="plx-dropdown">
              <div className="plx-dropdown-item" onClick={() => { closeMenu(); setHelpTab('About'); setShowHelp(true); }}>
                About PARALLAX
              </div>
              <div className="plx-dropdown-item" onClick={() => { closeMenu(); setHelpTab('Lanes'); setShowHelp(true); }}>
                Lane Guide
              </div>
              <div className="plx-dropdown-item" onClick={() => { closeMenu(); setHelpTab('MegaETH'); setShowHelp(true); }}>
                About MegaETH
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
              <div className="plx-offline-text">
                {'[!]'} NETWORK OFFLINE
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
                  Last block: #{rpc.blockNumber.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="plx-main-grid" style={{ position: 'relative' }}>
          <div className="plx-lanes-col plx-panel">
            <ExecutionLanes lanes={lanes} events={events} />
          </div>
          <div className="plx-side-col">
            <div className="plx-metrics-row plx-panel">
              <PerformanceMetrics metrics={metrics} rpc={rpc} />
            </div>
            <div className="plx-pipeline-row plx-panel">
              <PipelineStatus blockNumber={rpc.blockNumber} />
            </div>
          </div>
          {showScanlines && <div className="plx-scanlines" />}
        </div>

        {/* Bottom panel */}
        <div className="plx-bottom-bar plx-panel">
          <ConflictLog events={events} />
        </div>
      </div>

      {/* Status bar */}
      <div className="plx-statusbar">
        <div className="plx-statusbar-left">
          <span style={{ color: statusColor }}>{statusIcon}</span>
          <span style={{ color: statusColor, fontSize: '11px' }}>{statusText}</span>
        </div>
        <div className="plx-statusbar-right">
          PARALLAX v1.0 {'\u00B7'} MEGAETH {'\u00B7'} 8 LANES {'\u2502'} NX TERMINAL {'\u00D7'} MEGAETH
        </div>
      </div>

      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} initialTab={helpTab} />}
    </div>
  );
}
