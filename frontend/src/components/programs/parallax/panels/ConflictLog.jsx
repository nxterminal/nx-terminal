import { useRef, useEffect } from 'react';
import { EVENT_TYPES, COLORS } from '../constants';
import InfoTooltip from '../components/InfoTooltip';

function formatTime(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export default function ConflictLog({ events }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const visible = events.slice(-50);

  return (
    <div className="plx-conflict-log">
      <InfoTooltip title="CONFLICT LOG" text="Real-time feed of state access conflicts, re-executions, and resolutions. CONFLICT = two lanes accessed same state. RE-EXEC = tx replayed. CLEAR = conflict resolved.">
        <div className="plx-log-header">
          CONFLICT LOG
          <span style={{ color: '#666', fontWeight: 'normal', marginLeft: '8px', fontSize: '9px' }}>
            {events.length} events
          </span>
        </div>
      </InfoTooltip>
      <div className="plx-log-scroll" ref={scrollRef}>
        {visible.length === 0 && (
          <div style={{ color: '#444', fontStyle: 'italic', padding: '4px 0' }}>
            Awaiting block data...
          </div>
        )}
        {visible.map((evt) => {
          const evtType = EVENT_TYPES[evt.type] || EVENT_TYPES.PARALLEL;
          return (
            <div key={evt.id} className="plx-log-entry plx-log-enter">
              <span style={{ color: '#555' }}>{formatTime(evt.timestamp)} </span>
              <span style={{ color: evtType.color, fontWeight: 'bold' }}>
                [{evtType.label}]
              </span>
              <span style={{ color: '#aaa' }}> {evt.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
