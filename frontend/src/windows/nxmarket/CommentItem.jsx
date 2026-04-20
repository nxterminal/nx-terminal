import { useState } from 'react';


function shortAddr(addr) {
  if (!addr) return '?';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtRel(iso) {
  if (!iso) return '';
  const diffMs = new Date(iso).getTime() - Date.now();
  const sec = Math.round(diffMs / 1000);
  const abs = Math.abs(sec);
  const past = sec < 0;
  let v, u;
  if (abs < 60) { v = abs; u = 'sec'; }
  else if (abs < 3600) { v = Math.round(abs / 60); u = 'min'; }
  else if (abs < 86400) { v = Math.round(abs / 3600); u = 'h'; }
  else { v = Math.round(abs / 86400); u = 'd'; }
  return past ? `${v} ${u} ago` : `in ${v} ${u}`;
}


function VoteButton({ icon, count, active, activeColor, disabled, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', fontSize: 12,
        background: active ? `${activeColor}22` : hover && !disabled ? '#eee' : 'transparent',
        border: `1px solid ${active ? activeColor : '#bbb'}`,
        color: active ? activeColor : '#555',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'Tahoma, sans-serif', fontWeight: active ? 'bold' : 'normal',
        opacity: disabled ? 0.55 : 1,
      }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span>{count}</span>
    </button>
  );
}


export default function CommentItem({
  comment, currentWallet, isAdmin, onDelete, onVote,
}) {
  const isDeleted = comment.is_deleted;
  const isOwn = currentWallet
    && comment.wallet_address?.toLowerCase() === currentWallet.toLowerCase();
  const canDelete = !isDeleted && (isOwn || isAdmin);

  const handleVote = (type) => {
    if (!currentWallet || isDeleted) return;
    const next = comment.my_vote === type ? 'none' : type;
    onVote(comment.id, next);
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm('Delete this comment? This cannot be undone.');
      if (!ok) return;
    }
    onDelete(comment.id);
  };

  return (
    <div className="win-panel" style={{
      padding: 8, marginBottom: 8, background: '#ffffff',
      fontFamily: 'Tahoma, sans-serif',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 4,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 'bold', color: '#555',
          fontFamily: 'monospace',
        }}>
          {shortAddr(comment.wallet_address)}
        </span>
        <span style={{ fontSize: 10, color: '#999' }}>
          {fmtRel(comment.created_at)}
        </span>
      </div>

      <div style={{
        fontSize: 12, lineHeight: 1.4, color: isDeleted ? '#999' : '#222',
        fontStyle: isDeleted ? 'italic' : 'normal',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {comment.body}
      </div>

      {!isDeleted && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          marginTop: 8,
        }}>
          <VoteButton
            icon="👍"
            count={comment.like_count}
            active={comment.my_vote === 'like'}
            activeColor="#1e8449"
            disabled={!currentWallet}
            onClick={() => handleVote('like')}
          />
          <VoteButton
            icon="👎"
            count={comment.dislike_count}
            active={comment.my_vote === 'dislike'}
            activeColor="#a93226"
            disabled={!currentWallet}
            onClick={() => handleVote('dislike')}
          />
          <div style={{ flex: 1 }} />
          {canDelete && (
            <button
              onClick={handleDelete}
              className="win-btn"
              style={{
                padding: '2px 8px', fontSize: 11,
                color: '#a93226', fontWeight: 'bold',
              }}
              title={isAdmin && !isOwn ? 'Admin delete' : 'Delete your comment'}>
              {isAdmin && !isOwn ? 'Delete (admin)' : 'Delete'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
