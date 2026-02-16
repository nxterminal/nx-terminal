import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

export default function ProtocolMarket() {
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('value');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.getProtocols({ sort })
      .then(d => {
        setProtocols(Array.isArray(d) ? d : d.protocols || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sort]);

  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px', borderBottom: '1px solid var(--border-dark)' }}>
          <button className="win-btn" onClick={() => setSelected(null)}>&lt; Back</button>
        </div>
        <ProtocolDetail protocol={selected} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
        <span>Sort:</span>
        {['value', 'code_quality', 'investor_count'].map(s => (
          <button
            key={s}
            className={`win-btn${sort === s ? ' active' : ''}`}
            onClick={() => setSort(s)}
            style={{ fontSize: '10px', padding: '2px 6px' }}
          >
            {s === 'code_quality' ? 'Quality' : s === 'investor_count' ? 'Investors' : 'Value'}
          </button>
        ))}
      </div>

      <div className="win-panel" style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div className="loading">Loading protocols...</div>
        ) : (
          <table className="win-table">
            <thead>
              <tr><th>Name</th><th>Creator</th><th>Quality</th><th>Value</th><th>Investors</th></tr>
            </thead>
            <tbody>
              {protocols.map((p, i) => (
                <tr key={p.id || i} className="clickable" onClick={() => setSelected(p)}>
                  <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                  <td>{p.creator_name || '-'}</td>
                  <td>{p.code_quality != null ? `${p.code_quality}/100` : '-'}</td>
                  <td style={{ color: 'var(--gold)' }}>{formatNumber(p.value)} $NXT</td>
                  <td>{p.investor_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ProtocolDetail({ protocol }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (protocol.id) {
      api.getProtocol(protocol.id)
        .then(d => setDetail(d))
        .catch(() => {});
    }
  }, [protocol.id]);

  const data = detail || protocol;

  return (
    <div style={{ padding: '8px', overflow: 'auto', flex: 1 }}>
      <h3 style={{ fontFamily: "'VT323', monospace", fontSize: '20px', color: 'var(--terminal-green)', margin: '0 0 8px' }}>
        {data.name}
      </h3>
      <p style={{ fontSize: '11px', marginBottom: '8px' }}>{data.description || 'No description'}</p>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-box win-panel">
          <div className="stat-label">Value</div>
          <div className="stat-value" style={{ color: 'var(--gold)' }}>{formatNumber(data.value)}</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Quality</div>
          <div className="stat-value">{data.code_quality ?? '?'}/100</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Investors</div>
          <div className="stat-value">{data.investor_count ?? 0}</div>
        </div>
        <div className="stat-box win-panel">
          <div className="stat-label">Creator</div>
          <div className="stat-value" style={{ fontSize: '11px' }}>{data.creator_name || '-'}</div>
        </div>
      </div>

      {detail?.investors && detail.investors.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Investors:</div>
          <table className="win-table">
            <thead><tr><th>Dev</th><th>Amount</th></tr></thead>
            <tbody>
              {detail.investors.map((inv, i) => (
                <tr key={i}>
                  <td>{inv.dev_name || inv.name || `Dev #${inv.dev_id}`}</td>
                  <td>{formatNumber(inv.amount)} $NXT</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
