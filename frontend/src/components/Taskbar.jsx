import { useState, useEffect } from 'react';
import { api } from '../services/api';
import StartMenu from './StartMenu';

export default function Taskbar({ windows, onWindowClick, openWindow }) {
  const [cycle, setCycle] = useState(null);
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    const fetchCycle = () => {
      api.getSimulationState()
        .then(data => setCycle(data.current_cycle || data.cycle || '?'))
        .catch(() => {});
    };
    fetchCycle();
    const id = setInterval(fetchCycle, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="taskbar">
      <StartMenu
        open={startOpen}
        onClose={() => setStartOpen(false)}
        openWindow={openWindow}
      />

      <button
        className={`win-btn start-btn${startOpen ? ' active' : ''}`}
        onClick={() => setStartOpen(s => !s)}
      >
        <span style={{ fontSize: '14px' }}>&#x1F5A5;</span>
        <span>Start</span>
      </button>

      <div className="taskbar-windows">
        {windows.map(w => (
          <button
            key={w.id}
            className={`win-btn taskbar-btn${!w.minimized ? ' active' : ''}`}
            onClick={() => onWindowClick(w.id)}
            title={w.title}
          >
            <span>{w.icon} {w.title}</span>
          </button>
        ))}
      </div>

      <div className="taskbar-clock">
        Cycle: {cycle ?? '...'}
      </div>
    </div>
  );
}
