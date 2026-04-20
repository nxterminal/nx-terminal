import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';

function fmtTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MarketPriceChart({ priceHistory }) {
  if (!priceHistory || priceHistory.length === 0) {
    return (
      <div className="win-panel" style={{
        height: 200, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--text-secondary)',
        background: 'var(--win-bg, #c0c0c0)',
      }}>
        No price history yet
      </div>
    );
  }

  const data = priceHistory.map(snap => ({
    time: fmtTime(snap.snapshot_at),
    snapshot_at: snap.snapshot_at,
    price_yes: Number(snap.price_yes),
    volume: Number(snap.total_volume_nxt || 0),
  }));

  return (
    <div className="win-panel" style={{
      height: 220, padding: 6, background: '#fff',
    }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis dataKey="time" stroke="#666" style={{ fontSize: 10 }} />
          <YAxis yAxisId="price" domain={[0, 1]} stroke="#1b5e20"
            tickFormatter={v => v.toFixed(2)} style={{ fontSize: 10 }} />
          <YAxis yAxisId="vol" orientation="right" stroke="#1565c0"
            style={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value, name) =>
              name === 'price_yes' ? [Number(value).toFixed(4), 'YES']
              : name === 'volume' ? [Math.round(value), 'Vol $NXT']
              : [value, name]
            }
          />
          <ReferenceLine yAxisId="price" y={0.5} stroke="#888"
            strokeDasharray="4 4" />
          <Bar yAxisId="vol" dataKey="volume" fill="#90caf9" />
          <Line yAxisId="price" type="monotone" dataKey="price_yes"
            stroke="#1b5e20" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
