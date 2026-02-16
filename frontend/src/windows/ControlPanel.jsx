import { useState } from 'react';

const PANELS = [
  {
    id: 'display',
    name: 'Display',
    desc: 'Change display settings and resolution',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="3" y="4" width="26" height="18" rx="1" fill="#000080" stroke="#808080" strokeWidth="2" />
        <rect x="6" y="7" width="20" height="12" fill="#008080" />
        <rect x="12" y="23" width="8" height="2" fill="#808080" />
        <rect x="10" y="25" width="12" height="2" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5" />
      </svg>
    ),
  },
  {
    id: 'sound',
    name: 'Sound',
    desc: 'Configure audio devices and volume',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="12" width="6" height="8" fill="#c0c0c0" stroke="#808080" />
        <polygon points="10,12 20,5 20,27 10,20" fill="#c0c0c0" stroke="#808080" />
        <path d="M23 10 Q28 16 23 22" stroke="#000080" strokeWidth="2" fill="none" />
        <path d="M25 7 Q32 16 25 25" stroke="#000080" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    id: 'morale',
    name: 'Corporate Morale',
    desc: 'Adjust employee morale settings',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="14" r="10" fill="#ffd700" stroke="#808080" strokeWidth="1" />
        <circle cx="12" cy="12" r="1.5" fill="#000" />
        <circle cx="20" cy="12" r="1.5" fill="#000" />
        <path d="M11 18 Q16 16 21 18" stroke="#000" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    id: 'network',
    name: 'Network',
    desc: 'Network connection and modem settings',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="18" width="10" height="8" rx="1" fill="#c0c0c0" stroke="#808080" />
        <rect x="18" y="18" width="10" height="8" rx="1" fill="#c0c0c0" stroke="#808080" />
        <line x1="14" y1="22" x2="18" y2="22" stroke="#000080" strokeWidth="2" />
        <rect x="6" y="20" width="2" height="1" fill="#33ff33" />
        <rect x="6" y="22" width="2" height="1" fill="#ff4444" />
        <rect x="20" y="20" width="2" height="1" fill="#33ff33" />
        <rect x="20" y="22" width="2" height="1" fill="#ffaa00" />
        <line x1="16" y1="6" x2="16" y2="18" stroke="#808080" strokeWidth="1" />
        <circle cx="16" cy="6" r="3" fill="#000080" stroke="#808080" strokeWidth="0.5" />
      </svg>
    ),
  },
  {
    id: 'productivity',
    name: 'Productivity',
    desc: 'Workplace productivity controls',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="4" width="24" height="24" rx="2" fill="#fff" stroke="#808080" />
        <line x1="8" y1="10" x2="24" y2="10" stroke="#000080" strokeWidth="1.5" />
        <line x1="8" y1="15" x2="20" y2="15" stroke="#808080" strokeWidth="1" />
        <line x1="8" y1="19" x2="22" y2="19" stroke="#808080" strokeWidth="1" />
        <line x1="8" y1="23" x2="18" y2="23" stroke="#808080" strokeWidth="1" />
        <rect x="5" y="10" width="2" height="2" fill="#33ff33" />
        <rect x="5" y="15" width="2" height="2" fill="#33ff33" />
        <rect x="5" y="19" width="2" height="2" fill="#ff4444" />
      </svg>
    ),
  },
  {
    id: 'datetime',
    name: 'Date/Time',
    desc: 'Set date, time, and timezone',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" fill="#fff" stroke="#808080" strokeWidth="2" />
        <circle cx="16" cy="16" r="10" fill="#fff" stroke="#000080" strokeWidth="0.5" />
        <line x1="16" y1="16" x2="16" y2="8" stroke="#000" strokeWidth="2" />
        <line x1="16" y1="16" x2="22" y2="16" stroke="#000" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="1.5" fill="#ff4444" />
      </svg>
    ),
  },
  {
    id: 'programs',
    name: 'Add/Remove Programs',
    desc: 'Install and uninstall programs',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="6" width="18" height="20" rx="1" fill="#ffaa00" stroke="#808080" />
        <rect x="8" y="2" width="18" height="20" rx="1" fill="#ffd700" stroke="#808080" />
        <rect x="11" y="6" width="12" height="2" fill="#000080" />
        <rect x="11" y="10" width="10" height="1" fill="#808080" />
        <rect x="11" y="13" width="8" height="1" fill="#808080" />
        <rect x="11" y="16" width="11" height="1" fill="#808080" />
      </svg>
    ),
  },
];

