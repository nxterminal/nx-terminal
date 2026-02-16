import { useState, useEffect } from 'react';
import { useInbox } from '../contexts/InboxContext';

export default function Taskbar({ windows, onWindowClick, onStartClick, startOpen, openWindow }) {
  const { unreadCount, notification, clearNotification } = useInbox();
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const id = setInterval(updateTime, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="taskbar">
      <button
        className={`win-btn start-btn${startOpen ? ' active' : ''}`}
        onClick={onStartClick}
      >
        <span style={{ fontSize: '14px' }}>&#x1F5A5;</span>
        <span style={{ fontWeight: 'bold' }}>Start</span>
      </button>

      <div className="taskbar-divider" />

      <div className="taskbar-windows">
        {windows.map(w => (
          <button
            key={w.id}
            className={`win-btn taskbar-btn${!w.minimized ? ' active' : ''}`}
            onClick={() => onWindowClick(w.id)}
            title={w.title}
          >
            <span>{w.icon} {w.title}</span>
          </button>
        ))}
      </div>

      <div className="taskbar-tray">
        <div
          className="taskbar-tray-icon"
          onClick={() => openWindow('inbox')}
          title={unreadCount > 0 ? `${unreadCount} unread` : 'Inbox'}
          style={{ position: 'relative', cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}
        >
          📬
          {unreadCount > 0 && <span className="tray-badge" />}
        </div>
        {notification && (
          <div className="tray-notification" onClick={() => { clearNotification(); openWindow('inbox'); }}>
            {notification}
          </div>
        )}
        <div className="taskbar-clock">
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}
