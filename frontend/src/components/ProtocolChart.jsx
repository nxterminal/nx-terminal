import { useState, useRef, useCallback } from 'react';

/**
 * ProtocolChart — Pure SVG retro trading chart.
 * Props:
 *   dataPoints: [{x, y}]  — price data normalized to chart space
 *   markers: [{x, y, type, label}] — type: 'invest'|'fork'|'event'
 *   protocolName, currentValue, changePercent
 */

const MARKER_COLORS = {
  invest: '#ffaa00',
  fork: '#ff4444',
  event: '#00ffff',
  sabotage: '#ff4444',
  default: '#888',
};

export default function ProtocolChart({
  dataPoints = [],
  markers = [],
  width: containerWidth,
  height: containerHeight,
}) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  const W = containerWidth || 600;
  const H = containerHeight || 220;
  const PAD = { top: 10, right: 10, bottom: 20, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  if (dataPoints.length < 2) {
    return (
      <div className="protocol-chart" style={{ width: '100%', height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#555', fontFamily: "'VT323', monospace", fontSize: '14px' }}>
          {'>'} Insufficient data for chart rendering...
        </span>
      </div>
    );
  }

  const yValues = dataPoints.map(p => p.y);
  const yMin = Math.min(...yValues) * 0.9;
  const yMax = Math.max(...yValues) * 1.1;
  const yRange = yMax - yMin || 1;

  const scaleX = (i) => PAD.left + (i / (dataPoints.length - 1)) * chartW;
  const scaleY = (val) => PAD.top + chartH - ((val - yMin) / yRange) * chartH;

  // Build price line path
  const linePath = dataPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i).toFixed(1)},${scaleY(p.y).toFixed(1)}`)
    .join(' ');

  // Build fill path (close to bottom)
  const fillPath = linePath +
    ` L${scaleX(dataPoints.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)}` +
    ` L${scaleX(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

  // Grid lines (4 horizontal)
  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const val = yMin + (yRange * i) / 4;
    const y = scaleY(val);
    gridLines.push({ y, label: Math.round(val).toLocaleString() });
  }

  // Volume bars (simulated from price deltas)
  const volumeBars = dataPoints.slice(1).map((p, i) => {
    const delta = Math.abs(p.y - dataPoints[i].y);
    const maxDelta = yRange * 0.3 || 1;
    const barH = Math.max(2, (delta / maxDelta) * (chartH * 0.25));
    return {
      x: scaleX(i + 1) - (chartW / dataPoints.length) * 0.4,
      y: PAD.top + chartH - barH,
      width: Math.max(2, (chartW / dataPoints.length) * 0.6),
      height: barH,
    };
  });

  const handleMarkerEnter = useCallback((e, marker) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left + 10,
      y: e.clientY - rect.top - 20,
      label: marker.label,
    });
  }, []);

  const handleMarkerLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="protocol-chart" style={{ width: '100%', position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#33ff33" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#33ff33" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={g.y}
              x2={W - PAD.right}
              y2={g.y}
              className="chart-grid-line"
            />
            <text
              x={PAD.left - 4}
              y={g.y + 3}
              fill="#555"
              fontSize="10"
              fontFamily="VT323, monospace"
              textAnchor="end"
            >
              {g.label}
            </text>
          </g>
        ))}

        {/* Volume bars */}
        {volumeBars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            className="chart-volume-bar"
          />
        ))}

        {/* Fill under line */}
        <path d={fillPath} fill="url(#greenGradient)" className="chart-fill" />

        {/* Price line */}
        <path d={linePath} className="chart-line" />

        {/* Event markers */}
        {markers.map((m, i) => {
          const idx = Math.min(Math.max(0, Math.round(m.x)), dataPoints.length - 1);
          const cx = scaleX(idx);
          const cy = scaleY(dataPoints[idx]?.y || 0);
          const color = MARKER_COLORS[m.type] || MARKER_COLORS.default;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={5}
              fill={color}
              stroke="#0c0c0c"
              strokeWidth={1.5}
              className="chart-marker"
              onMouseEnter={(e) => handleMarkerEnter(e, m)}
              onMouseLeave={handleMarkerLeave}
            />
          );
        })}
      </svg>

      {tooltip && (
        <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