function DisplayPanel() {
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>Display Settings</div>
      <div style={{
        background: '#000',
        width: '120px',
        height: '90px',
        margin: '0 auto 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '3px solid #555',
        borderRadius: '2px',
      }}>
        <span style={{ color: 'var(--terminal-green)', fontFamily: "'VT323', monospace", fontSize: '10px' }}>
          1024x768
        </span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--terminal-red)', textAlign: 'center', marginBottom: '12px', fontWeight: 'bold' }}>
        Your CRT does not support this resolution
      </div>
      <div style={{ fontSize: '11px', marginBottom: '4px' }}>Screen Resolution:</div>
      <select disabled style={{
        width: '100%',
        padding: '2px',
        fontSize: '11px',
        fontFamily: "'Tahoma', sans-serif",
        background: '#dfdfdf',
        color: 'var(--border-dark)',
        border: '1px solid var(--border-dark)',
      }}>
        <option>640 x 480 (Recommended)</option>
        <option>800 x 600</option>
        <option>1024 x 768</option>
      </select>
      <div style={{ fontSize: '10px', color: '#888', marginTop: '6px', fontStyle: 'italic' }}>
        Resolution changes are disabled by IT department.
      </div>
    </div>
  );
}

function SoundPanel() {
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '12px' }}>Sound Settings</div>
      <div style={{ fontSize: '11px', marginBottom: '4px' }}>Master Volume:</div>
      <input
        type="range"
        min="0"
        max="100"
        value="15"
        disabled
        readOnly
        style={{ width: '100%', marginBottom: '12px' }}
      />
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '16px' }}>
        Volume locked at 15% by corporate policy.
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
        <input type="checkbox" checked disabled readOnly />
        Enable PC Speaker beeps
      </label>
      <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', fontStyle: 'italic' }}>
        PC Speaker beeps cannot be disabled. They are a feature, not a bug.
      </div>
    </div>
  );
}

function MoralePanel() {
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '12px' }}>Corporate Morale Index</div>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <span style={{
          fontSize: '36px',
          fontWeight: 'bold',
          fontFamily: "'VT323', monospace",
          color: 'var(--terminal-red)',
        }}>
          12
        </span>
        <span style={{ fontSize: '14px', color: '#888' }}> / 100</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value="12"
        disabled
        readOnly
        style={{ width: '100%', marginBottom: '4px' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#888' }}>
        <span>Miserable</span>
        <span>Acceptable</span>
        <span>Euphoric</span>
      </div>
      <div style={{
        marginTop: '12px',
        padding: '8px',
        background: '#ffffcc',
        border: '1px solid #cca800',
        fontSize: '11px',
        color: '#444',
      }}>
        This setting is controlled by management.
      </div>
    </div>
  );
}

function NetworkPanel() {
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '12px' }}>Network Configuration</div>
      <div style={{
        padding: '8px',
        background: '#fff',
        border: '1px solid var(--border-dark)',
        marginBottom: '12px',
        fontSize: '11px',
      }}>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ fontWeight: 'bold' }}>Status:</span>{' '}
          <span style={{ color: 'var(--terminal-green)' }}>Connected</span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ fontWeight: 'bold' }}>Network:</span> NX Terminal Network
        </div>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ fontWeight: 'bold' }}>Speed:</span> 56.6 Kbps
        </div>
        <div>
          <span style={{ fontWeight: 'bold' }}>Protocol:</span> TCP/NX v4.2
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <button
          className="win-btn"
          style={{ minWidth: '100px' }}
          onClick={() => window.alert('Disconnection is not permitted during Protocol Wars.')}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

function ProductivityPanel() {
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '12px' }}>Productivity Settings</div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          color: 'var(--border-dark)',
        }}>
          <input type="checkbox" disabled />
          Enable fun
        </label>
        <div style={{
          marginTop: '6px',
          padding: '8px',
          background: '#ffffcc',
          border: '1px solid #cca800',
          fontSize: '11px',
          color: '#444',
        }}>
          Disabled by management. Fun is not a recognized corporate value.
        </div>
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
          <input type="checkbox" checked disabled readOnly />
          Enable mandatory overtime
        </label>
      </div>
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
          <input type="checkbox" checked disabled readOnly />
          Track employee bathroom breaks
        </label>
      </div>
    </div>
  );
}

