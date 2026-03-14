import Card from '../shared/Card';
import Badge from '../shared/Badge';

const DIFFICULTY_COLORS = {
  Beginner: 'green',
  Intermediate: 'amber',
  Advanced: 'red',
};

export default function TopicCard({ icon, title, description, readTime, difficulty, onClick }) {
  const IconComp = icon;
  return (
    <Card onClick={onClick} gradient>
      <div className="mb-flex mb-items-center mb-gap-sm mb-mb-sm">
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(56,189,248,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <IconComp size={18} style={{ color: 'var(--mb-accent-info)' }} />
        </div>
        <Badge color={DIFFICULTY_COLORS[difficulty] || 'purple'}>{difficulty}</Badge>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div className="mb-text-sm" style={{ marginBottom: 8 }}>{description}</div>
      <div className="mb-text-xs">{readTime} min read</div>
    </Card>
  );
}
