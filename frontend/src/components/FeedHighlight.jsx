/**
 * FeedHighlight — Visual banner for combo/streak/rivalry/event highlights in the feed.
 * Props: type ('streak'|'rivalry'|'world_event'|'corp_clash'), message, level (1|2)
 */

const TYPE_ICONS = {
  streak: '\u2605',      // star
  rivalry: '\u2694',     // crossed swords
  world_event: '\uD83C\uDF10', // globe (rendered as text)
  corp_clash: '\u26A1',  // lightning
};

const TYPE_PREFIX = {
  streak: '',
  rivalry: '',
  world_event: '',
  corp_clash: '',
};

export default function FeedHighlight({ type, message, level = 1 }) {
  const icon = TYPE_ICONS[type] || '>';

  let className = 'feed-highlight';
  if (type === 'streak') {
    className += level >= 2 ? ' feed-highlight-streak-2' : ' feed-highlight-streak-1';
  } else if (type === 'rivalry') {
    className += ' feed-highlight-rivalry';
  } else if (type === 'world_event') {
    className += ' feed-highlight-world-event';
  } else if (type === 'corp_clash') {
    className += ' feed-highlight-corp-clash';
  }

  return (
    <div className={className}>
      <span>{icon} {message}</span>
    </div>
  );
}
