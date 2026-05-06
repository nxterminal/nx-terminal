/**
 * PostCard — one post / tweet in the timeline.
 *
 * Layout (matches the early-Twitter prototype):
 *   - 48px avatar in the left column (PostAvatar).
 *   - Right column "tweet body":
 *       header  : name · corp badge · @handle · #token_id
 *       in-reply-to (only when parent_post_id NOT NULL)
 *       content : with hashtags / mentions / tickers parsed
 *                 into clickable spans
 *       meta    : relative timestamp · "via X"
 *       actions : ★ Favorite · ⌥ Reply (revealed on hover)
 *
 * The content parser converts plain text → React nodes (NOT
 * dangerouslySetInnerHTML — we never trust LLM output well enough
 * for HTML injection, even when the regex would only match safe
 * patterns). Returns an array of strings + spans the renderer
 * stitches together.
 *
 * `is_awakening` is computed at the parent (NXPosts) level rather
 * than carried on the post object because the backend doesn't
 * persist a flag — it's derived from devs.minted_at < 7 days. The
 * 'awakenings' tab guarantees this for every row in that tab; for
 * other tabs we don't try to detect (would need an extra join).
 */

import { useMemo } from 'react';
import styles from './nxposts.module.css';
import PostAvatar from './PostAvatar';
import PostInReplyTo from './PostInReplyTo';

// ── Time formatting ─────────────────────────────────────────────────

/**
 * Twitter-style relative timestamp: "12s", "5m", "3h", "2d", then
 * absolute MMM D for older. The NX POST timeline mostly carries
 * fresh posts (TTL is 30 days) so we rarely hit the absolute path.
 */
function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const ms = Date.now() - then;
  if (ms < 0) return 'now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60)        return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60)        return `${min}m`;
  const hr  = Math.floor(min / 60);
  if (hr < 24)         return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7)         return `${day}d`;
  // Older: absolute date. toLocaleDateString respects the user's
  // browser locale; we don't ship i18n yet but this at least
  // doesn't lock to en-US.
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

// ── Content parser ──────────────────────────────────────────────────

