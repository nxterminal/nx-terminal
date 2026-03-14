import { useBuild } from '../../../BuildContext';
import { CONTRACT_TYPES } from '../../../constants/monad';
import Badge from '../../shared/Badge';

export default function Step1Type() {
  const { state } = useBuild();
  const type = CONTRACT_TYPES.find(t => t.id === state.contractType);

  if (!type) return null;

  return (
    <div>
      <h3 className="mb-h3 mb-mb-md">Contract Type</h3>
      <div className="mb-card" style={{ borderColor: 'var(--mb-accent-primary)' }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{type.name}</div>
        <div className="mb-text-sm mb-mb-sm">{type.description}</div>
        <div className="mb-flex mb-gap-sm">
          {type.tags.map(tag => (
            <Badge key={tag} color="purple">{tag}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
