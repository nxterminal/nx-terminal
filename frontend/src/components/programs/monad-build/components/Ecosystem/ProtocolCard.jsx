import { ExternalLink } from 'lucide-react';
import Badge from '../shared/Badge';

export default function ProtocolCard({ name, category, description, url, categoryColor }) {
  const colorMap = {
    defi: 'purple',
    gaming: 'green',
    nft: 'blue',
    infra: 'amber',
  };

  return (
    <div
      className={`mb-card mb-cat-${categoryColor || 'defi'}`}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div className="mb-flex mb-items-center mb-justify-between mb-mb-sm">
        <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
        <Badge color={colorMap[categoryColor] || 'purple'}>{category}</Badge>
      </div>
      <div className="mb-text-sm" style={{ flex: 1, marginBottom: 12 }}>{description}</div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-btn mb-btn-secondary mb-btn-sm"
        style={{ textDecoration: 'none', alignSelf: 'flex-start' }}
      >
        Visit <ExternalLink size={12} />
      </a>
    </div>
  );
}
