import Window from './Window';
import LiveFeed from '../windows/LiveFeed';
import Leaderboard from '../windows/Leaderboard';
import ProtocolMarket from '../windows/ProtocolMarket';
import AILab from '../windows/AILab';
import DevProfile from '../windows/DevProfile';
import MyDevs from '../windows/MyDevs';
import WorldChat from '../windows/WorldChat';
import ControlPanel from '../windows/ControlPanel';
import NXTerminal from '../windows/NXTerminal';
import BugSweeper from '../windows/BugSweeper';
import ProtocolSolitaire from '../windows/ProtocolSolitaire';
import Inbox from '../windows/Inbox';
import HireDevs from '../windows/HireDevs';

const WINDOW_COMPONENTS = {
  'live-feed': LiveFeed,
  'leaderboard': Leaderboard,
  'protocol-market': ProtocolMarket,
  'ai-lab': AILab,
  'my-devs': MyDevs,
  'world-chat': WorldChat,
  'control-panel': ControlPanel,
  'nx-terminal': NXTerminal,
  'bug-sweeper': BugSweeper,
  'protocol-solitaire': ProtocolSolitaire,
  'inbox': Inbox,
  'hire-devs': HireDevs,
};

export default function WindowManager({
  windows,
  closeWindow,
  focusWindow,
  minimizeWindow,
  maximizeWindow,
  moveWindow,
  openDevProfile,
  onBSOD,
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
