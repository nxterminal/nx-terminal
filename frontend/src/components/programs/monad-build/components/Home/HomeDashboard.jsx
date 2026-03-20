import { useState } from 'react';
import { Coins, Image, Gamepad2, BookOpen, Rocket, Globe, Zap, Clock, Gauge, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useBuild } from '../../BuildContext';
import { MONAD_KEY_DIFFERENCES } from '../../constants/monad';
import Card from '../shared/Card';
import Badge from '../shared/Badge';

const STATS = [
  { icon: Clock, label: 'Block Time', value: '0.4s', color: '#836EF9' },
  { icon: Zap, label: 'Finality', value: 'Sub-s', color: '#22C55E' },
  { icon: Gauge, label: 'TPS', value: '30,000+', color: '#38BDF8' },
  { icon: Users, label: 'Ecosystem', value: '300+', color: '#F59E0B' },
];

const QUICK_ACTIONS = [
  { id: 'erc20', icon: Coins, title: 'Create Token', desc: 'Deploy an ERC-20 token', module: 'build', type: 'erc20' },
  { id: 'erc721', icon: Image, title: 'Create NFT', desc: 'Launch an NFT collection', module: 'build', type: 'erc721' },
  { id: 'game', icon: Gamepad2, title: 'Game Contract', desc: 'Build game economy', module: 'build', type: 'game' },
  { id: 'learn', icon: BookOpen, title: 'Learn Pharos', desc: 'Understand the platform', module: 'learn' },
  { id: 'deploy', icon: Rocket, title: 'Deploy Contract', desc: 'Ship to mainnet/testnet', module: 'deploy' },
  { id: 'explore', icon: Globe, title: 'Explore Ecosystem', desc: 'Discover Pharos projects', module: 'ecosystem' },
];

export default function HomeDashboard() {
  const { state, dispatch } = useBuild();
  const [showComparison, setShowComparison] = useState(false);

  function handleAction(action) {
    if (action.type) {
      dispatch({ type: 'SET_CONTRACT_TYPE', payload: action.type });
    }
    dispatch({ type: 'SET_MODULE', payload: action.module });
  }

  return (
    <div className="mb-animate-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="mb-h1" style={{ marginBottom: 6 }}>Welcome to Pharos Build</h1>
        <p className="mb-text-sm" style={{ margin: 0 }}>
          Create, deploy, and explore on the fastest EVM chain
        </p>
      </div>

      <div className="mb-flex mb-items-center mb-justify-between mb-mb-md">
        <h3 className="mb-h3">Network</h3>
        <div className="mb-network-toggle">
          <button
            className={state.network === 'testnet' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_NETWORK', payload: 'testnet' })}
          >
            Testnet
          </button>
          <button
            className={state.network === 'mainnet' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_NETWORK', payload: 'mainnet' })}
          >
            Mainnet
          </button>
        </div>
      </div>

      <div className="mb-grid-4 mb-mb-lg">
        {STATS.map(s => (
          <Card key={s.label}>
            <div className="mb-flex mb-items-center mb-gap-sm mb-mb-sm">
              <s.icon size={16} style={{ color: s.color }} />
              <span className="mb-text-xs" style={{ color: 'var(--mb-text-tertiary)' }}>{s.label}</span>
            </div>
            <div style={{
              fontFamily: 'var(--mb-font-display)',
              fontSize: 24,
              fontWeight: 700,
              color: s.color,
            }}>
              {s.value}
            </div>
          </Card>
        ))}
      </div>

      <h3 className="mb-h3 mb-mb-md">Quick Actions</h3>
      <div className="mb-grid-3 mb-mb-lg">
        {QUICK_ACTIONS.map(a => (
          <Card key={a.id} onClick={() => handleAction(a)} gradient>
            <div className="mb-flex mb-items-center mb-gap-sm mb-mb-sm">
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(131,110,249,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <a.icon size={18} style={{ color: 'var(--mb-accent-primary)' }} />
              </div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{a.title}</div>
            <div className="mb-text-sm">{a.desc}</div>
          </Card>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="mb-flex mb-items-center mb-gap-sm"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--mb-text-primary)',
            cursor: 'pointer',
            fontFamily: 'var(--mb-font-display)',
            fontSize: 16,
            fontWeight: 600,
            padding: 0,
          }}
        >
          Pharos vs Ethereum
          {showComparison ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {showComparison && (
        <div className="mb-animate-in">
          <table className="mb-table">
            <thead>
              <tr>
                <th>Aspect</th>
                <th>Ethereum</th>
                <th>Pharos</th>
                <th>Developer Impact</th>
              </tr>
            </thead>
            <tbody>
              {MONAD_KEY_DIFFERENCES.map(d => (
                <tr key={d.aspect}>
                  <td style={{ fontWeight: 500, color: 'var(--mb-text-primary)' }}>{d.aspect}</td>
                  <td>{d.ethereum}</td>
                  <td>
                    <Badge color={d.severity === 'good' ? 'green' : d.severity === 'warning' ? 'amber' : 'blue'}>
                      {d.monad}
                    </Badge>
                  </td>
                  <td style={{ fontSize: 12 }}>{d.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
