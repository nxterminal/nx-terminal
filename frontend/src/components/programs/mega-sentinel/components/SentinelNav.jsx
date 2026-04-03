import { MODULES } from '../constants';

export default function SentinelNav({ activeModule, onSelect }) {
  return (
    <div className="sentinel-nav">
      <div className="sentinel-nav__header">
        <div className="sentinel-nav__brand">
          <div className="sentinel-nav__shield">S</div>
          <div>
            <div className="sentinel-nav__name">SENTINEL</div>
            <div className="sentinel-nav__version">v1.0</div>
          </div>
        </div>
      </div>
      <div className="sentinel-nav__modules">
        {MODULES.map(mod => (
          <button
            key={mod.id}
            className={`sentinel-nav__item ${activeModule === mod.id ? 'active' : ''}`}
            onClick={() => onSelect(mod.id)}
          >
            <span className="sentinel-nav__item-label">{mod.label}</span>
            <span className="sentinel-nav__item-desc">{mod.desc}</span>
          </button>
        ))}
      </div>
      <div className="sentinel-nav__footer">
        MegaETH Chain 4326
      </div>
    </div>
  );
}
