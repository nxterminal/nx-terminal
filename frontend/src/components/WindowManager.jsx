import Window from './Window';
import LockedProgram from './LockedProgram';
import { useDevCount } from '../hooks/useDevCount';
import { canAccessProgram } from '../config/tiers';
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
import Notepad from '../windows/Notepad';
import RecycleBin from '../windows/RecycleBin';
import NxtWallet from '../windows/NxtWallet';
import CorpWars from '../windows/CorpWars';
import NadWatch from './programs/nadwatch/NadWatch';
import Parallax from './programs/parallax/Parallax';
import MonadCity from './programs/monad-city/MonadCity';
import Flow from './programs/flow/Flow';
import DevAcademy from './programs/dev-academy/DevAcademy';
import MonadBuild from './programs/monad-build/MonadBuild';
import NetWatch from './programs/netwatch/NetWatch';
import MegaSentinel from './programs/mega-sentinel/MegaSentinel';
import MissionControl from './programs/mission-control/MissionControl';
import Achievements from '../windows/Achievements';
import DevCamp from '../windows/DevCamp';
import NXMarket from '../windows/NXMarket';

const WINDOW_COMPONENTS = {
  'live-feed': LiveFeed,
  'leaderboard': Leaderboard,
  'protocol-market': ProtocolMarket,
  'ai-lab': AILab,
  'my-devs': MyDevs,
  'nxt-wallet': NxtWallet,
  'world-chat': WorldChat,
  'control-panel': ControlPanel,
  'nx-terminal': NXTerminal,
  'bug-sweeper': BugSweeper,
  'protocol-solitaire': ProtocolSolitaire,
  'inbox': Inbox,
  'hire-devs': HireDevs,
  'notepad': Notepad,
  'recycle-bin': RecycleBin,
  'corp-wars': CorpWars,
  'nadwatch': NadWatch,
  'parallax': Parallax,
  'monad-city': MonadCity,
  'flow': Flow,
  'dev-academy': DevAcademy,
  'monad-build': MonadBuild,
  'netwatch': NetWatch,
  'mega-sentinel': MegaSentinel,
  'mission-control': MissionControl,
  'achievements': Achievements,
  'dev-camp': DevCamp,
  'nxmarket': NXMarket,
};

export default function WindowManager({
  windows,
  closeWindow,
  focusWindow,
  minimizeWindow,
  maximizeWindow,
  moveWindow,
  resizeWindow,
  openDevProfile,
  openWindow,
  onBSOD,
}) {
  const { devCount } = useDevCount();

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

        // Tier gating: show LockedProgram if insufficient devs
        const isLocked = !canAccessProgram(w.id, devCount);

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
            onResize={(s) => resizeWindow(w.id, s)}
          >
            {isLocked ? (
              <LockedProgram
                programId={w.id}
                programName={w.title}
                devCount={devCount}
                openWindow={openWindow}
                onClose={() => closeWindow(w.id)}
              />
            ) : (
              <ContentComponent
                devId={w.devId}
                openDevProfile={openDevProfile}
                openWindow={openWindow}
                onClose={() => closeWindow(w.id)}
              />
            )}
          </Window>
        );
      })}
    </>
  );
}
