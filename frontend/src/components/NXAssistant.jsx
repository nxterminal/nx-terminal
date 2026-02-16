import { useState, useEffect, useMemo } from 'react';

const PHRASES = [
  {
    text: "It looks like you're trying to win the Protocol Wars. Would you like help?",
    buttons: ['Get help', "Don't show this again"],
  },
  {
    text: 'Your developer has been staring at their screen for 3 hours. This is normal.',
    buttons: null,
  },
  {
    text: 'TIP: You can increase productivity by hiring more developers. Or by threatening the existing ones.',
    buttons: null,
  },
  {
    text: "I see you haven't collected your salary. It's not going anywhere. Neither are you.",
    buttons: null,
  },
  {
    text: 'Did you know? 73% of protocols fail in their first week. The other 27% fail in their second week.',
    buttons: null,
  },
  {
    text: 'Your developer is mass-producing code. Quality not guaranteed.',
    buttons: null,
  },
  {
    text: "It looks like you're writing a protocol. Would you like me to:",
    buttons: ['Add more bugs', 'Add blockchain', 'Both'],
  },
];

export default function NXAssistant({ onDismiss, onFire }) {
  const [selectedPhrase] = useState(() =>
    PHRASES[Math.floor(Math.random() * PHRASES.length)]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss?.();
    }, 15000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleButtonClick = () => {
    onDismiss?.();
  };

  const handleFire = () => {
    onFire?.();
    onDismiss?.();
  };

  return (
    <div
      className="nx-bounce-in"
      style={{
        position: 'fixed',
        bottom: 44,
        right: 16,
        zIndex: 10006,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      <style>{`
        @keyframes nxBounceIn {
          0% { transform: scale(0) translateY(40px); opacity: 0; }
          50% { transform: scale(1.1) translateY(-8px); opacity: 1; }
          70% { transform: scale(0.95) translateY(2px); }
          100% { transform: scale(1) translateY(0); }
        }
        .nx-bounce-in {
          animation: nxBounceIn 0.5s ease-out forwards;
        }
      `}</style>

      {/* Speech bubble */}
      <div style={{
        position: 'relative',
        background: '#ffffcc',
        border: '1px solid #000',
        padding: '10px 28px 10px 10px',
        maxWidth: 280,
        fontSize: '12px',
        fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
        marginBottom: 6,
        boxShadow: '2px 2px 0 rgba(0,0,0,0.15)',
      }}>
        {/* Close X button */}
        <button
          onClick={() => onDismiss?.()}
          style={{
            position: 'absolute',
            top: 2,
            right: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#000',
            padding: '0 3px',
            lineHeight: '1',
          }}
          title="Close"
        >
          x
        </button>

        <div style={{ marginBottom: selectedPhrase.buttons ? 8 : 0 }}>
          {selectedPhrase.text}
        </div>

        {selectedPhrase.buttons && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {selectedPhrase.buttons.map((label) => (
              <button
                key={label}
                onClick={handleButtonClick}
                style={{
                  background: '#c0c0c0',
                  border: '2px outset #c0c0c0',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 8, borderTop: '1px solid #ccc', paddingTop: 6 }}>
          <span
            onClick={handleFire}
            style={{
              color: '#0000cc',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Fire this assistant
          </span>
        </div>

        {/* Triangle pointer */}
        <div style={{
          position: 'absolute',
          bottom: -8,
          right: 24,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid #000',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -6,
          right: 25,
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '7px solid #ffffcc',
        }} />
      </div>

      {/* Robot character (inline SVG ~40x50) */}
      <svg width="40" height="50" viewBox="0 0 40 50" fill="none">
        {/* Antenna */}
        <line x1="20" y1="2" x2="20" y2="10" stroke="#808080" strokeWidth="2" />
        <circle cx="20" cy="2" r="3" fill="#cc0000" />
        {/* Head / Body */}
        <rect x="6" y="10" width="28" height="24" rx="3" fill="#c0c0c0" stroke="#808080" strokeWidth="1" />
        {/* Eyes */}
        <rect x="12" y="16" width="5" height="5" rx="1" fill="#0066cc" />
        <rect x="23" y="16" width="5" height="5" rx="1" fill="#0066cc" />
        {/* Mouth */}
        <rect x="14" y="26" width="12" height="3" rx="1" fill="#606060" />
        <line x1="18" y1="26" x2="18" y2="29" stroke="#808080" strokeWidth="0.5" />
        <line x1="22" y1="26" x2="22" y2="29" stroke="#808080" strokeWidth="0.5" />
        {/* Arms */}
        <rect x="1" y="16" width="5" height="10" rx="2" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5" />
        <rect x="34" y="16" width="5" height="10" rx="2" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5" />
        {/* Legs */}
        <rect x="12" y="34" width="6" height="10" rx="2" fill="#a0a0a0" stroke="#808080" strokeWidth="0.5" />
        <rect x="22" y="34" width="6" height="10" rx="2" fill="#a0a0a0" stroke="#808080" strokeWidth="0.5" />
        {/* Feet */}
        <rect x="10" y="43" width="10" height="4" rx="2" fill="#808080" />
        <rect x="20" y="43" width="10" height="4" rx="2" fill="#808080" />
      </svg>
    </div>
  );
}
