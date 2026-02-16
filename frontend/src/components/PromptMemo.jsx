import { useState } from 'react';
import { api } from '../services/api';
import { IconMemo } from './icons';

const QUICK_ACTIONS = [
  'Invest in top protocol',
  'Build DeFi protocol',
  'Make AI about cats',
  'Get intel on rivals',
  'Sabotage rival corp',
];

export default function PromptMemo({ devId, devName, onClose }) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState(null);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setSending(true);
    try {
      const result = await api.sendPrompt(devId, prompt);
      setResponse(result.response || result.message || JSON.stringify(result));
    } catch {
      setResponse('Error: Could not deliver memo. Dev might be busy.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="memo-modal" onClick={e => e.stopPropagation()}>
        <div className="win98-titlebar" style={{ cursor: 'default' }}>
          <span className="win98-titlebar-icon"><IconMemo size={16} /></span>
          <span className="win98-titlebar-title">Memo \u2014 {devName || `Dev #${devId}`}</span>
          <div className="win98-titlebar-buttons">
            <button className="win98-titlebar-btn" onClick={onClose}>
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>x</span>
            </button>
          </div>
        </div>
        <div style={{ padding: '8px' }}>
          <textarea
            className="memo-textarea"
            placeholder="Write a memo to your dev..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0' }}>
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                className="win-btn"
                onClick={() => setPrompt(action)}
                style={{ fontSize: '10px', padding: '2px 6px' }}
              >
                {action}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
            <button className="win-btn" onClick={onClose}>Cancel</button>
            <button
              className="win-btn primary"
              onClick={handleSend}
              disabled={sending || !prompt.trim()}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {response && (
            <div className="memo-response" style={{ marginTop: '8px' }}>
              <div style={{ color: 'var(--terminal-amber)', marginBottom: '4px' }}>
                {'>'} Response from {devName || `Dev #${devId}`}:
              </div>
              <div>{response}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
