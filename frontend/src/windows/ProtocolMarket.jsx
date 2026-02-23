import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import ProtocolChart from '../components/ProtocolChart';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// Generate simulated price history: starts low, ends at current value, with noise
function generatePriceHistory(currentValue, points = 25) {
  const data = [];
  const startValue = Math.max(10, currentValue * (0.1 + Math.random() * 0.3));
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    // S-curve growth
    const base = startValue + (currentValue - startValue) * (progress * progress * (3 - 2 * progress));
    // Add noise +-15%
    const noise = base * (Math.random() * 0.3 - 0.15);
    data.push({ x: i, y: Math.max(1, Math.round(base + noise)) });
  }
  // Ensure last point is exactly current value
  data[data.length - 1].y = currentValue;
  return data;
}

export default function ProtocolMarket() {
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('value');
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('list'); // 'list' | 'chart'

  useEffect(() => {
    setLoading(true);
    api.getProtocols({ sort })
      .then(d => {
        setProtocols(Array.isArray(d) ? d : d.protocols || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sort]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => {
      api.getProtocols({ sort })
        .then(d => setProtocols(Array.isArray(d) ? d : d.protocols || []))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [sort]);

  const handleSelectProtocol = (proto) => {
    setSelected(proto);
    setTab('chart');
  };

  const handleBackToList = () => {
    setTab('list');
    setSelected(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="win-tabs">
        <button
          className={`win-tab${tab === 'list' ? ' active' : ''}`}
          onClick={handleBackToList}
        >
          LIST
        </button>
        <button
          className={`win-tab${tab === 'chart' ? ' active' : ''}`}
          onClick={() => { if (selected) setTab('chart'); }}
          style={{ opacity: selected ? 1 : 0.5 }}
        >
          CHART VIEW
        </button>
      </div>

      <div className="win-panel" style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'list' ? (
          <ProtocolList
            protocols={protocols}
            loading={loading}
            sort={sort}
            setSort={setSort}
            onSelect={handleSelectProtocol}
          />
        ) : selected ? (
          <ProtocolChartView protocol={selected} />
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontFamily: "'VT323', monospace" }}>
            {'>'} Select a protocol from the LIST tab to view its chart.
          </div>
        )}
      </div>
    </div>
  );
}

function ProtocolList({ protocols, loading, sort, setSort, onSelect }) {
  if (loading) {
    return <div className="loading">Loading protocols...</div>;
  }

  if (protocols.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: '12px', padding: '24px',
      }}>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '24px', color: 'var(--text-muted, #555)' }}>[~]</div>
        <div style={{ fontWeight: 'bold', fontSize: '13px', textAlign: 'center', color: 'var(--text-primary, #000)' }}>
          No protocols deployed yet
        </div>
        <div style={{
          fontSize: '11px', color: 'var(--text-muted, #888)', textAlign: 'center',
          fontFamily: "'VT323', monospace", lineHeight: 1.6, maxWidth: '300px',
        }}>
          {'>'} The simulation hasn&apos;t started yet.{'\n'}
          Once your devs begin their cycles, they&apos;ll create protocols, invest in them, and compete for dominance.{'\n\n'}
          {'>'} Deploy devs first. Protocols follow.
        </div>
      </div>
    );
  }

  return (
    <>
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
      <table className="win-table">
        <thead>
          <tr><th>Name</th><th>Creator</th><th>Quality</th><th>Value</th><th>Investors</th></tr>
        </thead>
        <tbody>
          {protocols.map((p, i) => (
            <tr key={p.id || i} className="clickable" onClick={() => onSelect(p)}>
              <td style={{ fontWeight: 'bold' }}>{p.name}</td>
              <td>{p.creator_name || '-'}</td>
              <td>{p.code_quality != null ? `${p.code_quality}/100` : '-'}</td>
              <td style={{ color: 'var(--gold)' }}>{formatNumber(p.value)} $NXT</td>
              <td>{p.investor_count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ProtocolChartView({ protocol }) {
  const [detail, setDetail] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const chartDataRef = useRef(null);
  const markersRef = useRef([]);
  const [, forceUpdate] = useState(0);
  const ws = useWebSocket();
  const processedMsgRef = useRef(new Set());

  // Fetch protocol detail
  useEffect(() => {
    if (protocol.id) {
      api.getProtocol(protocol.id)
        .then(d => setDetail(d))
        .catch(() => {});
    }
  }, [protocol.id]);

  // Generate initial chart data
  if (!chartDataRef.current) {
    chartDataRef.current = generatePriceHistory(protocol.value || 100);
  }

  // Load initial feed and filter for this protocol
  useEffect(() => {
    api.getFeed(100)
      .then(data => {
        const items = Array.isArray(data) ? data : (data.feed || data.actions || []);
        const filtered = items.filter(item => {
          const d = typeof item.details === 'object' && item.details !== null ? item.details : {};
          const name = d.name || d.protocol_name || d.target || '';
          return name === protocol.name;
        });
        setActivityLog(filtered.slice(-20));
      })
      .catch(() => {});
  }, [protocol.name]);

  // Listen for WebSocket events mentioning this protocol
  useEffect(() => {
    if (ws.messages.length === 0) return;
    const latest = ws.messages[0];
    const item = latest.data || latest;
    const msgId = JSON.stringify(item).slice(0, 80);

    if (processedMsgRef.current.has(msgId)) return;
    processedMsgRef.current.add(msgId);

    const d = typeof item.details === 'object' && item.details !== null ? item.details : {};
    const name = d.name || d.protocol_name || d.target || '';

    if (name === protocol.name && chartDataRef.current) {
      // Add new price point
      const lastY = chartDataRef.current[chartDataRef.current.length - 1]?.y || 100;
      const action = (item.action_type || '').toUpperCase();
      let delta = 0;
      if (action === 'INVEST') delta = lastY * (0.02 + Math.random() * 0.05);
      else if (action === 'SELL') delta = -(lastY * (0.01 + Math.random() * 0.04));
      else if (action === 'FORK' || action === 'SABOTAGE') delta = -(lastY * (0.03 + Math.random() * 0.05));
      else delta = lastY * (Math.random() * 0.04 - 0.02);

      const newY = Math.max(1, Math.round(lastY + delta));
      chartDataRef.current = [...chartDataRef.current, { x: chartDataRef.current.length, y: newY }];

      // Add marker
      const markerType = action === 'INVEST' ? 'invest' : (action === 'FORK' || action === 'SABOTAGE') ? 'fork' : 'event';
      markersRef.current = [...markersRef.current, {
        x: chartDataRef.current.length - 1,
        y: newY,
        type: markerType,
        label: `${item.dev_name || '???'} ${action.toLowerCase()} ${d.amount ? d.amount + ' $NXT' : ''}`.trim(),
      }];

      // Add to activity log
      setActivityLog(prev => [...prev, item].slice(-20));

      forceUpdate(n => n + 1);
    }
  }, [ws.messages, protocol.name]);

  const data = detail || protocol;
  const chartData = chartDataRef.current || [];
  const markers = markersRef.current || [];

  // Calculate change percent
  const changePercent = useMemo(() => {
    if (chartData.length < 2) return 0;
    const first = chartData[0].y;
    const last = chartData[chartData.length - 1].y;
    if (first === 0) return 0;
    return ((last - first) / first * 100).toFixed(1);
  }, [chartData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Chart header */}
      <div className="chart-header">
        <span style={{ color: '#33ff33', fontSize: '18px', fontWeight: 'bold' }}>
          {data.name}
        </span>
        <span style={{ color: 'var(--gold)', fontSize: '16px' }}>
          {formatNumber(data.value)} $NXT
        </span>
        <span style={{
          color: changePercent >= 0 ? '#33ff33' : '#ff4444',
          fontSize: '14px',
        }}>
          {changePercent >= 0 ? '\u25B2' : '\u25BC'}{changePercent >= 0 ? '+' : ''}{changePercent}%
        </span>
      </div>

      {/* SVG Chart */}
      <ProtocolChart
        dataPoints={chartData}
        markers={markers}
      />

      {/* Activity Log */}
      <div style={{ padding: '4px 8px 0' }}>
        <span style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: '#888' }}>
          Activity Log
        </span>
      </div>
      <div className="chart-activity-log" style={{ margin: '0 8px 4px', flex: '0 0 auto' }}>
        {activityLog.length === 0 ? (
          <div style={{ color: '#555' }}>{'>'} No activity recorded for this protocol yet...</div>
        ) : (
          activityLog.map((item, i) => {
            const d = typeof item.details === 'object' && item.details !== null ? item.details : {};
            const action = (item.action_type || '').toUpperCase();
            const amount = d.amount || d.cost || '???';
            return (
              <div key={i} className="chart-activity-line">
                <span style={{ color: '#888' }}>[{formatTime(item.created_at)}]</span>{' '}
                <span style={{ color: '#33ff33' }}>{item.dev_name || '???'}</span>{' '}
                <span style={{ color: action === 'INVEST' ? '#ffaa00' : action === 'SELL' ? '#ff4444' : '#00ffff' }}>
                  {action === 'INVEST' ? `invested +${amount} $NXT` :
                   action === 'SELL' ? `sold -${amount} $NXT` :
                   action === 'CREATE_PROTOCOL' ? `created this protocol` :
                   `${action.toLowerCase()}`}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="chart-footer">
        <span>Creator: <span style={{ color: '#33ff33' }}>{data.creator_name || '-'}</span></span>
        <span>Investors: <span style={{ color: '#ffaa00' }}>{data.investor_count ?? 0}</span></span>
        <span>Quality: <span style={{ color: '#4488ff' }}>{data.code_quality ?? '?'}/100</span></span>
      </div>
    </div>
  );
}
