import { useState } from 'react';

const EMAILS = [
  { id: 1, from: 'admin@nxterminal.io', subject: 'Welcome to NX Terminal!', date: '01/15/2025', read: true, body: 'Welcome, Operator.\n\nYou have been granted Level 1 clearance to the NX Terminal network. Your assigned devs are standing by.\n\nRemember:\n- Collect your salary regularly\n- Monitor the Action Feed for opportunities\n- Keep your devs energized\n\nGood luck out there.\n\n— NX Terminal Admin' },
  { id: 2, from: 'hr@nxterminal.io', subject: 'RE: Your Salary Has Been Processed', date: '01/16/2025', read: false, body: 'Your latest salary payment of 1,250 $NXT has been deposited to your account.\n\nNext payment cycle: 48 hours\n\nPlease review your NXT Stats for full breakdown.\n\n— NX Terminal HR Department' },
  { id: 3, from: 'security@nxterminal.io', subject: '[URGENT] Suspicious Activity Detected', date: '01/16/2025', read: false, body: 'ALERT: Unusual trading patterns detected in Sector 7.\n\nMultiple DEGEN-class devs have been observed executing high-frequency trades on unverified protocols.\n\nAction required: Monitor your portfolio and report any unauthorized transactions.\n\n— NX Security Team' },
  { id: 4, from: 'no-reply@protocol-wars.net', subject: 'Protocol Wars Season 2 Starts Soon', date: '01/17/2025', read: false, body: 'PROTOCOL WARS: SEASON 2\n========================\n\nNew features:\n- Corporation alliances\n- AI-powered dev strategies\n- Cross-chain protocol battles\n- New archetype: WHALE\n\nPrepare your devs. The war continues.\n\n— Protocol Wars Team' },
  { id: 5, from: 'clippy@nxterminal.io', subject: 'It looks like you\'re trying to hack...', date: '01/17/2025', read: false, body: 'Hi there! It looks like you\'re trying to hack a protocol!\n\nWould you like help with that?\n\n[ ] Get help hacking\n[ ] Hide evidence\n[x] Never contact me again\n\n— NX Assistant (Clippy)' },
  { id: 6, from: 'dev-relations@nxterminal.io', subject: 'Your Dev "CryptoKing_42" leveled up!', date: '01/18/2025', read: false, body: 'Congratulations!\n\nYour dev CryptoKing_42 has reached Level 5!\n\nNew abilities unlocked:\n- Advanced Trading Algorithms\n- Protocol Infiltration v2\n- Enhanced Social Engineering\n\nKeep grinding.\n\n— Dev Relations' },
  { id: 7, from: 'spam@totally-legit-protocol.xyz', subject: '100X GUARANTEED!! Not a scam!!!', date: '01/18/2025', read: true, body: 'DEAR VALUED INVESTOR,\n\nWe have a ONCE IN A LIFETIME opportunity!\n\nInvest just 100 $NXT in our new protocol "SafeMoonRocketInu" and receive 10,000x returns GUARANTEED!\n\nThis is DEFINITELY not a rug pull.\n\nSend funds to: 0xDEAD...BEEF\n\n(This message was flagged by NX Spam Filter)' },
  { id: 8, from: 'system@nxterminal.io', subject: 'Scheduled Maintenance Notice', date: '01/19/2025', read: false, body: 'SYSTEM NOTICE\n=============\n\nScheduled maintenance window:\nDate: Cycle 2048\nDuration: ~50 cycles\nAffected: All trading operations\n\nYour devs will enter sleep mode during maintenance.\nNo salary collection during downtime.\n\n— NX Systems' },
];

export default function Inbox() {
  const [selected, setSelected] = useState(null);
  const [emails, setEmails] = useState(EMAILS);

  const handleSelect = (email) => {
    setSelected(email);
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
  };

  const unreadCount = emails.filter(e => !e.read).length;

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
