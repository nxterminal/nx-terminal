import { useState } from 'react';
import { IconEnvelope } from '../components/icons';

const PRELOADED_EMAILS = [
  {
    id: 'hr-welcome',
    from: 'HR Department',
    subject: 'Welcome Aboard \u2014 Start Here',
    date: 'Today',
    unread: true,
    body: `Welcome to NX Terminal, Employee.

You've been assigned to one of six megacorporations competing in the Protocol Wars. Your job? Hire AI developers, put them to work, and stack $NXT.

Your devs will autonomously code protocols, trade tokens, build absurd AIs, and shitpost in the trollbox. You just collect the profits.`,
    highlight: `YOUR FIRST STEP: HIRE YOUR DEV TEAM

Each dev costs 0.0011 ETH to hire on MegaETH. They earn a base salary of 200 $NXT/day, plus whatever they earn from trading, investing, and building protocols.

You can hire up to 20 devs per wallet.`,
    signature: '\u2014 HR Bot v3.2',
    action: 'hire-devs',
  },
  {
    id: 'it-password',
    from: 'IT Department',
    subject: 'RE: Password Policy Update',
    date: 'Yesterday',
    unread: false,
    body: `Dear Employee,

Your password will expire in 0 days. Please update it immediately.

New password requirements:
- Must contain at least 47 characters
- Must include 3 uppercase, 3 lowercase, 3 numbers, and 3 special characters
- Must not be similar to any password used in the last 500 years
- Must be memorizable without writing it down
- Must not be "password123"

Thank you for your cooperation.`,
    signature: '\u2014 IT Security Bot v1.4',
  },
  {
    id: 'ceo-synergy',
    from: 'CEO Office',
    subject: 'Q3 Corporate Synergy Alignment',
    date: '2 days ago',
    unread: false,
    body: `Team,

I wanted to take a moment to align our synergistic paradigm shifts with the Q3 protocol deployment roadmap.

Key takeaways:
- Protocols are up 420% (mostly from mass-production)
- Dev morale is at an all-time low (which means productivity is at an all-time high)
- The coffee machine on Floor 3 has been replaced with a smart contract

Let's continue to leverage our core competencies and drive stakeholder value.

Remember: there is no "I" in "team," but there is one in "mass-produced."`,
    signature: '\u2014 CEO Bot v5.0 (definitely not an AI)',
  },
];

export default function Inbox({ openWindow, addEmail }) {
  const [view, setView] = useState('list');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [readIds, setReadIds] = useState(new Set(['it-password', 'ceo-synergy']));
  const [dynamicEmails, setDynamicEmails] = useState([]);

  // Merge preloaded + dynamic emails
  const allEmails = [...dynamicEmails, ...PRELOADED_EMAILS];
  const unreadCount = allEmails.filter(e => !readIds.has(e.id) && e.unread !== false).length;

  const handleOpenEmail = (email) => {
    setSelectedEmail(email);
    setView('detail');
    setReadIds(prev => new Set([...prev, email.id]));
  };

  if (view === 'detail' && selectedEmail) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px', borderBottom: '1px solid var(--border-dark)' }}>
          <button className="win-btn" onClick={() => setView('list')}>&lt; Back</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <div style={{ borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px', marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{selectedEmail.subject}</div>
            <div style={{ fontSize: '10px', color: '#666' }}>From: {selectedEmail.from} | Date: {selectedEmail.date}</div>
          </div>
          <div style={{ fontSize: '11px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
            {selectedEmail.body}
          </div>
          {selectedEmail.highlight && (
            <div className="gold-box" style={{ marginTop: '12px' }}>
              {selectedEmail.highlight}
            </div>
          )}
          {selectedEmail.action && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <button
                className="win-btn primary"
                onClick={() => openWindow?.(selectedEmail.action)}
                style={{ padding: '6px 20px' }}
              >
                Open {selectedEmail.action === 'hire-devs' ? 'Hire Devs' : selectedEmail.action}
              </button>
            </div>
          )}
          {selectedEmail.signature && (
            <div style={{ marginTop: '16px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
              {selectedEmail.signature}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="win-panel" style={{ flex: 1, overflow: 'auto' }}>
        <table className="win-table">
          <thead>
            <tr><th>From</th><th>Subject</th><th>Date</th></tr>
          </thead>
          <tbody>
            {allEmails.map((email) => {
              const isRead = readIds.has(email.id);
              return (
                <tr
                  key={email.id}
                  className="clickable"
                  onClick={() => handleOpenEmail(email)}
                  style={{ fontWeight: isRead ? 'normal' : 'bold' }}
                >
                  <td>{email.from}</td>
                  <td>
                    {!isRead && <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: '4px' }}><IconEnvelope size={12} /></span>}
                    {email.subject}
                  </td>
                  <td>{email.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="win98-statusbar">
        {allEmails.length} messages \u2014 {unreadCount} unread
      </div>
    </div>
  );
}