function DateTimePanel() {
  const now = new Date();
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '12px' }}>Date and Time</div>
      <div style={{
        padding: '12px',
        background: 'var(--terminal-bg)',
        border: '1px solid var(--border-dark)',
        textAlign: 'center',
        marginBottom: '12px',
      }}>
        <div style={{
          color: 'var(--terminal-amber)',
          fontFamily: "'VT323', monospace",
          fontSize: '14px',
          marginBottom: '8px',
        }}>
          NX Simulation Time:
        </div>
        <div style={{
          color: 'var(--gold)',
          fontFamily: "'VT323', monospace",
          fontSize: '22px',
          fontWeight: 'bold',
        }}>
          Year 2007, Q3
        </div>
      </div>
      <div style={{
        padding: '8px',
        background: '#fff',
        border: '1px solid var(--border-dark)',
        fontSize: '11px',
      }}>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ fontWeight: 'bold' }}>Real Time:</span>{' '}
          {now.toLocaleTimeString()}
        </div>
        <div>
          <span style={{ fontWeight: 'bold' }}>Real Date:</span>{' '}
          {now.toLocaleDateString()}
        </div>
      </div>
      <div style={{ fontSize: '10px', color: '#888', marginTop: '8px', fontStyle: 'italic' }}>
        Time synchronization with NX Terminal servers cannot be overridden.
      </div>
    </div>
  );
}

function ProgramsPanel() {
  const programs = [
    { name: 'mass_produced_protocol_v3.exe', size: '420 MB' },
    { name: 'definitely_not_spyware.dll', size: '0 KB \u2014 suspicious' },
    { name: 'employee_morale.exe', size: 'File not found' },
  ];

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '12px' }}>Installed Programs</div>
      {programs.map((prog) => (
        <div key={prog.name} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          marginBottom: '4px',
          background: '#fff',
          border: '1px solid #dfdfdf',
          fontSize: '11px',
        }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>{prog.name}</div>
            <div style={{ fontSize: '10px', color: '#888' }}>Size: {prog.size}</div>
          </div>
          <button
            className="win-btn"
            style={{ fontSize: '10px', flexShrink: 0 }}
            onClick={() => window.alert(`Cannot remove ${prog.name}. All software installations are permanent at NX Terminal Corp.`)}
          >
            Remove
          </button>
        </div>
      ))}
      <div style={{ fontSize: '10px', color: '#888', marginTop: '8px', fontStyle: 'italic' }}>
        Disk space: 1 MB free of 500 MB. Consider deleting nothing, as usual.
      </div>
    </div>
  );
}

const PANEL_COMPONENTS = {
  display: DisplayPanel,
  sound: SoundPanel,
  morale: MoralePanel,
  network: NetworkPanel,
  productivity: ProductivityPanel,
  datetime: DateTimePanel,
  programs: ProgramsPanel,
};

export default function ControlPanel() {
  const [activePanel, setActivePanel] = useState(null);

  if (activePanel) {
    const PanelComponent = PANEL_COMPONENTS[activePanel];
    const panelInfo = PANELS.find((p) => p.id === activePanel);

    return (
      <div style={{ height: '100%', overflow: 'auto', background: 'var(--win-bg)' }}>
        {/* Sub-view header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          borderBottom: '1px solid var(--border-dark)',
        }}>
          <button
            className="win-btn"
            style={{ fontSize: '11px' }}
            onClick={() => setActivePanel(null)}
          >
            &laquo; Back
          </button>
          <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{panelInfo.name}</span>
        </div>
        <PanelComponent />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--win-bg)' }}>
      {/* Title */}
      <div style={{
        padding: '8px 12px',
        fontWeight: 'bold',
        fontSize: '12px',
        borderBottom: '1px solid var(--border-dark)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" fill="#c0c0c0" stroke="#404040" strokeWidth="0.5"/><circle cx="8" cy="8" r="1.5" fill="#808080"/>{[0,45,90,135,180,225,270,315].map(d=><rect key={d} x="7" y="2" width="2" height="3" fill="#808080" stroke="#404040" strokeWidth="0.3" transform={`rotate(${d} 8 8)`}/>)}</svg>
        Control Panel
      </div>

      {/* Grid of panels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        padding: '12px',
      }}>
        {PANELS.map((panel) => (
          <div
            key={panel.id}
            className="win-raised"
            style={{
              padding: '12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '6px',
              transition: 'background 0.1s',
            }}
            onClick={() => setActivePanel(panel.id)}
            onMouseOver={(e) => { e.currentTarget.style.background = '#d4d0c8'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--win-bg)'; }}
          >
            <div>{panel.icon}</div>
            <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{panel.name}</div>
            <div style={{ fontSize: '10px', color: '#666' }}>{panel.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
