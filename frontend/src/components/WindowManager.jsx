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
import NXHome from '../windows/NXHome';
import Inbox from '../windows/Inbox';
import HireDevs from '../windows/HireDevs';
import EmployeeHandbook from '../windows/EmployeeHandbook';
import MyAccount from '../windows/MyAccount';
import CollectSalary from '../windows/CollectSalary';
import NXTStats from '../windows/NXTStats';
import Lore from '../windows/Lore';

const WINDOW_COMPONENTS = {
  'nx-home': NXHome,
  'inbox': Inbox,
  'hire-devs': HireDevs,
  'action-feed': ActionFeed,
  'leaderboard': Leaderboard,
  'protocol-market': ProtocolMarket,
  'ai-lab': AILab,
  'dev-chat': DevChat,
  'my-devs': MyDevs,
  'shop': Shop,
  'world-chat': WorldChat,
  'handbook': EmployeeHandbook,
  'my-account': MyAccount,
  'collect-salary': CollectSalary,
  'nxt-stats': NXTStats,
  'lore': Lore,
};

export default function WindowManager({
  windows,
  closeWindow,
  focusWindow,
  minimizeWindow,
  maximizeWindow,
  moveWindow,
  openWindow,
  openDevProfile,
  wallet,
  onStartDialUp,
}) {
  const maxZ = windows.reduce((max, w) => Math.max(max, w.zIndex || 0), 0);

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

        const isActive = !w.minimized && w.zIndex === maxZ;

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
            isActive={isActive}
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
              wallet={wallet}
              onStartDialUp={onStartDialUp}
            />
          </Window>
        );
      })}
    </>
  );
}
