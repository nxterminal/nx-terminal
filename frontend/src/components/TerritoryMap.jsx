/**
 * TerritoryMap — 3x2 grid of game locations showing corporate control.
 * Props: territories: [{location, name, controller, contested, color}]
 */

const LOCATIONS = [
  { id: 'github_hq', name: 'GitHub HQ' },
  { id: 'server_farm', name: 'Server Farm' },
  { id: 'vc_tower', name: 'VC Tower' },
  { id: 'dark_web', name: 'The Dark Web' },
  { id: 'hackathon_hall', name: 'Hackathon Hall' },
  { id: 'stack_overflow', name: 'Stack Overflow' },
];

export default function TerritoryMap({ territories = [] }) {
  // Build a lookup from location id/name to territory data
  const territoryMap = {};
  for (const t of territories) {
    territoryMap[t.location] = t;
  }

  return (
    <div className="territory-grid">
      {LOCATIONS.map(loc => {
        const t = territoryMap[loc.id] || territoryMap[loc.name] || null;
        const contested = t?.contested;
        const controller = t?.controller || 'NEUTRAL';
        const color = t?.color || '#555';

        return (
          <div
            key={loc.id}
            className={`territory-cell${contested ? ' contested' : ''}`}
            style={{ borderColor: contested ? undefined : color }}
          >
            <div className="territory-cell-name">{loc.name}</div>
            <div
              className="territory-cell-controller"
              style={{ color: contested ? '#ff4444' : color }}
            >
              {contested ? '\u2694 CONTESTED' : controller}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { LOCATIONS };