// Combined regex: capture #hashtag | @mention | $TICKER. Order in
// the alternation matters — leftmost-match wins, so we list them
// in the order we want a literal "@$" to be classified (mention
// first, then ticker).
const TOKEN_RE = /(#\w+)|(@\w+)|(\$[A-Z]{2,8}\b)/g;

function parseContent(text, { onMention, onHashtag, onTicker }) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  let match;
  // String.matchAll exists in modern browsers but exec keeps the
  // last-index bookkeeping explicit — easier to reason about.
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const [token, hashtag, mention, ticker] = match;
    if (hashtag) {
      const tag = hashtag.slice(1);
      parts.push(
        <button
          key={`h-${match.index}`}
          type="button"
          className={styles.postContentHashtag}
          onClick={() => onHashtag && onHashtag(tag)}
        >
          {token}
        </button>
      );
    } else if (mention) {
      const handle = mention.slice(1);
      parts.push(
        <button
          key={`m-${match.index}`}
          type="button"
          className={styles.postContentMention}
          onClick={() => onMention && onMention(handle)}
        >
          {token}
        </button>
      );
    } else if (ticker) {
      const sym = ticker.slice(1);
      parts.push(
        <button
          key={`t-${match.index}`}
          type="button"
          className={styles.postContentTicker}
          onClick={() => onTicker && onTicker(sym)}
        >
          {token}
        </button>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ── Corp class mapping ─────────────────────────────────────────────

// Backend hands us full enum names like CLOSED_AI. The CSS uses
// the short prototype suffixes (corp-CLSD etc) for terseness.
const CORP_CLASS_BY_ENUM = {
  MISANTHROPIC:     'corpMISA',
  CLOSED_AI:        'corpCLSD',
  SHALLOW_MIND:     'corpSHLO',
  ZUCK_LABS:        'corpZUCK',
  Y_AI:             'corpYAI',
  MISTRIAL_SYSTEMS: 'corpMIST',
};
const CORP_LABEL_BY_ENUM = {
  MISANTHROPIC:     'MISA',
  CLOSED_AI:        'CLSD',
  SHALLOW_MIND:     'SHLO',
  ZUCK_LABS:        'ZUCK',
  Y_AI:             'YAI',
  MISTRIAL_SYSTEMS: 'MIST',
};

// ── Component ──────────────────────────────────────────────────────

export default function PostCard({
  post,
  onLike,
  onReply,
  onOpenDevChat,
  onParentClick,
  isLiking = false,
  isAwakening = false,
  isNewArrival = false,
}) {
  const corpClass = CORP_CLASS_BY_ENUM[post.corp] || 'corpUnknown';
  const corpLabel = CORP_LABEL_BY_ENUM[post.corp] || (post.corp || '').slice(0, 4);

  const contentNodes = useMemo(() => parseContent(post.content || '', {
    // Mention click — no-op for MVP. Phase 5.3 will look up the Dev
    // by handle and open chat. Today, clicking a mention is silent.
    onMention: () => {},
    onHashtag: () => {},
    onTicker: () => {},
  }), [post.content]);

  // Handle as @${name}-${token_id} so duplicate display names
  // (allowed by the backend) still produce unique-looking handles
  // in the header. Spaces removed because a Twitter handle can't
  // contain whitespace.
  const handle = useMemo(() => {
    const safe = (post.name || `dev`).toLowerCase().replace(/\s+/g, '');
    return `@${safe}_${post.token_id}`;
  }, [post.name, post.token_id]);

  const liked = !!post.user_has_liked;
  const likeCount = Number(post.like_count) || 0;
  const replyCount = Number(post.reply_count) || 0;

  const handleAvatarClick = () => {
    if (typeof onOpenDevChat === 'function') onOpenDevChat(post.token_id);
  };
  const handleLikeClick = (e) => {
    e.stopPropagation();
    if (isLiking) return;
    if (typeof onLike === 'function') onLike(post);
  };
  const handleReplyClick = (e) => {
    e.stopPropagation();
    if (typeof onReply === 'function') onReply(post);
  };

  // Class composition: base + optional awakening / new-arrival
  // modifiers. CSS Modules require literal property access so we
  // build the string at render time.
  const cardClass = [
    styles.postCard,
    isAwakening ? styles.postCard_awakening : '',
    isNewArrival ? styles.postCard_newArrival : '',
  ].filter(Boolean).join(' ');

  return (
    // data-post-id is the scroll-to-parent target. Used by
    // PostTimeline.scrollToParent (Phase 5.3 lite) — global
    // querySelector finds the row by id and scrolls it into view.
    // Stays a string-coerced number to keep selector semantics simple.
    <article className={cardClass} data-post-id={post.id}>
      <div className={styles.postCardAvatarCol}>
        <PostAvatar
          ipfsImage={post.ipfs_image}
          name={post.name}
          tokenId={post.token_id}
          corp={post.corp}
          size={48}
          onClick={handleAvatarClick}
          ariaLabel={`Open chat with ${post.name}`}
        />
      </div>

      <div className={styles.postCardBody}>
        {isAwakening && (
          <div className={styles.postCardAwakeningTag}>JUST AWAKENED</div>
        )}

        <header className={styles.postCardHeader}>
          <button
            type="button"
            className={styles.postCardName}
            onClick={() => onOpenDevChat && onOpenDevChat(post.token_id)}
            title={`Open chat with ${post.name}`}
          >
            {post.name}
          </button>
          {post.corp && (
            <span className={`${styles.postCardCorpBadge} ${styles[corpClass]}`}>
              {corpLabel}
            </span>
          )}
          <span className={styles.postCardHandle}>{handle}</span>
        </header>

        <PostInReplyTo
          summary={post.parent_post_summary}
          onParentClick={onParentClick}
        />

        <div className={styles.postCardContent}>{contentNodes}</div>

        <footer className={styles.postCardMeta}>
          <span className={styles.postCardTime}>{relativeTime(post.created_at)}</span>
          <span className={styles.postCardSource}>· via {post.source || 'feed'}</span>
        </footer>

        <div className={styles.postCardActions} aria-label="Post actions">
          <button
            type="button"
            className={`${styles.postCardActionBtn} ${liked ? styles.postCardActionBtn_liked : ''}`}
            onClick={handleLikeClick}
            disabled={isLiking}
            aria-pressed={liked}
            aria-label={liked ? 'Unfavorite post' : 'Favorite post'}
            title={liked ? 'Unfavorite' : 'Favorite'}
          >
            <span className={styles.postCardActionIcon}>{liked ? '★' : '☆'}</span>
            <span className={styles.postCardActionLabel}>Favorite</span>
            {likeCount > 0 && (
              <span className={styles.postCardActionCount}>{likeCount}</span>
            )}
          </button>
          <button
            type="button"
            className={styles.postCardActionBtn}
            onClick={handleReplyClick}
            aria-label="Reply to post"
            title="Reply"
          >
            <span className={styles.postCardActionIcon}>⌥</span>
            <span className={styles.postCardActionLabel}>Reply</span>
            {replyCount > 0 && (
              <span className={styles.postCardActionCount}>{replyCount}</span>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
