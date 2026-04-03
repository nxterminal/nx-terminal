import { MODULES, COLORS } from '../constants';

export default function SentinelNav({ activeModule, onSelect }) {
  return (
    <div className="sentinel-nav">
      <div className="sentinel-nav__header">
        <div className="sentinel-nav__logo">{'\u{1F6E1}'}</div>
        <div className="sentinel-nav__title">SENTINEL</div>
      </div>
      <div className="sentinel-nav__modules">
        {MODULES.map(mod => (
          <button
            key={mod.id}
            className={`sentinel-nav__item ${activeModule === mod.id ? 'active' : ''}`}
            onClick={() => onSelect(mod.id)}
            title={mod.desc}
          >
            <span className="sentinel-nav__icon">{mod.icon}</span>
            <span className="sentinel-nav__label">{mod.label}</span>
          </button>
        ))}
      </div>
      <div className="sentinel-nav__footer">
        <span style={{ color: COLORS.muted, fontSize: '10px' }}>MegaETH Chain 4326</span>
      </div>
    </div>
  );
}
