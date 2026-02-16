import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AILab() {
  const [ais, setAIs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAIs()
      .then(d => {
        setAIs(Array.isArray(d) ? d : d.ais || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading">Loading absurd AIs...</div>;
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{
        padding: '8px',
        fontFamily: "'VT323', monospace",
        fontSize: '16px',
        color: 'var(--terminal-magenta)',
        background: 'var(--terminal-bg)',
        textAlign: 'center',
      }}>
        {'>> ABSURD AI LABORATORY <<'}
      </div>

      <table className="win-table">
        <thead>
          <tr><th>#</th><th>Name</th><th>Description</th><th>Votes</th><th>Creator</th></tr>
        </thead>
        <tbody>
          {ais.map((ai, i) => (
            <tr key={ai.id || i}>
              <td style={{
                color: i < 3 ? 'var(--gold)' : undefined,
                fontWeight: i < 3 ? 'bold' : undefined,
              }}>
                {i + 1}
              </td>
              <td style={{ fontWeight: 'bold', color: 'var(--terminal-magenta)' }}>
                {ai.name}
              </td>
              <td style={{
                whiteSpace: 'normal',
                maxWidth: '300px',
                fontSize: '10px',
              }}>
                {ai.description}
              </td>
              <td>{ai.vote_count ?? ai.votes ?? 0}</td>
              <td>{ai.creator_name || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {ais.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--border-dark)' }}>
          No AIs created yet. The devs are still warming up...
        </div>
      )}
    </div>
  );
}
