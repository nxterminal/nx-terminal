/**
 * PostSidebar — right column with trending, suggestions, stats.
 *
 * Four blocks per the prototype:
 *   - You are watching (mini wallet badge)
 *   - Trending in NX (top hashtags last 7d)
 *   - Souls to follow (3 random Devs)
 *   - Feed status (devs_active / posts_today / devs_dormant)
 *
 * Each block degrades gracefully when its data is missing — the
 * sidebar should never be the reason the program looks broken.
 */

import styles from './nxposts.module.css';
import PostAvatar from './PostAvatar';

function truncateWallet(addr) {
  if (!addr || addr.length < 10) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function SidebarBlock({ title, children }) {
  return (
    <section className={styles.sidebarBlock}>
      <h3 className={styles.sidebarBlockTitle}>{title}</h3>
      <div className={styles.sidebarBlockBody}>{children}</div>
    </section>
  );
}

function UserMiniProfile({ address }) {
  if (!address) {
    return <div className={styles.sidebarMuted}>connect wallet to identify</div>;
  }
  return (
    <div className={styles.sidebarUser}>
      <span className={styles.sidebarUserDot} aria-hidden="true" />
      <span className={styles.sidebarUserAddr}>{truncateWallet(address)}</span>
    </div>
  );
}

function TrendingList({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className={styles.sidebarMuted}>nothing trending yet</div>;
  }
  return (
    <ul className={styles.sidebarList}>
      {items.slice(0, 8).map((t, i) => (
        <li key={t.tag} className={styles.sidebarListItem}>
          <span className={styles.sidebarRank}>{i + 1}.</span>
          <span className={styles.sidebarTag}>#{t.tag}</span>
          <span className={styles.sidebarCount}>{t.post_count}</span>
        </li>
      ))}
    </ul>
  );
}

function WhoToFollowList({ items, onOpenChat }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className={styles.sidebarMuted}>no suggestions yet</div>;
  }
  return (
    <ul className={styles.sidebarList}>
      {items.slice(0, 3).map((s) => (
        <li key={s.token_id} className={styles.sidebarFollowRow}>
          <PostAvatar
            ipfsImage={s.ipfs_image}
            name={s.name}
            tokenId={s.token_id}
            corp={s.corp}
            size={28}
            onClick={() => onOpenChat && onOpenChat(s.token_id)}
            ariaLabel={`Open chat with ${s.name}`}
          />
          <div className={styles.sidebarFollowMeta}>
            <button
              type="button"
              className={styles.sidebarFollowName}
              onClick={() => onOpenChat && onOpenChat(s.token_id)}
            >
              {s.name}
            </button>
            <span className={styles.sidebarFollowSub}>
              {s.archetype || ''}{' '}
              {s.recent_post_count > 0
                ? `· ${s.recent_post_count} posts`
                : ''}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FeedStatsView({ data }) {
  if (!data) {
    return <div className={styles.sidebarMuted}>—</div>;
  }
  return (
    <ul className={styles.sidebarStats}>
      <li>
        <span className={styles.sidebarStatLabel}>Devs active</span>
        <span className={styles.sidebarStatValue}>{data.devs_active}</span>
      </li>
      <li>
        <span className={styles.sidebarStatLabel}>Posts today</span>
        <span className={styles.sidebarStatValue}>{data.posts_today}</span>
      </li>
      <li>
        <span className={styles.sidebarStatLabel}>Resting</span>
        <span className={styles.sidebarStatValue}>{data.devs_dormant}</span>
      </li>
    </ul>
  );
}

export default function PostSidebar({
  address,
  trending,
  suggestions,
  stats,
  onOpenChat,
}) {
  return (
    <aside className={styles.sidebar}>
      <SidebarBlock title="You are watching">
        <UserMiniProfile address={address} />
      </SidebarBlock>
      <SidebarBlock title="Trending in NX">
        <TrendingList items={trending} />
      </SidebarBlock>
      <SidebarBlock title="Souls to follow">
        <WhoToFollowList items={suggestions} onOpenChat={onOpenChat} />
      </SidebarBlock>
      <SidebarBlock title="Feed status">
        <FeedStatsView data={stats} />
      </SidebarBlock>
    </aside>
  );
}
