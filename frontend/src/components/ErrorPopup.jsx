import { useState, useEffect, useRef } from 'react';

const ERROR_MESSAGES = [
  { title: 'NX Terminal Error', text: 'Your developer has encountered an existential crisis and stopped working. Would you like to send an unhelpful report?', icon: '\u26A0' },
  { title: 'Protocol Conflict', text: 'Two protocols are trying to occupy the same memory address. Neither will yield. This is now a political issue.', icon: '\u{1F6AB}' },
  { title: 'Salary.exe', text: 'Insufficient funds to pay developer salaries. Developers have unionized. Productivity reduced by 100%.', icon: '\u{1F4B8}' },
  { title: 'Morale Overflow', text: 'Developer morale has exceeded maximum integer value and wrapped around to -2,147,483,648. This is technically your fault.', icon: '\u2757' },
  { title: 'Security Alert', text: 'A developer is attempting to access files above their clearance level. The files are just cat pictures.', icon: '\u{1F6E1}' },
  { title: 'Network Error', text: 'Connection to NX Terminal mainframe lost. The hamster powering the server has escaped. Deploying replacement hamster.', icon: '\u{1F4E1}' },
  { title: 'Memory Leak', text: 'Memory leak detected. 640K should have been enough for anyone, but your developers are very wasteful.', icon: '\u{1F4A7}' },
  { title: 'HR Violation', text: 'A developer has been caught mining cryptocurrency during work hours. The cryptocurrency was also imaginary.', icon: '\u{1F46E}' },
  { title: 'coffee.sys', text: 'CRITICAL: Coffee machine on floor 3 is offline. Developer productivity expected to drop to near-zero levels.', icon: '\u2615' },
  { title: 'Ethics.dll', text: 'Ethics module not found. Proceeding without ethics. (This has been the default behavior for 6 quarters.)', icon: '\u{1F916}' },
  { title: 'Disk Full', text: 'Hard drive is full. 498MB used by "important_work.zip" which is just 3 years of unread corporate memos.', icon: '\u{1F4BE}' },
  { title: 'Update Required', text: 'NX Terminal requires an update. The update requires an update. The update to the update has been deprecated.', icon: '\u{1F504}' },
];

export default function ErrorPopup() {
  const [popup, setPopup] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timerRef = useRef(null);

  const showError = () => {
    const msg = ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)];
    const x = Math.random() * (window.innerWidth - 380) + 40;
    const y = Math.random() * (window.innerHeight - 200) + 40;
    setPosition({ x, y });
    setPopup(msg);
  };

  const scheduleNext = () => {
    const delay = (Math.random() * 120000) + 180000; // 3-5 minutes
    timerRef.current = setTimeout(() => {
      showError();
      scheduleNext();
    }, delay);
  };

  useEffect(() => {
    // First popup after 2-4 minutes
    timerRef.current = setTimeout(() => {
      showError();
      scheduleNext();
    }, (Math.random() * 120000) + 120000);

    return () => clearTimeout(timerRef.current);
  }, []);

  if (!popup) return null;

  return (
    <div style={{
      position: 'fixed',
      left: position.x,
      top: position.y,
      zIndex: 10005,
      width: '340px',
      background: 'var(--win-bg)',
      boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 var(--border-light), inset -2px -2px 0 var(--border-dark), inset 2px 2px 0 #dfdfdf, 4px 4px 8px rgba(0,0,0,0.3)',
    }}>
      <div style={{
        background: 'linear-gradient(90deg, #800000, #cc0000)',
        color: 'white',
        padding: '2px 6px',
        fontWeight: 'bold',
        fontSize: '11px',
        height: '22px',
        display: 'flex',
        alignItems: 'center',
      }}>
        {popup.title}
      </div>
      <div style={{ padding: '12px', display: 'flex', gap: '12px' }}>
        <span style={{ fontSize: '28px', flexShrink: 0 }}>{popup.icon}</span>
        <div style={{ fontSize: '11px', lineHeight: 1.4 }}>{popup.text}</div>
      </div>
      <div style={{ padding: '0 12px 12px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <button className="win-btn" onClick={() => setPopup(null)} style={{ padding: '3px 24px' }}>OK</button>
        <button className="win-btn" onClick={() => setPopup(null)} style={{ padding: '3px 16px' }}>Ignore</button>
        <button className="win-btn" onClick={() => {
          setPopup(null);
          setTimeout(showError, 500);
        }} style={{ padding: '3px 16px' }}>Blame Someone</button>
      </div>
    </div>
  );
}
