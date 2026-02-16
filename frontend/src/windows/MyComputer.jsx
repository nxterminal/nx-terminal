import { useState, useEffect } from 'react';
import EmployeeHandbook from './EmployeeHandbook';
import Lore from './Lore';

const FILE_SYSTEM = {
  'My Computer': {
    icon: '🖥️',
    children: {
      'C: (NX_SYSTEM)': {
        icon: '💾',
        children: {
          'WINDOWS': { icon: '📁', children: { 'System32': { icon: '📁', children: { 'config.sys': { icon: '📄', size: '2 KB' }, 'autoexec.bat': { icon: '📄', size: '1 KB' }, 'hal.dll': { icon: '⚙️', size: '156 KB' } } }, 'Fonts': { icon: '📁', children: {} }, 'Temp': { icon: '📁', children: { '~DF4A2B.tmp': { icon: '📄', size: '0 KB' } } } } },
          'Program Files': { icon: '📁', children: { 'NX Terminal': { icon: '📁', children: { 'nxterminal.exe': { icon: '🖥️', size: '4,200 KB' }, 'protocol_wars.dll': { icon: '⚙️', size: '1,024 KB' }, 'README.txt': { icon: '📄', size: '3 KB' } } }, 'Internet Explorer': { icon: '📁', children: { 'iexplore.exe': { icon: '🌐', size: '512 KB' } } } } },
          'My Documents': { icon: '📁', children: { 'dev_strategies.txt': { icon: '📄', size: '8 KB' }, 'wallet_backup.enc': { icon: '🔒', size: '1 KB' }, 'screenshots': { icon: '📁', children: {} } } },
        }
      },
      'D: (PROTOCOLS)': { icon: '💿', children: { 'protocol_data.db': { icon: '📊', size: '52,480 KB' }, 'backups': { icon: '📁', children: {} } } },
      'Control Panel': { icon: '⚙️', children: {} },
    }
  }
};

function getEntries(node) {
  if (!node || !node.children) return [];
  return Object.entries(node.children).map(([name, data]) => ({
    name,
    icon: data.icon || '📄',
    isFolder: !!data.children,
    size: data.size || '',
    data,
  }));
}

function findNode(tree, path) {
  let node = tree;
  for (const p of path) {
    if (node.children && node.children[p]) {
      node = node.children[p];
    } else {
      return null;
    }
  }
  return node;
}

function FileBrowser() {
  const [path, setPath] = useState(['My Computer']);
  const root = FILE_SYSTEM['My Computer'];

  const currentNode = path.length === 1 ? root : findNode(root, path.slice(1));
  const entries = getEntries(currentNode);

  const handleOpen = (entry) => {
    if (entry.isFolder) {
      setPath([...path, entry.name]);
    }
  };

  const goUp = () => {
    if (path.length > 1) setPath(path.slice(0, -1));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '2px 4px', background: 'var(--win-bg)', borderBottom: '1px solid var(--border-dark)', display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button className="win-btn" onClick={goUp} disabled={path.length <= 1} style={{ fontSize: '10px', padding: '1px 6px' }}>⬆ Up</button>
        <div className="win-panel" style={{ flex: 1, padding: '1px 6px', fontSize: '11px' }}>
          {path.join(' > ')}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: '#fff', padding: '8px' }}>
        {entries.length === 0 ? (
          <div style={{ color: '#888', fontStyle: 'italic', padding: '16px', textAlign: 'center' }}>This folder is empty</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '4px' }}>
            {entries.map(entry => (
              <div key={entry.name} className="desktop-icon" onDoubleClick={() => handleOpen(entry)}
                   style={{ width: 'auto', padding: '8px 4px' }}>
                <div style={{ fontSize: '28px' }}>{entry.icon}</div>
                <div style={{ fontSize: '10px', textAlign: 'center', color: '#000', wordBreak: 'break-word' }}>{entry.name}</div>
                {entry.size && <div style={{ fontSize: '9px', color: '#888' }}>{entry.size}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="win98-statusbar">
        {entries.length} object(s)
      </div>
    </div>
  );
}

const TABS = [
  { key: 'system', label: '🖥️ System' },
  { key: 'handbook', label: '📖 Handbook' },
  { key: 'lore', label: '📜 Lore' },
];

export default function MyComputer({ initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'system');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="win-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`win-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', borderTop: '1px solid var(--border-dark)' }}>
        {activeTab === 'system' && <FileBrowser />}
        {activeTab === 'handbook' && <EmployeeHandbook />}
        {activeTab === 'lore' && <Lore />}
      </div>
    </div>
  );
}
