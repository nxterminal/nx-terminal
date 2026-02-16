import { useEffect } from 'react';

const BSOD_MESSAGES = [
  {
    error: 'PROTOCOL_WARS_EXCEPTION',
    detail: 'A developer has divided by zero while calculating their own net worth.',
  },
  {
    error: 'KMODE_SYNERGY_NOT_HANDLED',
    detail: 'The system attempted to process a synergy request but found no actual synergy.',
  },
  {
    error: 'IRQL_COFFEE_NOT_LESS_OR_EQUAL',
    detail: 'Coffee levels have reached a critically low state. System cannot continue.',
  },
  {
    error: 'PAGE_FAULT_IN_CORPORATE_AREA',
    detail: 'An illegal memory access was attempted in the corporate leadership sector.',
  },
  {
    error: 'MORALE_DRIVER_OVERRAN_STACK_BUFFER',
    detail: 'Employee morale overflow detected. Stack has been corrupted since Q3 2006.',
  },
];

export default function BSOD({ onDismiss }) {
  const msg = BSOD_MESSAGES[Math.floor(Math.random() * BSOD_MESSAGES.length)];

  useEffect(() => {
    const handleKey = () => {
      if (onDismiss) onDismiss();
    };
    const handleClick = () => {
      if (onDismiss) onDismiss();
    };
    // Small delay so the click that triggered it doesn't immediately dismiss
    const timer = setTimeout(() => {
      window.addEventListener('keydown', handleKey);
      window.addEventListener('click', handleClick);
    }, 500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('click', handleClick);
    };
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: '#000080',
      color: '#ffffff',
      fontFamily: "'Courier New', monospace",
      fontSize: '14px',
      padding: '40px 60px',
      zIndex: 99999,
      lineHeight: 1.6,
      cursor: 'pointer',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <span style={{ background: '#c0c0c0', color: '#000080', padding: '2px 12px', fontWeight: 'bold' }}>
          NX Terminal Corp.
        </span>
      </div>

      <p>A fatal exception {msg.error} has occurred at 0x0028:NXT00486DX in</p>
      <p>VxD PROTOCOLWARS(01) + 00001998. The current application will be terminated.</p>
      <br />
      <p>* {msg.detail}</p>
      <br />
      <p>* Press any key to terminate the current operation.</p>
      <p>* Press CTRL+ALT+DEL to restart your computer. You will</p>
      <p>  lose any unsaved information in all applications, and also</p>
      <p>  your sense of purpose.</p>
      <br />
      <p style={{ textAlign: 'center' }}>
        Press any key to continue <span style={{ animation: 'blink 1s infinite' }}>_</span>
      </p>
    </div>
  );
}
