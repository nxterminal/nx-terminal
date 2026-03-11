import { PROTOCOLS } from '../constants';

export default function ProtocolBadge({ protocol, showType = false }) {
  const data = PROTOCOLS[protocol];
  if (!data) return null;

  const text = showType ? data.label : data.name;

  return (
    <span
      className="flow-protocol-badge"
      style={{
        backgroundColor: `${data.color}1A`,
        borderColor: `${data.color}33`,
        color: data.color,
      }}
    >
      {text}
    </span>
  );
}
