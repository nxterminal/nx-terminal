import { useState, useCallback } from 'react';
import { api } from '../../../../services/api';
import { useWallet } from '../../../../hooks/useWallet';
import { COLORS, getRiskLevel, RISK_LEVELS } from '../constants';
import ScanProgressBar from '../components/ScanProgressBar';
import ThreatBadge from '../components/ThreatBadge';

function shortAddr(a) {
  if (!a) return '--';
  return a.slice(0, 6) + '...' + a.slice(-4);
}

function RiskDot({ risk }) {
  const r = RISK_LEVELS[risk] || RISK_LEVELS.WARNING;
  return <span style={{ color: r.color, fontWeight: 'bold' }}>{'\u25CF'} {risk}</span>;
}

export default function Firewall() {
  const { address, isConnected } = useWallet();
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [revoking, setRevoking] = useState(null); // token+spender key
  const [revokeStatus, setRevokeStatus] = useState({}); // key -> 'pending' | 'success' | 'error'

  const handleScan = useCallback(async () => {
    if (!address) return;
    setScanning(true);
    setResult(null);
    setError(null);
    setProgress(0);
    setRevokeStatus({});

    const timer = setInterval(() => {
      setProgress(p => Math.min(p + 5, 85));
    }, 400);

    try {
      const data = await api.sentinelFirewallScan(address);
      clearInterval(timer);
      setProgress(100);
      setTimeout(() => {
        setResult(data);
        setScanning(false);
      }, 300);
    } catch (e) {
      clearInterval(timer);
      setError(e.message || 'Scan failed');
      setScanning(false);
    }
  }, [address]);

  const handleRevoke = useCallback(async (token, spender) => {
    if (!window.ethereum || !address) return;
    const key = `${token}-${spender}`;
    setRevoking(key);
    setRevokeStatus(prev => ({ ...prev, [key]: 'pending' }));

    try {
      const { tx } = await api.sentinelFirewallRevoke(token, spender, address);
      await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [tx],
      });
      setRevokeStatus(prev => ({ ...prev, [key]: 'success' }));
    } catch (e) {
      setRevokeStatus(prev => ({ ...prev, [key]: 'error' }));
    } finally {
      setRevoking(null);
    }
  }, [address]);

  if (!isConnected) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontFamily: '"VT323", monospace', color: COLORS.amber, gap: '8px',
      }}>
        <div style={{ fontSize: '24px' }}>{'\u{1F6E1}'}</div>
        <div>{'>'} Connect wallet to scan approvals</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 12px', height: '100%', overflow: 'auto' }}>
      {/* Scan button */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '8px 12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`,
        fontFamily: '"VT323", monospace', fontSize: '14px',
      }}>
        <span style={{ color: COLORS.green }}>{'>'} Wallet: {shortAddr(address)}</span>
        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            background: scanning ? '#222' : COLORS.dimGreen,
            border: `1px solid ${scanning ? '#444' : COLORS.green}`,
            color: scanning ? '#666' : COLORS.green,
            fontFamily: '"VT323", monospace', fontSize: '13px',
            padding: '4px 16px', cursor: scanning ? 'default' : 'pointer',
          }}
        >
          {scanning ? 'SCANNING...' : 'SCAN MY WALLET'}
        </button>
      </div>

      {scanning && (
        <div style={{ marginTop: '12px' }}>
          <ScanProgressBar progress={progress} label="Scanning approval events..." />
        </div>
      )}

      {error && (
        <div className="sentinel-panel" style={{ marginTop: '12px', color: COLORS.red }}>
          {'>'} ERROR: {error}
        </div>
      )}

      {result && <FirewallResults data={result} onRevoke={handleRevoke} revoking={revoking} revokeStatus={revokeStatus} />}
    </div>
  );
}

function FirewallResults({ data, onRevoke, revoking, revokeStatus }) {
  const risk = getRiskLevel(data.healthScore);

  return (
    <div className="sentinel-fade-in" style={{ marginTop: '12px' }}>
      {/* Health overview */}
      <div className="sentinel-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '14px', color: COLORS.green }}>
              {'>'} WALLET HEALTH REPORT
            </div>
            <div style={{ fontSize: '12px', color: COLORS.muted, marginTop: '2px' }}>
              {data.totalApprovals} active approval{data.totalApprovals !== 1 ? 's' : ''} found
              {data.unlimitedApprovals > 0 && (
                <span style={{ color: COLORS.amber }}>
                  {' '}({data.unlimitedApprovals} unlimited)
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: COLORS.text, fontSize: '14px' }}>Health:</span>
            <span style={{ color: risk.color, fontWeight: 'bold', fontSize: '18px' }}>{data.healthScore}/100</span>
            <ThreatBadge score={data.healthScore} />
          </div>
        </div>
      </div>

      {/* Approvals list */}
      {data.approvals.length === 0 ? (
        <div className="sentinel-panel" style={{ textAlign: 'center' }}>
          <div style={{ color: COLORS.green, fontSize: '14px' }}>
            {'\u2713'} No active approvals found. Your wallet is clean!
          </div>
        </div>
      ) : (
        <div className="sentinel-panel" style={{ padding: '4px' }}>
          <table className="sentinel-table">
            <thead>
              <tr>
                <th>Risk</th>
                <th>Token</th>
                <th>Spender</th>
                <th>Allowance</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.approvals.map((appr, i) => {
                const key = `${appr.token.address}-${appr.spender}`;
                const status = revokeStatus[key];
                return (
                  <tr key={i}>
                    <td><RiskDot risk={appr.risk} /></td>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{appr.token.symbol || '???'}</div>
                      <div style={{ fontSize: '10px', color: COLORS.muted }}>{shortAddr(appr.token.address)}</div>
                    </td>
                    <td style={{ fontSize: '11px' }}>{shortAddr(appr.spender)}</td>
                    <td style={{ color: appr.isUnlimited ? COLORS.red : COLORS.text, fontSize: '12px' }}>
                      {appr.isUnlimited ? 'UNLIMITED' : 'Limited'}
                    </td>
                    <td style={{ fontSize: '11px', color: COLORS.muted }}>
                      {appr.spenderIsContract ? 'Contract' : 'EOA'}
                    </td>
                    <td>
                      {status === 'success' ? (
                        <span style={{ color: COLORS.green, fontSize: '11px' }}>{'\u2713'} Revoked</span>
                      ) : status === 'error' ? (
                        <span style={{ color: COLORS.red, fontSize: '11px' }}>Failed</span>
                      ) : (
                        <button
                          onClick={() => onRevoke(appr.token.address, appr.spender)}
                          disabled={revoking === key}
                          style={{
                            background: appr.risk === 'SAFE' ? '#222' : COLORS.dimRed,
                            border: `1px solid ${appr.risk === 'SAFE' ? '#444' : COLORS.red}`,
                            color: appr.risk === 'SAFE' ? '#888' : COLORS.red,
                            fontFamily: '"VT323", monospace', fontSize: '11px',
                            padding: '2px 8px', cursor: 'pointer',
                          }}
                        >
                          {revoking === key ? '...' : 'REVOKE'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
