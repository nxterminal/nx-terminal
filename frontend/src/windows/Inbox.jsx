import { useState } from 'react';
import { useInbox } from '../contexts/InboxContext';

export default function Inbox() {
  const { emails, markRead, unreadCount } = useInbox();
  const [selected, setSelected] = useState(null);

  const handleSelect = (email) => {
    setSelected(email);
    markRead(email.id);
  };

  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px', background: 'var(--win-bg)', borderBottom: '1px solid var(--border-dark)' }}>
          <button className="win-btn" onClick={() => setSelected(null)} style={{ fontSize: '11px' }}>
            &larr; Back to Inbox
          </button>
        </div>
        <div style={{ padding: '8px', borderBottom: '1px solid var(--border-dark)', background: 'var(--win-bg)' }}>
          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{selected.subject}</div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
            From: {selected.from} | Date: {selected.date}
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px', overflow: 'auto', background: '#fff', fontFamily: "'Courier New', monospace", fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
          {selected.body}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '4px', background: 'var(--win-bg)', fontSize: '11px', borderBottom: '1px solid var(--border-dark)' }}>
        Inbox ({unreadCount} unread)
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        <table className="win-table">
          <thead>
            <tr>
              <th style={{ width: '20px' }}></th>
              <th>From</th>
              <th>Subject</th>
              <th style={{ width: '80px' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {emails.map(email => (
              <tr key={email.id} className="clickable" onClick={() => handleSelect(email)}
                  style={{ fontWeight: email.read ? 'normal' : 'bold' }}>
                <td>{email.read ? '📭' : '📬'}</td>
                <td>{email.from}</td>
                <td>{email.subject}</td>
                <td>{email.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
