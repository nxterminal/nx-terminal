import { useState, useEffect } from 'react';
import { useNFTVerify } from '../hooks/useNFTVerify';

export default function NFTGate({ onVerified, onSkip }) {
  const [inputVal, setInputVal] = useState("");
  const [localError, setLocalError] = useState("");
  const [show, setShow] = useState(false);
  const { verify, verifying, error: apiError } = useNFTVerify();
  useEffect(() => { setTimeout(() => setShow(true), 200); }, []);

  const error = localError || apiError;

  const handleVerify = async () => {
    if (!inputVal.trim()) { setLocalError("Dev ID is required"); return; }
    const num = parseInt(inputVal.replace(/[^0-9]/g, ""));
    if (isNaN(num) || num < 1 || num > 35000) { setLocalError("Invalid ID. Must be #1 to #35,000"); return; }
    setLocalError("");
    const result = await verify(num);
    if (result) {
      onVerified(result);
    }
  };

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
          padding: 28, backdropFilter: "blur(8px)",
        }}>
          {!verifying ? (
            <>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 13, marginBottom: 8, fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>
                Enter your Dev ID to access
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{
                  flex: 1, display: "flex", alignItems: "center",
                  background: "#020617", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden",
                }}>
                  <span style={{ color: "#475569", padding: "0 0 0 14px", fontSize: 15, fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>#</span>
                  <input value={inputVal} onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleVerify()} placeholder="1 to 35000"
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      color: "#f1f5f9", fontSize: 15, padding: "12px 14px 12px 6px", fontFamily: "system-ui, sans-serif",
                    }}
                  />
                </div>
                <button onClick={handleVerify} style={{
                  background: "linear-gradient(135deg, #10b981, #06b6d4)",
                  color: "#fff", border: "none", borderRadius: 10, padding: "0 22px",
                  fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif",
                }}>Verify</button>
              </div>
              {error && <p style={{ color: "#f43f5e", fontSize: 13, margin: "0 0 4px", fontFamily: "system-ui, sans-serif" }}>{error}</p>}
              <p style={{ color: "#334155", fontSize: 12, margin: "14px 0 0", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>
                Hold at least one NXDev NFT to access Dev Academy.
                This program requires <span style={{ color: "#10b981" }}>Indie Lab</span> rank (3 devs).
              </p>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div className="da-spinner" style={{
                width: 44, height: 44, borderRadius: 22, margin: "0 auto 14px",
                border: "3px solid #1e293b", borderTopColor: "#10b981",
              }} />
              <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, fontFamily: "system-ui, sans-serif" }}>
                Verifying Dev #{inputVal}...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
