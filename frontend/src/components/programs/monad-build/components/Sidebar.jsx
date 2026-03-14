import { Home, BookOpen, Hammer, Rocket, Globe, FileText } from 'lucide-react';
import { useBuild } from '../BuildContext';
import Tooltip from './shared/Tooltip';

const NAV_ITEMS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'learn', icon: BookOpen, label: 'Learn' },
  { id: 'build', icon: Hammer, label: 'Build' },
  { id: 'deploy', icon: Rocket, label: 'Deploy' },
  { id: 'ecosystem', icon: Globe, label: 'Ecosystem' },
  { id: 'resources', icon: FileText, label: 'Resources' },
];

export default function Sidebar() {
  const { state, dispatch } = useBuild();

  return (
    <nav className="mb-sidebar">
      {NAV_ITEMS.map((item) => {
        const IconComp = item.icon;
        return (
          <Tooltip key={item.id} label={item.label}>
            <button
              className={`mb-sidebar-item ${state.activeModule === item.id ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_MODULE', payload: item.id })}
            >
              <IconComp size={20} />
            </button>
          </Tooltip>
        );
      })}
      <div style={{ flex: 1 }} />
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #836EF9 0%, #4A3AFF 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: 'white',
        fontFamily: 'var(--mb-font-display)',
        marginBottom: 4,
      }}>
        M
      </div>
    </nav>
  );
}
