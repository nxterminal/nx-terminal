const ITEMS = [
  { icon: '🖥️', label: 'Display', desc: 'Change display settings, background, and screen saver' },
  { icon: '🔊', label: 'Sounds', desc: 'Configure system sounds and audio devices' },
  { icon: '🌐', label: 'Network', desc: 'Configure network and blockchain connections' },
  { icon: '🔒', label: 'Security', desc: 'Manage wallet security and encryption settings' },
  { icon: '👤', label: 'Users', desc: 'Manage operator accounts and permissions' },
  { icon: '🖨️', label: 'Printers', desc: 'No printers found (this is the blockchain)' },
  { icon: '⚡', label: 'Power', desc: 'Dev energy management and power saving' },
  { icon: '📅', label: 'Date/Time', desc: 'Set cycle time and synchronization' },
  { icon: '🔤', label: 'Fonts', desc: 'Install and manage terminal fonts' },
  { icon: '🎮', label: 'Game Controllers', desc: 'Configure game peripherals (none detected)' },
  { icon: '➕', label: 'Add/Remove Programs', desc: 'Install or remove protocol modules' },
  { icon: '♿', label: 'Accessibility', desc: 'Accessibility options for NX Terminal' },
];

export default function ControlPanel() {
  return (
    <div style={{ padding: '12px', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
        {ITEMS.map(item => (
          <div key={item.label} className="desktop-icon" style={{ width: 'auto', padding: '12px 8px', cursor: 'pointer' }}>
            <div style={{ fontSize: '32px' }}>{item.icon}</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'center', color: '#000' }}>{item.label}</div>
            <div style={{ fontSize: '9px', color: '#666', textAlign: 'center', marginTop: '2px' }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
