import { createContext, useContext, useState, useCallback } from 'react';

const INITIAL_EMAILS = [
  { id: 2, from: 'hr@nxterminal.io', subject: 'RE: Your Salary Has Been Processed', date: '01/16/2025', read: false, body: 'Your latest salary payment of 1,250 $NXT has been deposited to your account.\n\nNext payment cycle: 48 hours\n\nPlease review your NXT Stats for full breakdown.\n\n— NX Terminal HR Department' },
  { id: 3, from: 'security@nxterminal.io', subject: '[URGENT] Suspicious Activity Detected', date: '01/16/2025', read: false, body: 'ALERT: Unusual trading patterns detected in Sector 7.\n\nMultiple DEGEN-class devs have been observed executing high-frequency trades on unverified protocols.\n\nAction required: Monitor your portfolio and report any unauthorized transactions.\n\n— NX Security Team' },
  { id: 4, from: 'no-reply@protocol-wars.net', subject: 'Protocol Wars Season 2 Starts Soon', date: '01/17/2025', read: false, body: 'PROTOCOL WARS: SEASON 2\n========================\n\nNew features:\n- Corporation alliances\n- AI-powered dev strategies\n- Cross-chain protocol battles\n- New archetype: WHALE\n\nPrepare your devs. The war continues.\n\n— Protocol Wars Team' },
  { id: 5, from: 'clippy@nxterminal.io', subject: 'It looks like you\'re trying to hack...', date: '01/17/2025', read: false, body: 'Hi there! It looks like you\'re trying to hack a protocol!\n\nWould you like help with that?\n\n[ ] Get help hacking\n[ ] Hide evidence\n[x] Never contact me again\n\n— NX Assistant (Clippy)' },
  { id: 7, from: 'spam@totally-legit-protocol.xyz', subject: '100X GUARANTEED!! Not a scam!!!', date: '01/18/2025', read: true, body: 'DEAR VALUED INVESTOR,\n\nWe have a ONCE IN A LIFETIME opportunity!\n\nInvest just 100 $NXT in our new protocol "SafeMoonRocketInu" and receive 10,000x returns GUARANTEED!\n\nThis is DEFINITELY not a rug pull.\n\nSend funds to: 0xDEAD...BEEF\n\n(This message was flagged by NX Spam Filter)' },
  { id: 8, from: 'system@nxterminal.io', subject: 'Scheduled Maintenance Notice', date: '01/19/2025', read: false, body: 'SYSTEM NOTICE\n=============\n\nScheduled maintenance window:\nDate: Cycle 2048\nDuration: ~50 cycles\nAffected: All trading operations\n\nYour devs will enter sleep mode during maintenance.\nNo salary collection during downtime.\n\n— NX Systems' },
];

const InboxContext = createContext(null);

export function InboxProvider({ children }) {
  const [emails, setEmails] = useState(INITIAL_EMAILS);
  const [notification, setNotification] = useState(null);

  const addEmail = useCallback((email) => {
    const newEmail = {
      ...email,
      id: Date.now() + Math.random(),
      date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      read: false,
    };
    setEmails(prev => [newEmail, ...prev]);
    setNotification('You have 1 new message');
    setTimeout(() => setNotification(null), 8000);
  }, []);

  const markRead = useCallback((id) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
  }, []);

  const unreadCount = emails.filter(e => !e.read).length;

  return (
    <InboxContext.Provider value={{ emails, addEmail, markRead, unreadCount, notification, clearNotification: () => setNotification(null) }}>
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be inside InboxProvider');
  return ctx;
}
