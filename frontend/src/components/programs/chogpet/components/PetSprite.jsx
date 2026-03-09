import { PET_TYPES, LCD } from '../constants';

export default function PetSprite({ petType, frame = 'idle', size = 64, monochrome = false, silhouette = false, onClick, onContextMenu, style }) {
  const pet = PET_TYPES[petType];
  if (!pet) return null;

  const spriteData = pet.sprites[frame] || pet.sprites.idle;
  const colors = pet.colors;
  const cellSize = size / 8;

  return (
    <div
      className="cp-sprite"
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(8, ${cellSize}px)`,
        gridTemplateRows: `repeat(8, ${cellSize}px)`,
        width: `${size}px`,
        height: `${size}px`,
        cursor: 'pointer',
        imageRendering: 'pixelated',
        ...style,
      }}
    >
      {spriteData.flat().map((colorKey, i) => (
        <div
          key={i}
          style={{
            width: `${cellSize}px`,
            height: `${cellSize}px`,
            backgroundColor: colorKey
              ? (silhouette ? '#888' : monochrome ? LCD.dark : (colors[colorKey] || colorKey))
              : 'transparent',
          }}
        />
      ))}
    </div>
  );
}
