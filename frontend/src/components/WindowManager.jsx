import Window from './Window';
import LiveFeed from '../windows/LiveFeed';
import Leaderboard from '../windows/Leaderboard';
import ProtocolMarket from '../windows/ProtocolMarket';
import AILab from '../windows/AILab';
import DevProfile from '../windows/DevProfile';
import MyDevs from '../windows/MyDevs';
import Shop from '../windows/Shop';
import WorldChat from '../windows/WorldChat';
import Lore from '../windows/Lore';
import ControlPanel from '../windows/ControlPanel';

const WINDOW_COMPONENTS = {
  'live-feed': LiveFeed,
  'leaderboard': Leaderboard,
  'protocol-market': ProtocolMarket,
  'ai-lab': AILab,
  'my-devs': MyDevs,
  'shop': Shop,
  'world-chat': WorldChat,
  'lore': Lore,
  'control-panel': ControlPanel,
};

export default function WindowManager({
  windows,
  closeWindow,
  focusWindow,
  minimizeWindow,
  maximizeWindow,
  moveWindow,
  openDevProfile,
}) {
  return (
    <>
      {windows.map(w => {
        let ContentComponent;
        if (w.id.startsWith('dev-profile-')) {
          ContentComponent = DevProfile;
        } else {
          ContentComponent = WINDOW_COMPONENTS[w.id];
        }

        if (!ContentComponent) return null;

        return (
          <Window
            key={w.id}
            id={w.id}
            title={w.title}
            icon={w.icon}
            position={w.position}
            size={w.size}
            minimized={w.minimized}
            maximized={w.maximized}
            zIndex={w.zIndex}
            onClose={() => closeWindow(w.id)}
            onFocus={() => focusWindow(w.id)}
            onMinimize={() => minimizeWindow(w.id)}
            onMaximize={() => maximizeWindow(w.id)}
            onMove={(pos) => moveWindow(w.id, pos)}
          >
            <ContentComponent
              devId={w.devId}
              openDevProfile={openDevProfile}
            />
          </Window>
        );
      })}
    </>
  );
}
