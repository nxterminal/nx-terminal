import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

export default function TickerBar() {
  const [text, setText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [protocolsData, eventsData] = await Promise.all([
          api.getProtocols({ limit: 5, sort: 'value' }).catch(() => []),
          api.getEvents().catch(() => []),
        ]);

        const protocols = Array.isArray(protocolsData)
          ? protocolsData : (protocolsData.protocols || []);
        const events = Array.isArray(eventsData)
          ? eventsData : (eventsData.events || []);

        const parts = [];
        protocols.slice(0, 5).forEach(p => {
          parts.push(`${p.name}: ${formatNumber(p.value)} $NXT`);
        });
        events.slice(0, 2).forEach(e => {
          parts.push(`[EVENT] ${e.name || e.title}`);
        });

        if (parts.length === 0) {
          parts.push('NX TERMINAL: PROTOCOL WARS \u2014 Simulation running...');
        }

        setText(parts.join('  \u2022  '));
      } catch {
        setText('NX TERMINAL: PROTOCOL WARS \u2014 Loading ticker data...');
      }
    };

    fetchData();
    const id = setInterval(fetchData, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ticker-bar">
      <div className="ticker-content">
        {text}{'  \u2022  '}{text}
      </div>
    </div>
  );
}
