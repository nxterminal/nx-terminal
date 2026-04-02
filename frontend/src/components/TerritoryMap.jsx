/**
 * TerritoryMap — 3x2 grid of game locations showing corporate control.
 * Props: territories: [{location, name, controller, contested, color}]
 */

const LOCATIONS = [
  { id: 'BOARD_ROOM', name: 'Board Room' },
  { id: 'SERVER_FARM', name: 'Server Farm' },
  { id: 'VC_TOWER', name: 'VC Tower' },
  { id: 'DARK_WEB', name: 'The Dark Web' },
  { id: 'HACKATHON_HALL', name: 'Hackathon Hall' },
  { id: 'THE_PIT', name: 'The Pit' },
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
