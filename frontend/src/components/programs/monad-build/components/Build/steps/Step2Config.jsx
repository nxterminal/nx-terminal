import { useBuild } from '../../../BuildContext';

const FIELDS = {
  erc20: [
    { key: 'contractName', label: 'Contract Name', placeholder: 'MyToken', type: 'text' },
    { key: 'tokenName', label: 'Token Name', placeholder: 'My Token', type: 'text' },
    { key: 'tokenSymbol', label: 'Token Symbol', placeholder: 'MTK', type: 'text' },
    { key: 'initialSupply', label: 'Initial Supply', placeholder: '1000000', type: 'number' },
    { key: 'decimals', label: 'Decimals', placeholder: '18', type: 'select', options: ['6', '8', '18'] },
    { key: 'maxSupply', label: 'Max Supply (optional)', placeholder: '10000000', type: 'number' },
  ],
  erc721: [
    { key: 'contractName', label: 'Contract Name', placeholder: 'MyNFT', type: 'text' },
    { key: 'tokenName', label: 'Collection Name', placeholder: 'My NFT Collection', type: 'text' },
    { key: 'tokenSymbol', label: 'Symbol', placeholder: 'MNFT', type: 'text' },
    { key: 'baseURI', label: 'Base URI', placeholder: 'https://api.example.com/metadata/', type: 'text' },
    { key: 'maxSupply', label: 'Max Supply', placeholder: '10000', type: 'number' },
  ],
  erc1155: [
    { key: 'contractName', label: 'Contract Name', placeholder: 'MyMultiToken', type: 'text' },
    { key: 'uri', label: 'URI Pattern', placeholder: 'https://api.example.com/token/{id}.json', type: 'text' },
  ],
  staking: [
    { key: 'contractName', label: 'Contract Name', placeholder: 'MonadStaking', type: 'text' },
    { key: 'stakingToken', label: 'Staking Token Address', placeholder: '0x...', type: 'text' },
    { key: 'rewardToken', label: 'Reward Token Address', placeholder: '0x...', type: 'text' },
    { key: 'rewardRate', label: 'Reward Rate (per second)', placeholder: '100', type: 'number' },
    { key: 'lockPeriod', label: 'Lock Period (seconds)', placeholder: '86400', type: 'number' },
  ],
  game: [
    { key: 'contractName', label: 'Game Name', placeholder: 'MonadGame', type: 'text' },
    { key: 'currencyName', label: 'Currency Name', placeholder: 'Game Gold', type: 'text' },
    { key: 'currencySymbol', label: 'Currency Symbol', placeholder: 'GOLD', type: 'text' },
    { key: 'itemName', label: 'Item Collection Name', placeholder: 'Game Items', type: 'text' },
  ],
};

export default function Step2Config() {
  const { state, dispatch } = useBuild();
  const fields = FIELDS[state.contractType] || [];

  function updateField(key, value) {
    dispatch({ type: 'SET_CONFIG', payload: { [key]: value } });
  }

  return (
    <div>
      <h3 className="mb-h3 mb-mb-md">Configuration</h3>
      <div className="mb-flex-col mb-gap-md">
        {fields.map(field => (
          <div key={field.key}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
              color: 'var(--mb-text-secondary)',
            }}>
              {field.label}
            </label>
            {field.type === 'select' ? (
              <select
                className="mb-input"
                value={state.contractConfig[field.key] || field.options[field.options.length - 1]}
                onChange={e => updateField(field.key, e.target.value)}
                style={{ fontFamily: 'var(--mb-font-body)' }}
              >
                {field.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                className="mb-input"
                type={field.type === 'number' ? 'text' : 'text'}
                placeholder={field.placeholder}
                value={state.contractConfig[field.key] || ''}
                onChange={e => updateField(field.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
