import { useEffect } from 'react';

export default function BSOD({ onDismiss }) {
  useEffect(() => {
    const handleKey = () => onDismiss?.();
    const handleClick = () => onDismiss?.();

    window.addEventListener('keydown', handleKey);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('click', handleClick);
    };
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 99999,
      background: '#000080',
      color: 'white',
      fontFamily: "'Courier New', monospace",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px',
      boxSizing: 'border-box',
    }}>
      <style>{`
        @keyframes bsod-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .bsod-cursor {
          animation: bsod-blink 1s step-end infinite;
        }
      `}</style>
      <pre style={{
        fontSize: '14px',
        lineHeight: '1.8',
        whiteSpace: 'pre-wrap',
        maxWidth: '700px',
        textAlign: 'left',
      }}>
{`NX TERMINAL v4.86.33

A fatal exception 0x4E58 has occurred at 0028:C0035000 in VXD NXPROTOCOL(01) + 00001CB0. The current application will be terminated.

   * Press any key to terminate the current protocol.
   * Press CTRL+ALT+DEL to restart your NX Terminal. You will
     lose any unsaved salary data.

CAUSE: Too many protocols running simultaneously.
RECOMMENDATION: Have you tried hiring fewer developers?

Press any key to continue `}<span className="bsod-cursor">_</span>
      </pre>
    </div>
  );
}
