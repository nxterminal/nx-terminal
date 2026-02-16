import Window from './Window';
import {
  IconMonitor, IconEnvelope, IconBriefcase, IconFolderPerson, IconChart,
  IconAntenna, IconCart, IconDollar, IconChartLens, IconBook, IconScroll,
  IconPerson, IconLeaderboard, IconChat, IconGlobe, IconBrain, IconCard,
  IconComputer, IconNotepad, IconTrash, IconGear, IconFlag,
} from './icons';
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
import BugSweeper from '../windows/BugSweeper';
import ProtocolSolitaire from '../windows/ProtocolSolitaire';
import MyComputer from '../windows/MyComputer';
import Notepad from '../windows/Notepad';
import RecycleBin from '../windows/RecycleBin';
import ControlPanel from '../windows/ControlPanel';

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
  'bug-sweeper': BugSweeper,
  'protocol-solitaire': ProtocolSolitaire,
  'my-computer': MyComputer,
  'notepad': Notepad,
  'recycle-bin': RecycleBin,
  'control-panel': ControlPanel,
};

const WINDOW_ICONS = {
  'nx-home': <IconMonitor size={16} />,
  'inbox': <IconEnvelope size={16} />,
  'hire-devs': <IconBriefcase size={16} />,
  'action-feed': <IconAntenna size={16} />,
  'leaderboard': <IconLeaderboard size={16} />,
  'protocol-market': <IconChart size={16} />,
  'ai-lab': <IconBrain size={16} />,
  'dev-chat': <IconChat size={16} />,
  'my-devs': <IconFolderPerson size={16} />,
  'shop': <IconCart size={16} />,
  'world-chat': <IconGlobe size={16} />,
  'handbook': <IconBook size={16} />,
  'my-account': <IconPerson size={16} />,
  'collect-salary': <IconDollar size={16} />,
  'nxt-stats': <IconChartLens size={16} />,
  'lore': <IconScroll size={16} />,
  'bug-sweeper': <IconFlag size={16} />,
  'protocol-solitaire': <IconCard size={16} />,
  'my-computer': <IconComputer size={16} />,
  'notepad': <IconNotepad size={16} />,
  'recycle-bin': <IconTrash size={16} />,
  'control-panel': <IconGear size={16} />,
};

export { WINDOW_ICONS };

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
  hasMinted,
  addEmail,
}) {
  const maxZ = windows.reduce((max, w) => Math.max(max, w.zIndex || 0), 0);

  return (
    <>
      {windows.map(w => {
        let ContentComponent;
        const baseId = w.id.startsWith('dev-profile-') ? 'dev-profile' : w.id;

        if (baseId === 'dev-profile') {
          ContentComponent = DevProfile;
        } else {
          ContentComponent = WINDOW_COMPONENTS[w.id];
        }

        if (!ContentComponent) return null;

        const isActive = !w.minimized && w.zIndex === maxZ;
        const icon = WINDOW_ICONS[w.id] || <IconPerson size={16} />;

        return (
          <Window
            key={w.id}
            id={w.id}
            title={w.title}
            icon={icon}
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
              hasMinted={hasMinted}
              addEmail={addEmail}
            />
          </Window>
        );
      })}
    </>
  );
}
