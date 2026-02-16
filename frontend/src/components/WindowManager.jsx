import Window from './Window';
import ActionFeed from '../windows/ActionFeed';
import Leaderboard from '../windows/Leaderboard';
import ProtocolMarket from '../windows/ProtocolMarket';
import AILab from '../windows/AILab';
import DevChat from '../windows/DevChat';
import DevProfile from '../windows/DevProfile';
import MyDevs from '../windows/MyDevs';
import Shop from '../windows/Shop';
import WorldChat from '../windows/WorldChat';
import Inbox from '../windows/Inbox';
import NXHome from '../windows/NXHome';
import Notepad from '../windows/Notepad';
import MyComputer from '../windows/MyComputer';
import RecycleBin from '../windows/RecycleBin';
import ControlPanel from '../windows/ControlPanel';
import HireDevs from '../windows/HireDevs';
import CollectSalary from '../windows/CollectSalary';
import NXTStats from '../windows/NXTStats';
import EmployeeHandbook from '../windows/EmployeeHandbook';
import Lore from '../windows/Lore';
import MyAccount from '../windows/MyAccount';
import BugSweeper from '../windows/BugSweeper';
import Solitaire from '../windows/Solitaire';

const WINDOW_COMPONENTS = {
  'action-feed': ActionFeed,
  'leaderboard': Leaderboard,
  'protocol-market': ProtocolMarket,
  'ai-lab': AILab,
  'dev-chat': DevChat,
  'my-devs': MyDevs,
  'shop': Shop,
  'world-chat': WorldChat,
  'inbox': Inbox,
  'nx-home': NXHome,
  'notepad': Notepad,
  'my-computer': MyComputer,
  'recycle-bin': RecycleBin,
  'control-panel': ControlPanel,
  'hire-devs': HireDevs,
  'collect-salary': CollectSalary,
  'nxt-stats': NXTStats,
  'employee-handbook': EmployeeHandbook,
  'lore': Lore,
  'my-account': MyAccount,
  'bug-sweeper': BugSweeper,
  'solitaire': Solitaire,
};

export default function WindowManager({
  windows,
  closeWindow,
  focusWindow,
  minimizeWindow,
  maximizeWindow,
  moveWindow,
  openDevProfile,
  openWindow,
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
              openWindow={openWindow}
              initialTab={w.initialTab}
            />
          </Window>
        );
      })}
    </>
  );
}
