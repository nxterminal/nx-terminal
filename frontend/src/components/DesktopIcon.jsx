import { Win98Icon } from './Win98Icons';

// `onOpen` is the unified "activate this icon" handler. The shell wires
// it to either onClick or onDoubleClick depending on the user's chosen
// click mode (Settings → Desktop → Click Mode).
export default function DesktopIcon({
  id,
  icon,
  label,
  desc,
  iconSize = 32,
  onOpen,
  clickMode = 'double',
  tooltipsEnabled = true,
  unreadCount = 0,
}) {
  const isSingleClick = clickMode === 'single';
  const clickProps = isSingleClick
    ? { onClick: onOpen }
    : { onDoubleClick: onOpen };
  const showTip = tooltipsEnabled && !!desc;

  return (
    <div
      className={`desktop-icon${isSingleClick ? ' single-click' : ''}${showTip ? ' has-tip' : ''}`}
      data-tip={showTip ? `${label} — ${desc}` : undefined}
      {...clickProps}
    >
      <div className="desktop-icon-img">
        {id ? <Win98Icon id={id} size={iconSize} /> : icon}
        {unreadCount > 0 && <span className="desktop-icon-badge" />}
      </div>
      <div className="desktop-icon-label">{label}</div>
    </div>
  );
}
