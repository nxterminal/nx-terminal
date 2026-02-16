import { useState } from 'react';

const HR_EMAIL = {
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
};

export default function Inbox({ openWindow }) {
  const [view, setView] = useState('list');
  const [readHR, setReadHR] = useState(false);

  if (view === 'detail') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px', borderBottom: '1px solid var(--border-dark)' }}>
          <button className="win-btn" onClick={() => setView('list')}>&lt; Back</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <div style={{ borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px', marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{HR_EMAIL.subject}</div>
            <div style={{ fontSize: '10px', color: '#666' }}>From: {HR_EMAIL.from} | Date: {HR_EMAIL.date}</div>
          </div>
          <div style={{ fontSize: '11px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
            {HR_EMAIL.body}
          </div>
          <div className="gold-box" style={{ marginTop: '12px' }}>
            {HR_EMAIL.highlight}
          </div>
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <button
              className="win-btn primary"
              onClick={() => openWindow?.('hire-devs')}
              style={{ padding: '6px 20px' }}
            >
              Open Hire Devs
            </button>
          </div>
          <div style={{ marginTop: '16px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
            {HR_EMAIL.signature}
          </div>
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
            <tr
              className="clickable"
              onClick={() => { setView('detail'); setReadHR(true); }}
              style={{ fontWeight: readHR ? 'normal' : 'bold' }}
            >
              <td>{HR_EMAIL.from}</td>
              <td>{readHR ? '' : '\u2709 '}{HR_EMAIL.subject}</td>
              <td>{HR_EMAIL.date}</td>
            </tr>
            <tr>
              <td style={{ color: '#999' }}>System</td>
              <td style={{ color: '#999', fontStyle: 'italic' }}>No more messages</td>
              <td style={{ color: '#999' }}>\u2014</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="win98-statusbar">
        2 messages \u2014 {readHR ? '0' : '1'} unread
      </div>
    </div>
  );
}
