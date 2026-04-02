import { useState, useEffect } from 'react';
import { useDevCount } from '../../../../hooks/useDevCount';

export default function NFTGate({ onVerified, openWindow }) {
  const { devCount, isLoading } = useDevCount();
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 200); }, []);

  // Auto-verify: if wallet has at least 1 NFT, grant access immediately
  useEffect(() => {
    if (!isLoading && devCount >= 1) {
      onVerified({ devId: 'wallet', species: 'Unknown' });
    }
  }, [isLoading, devCount, onVerified]);

  // While loading, show spinner
  if (isLoading) {
    return (
      <div style={{
        minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(160deg, #0f172a 0%, #020617 50%, #0f172a 100%)", padding: 24,
      }}>
        <div style={{ textAlign: "center" }}>
          <div className="da-spinner" style={{
            width: 44, height: 44, borderRadius: 22, margin: "0 auto 14px",
            border: "3px solid #1e293b", borderTopColor: "#10b981",
          }} />
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, fontFamily: "system-ui, sans-serif" }}>
            Checking wallet...
          </p>
        </div>
      </div>
    );
  }

  // If devCount >= 1, the useEffect above will call onVerified.
  // This renders only when devCount === 0 (no NFTs).
  return (
    <div style={{
      minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #0f172a 0%, #020617 50%, #0f172a 100%)", padding: 24,
    }}>
      <div style={{
        maxWidth: 400, width: "100%",
        opacity: show ? 1 : 0, transform: show ? "none" : "translateY(16px)",
        transition: "all 0.6s cubic-bezier(.4,0,.2,1)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 18,
            background: "linear-gradient(135deg, #10b981, #06b6d4)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "monospace",
            boxShadow: "0 8px 32px rgba(16,185,129,0.25)", marginBottom: 14,
            letterSpacing: "-1px",
          }}>DA</div>
          <h1 style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 700, margin: "0 0 4px", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "-0.02em" }}>
            Dev Academy
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0, fontFamily: "system-ui, sans-serif" }}>
            NX Terminal Training System
          </p>
        </div>

        <div style={{
          background: "rgba(15,23,42,0.8)", border: "1px solid #1e293b", borderRadius: 16,
          padding: 28, backdropFilter: "blur(8px)", textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <p style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, margin: "0 0 8px", fontFamily: "system-ui, sans-serif" }}>
            Dev Academy requires at least 1 NXDev NFT
          </p>
          <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 20px", fontFamily: "system-ui, sans-serif" }}>
            Mint a dev to start learning!
          </p>
          <button
            onClick={() => openWindow?.('hire-devs')}
            style={{
              background: "linear-gradient(135deg, #10b981, #06b6d4)",
              color: "#fff", border: "none", borderRadius: 10, padding: "10px 28px",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif",
            }}
          >
            Mint Devs
          </button>
        </div>
      </div>
    </div>
  );
}
