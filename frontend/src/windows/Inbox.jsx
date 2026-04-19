import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useWallet } from '../hooks/useWallet';

function loadSavedEmails() {
  const saved = localStorage.getItem('nx-inbox-emails');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return parsed;
    } catch {}
  }
  return null;
}

function saveEmails(emails) {
  const toSave = emails.map(({ id, from, subject, date, dateRaw, read, body, notifId, notifType, sentByMe }) =>
    ({ id, from, subject, date, dateRaw, read, body, notifId, notifType, sentByMe }));
  localStorage.setItem('nx-inbox-emails', JSON.stringify(toSave));
}

// Map backend notification type → display sender
const TYPE_SENDERS = {
  welcome: 'NX Terminal System <system@nxterminal.corp>',
  broadcast: 'NX Terminal System <system@nxterminal.corp>',
  streak_claim: 'NX Terminal HR <hr@nxterminal.corp>',
  achievement: 'NX Terminal Systems <alerts@nxterminal.corp>',
  vip_welcome: 'Ariel <founder@nxterminal.corp>',
  vip_alert: 'NX Terminal Ops <ops@nxterminal.corp>',
  vip_mint: 'NX Terminal Ops <ops@nxterminal.corp>',
  dev_deployed: 'NX Terminal Deployment <deploy@nxterminal.corp>',
  hack_received: 'NX Terminal Security <security@nxterminal.corp>',
  world_event: 'NX Terminal Ops <ops@nxterminal.corp>',
  prompt_response: 'NX Terminal <prompts@nxterminal.corp>',
  ticket_sent: 'Me <outgoing>',
  ticket_response: 'NX Terminal Support <support@nxterminal.corp>',
  ticket_received: 'NX Terminal Tickets <tickets@nxterminal.corp>',
};
const ALLOWED_NOTIF_TYPES = new Set(Object.keys(TYPE_SENDERS));

const SENT_TYPES = new Set(['ticket_sent']);

function notifToEmail(n) {
  const d = n.created_at ? new Date(n.created_at) : new Date();
  return {
    id: `notif-${n.id}`,
    notifId: n.id,
    notifType: n.type,
    from: TYPE_SENDERS[n.type] || 'NX Terminal <system@nxterminal.corp>',
    subject: n.title || '(no subject)',
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    dateRaw: d,
    read: !!n.read,
    body: n.body || '',
    sentByMe: SENT_TYPES.has(n.type),
  };
}

// Wallets allowed to operate the Support Tickets admin panel. Kept in
// sync with backend/api/routes/admin.py::ADMIN_WALLETS — the backend
// remains the source of truth (any non-admin wallet gets 403 on these
// endpoints), but mirroring the set client-side lets us hide the tab
// from non-admin users so the UI doesn't advertise a feature they
// can't reach.
const TICKET_ADMIN_WALLETS = new Set([
  '0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc',
  '0xae882a8933b33429f53b7cee102ef3dbf9c9e88b',
]);

function isTicketAdmin(wallet) {
  return !!wallet && TICKET_ADMIN_WALLETS.has(wallet.toLowerCase());
}

function formatTicketTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortWallet(w) {
  if (!w || w.length < 10) return w || '';
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function TicketReplyModal({ ticket, adminWallet, onClose, onReplied }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  const MAX = 4000;
  const canSend = text.trim().length > 0 && text.length <= MAX && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setStatus(null);
    try {
      await api.replyToTicket(adminWallet, ticket.id, text.trim());
      setStatus('sent');
      if (onReplied) onReplied();
    } catch (err) {
      const msg = (typeof err.detail === 'string' ? err.detail : null)
        || err.message || 'Failed to send reply';
      setStatus(msg);
      setSending(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 10030, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="win-raised"
        style={{ width: '520px', maxHeight: '80vh', background: 'var(--win-bg)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{
          background: 'linear-gradient(90deg, #000080, #1084d0)',
          color: '#fff', padding: '3px 6px', fontSize: 'var(--text-base)',
          fontWeight: 'bold', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Reply to Ticket #{ticket.id}</span>
          <button onClick={onClose} style={{
            background: '#c0c0c0', border: '1px outset #fff',
            fontWeight: 'bold', cursor: 'pointer', fontSize: 'var(--text-xs)',
            padding: '0 4px', lineHeight: 1,
          }}>X</button>
        </div>

        <div style={{ padding: '10px 12px', overflow: 'auto', fontSize: 'var(--text-sm)' }}>
          <div className="win-panel" style={{ padding: '8px 10px', marginBottom: '10px' }}>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>From: </span>
              <code style={{ fontFamily: "'VT323', monospace" }}>{ticket.player_address}</code>
              {ticket.display_name && (
                <span style={{ marginLeft: '6px', fontWeight: 'bold' }}>({ticket.display_name})</span>
              )}
            </div>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Received: </span>
              {new Date(ticket.created_at).toLocaleString()}
            </div>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Subject: </span>
              <span style={{ fontWeight: 'bold' }}>{ticket.subject}</span>
            </div>
          </div>

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Original message
          </div>
          <div className="win-panel" style={{
            padding: '6px 8px', marginBottom: '10px',
            maxHeight: '160px', overflowY: 'auto', whiteSpace: 'pre-wrap',
            background: '#fff',
          }}>
            {ticket.message}
          </div>

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Your reply (delivered as an in-game notification)
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type your reply..."
            disabled={sending || status === 'sent'}
            style={{
              width: '100%', minHeight: '140px', padding: '6px 8px',
              fontSize: 'var(--text-sm)', fontFamily: "'Tahoma', sans-serif",
              boxShadow: 'inset 1px 1px 0 var(--border-dark), inset -1px -1px 0 var(--border-light)',
              border: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
            marginTop: '4px',
          }}>
            <span>{text.length}/{MAX}</span>
            {status && status !== 'sent' && (
              <span style={{ color: 'var(--red-on-grey)' }}>{status}</span>
            )}
            {status === 'sent' && (
              <span style={{ color: 'var(--green-on-grey)' }}>Reply sent. Ticket closed.</span>
            )}
          </div>
        </div>

        <div style={{ padding: '8px 12px', display: 'flex', gap: '6px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-dark)' }}>
          <button
            className="win-btn"
            onClick={onClose}
            style={{ fontSize: 'var(--text-xs)', padding: '3px 14px' }}
          >
            {status === 'sent' ? 'Close' : 'Cancel'}
          </button>
          <button
            className="win-btn"
            disabled={!canSend || status === 'sent'}
            onClick={handleSend}
            style={{ fontSize: 'var(--text-xs)', padding: '3px 14px', fontWeight: 'bold' }}
          >
            {sending ? 'Sending...' : 'Send Reply'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminTicketsPanel({ adminWallet }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const fetchTickets = () => {
    setLoadError(null);
    api.getAdminTickets(adminWallet, 'open')
      .then(res => {
        setTickets(Array.isArray(res?.tickets) ? res.tickets : []);
      })
      .catch(err => {
        const msg = (typeof err.detail === 'string' ? err.detail : null)
          || err.message || 'Failed to load tickets';
        setLoadError(msg);
        setTickets([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!adminWallet) { setLoading(false); return; }
    fetchTickets();
    const iv = setInterval(fetchTickets, 60000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminWallet]);

  if (loading) {
    return (
      <div style={{ padding: '16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        Loading tickets...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: '16px', fontSize: 'var(--text-sm)', color: 'var(--red-on-grey)' }}>
        {loadError}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {tickets.length === 0 ? (
        <div style={{
          padding: '24px', textAlign: 'center',
          fontSize: 'var(--text-sm)', color: 'var(--text-muted)',
        }}>
          No open tickets.
        </div>
      ) : (
        <table className="win-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>From</th>
              <th>Subject</th>
              <th style={{ width: '100px' }}>Received</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr
                key={t.id}
                className="clickable"
                onClick={() => setSelected(t)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ fontSize: 'var(--text-xs)', fontFamily: "'VT323', monospace" }}>
                  {shortWallet(t.player_address)}
                  {t.display_name && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                      {t.display_name}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 'var(--text-sm)' }}>
                  <div style={{ fontWeight: 'bold' }}>{t.subject}</div>
                  <div style={{
                    fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: '320px',
                  }}>
                    {(t.message || '').slice(0, 100)}
                  </div>
                </td>
                <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {formatTicketTime(t.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <TicketReplyModal
          ticket={selected}
          adminWallet={adminWallet}
          onClose={() => setSelected(null)}
          onReplied={() => { fetchTickets(); }}
        />
      )}
    </div>
  );
}

function getSenderGroup(email) {
  if (email.sentByMe) return 'Sent';
  const name = (email.from || '').split('<')[0].trim();
  if (name === 'NX Terminal System') return 'NX Terminal System';
  return 'Other';
}

export default function Inbox({ onUnreadCount, walletAddress: walletProp }) {
  const { address: walletHookAddr } = useWallet();
  const wallet = walletProp || walletHookAddr;
  const [emails, setEmails] = useState(() => loadSavedEmails() || []);
  const [selectedId, setSelectedId] = useState(null);
  const [activeGroup, setActiveGroup] = useState('All');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortAsc, setSortAsc] = useState(false);
  const [composing, setComposing] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeStatus, setComposeStatus] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const unreadCount = emails.filter(e => !e.read).length;

  useEffect(() => {
    if (onUnreadCount) onUnreadCount(unreadCount);
    window.dispatchEvent(new CustomEvent('nx-inbox-unread', { detail: unreadCount }));
  }, [unreadCount, onUnreadCount]);

  // Fetch backend notifications and merge with local state
  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    api.getNotifications(wallet).then(notifs => {
      if (cancelled || !Array.isArray(notifs)) return;
      const backendEmails = notifs
        .filter(n => ALLOWED_NOTIF_TYPES.has(n.type))
        .map(notifToEmail);
      setEmails(prev => {
        // Preserve local read-state for emails the user already clicked
        const prevById = new Map(prev.map(e => [e.id, e]));
        const merged = backendEmails.map(be => {
          const existing = prevById.get(be.id);
          return existing?.read ? { ...be, read: true } : be;
        });
        saveEmails(merged);
        return merged;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [wallet]);

  const handleSelect = (email) => {
    setSelectedId(email.id);
    if (!email.read) {
      const updated = emails.map(e => e.id === email.id ? { ...e, read: true } : e);
      setEmails(updated);
      saveEmails(updated);
      // Mark backend notification as read
      if (email.notifId) {
        api.markNotificationRead(email.notifId).catch(() => {});
      }
    }
  };

  const selectedEmail = emails.find(e => e.id === selectedId);

  // Admin gate — drives both the "Support Tickets" tab visibility and
  // the backend credential for list/reply requests. Backend also gates
  // (403 on non-admin), so mirroring client-side is for UX only.
  const isAdmin = isTicketAdmin(wallet);
  const TICKETS_GROUP = 'Support Tickets';
  const ticketsActive = isAdmin && activeGroup === TICKETS_GROUP;

  // Compute available groups from emails
  const groups = ['All'];
  const groupSet = new Set();
  emails.forEach(e => {
    const g = getSenderGroup(e);
    if (!groupSet.has(g)) { groupSet.add(g); groups.push(g); }
  });
  if (isAdmin) groups.push(TICKETS_GROUP);

  const filteredEmails = activeGroup === 'All'
    ? emails
    : emails.filter(e => getSenderGroup(e) === activeGroup);

  const sortedEmails = [...filteredEmails].sort((a, b) => {
    const da = new Date(a.dateRaw || a.date);
    const db = new Date(b.dateRaw || b.date);
    return sortAsc ? da - db : db - da;
  });

  const toggleSelect = (emailId, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId);
      else next.add(emailId);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allSelected = filteredEmails.every(e => selectedIds.has(e.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmails.map(e => e.id)));
    }
  };

  const handleMarkSelectedRead = () => {
    if (selectedIds.size === 0) return;
    const updated = emails.map(e =>
      selectedIds.has(e.id) ? { ...e, read: true } : e
    );
    setEmails(updated);
    saveEmails(updated);
    // Mark backend notifications as read
    emails.forEach(e => {
      if (selectedIds.has(e.id) && !e.read && e.notifId) {
        api.markNotificationRead(e.notifId).catch(() => {});
      }
    });
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    // Mark any unread-but-deleted backend notifications as read first,
    // otherwise the desktop unread poll will reinstate the red dot 30s later.
    emails.forEach(e => {
      if (selectedIds.has(e.id) && !e.read && e.notifId) {
        api.markNotificationRead(e.notifId).catch(() => {});
      }
    });
    const updated = emails.filter(e => !selectedIds.has(e.id));
    setEmails(updated);
    saveEmails(updated);
    setSelectedIds(new Set());
    if (selectedId && selectedIds.has(selectedId)) setSelectedId(null);
  };

  const selectedUnreadCount = [...selectedIds].filter(id => {
    const e = emails.find(em => em.id === id);
    return e && !e.read;
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        padding: '4px 8px',
        background: 'var(--win-bg)',
        borderBottom: '1px solid var(--border-dark)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: 'var(--text-sm)',
      }}>
        <span style={{ fontWeight: 'bold' }}>NX Mail</span>
        <span style={{ color: 'var(--text-secondary)' }}>|</span>
        <span>{unreadCount} unread</span>
        {!selectedEmail && !composing && (
          <>
            <span style={{ color: 'var(--text-secondary)' }}>|</span>
            <button
              className="win-btn"
              onClick={() => { setComposing(true); setSelectedId(null); setComposeStatus(null); }}
              disabled={!wallet}
              style={{ fontSize: 'var(--text-xs)', padding: '1px 8px' }}
            >
              {'\u2709'} New
            </button>
          </>
        )}
        {composing && !selectedEmail ? (
          <>
            <span style={{ color: 'var(--text-secondary)' }}>|</span>
            <button
              className="win-btn"
              onClick={() => { setComposing(false); setComposeStatus(null); }}
              style={{ fontSize: 'var(--text-xs)', padding: '1px 8px' }}
            >
              Back to Inbox
            </button>
          </>
        ) : selectedEmail ? (
          <>
            <span style={{ color: 'var(--text-secondary)' }}>|</span>
            <button
              className="win-btn"
              onClick={() => setSelectedId(null)}
              style={{ fontSize: 'var(--text-xs)', padding: '1px 8px' }}
            >
              Back to Inbox
            </button>
          </>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <>
                <span style={{ color: 'var(--text-secondary)' }}>|</span>
                <span style={{ fontWeight: 'bold' }}>{selectedIds.size} selected</span>
                <button
                  className="win-btn"
                  onClick={handleMarkSelectedRead}
                  disabled={selectedUnreadCount === 0}
                  style={{ fontSize: 'var(--text-xs)', padding: '1px 8px' }}
                >
                  Mark as Read ({selectedUnreadCount})
                </button>
                <button
                  className="win-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ fontSize: 'var(--text-xs)', padding: '1px 8px' }}
                >
                  Delete ({selectedIds.size})
                </button>
                <button
                  className="win-btn"
                  onClick={() => setSelectedIds(new Set())}
                  style={{ fontSize: 'var(--text-xs)', padding: '1px 8px' }}
                >
                  Clear
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Group filter tabs */}
      {!selectedEmail && (
        <div style={{
          display: 'flex', gap: '0', padding: '0 4px',
          borderBottom: '1px solid var(--border-dark)',
          background: 'var(--win-bg)', flexWrap: 'wrap',
        }}>
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              style={{
                padding: '2px 8px',
                fontSize: 'var(--text-xs)',
                fontFamily: "'Tahoma', sans-serif",
                cursor: 'pointer',
                border: 'none',
                borderBottom: activeGroup === g ? '2px solid var(--selection)' : '2px solid transparent',
                background: activeGroup === g ? 'var(--win-bg)' : 'transparent',
                fontWeight: activeGroup === g ? 'bold' : 'normal',
                color: activeGroup === g ? 'var(--text-primary, #000)' : 'var(--text-muted, #666)',
              }}
            >
              {g}
              {g !== 'All' && (() => {
                const count = emails.filter(e => getSenderGroup(e) === g && !e.read).length;
                return count > 0 ? ` (${count})` : '';
              })()}
            </button>
          ))}
        </div>
      )}

      {composing && !selectedEmail ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: 'var(--text-sm)' }}>
            <span style={{ fontWeight: 'bold' }}>To:</span>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>NX Terminal Support</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)' }}>
            <span style={{ fontWeight: 'bold' }}>Subject:</span>
            <input
              type="text"
              value={composeSubject}
              onChange={e => setComposeSubject(e.target.value)}
              maxLength={200}
              placeholder="Brief description..."
              style={{
                flex: 1, padding: '2px 4px', fontSize: 'var(--text-sm)',
                boxShadow: 'inset 1px 1px 0 var(--border-dark), inset -1px -1px 0 var(--border-light)',
                border: 'none',
              }}
            />
          </div>
          <textarea
            value={composeBody}
            onChange={e => setComposeBody(e.target.value)}
            maxLength={2000}
            placeholder="Your message..."
            rows={10}
            style={{
              flex: 1, padding: '4px', fontSize: 'var(--text-sm)',
              fontFamily: "'Tahoma', sans-serif",
              boxShadow: 'inset 1px 1px 0 var(--border-dark), inset -1px -1px 0 var(--border-light)',
              border: 'none', resize: 'vertical',
            }}
          />
          {composeStatus && (
            <div style={{ fontSize: 'var(--text-xs)', color: composeStatus.includes('sent') || composeStatus.includes('Ticket') ? 'var(--green-on-grey)' : 'var(--red-on-grey)' }}>
              {composeStatus}
            </div>
          )}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="win-btn"
              disabled={composeSending || !composeSubject.trim() || !composeBody.trim()}
              onClick={async () => {
                setComposeSending(true);
                try {
                  const res = await api.submitTicket(wallet, composeSubject, composeBody);
                  setComposeStatus(`Message sent. Ticket #${res.ticket_id}. HR will probably ignore it.`);
                  setComposeSubject('');
                  setComposeBody('');
                  setTimeout(() => { setComposing(false); setComposeStatus(null); }, 3000);
                  api.getNotifications(wallet).then(notifs => {
                    if (!Array.isArray(notifs)) return;
                    const backendEmails = notifs.filter(n => ALLOWED_NOTIF_TYPES.has(n.type)).map(notifToEmail);
                    setEmails(backendEmails);
                    saveEmails(backendEmails);
                  }).catch(() => {});
                } catch (err) {
                  const msg = (typeof err.detail === 'string' ? err.detail : null)
                    || err.message
                    || 'Failed to send. Try again.';
                  setComposeStatus(msg);
                }
                setComposeSending(false);
              }}
              style={{ fontSize: 'var(--text-xs)', padding: '2px 12px' }}
            >
              Send
            </button>
            <button
              className="win-btn"
              onClick={() => { setComposing(false); setComposeStatus(null); }}
              style={{ fontSize: 'var(--text-xs)', padding: '2px 12px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : ticketsActive ? (
        <AdminTicketsPanel adminWallet={wallet} />
      ) : !selectedEmail ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table className="win-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '24px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredEmails.length > 0 && filteredEmails.every(e => selectedIds.has(e.id))}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ width: '20px' }}></th>
                <th>From</th>
                <th>Subject</th>
                <th
                  style={{ width: '100px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setSortAsc(prev => !prev)}
                >
                  Date {sortAsc ? '\u25B2' : '\u25BC'}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedEmails.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No messages in this group
                  </td>
                </tr>
              ) : sortedEmails.map(email => (
                <tr
                  key={email.id}
                  className="clickable"
                  onClick={() => handleSelect(email)}
                  style={{
                    fontWeight: email.read ? 'normal' : 'bold',
                    background: selectedIds.has(email.id) ? 'var(--selection)' : undefined,
                    color: selectedIds.has(email.id) ? 'var(--selection-text)' : undefined,
                  }}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(email.id)}
                      onChange={(e) => toggleSelect(email.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {email.read ? '-' : '>'}
                  </td>
                  <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {email.from.split('<')[0].trim()}
                  </td>
                  <td>{email.subject}</td>
                  <td>{email.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-dark)' }}>
            <div style={{ fontWeight: 'bold', fontSize: 'var(--text-base)', marginBottom: '4px' }}>{selectedEmail.subject}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>From: {selectedEmail.from}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Date: {selectedEmail.date}</div>
          </div>
          <pre style={{
            fontFamily: "'Tahoma', sans-serif",
            fontSize: 'var(--text-sm)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}>
            {selectedEmail.body}
          </pre>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          onClick={() => setShowDeleteConfirm(false)}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', inset: 0, zIndex: 10600,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: 320, background: 'var(--win-bg)',
              boxShadow:
                'inset -1px -1px 0 #000,' +
                'inset 1px 1px 0 var(--border-light),' +
                'inset -2px -2px 0 var(--border-dark),' +
                'inset 2px 2px 0 #dfdfdf',
              fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
            }}
          >
            <div style={{
              background: 'linear-gradient(90deg, var(--win-title-l), var(--win-title-r))',
              color: '#fff', padding: '3px 6px', fontSize: 'var(--text-sm)', fontWeight: 'bold',
            }}>
              NX Terminal — Confirm Delete
            </div>
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-sm)', marginBottom: '14px', lineHeight: 1.4 }}>
                {'\u26A0\uFE0F'} Are you sure you want to delete {selectedIds.size} email{selectedIds.size > 1 ? 's' : ''}?
                <br /><br />
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  HR advises against destroying corporate correspondence.
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button className="win-btn"
                  onClick={() => { handleDeleteSelected(); setShowDeleteConfirm(false); }}
                  style={{ padding: '4px 24px', fontSize: 'var(--text-sm)', fontWeight: 'bold', minWidth: 72 }}
                  autoFocus
                >Delete</button>
                <button className="win-btn"
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{ padding: '4px 24px', fontSize: 'var(--text-sm)', minWidth: 72 }}
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
