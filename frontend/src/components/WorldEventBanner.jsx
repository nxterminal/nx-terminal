import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function WorldEventBanner() {
  const [event, setEvent] = useState(null);

  useEffect(() => {
    const load = () => {
      api.getEvents()
        .then(events => {
          const active = Array.isArray(events)
            ? events.find(e => e.is_active)
            : null;
          setEvent(active || null);
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 300000);
    return () => clearInterval(iv);
  }, []);

  if (!event) return null;

  return (
    <div style={{
      position: 'fixed', top: 36, right: 8, zIndex: 4,
      fontFamily: "'VT323', monospace", fontSize: 12,
      background: 'rgba(0,0,0,0.7)', border: '1px solid #ffaa0040',
      borderLeft: '3px solid #ffaa00', padding: '4px 10px',
      borderRadius: '2px', maxWidth: 300,
      color: '#ddd', pointerEvents: 'none', userSelect: 'none',
    }}>
      <span style={{ color: '#ffaa00', fontWeight: 'bold' }}>EVENT: </span>
      <span>{event.title}</span>
    </div>
  );
}
