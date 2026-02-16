import { useState } from 'react';
import { IconTrash } from '../components/icons';

export default function RecycleBin() {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="terminal" style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        maxWidth: '420px',
        textAlign: 'center',
        padding: '24px',
        lineHeight: '1.8',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <IconTrash size={48} />
        </div>
        <div style={{ color: 'var(--gold)', fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
          RECYCLE BIN
        </div>
        <div style={{ color: 'var(--terminal-green)', fontSize: '14px', marginBottom: '24px' }}>
          NX Terminal Corp retains all employee data indefinitely. Nothing is ever truly deleted.
          Your protocols, salary records, and browser history are stored permanently in our servers.
          Have a productive day.
        </div>
        <button
          className="win-btn"
          style={{ padding: '6px 20px', fontSize: '12px' }}
          onClick={() => setShowConfirm(true)}
        >
          Empty Recycle Bin
        </button>
      </div>

      {showConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 10002,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--win-bg)',
            minWidth: '340px',
            maxWidth: '400px',
            boxShadow:
              'inset -1px -1px 0 #000, inset 1px 1px 0 var(--border-light), inset -2px -2px 0 var(--border-dark), inset 2px 2px 0 #dfdfdf',
          }}>
            {/* Titlebar */}
            <div style={{
              background: 'linear-gradient(90deg, var(--win-title-l), var(--win-title-r))',
              color: 'white',
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              height: '22px',
              fontWeight: 'bold',
              fontSize: '11px',
            }}>
              Confirm Delete
            </div>
            {/* Body */}
            <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0 }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><polygon points="16,2 30,28 2,28" fill="#ffcc00" stroke="#000" strokeWidth="1"/><text x="16" y="24" textAnchor="middle" fill="#000" fontSize="18" fontWeight="bold">!</text></svg>
              </div>
              <div style={{ fontSize: '11px', lineHeight: '1.6', color: '#000' }}>
                Are you sure? This action is irreversible and also impossible. We don't actually delete anything.
              </div>
            </div>
            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '0 16px 16px' }}>
              <button
                className="win-btn"
                style={{ minWidth: '75px' }}
                onClick={() => setShowConfirm(false)}
              >
                Yes
              </button>
              <button
                className="win-btn"
                style={{ minWidth: '75px' }}
                onClick={() => setShowConfirm(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
