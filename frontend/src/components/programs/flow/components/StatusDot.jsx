import { COLORS } from '../constants';

const STATUS_COLORS = {
  live: COLORS.accent,
  offline: COLORS.danger,
  loading: COLORS.warning,
};

export default function StatusDot({ status = 'live' }) {
  const color = STATUS_COLORS[status] || COLORS.accent;
  const shouldPulse = status === 'live' || status === 'loading';

  return (
    <span
      className={shouldPulse ? 'flow-status-dot flow-status-dot--pulse' : 'flow-status-dot'}
      style={{ backgroundColor: color }}
    />
  );
}
