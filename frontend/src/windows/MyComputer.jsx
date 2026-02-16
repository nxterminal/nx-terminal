import { useState, useEffect } from 'react';
import { IconComputer } from '../components/icons';

const CORPORATIONS = [
  'CLOSED AI',
  'MISANTHROPIC',
  'SHALLOW MIND',
  'ZUCK LABS',
  'Y.AI',
  'MISTRIAL SYSTEMS',
];

const SPECS = [
  { label: 'Processor', value: 'NX-486DX @ 66 MHz' },
  { label: 'Memory', value: '640 KB RAM (should be enough for anyone)' },
  { label: 'Hard Disk', value: '500 MB (420 MB used by protocols, 79 MB used by mass-produced memos, 1 MB free)' },
  { label: 'Display', value: 'VGA 1024x768 @ 60Hz (CRT \u2014 do not degauss)' },
  { label: 'Network', value: '56.6K NX Modem \u2014 Connected to NX Terminal Network' },
  { label: 'Sound', value: 'PC Speaker (mass-produced beeping)' },
  { label: 'OS', value: 'NX-DOS 6.22 with Protocol Wars Extension Pack' },
];

export default function MyComputer() {
  const [serverStatus, setServerStatus] = useState({});

  useEffect(() => {
    const statuses = {};
    CORPORATIONS.forEach((corp) => {
      statuses[corp] = Math.random() > 0.4;
    });
    setServerStatus(statuses);
  }, []);

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--win-bg)', padding: '0' }}>
      {/* Title header */}
      <div style={{
        background: 'var(--terminal-bg)',
        padding: '12px 16px',
        textAlign: 'center',
        borderBottom: '2px solid var(--border-dark)',
      }}>
        <div style={{
          color: 'var(--gold)',
          fontFamily: "'VT323', 'Courier New', monospace",
          fontSize: '22px',
          fontWeight: 'bold',
          letterSpacing: '2px',
        }}>
          NX Terminal 486DX
        </div>
        <div style={{
          color: 'var(--terminal-green)',
          fontFamily: "'VT323', 'Courier New', monospace",
          fontSize: '12px',
          marginTop: '2px',
        }}>
          System Properties
        </div>
      </div>

      {/* Computer icon + name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-dark)',
      }}>
        <div><IconComputer size={36} /></div>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '13px' }}>NX Terminal Corp Workstation</div>
          <div style={{ fontSize: '11px', color: '#666' }}>Property of NX Terminal Corp. Do not remove.</div>
        </div>
      </div>

      {/* Specs list */}
      <div style={{ padding: '8px 16px' }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: '11px',
          marginBottom: '6px',
          borderBottom: '1px solid var(--border-dark)',
          paddingBottom: '4px',
        }}>
          Hardware Summary
        </div>
        {SPECS.map((spec) => (
          <div key={spec.label} style={{
            display: 'flex',
            padding: '3px 0',
            fontSize: '11px',
            borderBottom: '1px solid #dfdfdf',
          }}>
            <div style={{ width: '80px', fontWeight: 'bold', flexShrink: 0, color: '#333' }}>
              {spec.label}:
            </div>
            <div style={{ color: '#000' }}>{spec.value}</div>
          </div>
        ))}
      </div>

      {/* Disk space bar */}
      <div style={{ padding: '8px 16px' }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: '11px',
          marginBottom: '6px',
          borderBottom: '1px solid var(--border-dark)',
          paddingBottom: '4px',
        }}>
          Disk Space Usage (C:)
        </div>
        <div style={{
          height: '20px',
          background: '#fff',
          border: '1px solid var(--border-dark)',
          boxShadow: 'inset 1px 1px 0 var(--border-darker), inset -1px -1px 0 #dfdfdf',
          display: 'flex',
          overflow: 'hidden',
        }}>
          {/* Used space - blue */}
          <div style={{
            width: '99.8%',
            background: 'linear-gradient(180deg, #3060d0 0%, #000080 40%, #000060 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>499 MB Used</span>
          </div>
          {/* Free space - pink/magenta */}
          <div style={{
            width: '0.2%',
            minWidth: '3px',
            background: 'var(--terminal-magenta)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '4px', color: '#666' }}>
          <span>Used: 499 MB (99.8%)</span>
          <span>Free: 1 MB (0.2%)</span>
        </div>
      </div>

      {/* Network Neighborhood */}
      <div style={{ padding: '8px 16px 16px' }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: '11px',
          marginBottom: '6px',
          borderBottom: '1px solid var(--border-dark)',
          paddingBottom: '4px',
        }}>
          Network Neighborhood
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '4px',
        }}>
          {CORPORATIONS.map((corp) => (
            <div key={corp} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 8px',
              background: '#fff',
              border: '1px solid #dfdfdf',
              fontSize: '11px',
            }}>
              {/* Status dot */}
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: serverStatus[corp] ? 'var(--terminal-green)' : 'var(--terminal-red)',
                flexShrink: 0,
                boxShadow: serverStatus[corp]
                  ? '0 0 4px rgba(51,255,51,0.5)'
                  : '0 0 4px rgba(255,68,68,0.5)',
              }} />
              {/* Server icon */}
              <span><IconComputer size={14} /></span>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '10px' }}>\\\\{corp.replace(/\s/g, '_')}</div>
                <div style={{ fontSize: '9px', color: '#888' }}>
                  {serverStatus[corp] ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
