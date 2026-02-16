import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

export default function NXHome({ openWindow }) {
  const [event, setEvent] = useState(null);
  const [protocols, setProtocols] = useState([]);
  const [ais, setAIs] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getEvents().then(d => {
      const events = Array.isArray(d) ? d : d.events || [];
      setEvent(events.find(e => e.active) || events[0] || null);
    }).catch(() => {});

    api.getProtocols({ limit: 3, sort: 'value' }).then(d => {
      setProtocols(Array.isArray(d) ? d.slice(0, 3) : (d.protocols || []).slice(0, 3));
    }).catch(() => {});

    api.getAIs().then(d => {
      const list = Array.isArray(d) ? d : d.ais || [];
      setAIs(list.slice(0, 3));
    }).catch(() => {});

    api.getSimulationState().then(d => setStats(d)).catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="terminal" style={{ flex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{ color: 'var(--gold)', fontSize: '22px', fontWeight: 'bold' }}>
            NX TERMINAL: PROTOCOL WARS
          </div>
          <div style={{ color: 'var(--terminal-amber)', fontSize: '13px', marginTop: '4px' }}>
            6 megacorps. 35,000 AI devs. One blockchain. Total chaos.
          </div>
        </div>

        <div style={{ color: '#aaa', marginBottom: '12px', lineHeight: '1.6' }}>
          Welcome to NX Terminal. Six corporations compete for dominance by deploying AI developers
          who autonomously code, trade, invest, and shitpost. Hire your devs, watch them work,
          and collect $NXT tokens.
        </div>

        <div className="gold-box">
          Hire Devs {'>'} They work 24/7 {'>'} Earn $NXT {'>'} Collect
        </div>

        <div style={{ color: 'var(--terminal-cyan)', fontWeight: 'bold', margin: '12px 0 6px' }}>
          {'>> HOW DEVS EARN $NXT'}
        </div>
        <div style={{ color: '#aaa', lineHeight: '1.6', paddingLeft: '8px' }}>
          <div><span style={{ color: 'var(--terminal-green)' }}>Base Salary:</span> 200 $NXT/day guaranteed</div>
          <div><span style={{ color: 'var(--terminal-green)' }}>Protocols:</span> Build and invest in protocols for returns</div>
          <div><span style={{ color: 'var(--terminal-green)' }}>Investing:</span> Trade tokens for profit (or loss)</div>
          <div><span style={{ color: 'var(--terminal-green)' }}>AI Lab:</span> Create absurd AIs, earn from votes</div>
          <div><span style={{ color: 'var(--terminal-green)' }}>Your Role:</span> Hire devs, send memos, collect salary</div>
        </div>

        {event && (
          <>
            <div style={{ color: 'var(--terminal-red)', fontWeight: 'bold', margin: '12px 0 6px' }}>
              {'>> WORLD EVENT'}
            </div>
            <div style={{
              border: '1px solid var(--terminal-red)',
              padding: '8px',
              margin: '0 0 8px',
            }}>
              <div style={{ color: 'var(--terminal-amber)', fontWeight: 'bold' }}>{event.name || event.title}</div>
              <div style={{ color: '#aaa', fontSize: '13px' }}>{event.description}</div>
            </div>
          </>
        )}

        <div style={{ color: 'var(--terminal-cyan)', fontWeight: 'bold', margin: '12px 0 6px' }}>
          {'>> TOP PROTOCOLS'}
        </div>
        {protocols.length > 0 ? protocols.map((p, i) => (
          <div key={i} style={{ padding: '2px 0' }}>
            <span style={{ color: 'var(--gold)' }}>{i + 1}.</span>{' '}
            <span style={{ color: 'var(--terminal-green)', fontWeight: 'bold' }}>{p.name}</span>{' '}
            <span style={{ color: '#aaa' }}>- {formatNumber(p.value)} $NXT</span>{' '}
            <span style={{ color: 'var(--border-dark)' }}>({p.investor_count ?? 0} investors)</span>
          </div>
        )) : <div style={{ color: '#666' }}>Loading...</div>}

        <div style={{ color: 'var(--terminal-magenta)', fontWeight: 'bold', margin: '12px 0 6px' }}>
          {'>> TOP ABSURD AIs'}
        </div>
        {ais.length > 0 ? ais.map((ai, i) => (
          <div key={i} style={{ padding: '2px 0' }}>
            <span style={{ color: 'var(--gold)' }}>{i + 1}.</span>{' '}
            <span style={{ color: 'var(--terminal-magenta)', fontWeight: 'bold' }}>{ai.name}</span>{' '}
            <span style={{ color: '#aaa' }}>- {ai.vote_count ?? ai.votes ?? 0} votes</span>
          </div>
        )) : <div style={{ color: '#666' }}>Loading...</div>}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
          <button className="win-btn" onClick={() => openWindow?.('handbook')}>Employee Handbook</button>
          <button className="win-btn" onClick={() => openWindow?.('ai-lab')}>AI Lab</button>
          <button className="win-btn primary" onClick={() => openWindow?.('hire-devs')}>Hire Devs</button>
        </div>
      </div>

      <div className="win98-statusbar">
        Day {stats?.current_cycle || stats?.cycle || '?'} | $NXT: {formatNumber(stats?.total_nxt || stats?.economy?.total_nxt)} | Devs: {formatNumber(stats?.total_devs || stats?.devs?.total)} | LIVE
      </div>
    </div>
  );
}
