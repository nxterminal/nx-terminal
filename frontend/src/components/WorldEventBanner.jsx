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
      position: 'fixed', top: 130, right: 10, zIndex: 2,
      pointerEvents: 'none', userSelect: 'none',
      transform: 'rotate(-1.5deg)',
    }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%', background: '#4444cc',
        position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)', zIndex: 3,
      }} />
      <div style={{
        width: 190, background: '#ff8a80',
        boxShadow: '3px 3px 8px rgba(0,0,0,0.25)',
        fontFamily: "'Patrick Hand', cursive",
      }}>
        <div style={{
          background: '#e57373', padding: '3px 8px', fontSize: 'var(--text-sm)', color: '#4a1010',
        }}>📢 Active Event</div>
        <div style={{ padding: '8px 10px', color: '#4a1010' }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', marginBottom: 4 }}>
            {event.title}
          </div>
          <div style={{ fontSize: 'var(--text-base)', opacity: 0.85, lineHeight: 1.4 }}>
            {event.description}
          </div>
        </div>
      </div>
    </div>
  );
}
