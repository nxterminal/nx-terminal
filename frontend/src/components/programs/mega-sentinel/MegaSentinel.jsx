import { useState, useEffect } from 'react';
import { MODULES, COLORS } from './constants';
import SentinelBoot from './overlays/SentinelBoot';
import SentinelNav from './components/SentinelNav';
import XrayMega from './modules/XrayMega';
import Firewall from './modules/Firewall';
import RugAutopsy from './modules/RugAutopsy';
import HologramDetector from './modules/HologramDetector';
import GraduationTracker from './modules/GraduationTracker';
import './MegaSentinel.css';

const MODULE_COMPONENTS = {
  xray: XrayMega,
  firewall: Firewall,
  autopsy: RugAutopsy,
  hologram: HologramDetector,
  graduation: GraduationTracker,
};

export default function MegaSentinel({ onClose }) {
  const [booting, setBooting] = useState(() => {
    return !sessionStorage.getItem('sentinel_boot_seen');
  });
  const [bootFade, setBootFade] = useState(false);
  const [activeModule, setActiveModule] = useState('xray');
  const [fadeTrigger, setFadeTrigger] = useState(true);

  const handleBootDone = () => {
    setBootFade(true);
    sessionStorage.setItem('sentinel_boot_seen', '1');
    setTimeout(() => setBooting(false), 250);
  };

  useEffect(() => {
    setFadeTrigger(false);
    const t = requestAnimationFrame(() => setFadeTrigger(true));
    return () => cancelAnimationFrame(t);
  }, [activeModule]);

  if (booting) {
    return (
      <div className="sentinel-root" style={{ opacity: bootFade ? 0 : 1, transition: 'opacity 0.25s' }}>
        <SentinelBoot onComplete={handleBootDone} />
      </div>
    );
  }

  const ActiveComponent = MODULE_COMPONENTS[activeModule] || XrayMega;
  const activeModInfo = MODULES.find(m => m.id === activeModule);

  return (
    <div className="sentinel-root">
      <SentinelNav activeModule={activeModule} onSelect={setActiveModule} />
      <div className="sentinel-content">
        <div className="sentinel-content__header">
          <span className="sentinel-content__title">
            {activeModInfo?.icon} {activeModInfo?.label || 'SENTINEL'}
          </span>
          <span style={{ fontSize: '11px', color: COLORS.muted }}>
            MegaETH <span style={{ color: COLORS.green }}>{'\u25CF'}</span> Connected
          </span>
        </div>
        <div className={`sentinel-content__body ${fadeTrigger ? 'sentinel-fade-in' : ''}`}>
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
