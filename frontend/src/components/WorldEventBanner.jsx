import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatTimeLeft(endsAt) {
  const diff = new Date(endsAt) - new Date();
  if (diff <= 0) return 'Ended';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

export default function WorldEventBanner() {
  const [event, setEvent] = useState(null);

  useEffect(() => {
    api.getEvents()
      .then(events => {
        const active = Array.isArray(events)
          ? events.find(e => e.is_active && new Date(e.ends_at) > new Date())
          : null;
        if (active) setEvent(active);
      })
      .catch(() => {});
    const iv = setInterval(() => {
      api.getEvents()
        .then(events => {
          const active = Array.isArray(events)
            ? events.find(e => e.is_active && new Date(e.ends_at) > new Date())
            : null;
          setEvent(active || null);
        })
        .catch(() => {});
    }, 300000); // refresh every 5min
    return () => clearInterval(iv);
  }, []);

  if (!event) return null;

  return (
    <div style={{
      position: 'fixed', top: 8, left: 8, zIndex: 5,
      fontFamily: "'VT323', monospace", fontSize: 12,
      background: 'rgba(0,0,0,0.75)', border: '1px solid #ffaa0040',
      borderLeft: '3px solid #ffaa00', padding: '4px 10px',
      color: '#e0e0e0', maxWidth: 340, pointerEvents: 'none',
      userSelect: 'none',
    }}>
      <span style={{ color: '#ffaa00', fontWeight: 'bold' }}>EVENT: </span>
      <span>{event.title}</span>
      <span style={{ color: '#666', marginLeft: 6 }}>{formatTimeLeft(event.ends_at)}</span>
    </div>
  );
}
