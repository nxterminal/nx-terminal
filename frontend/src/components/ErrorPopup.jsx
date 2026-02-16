import { useState } from 'react';
import { IconErrorX } from './icons';

export default function ErrorPopup({ message, onClose }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 10007,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 300,
        background: '#c0c0c0',
        border: '2px solid #c0c0c0',
        borderTopColor: '#ffffff',
        borderLeftColor: '#ffffff',
        borderRightColor: '#404040',
        borderBottomColor: '#404040',
        boxShadow: '1px 1px 0 #000, inset 1px 1px 0 #dfdfdf',
        fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
        fontSize: '11px',
        pointerEvents: 'auto',
      }}>
        {/* Titlebar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '2px 3px',
          background: 'linear-gradient(90deg, #000080, #1084d0)',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '11px',
          userSelect: 'none',
        }}>
          {/* Titlebar icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4, flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" fill="#ff0000" stroke="#cc0000" strokeWidth="0.5" />
            <line x1="4" y1="4" x2="10" y2="10" stroke="white" strokeWidth="1.5" />
            <line x1="10" y1="4" x2="4" y2="10" stroke="white" strokeWidth="1.5" />
          </svg>
          <span style={{ flex: 1 }}>NX Terminal</span>
        </div>

        {/* Body */}
        <div style={{
          padding: '12px 10px 8px 10px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          {/* Error icon */}
          <div style={{ flexShrink: 0 }}>
            <IconErrorX size={32} />
          </div>
          {/* Message */}
          <div style={{
            flex: 1,
            paddingTop: 6,
            lineHeight: '1.4',
            wordBreak: 'break-word',
          }}>
            {message}
          </div>
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          padding: '4px 10px 10px 10px',
        }}>
          <button
            onClick={() => onClose?.()}
            style={{
              minWidth: 75,
              padding: '2px 8px',
              background: '#c0c0c0',
              border: '2px solid #c0c0c0',
              borderTopColor: '#ffffff',
              borderLeftColor: '#ffffff',
              borderRightColor: '#404040',
              borderBottomColor: '#404040',
              fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
              fontSize: '11px',
              cursor: 'pointer',
              outline: '1px dotted #000',
              outlineOffset: -4,
            }}
          >
            OK
          </button>
          <button
            onClick={() => setShowDetails((prev) => !prev)}
            style={{
              minWidth: 75,
              padding: '2px 8px',
              background: '#c0c0c0',
              border: '2px solid #c0c0c0',
              borderTopColor: '#ffffff',
              borderLeftColor: '#ffffff',
              borderRightColor: '#404040',
              borderBottomColor: '#404040',
              fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {showDetails ? 'Details <<' : 'Details >>'}
          </button>
        </div>

        {/* Details section */}
        {showDetails && (
          <div style={{
            margin: '0 10px 10px 10px',
            padding: 8,
            background: '#e8e8e8',
            border: '1px solid #808080',
            borderTopColor: '#404040',
            borderLeftColor: '#404040',
            borderRightColor: '#ffffff',
            borderBottomColor: '#ffffff',
            overflow: 'auto',
            maxHeight: 160,
          }}>
            <pre style={{
              margin: 0,
              fontSize: '10px',
              fontFamily: "'Courier New', monospace",
              lineHeight: '1.5',
              whiteSpace: 'pre',
            }}>{`NXTERM caused a General Protection Fault
in module PROTOCOL.DLL at 0002:a]cdef001.

Registers:
EAX=0000004E EBX=00005854 ECX=C0FF33
EDX=DEADBEEF ESI=00000000 EDI=BAADF00D
Stack dump:
0x4E58 0x0000 0xFFFF 0xDEAD 0xBEEF
0x0420 0x1337 0xCAFE 0xBABE 0x0000`}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
