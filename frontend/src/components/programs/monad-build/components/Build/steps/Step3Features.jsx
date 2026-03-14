import { useBuild } from '../../../BuildContext';

const COMMON_FEATURES = [
  { key: 'mintable', label: 'Mintable', desc: 'Owner can create new tokens' },
  { key: 'burnable', label: 'Burnable', desc: 'Holders can destroy their tokens' },
  { key: 'pausable', label: 'Pausable', desc: 'Owner can pause all transfers' },
];

const ERC20_FEATURES = [
  { key: 'permit', label: 'Permit (EIP-2612)', desc: 'Gasless approvals' },
];

const ERC721_FEATURES = [
  { key: 'enumerable', label: 'Enumerable', desc: 'On-chain token enumeration' },
  { key: 'uriStorage', label: 'URI Storage', desc: 'Per-token metadata URI' },
  { key: 'royalties', label: 'Royalties (EIP-2981)', desc: 'On-chain royalty standard' },
];

function getFeatures(contractType) {
  const features = [...COMMON_FEATURES];
  if (contractType === 'erc20') features.push(...ERC20_FEATURES);
  if (contractType === 'erc721') features.push(...ERC721_FEATURES);
  return features;
}

export default function Step3Features() {
  const { state, dispatch } = useBuild();
  const features = getFeatures(state.contractType);

  function toggleFeature(key) {
    dispatch({ type: 'SET_FEATURES', payload: { [key]: !state.contractFeatures[key] } });
  }

  function setAccessControl(value) {
    dispatch({ type: 'SET_FEATURES', payload: { accessControl: value } });
  }

  // Don't show features for staking/game (they have fixed templates)
  if (state.contractType === 'staking' || state.contractType === 'game') {
    return (
      <div>
        <h3 className="mb-h3 mb-mb-md">Features</h3>
        <p className="mb-text-sm">
          This template includes all necessary features pre-configured.
          You can customize the code in the next step.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-h3 mb-mb-md">Features</h3>

      <div className="mb-grid-2 mb-mb-lg">
        {features.map(f => (
          <div
            key={f.key}
            className="mb-card clickable"
            onClick={() => toggleFeature(f.key)}
            style={{
              borderColor: state.contractFeatures[f.key]
                ? 'var(--mb-accent-primary)' : undefined,
            }}
          >
            <div className="mb-flex mb-items-center mb-justify-between mb-mb-sm">
              <span style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</span>
              <button
                className={`mb-toggle ${state.contractFeatures[f.key] ? 'active' : ''}`}
                onClick={e => { e.stopPropagation(); toggleFeature(f.key); }}
              />
            </div>
            <div className="mb-text-sm">{f.desc}</div>
            {f.key === 'royalties' && state.contractFeatures.royalties && (
              <div className="mb-mt-sm">
                <label className="mb-text-xs" style={{ display: 'block', marginBottom: 4 }}>
                  Royalty %
                </label>
                <input
                  className="mb-input"
                  type="text"
                  placeholder="5"
                  value={state.contractFeatures.royaltyPercent || ''}
                  onClick={e => e.stopPropagation()}
                  onChange={e => dispatch({
                    type: 'SET_FEATURES',
                    payload: { royaltyPercent: e.target.value },
                  })}
                  style={{ width: 80 }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <h3 className="mb-h3 mb-mb-md">Access Control</h3>
      <div className="mb-grid-2">
        <div
          className="mb-card clickable"
          onClick={() => setAccessControl('ownable')}
          style={{
            borderColor: state.contractFeatures.accessControl !== 'roles'
              ? 'var(--mb-accent-primary)' : undefined,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Ownable</div>
          <div className="mb-text-sm">Single owner with full control</div>
        </div>
        <div
          className="mb-card clickable"
          onClick={() => setAccessControl('roles')}
          style={{
            borderColor: state.contractFeatures.accessControl === 'roles'
              ? 'var(--mb-accent-primary)' : undefined,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Role-Based</div>
          <div className="mb-text-sm">Multiple roles with granular permissions</div>
        </div>
      </div>
    </div>
  );
}
