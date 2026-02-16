import { useState } from 'react';

const INITIAL_ITEMS = [
  { id: 1, name: 'failed_strategy_v3.txt', icon: '📄', originalLocation: 'C:\\My Documents', deleted: 'Cycle 847', size: '2 KB' },
  { id: 2, name: 'rugpull_evidence.png', icon: '🖼️', originalLocation: 'C:\\My Documents\\screenshots', deleted: 'Cycle 901', size: '245 KB' },
  { id: 3, name: 'old_wallet_backup.enc', icon: '🔒', originalLocation: 'C:\\My Documents', deleted: 'Cycle 1022', size: '1 KB' },
  { id: 4, name: 'definitely_not_a_virus.exe', icon: '⚠️', originalLocation: 'C:\\Downloads', deleted: 'Cycle 1100', size: '666 KB' },
  { id: 5, name: 'dev_resignation_letter.txt', icon: '📄', originalLocation: 'C:\\My Documents', deleted: 'Cycle 1203', size: '4 KB' },
  { id: 6, name: 'Shortcut to Nothing.lnk', icon: '🔗', originalLocation: 'C:\\Desktop', deleted: 'Cycle 1350', size: '1 KB' },
];

export default function RecycleBin() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [selected, setSelected] = useState(null);

  const emptyBin = () => {
    if (items.length > 0) setItems([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '2px 4px', background: 'var(--win-bg)', borderBottom: '1px solid var(--border-dark)', display: 'flex', gap: '4px' }}>
        <button className="win-btn" onClick={emptyBin} style={{ fontSize: '10px', padding: '1px 6px' }}>
          Empty Recycle Bin
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        {items.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🗑️</div>
            <div>Recycle Bin is empty</div>
          </div>
        ) : (
          <table className="win-table">
            <thead>
              <tr>
                <th style={{ width: '20px' }}></th>
                <th>Name</th>
                <th>Original Location</th>
                <th>Date Deleted</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="clickable"
                    onClick={() => setSelected(item.id)}
                    style={{ background: selected === item.id ? 'var(--selection)' : undefined,
                             color: selected === item.id ? 'var(--selection-text)' : undefined }}>
                  <td>{item.icon}</td>
                  <td>{item.name}</td>
                  <td>{item.originalLocation}</td>
                  <td>{item.deleted}</td>
                  <td>{item.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="win98-statusbar">
        {items.length} object(s)
      </div>
    </div>
  );
}
