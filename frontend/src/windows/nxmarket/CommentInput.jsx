import { useState } from 'react';
import { api } from '../../services/api';


const MAX_LEN = 500;


export default function CommentInput({ marketId, wallet, onPosted }) {
  const [text, setText] = useState('');
  const [stage, setStage] = useState('idle'); // 'idle' | 'submitting'
  const [error, setError] = useState(null);

  const trimmedLen = text.trim().length;
  const charCount = text.length;
  const canSubmit = !!wallet && trimmedLen > 0 && trimmedLen <= MAX_LEN
    && stage === 'idle';

  const submit = async () => {
    if (!canSubmit) return;
    setStage('submitting');
    setError(null);
    try {
      await api.createComment(marketId, wallet, text.trim());
      setText('');
      onPosted && onPosted();
    } catch (e) {
      // Rate limit surfaces as 429 via fetchJSON's thrown Error whose
      // message starts with "Rate limited".
      const msg = (e && e.message) || '';
      if (msg.toLowerCase().includes('rate limited')) {
        setError('Please wait before posting another comment.');
      } else {
        setError('Failed to post comment. Try again.');
      }
    } finally {
      setStage('idle');
    }
  };

  let counterColor = '#777';
  if (charCount > 450 && charCount < 500) counterColor = '#a07a00';
  if (charCount >= 500) counterColor = '#b71c1c';

  const disabledReason = !wallet ? 'Connect wallet to comment'
    : trimmedLen === 0 ? 'Type something to post'
    : trimmedLen > MAX_LEN ? `Too long (${trimmedLen}/${MAX_LEN})`
    : null;

  return (
    <div className="win-panel" style={{
      padding: 8, marginBottom: 10, background: '#ffffff',
      fontFamily: 'Tahoma, sans-serif',
    }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX_LEN + 20))}
        placeholder={wallet ? 'Add a comment...' : 'Connect wallet to comment'}
        disabled={!wallet || stage === 'submitting'}
        rows={3}
        style={{
          width: '100%', padding: 6, boxSizing: 'border-box',
          fontFamily: 'Tahoma, sans-serif', fontSize: 12,
          background: wallet ? '#fff' : '#eee',
          border: '2px inset #888', resize: 'vertical', minHeight: 60,
        }}
      />
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 6,
      }}>
        <span style={{ fontSize: 11, color: counterColor }}>
          {charCount}/{MAX_LEN}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && (
            <span style={{
              fontSize: 11, color: '#b71c1c', fontWeight: 'bold',
            }}>{error}</span>
          )}
          <button
            onClick={submit}
            className="win-btn"
            disabled={!canSubmit}
            title={disabledReason || undefined}
            style={{
              padding: '4px 14px', fontSize: 12, fontWeight: 'bold',
            }}>
            {stage === 'submitting' ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
