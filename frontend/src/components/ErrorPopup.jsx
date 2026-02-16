import { useState, useEffect, useRef } from 'react';

const ERRORS = [
  { title: 'nxterminal.exe', msg: 'This program has performed an illegal operation and will be shut down.\nIf the problem persists, contact your system administrator.' },
  { title: 'Protocol Error', msg: 'Error 0x80004005: Unspecified error.\nThe protocol you are trying to access has been rugged.' },
  { title: 'Memory Warning', msg: 'Your system is running low on $NXT.\nClose some protocols to free up funds.' },
  { title: 'Network Error', msg: 'Unable to connect to blockchain node.\nError: ECONNREFUSED 0.0.0.0:8545\n\nThe node might be busy mining.' },
  { title: 'Explorer.exe', msg: 'The operation completed successfully.\n\n(But something still feels wrong.)' },
  { title: 'Dev Runtime Error', msg: 'Runtime Error!\nProgram: dev_ai_v3.exe\n\nAbnormal program termination\nYour dev had an existential crisis.' },
  { title: 'Fatal Exception', msg: 'A fatal exception 0E has occurred at 0028:C0011E36 in VXD VMM(01) +\n00010E36. The current application will be terminated.' },
  { title: 'Wallet Error', msg: 'Transaction failed: insufficient gas.\n\nHave you tried adding more $NXT?' },
  { title: 'hal.dll', msg: 'Windows could not start because the following file is missing or corrupt:\nC:\\WINDOWS\\SYSTEM32\\HAL.DLL\n\nJust kidding. Or are we?' },
];

export default function ErrorPopup() {
  const [popups, setPopups] = useState([]);
  const timerRef = useRef(null);
  const nextId = useRef(0);

  useEffect(() => {
    const schedule = () => {
      const delay = 45000 + Math.random() * 90000; // 45-135 seconds
      timerRef.current = setTimeout(() => {
        const error = ERRORS[Math.floor(Math.random() * ERRORS.length)];
        const id = nextId.current++;
        setPopups(prev => [...prev, { ...error, id, x: 100 + Math.random() * 200, y: 80 + Math.random() * 200 }]);
        schedule();
      }, delay);
    };

    // First error after 60-120 seconds
    timerRef.current = setTimeout(() => {
      const error = ERRORS[Math.floor(Math.random() * ERRORS.length)];
      const id = nextId.current++;
      setPopups(prev => [...prev, { ...error, id, x: 150, y: 120 }]);
      schedule();
    }, 60000 + Math.random() * 60000);

    return () => clearTimeout(timerRef.current);
  }, []);

  const close = (id) => {
    setPopups(prev => prev.filter(p => p.id !== id));
  };

  return (
    <>
      {popups.map(p => (
        <div key={p.id} className="error-popup" style={{ left: p.x, top: p.y, zIndex: 10000 + p.id }}>
          <div className="error-popup-titlebar">
            <span>⚠️ {p.title}</span>
            <button className="win98-titlebar-btn" onClick={() => close(p.id)}>✕</button>
          </div>
          <div className="error-popup-body">
            <div className="error-popup-icon">⚠️</div>
            <div className="error-popup-msg">{p.msg}</div>
          </div>
          <div className="error-popup-buttons">
            <button className="win-btn" onClick={() => close(p.id)}>OK</button>
          </div>
        </div>
      ))}
    </>
  );
}
