import { useState, useEffect } from 'react';
import { MODULES, COLORS } from './constants';
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
  const [activeModule, setActiveModule] = useState('xray');
  const [fadeTrigger, setFadeTrigger] = useState(true);

  useEffect(() => {
    setFadeTrigger(false);
    const t = requestAnimationFrame(() => setFadeTrigger(true));
    return () => cancelAnimationFrame(t);
  }, [activeModule]);

  const ActiveComponent = MODULE_COMPONENTS[activeModule] || XrayMega;
  const activeModInfo = MODULES.find(m => m.id === activeModule);

  return (
    <div className="sentinel-root">
      <SentinelNav activeModule={activeModule} onSelect={setActiveModule} />
      <div className="sentinel-content">
        <div className="sentinel-content__header">
          <div className="sentinel-content__title-group">
            <span className="sentinel-content__title">MEGA SENTINEL</span>
            <span className="sentinel-content__subtitle">{activeModInfo?.label}</span>
          </div>
          <div className="sentinel-content__status">
            <span className="sentinel-status-dot" />
            <span>MegaETH Connected</span>
          </div>
        </div>
        <div className={`sentinel-content__body ${fadeTrigger ? 'sentinel-fade-in' : ''}`}>
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
