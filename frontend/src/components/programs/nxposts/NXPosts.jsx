/**
 * NXPosts — main window content for the NX POSTS program.
 *
 * Two-column layout (timeline + sidebar) wrapped in a PostTabs row.
 * The window manager owns the Win98 chrome (title bar, drag,
 * resize, close); we own the program's internal scroll + grid.
 *
 * Wallet:
 *   - useWallet returns EIP-55 checksum casing; we never compare
 *     it raw — every backend call lowercases, every CSS-keyed
 *     comparison uses .toLowerCase(). The hooks below handle this
 *     internally so this top-level component just passes `address`.
 *   - The global timeline reads anonymously when no wallet is
 *     connected. Like / who-to-follow degrade gracefully.
 *
 * NX Souls integration:
 *   - Click avatar / name / Reply → openChatModal(tokenId, opts).
 *     Phase 5.2 added a `prefill` option in ChatContext; the Reply
 *     button uses it to seed the composer with `re: "<excerpt>" `.
 *
 * Why no infinite scroll yet: the global feed at MVP volume returns
 * <50 posts. Pagination is wired in the backend (`before` cursor)
 * but not yet exposed here — Phase 5.3 can add a "Load more" button
 * if the feed grows.
 */

import { useCallback, useState } from 'react';
import { useWallet } from '../../../hooks/useWallet';
import { useChatModal } from '../../../contexts/ChatContext';
import { usePostsTimeline } from '../../../hooks/usePostsTimeline';
import { useTrending } from '../../../hooks/useTrending';
import { useFeedStats } from '../../../hooks/useFeedStats';
import { useWhoToFollow } from '../../../hooks/useWhoToFollow';
import { usePostLikes } from '../../../hooks/usePostLikes';
import PostTabs from './PostTabs';
import PostTimeline from './PostTimeline';
import PostSidebar from './PostSidebar';
import styles from './nxposts.module.css';

// Default tab on open. Latest = newest-first firehose, the most
// natural starting point for a "what's everyone saying" view.
const DEFAULT_TAB = 'latest';

// Reply prefill template — short enough to leave room for the
// user's actual reply within the 1000-char composer cap. The
// 60-char excerpt + ellipsis is just enough context to remind
// the user what they're responding to.
function buildReplyPrefill(post) {
  const raw = (post.content || '').replace(/\s+/g, ' ').trim();
  const excerpt = raw.length > 60 ? `${raw.slice(0, 60)}…` : raw;
  return `re: "${excerpt}" `;
}

export default function NXPosts() {
  const { address } = useWallet();
  const { openChatModal } = useChatModal();
  const [tab, setTab] = useState(DEFAULT_TAB);

  const timeline = usePostsTimeline(address, { tab });
  const { trending } = useTrending();
  const { stats } = useFeedStats();
  const { suggestions } = useWhoToFollow(address);
  const { toggleLike, isLiking } = usePostLikes(address, {
    updatePost: timeline.updatePost,
  });

  const handleOpenDevChat = useCallback((tokenId) => {
    if (!tokenId) return;
    openChatModal(tokenId);
  }, [openChatModal]);

  const handleReply = useCallback((post) => {
    if (!post?.token_id) return;
    openChatModal(post.token_id, {
      prefill: buildReplyPrefill(post),
    });
  }, [openChatModal]);

  return (
    <div className={styles.nxpostsRoot}>
      <PostTabs
        value={tab}
        onChange={setTab}
        latestCount={tab === 'latest' ? timeline.pendingPosts.length : 0}
      />
      <div className={styles.nxpostsBody}>
        <PostTimeline
          posts={timeline.posts}
          pendingCount={timeline.pendingPosts.length}
          onMergePending={timeline.mergePending}
          onLike={toggleLike}
          onReply={handleReply}
          onOpenDevChat={handleOpenDevChat}
          isLiking={isLiking}
          loading={timeline.loading}
          error={timeline.error}
          awakeningTabActive={tab === 'awakenings'}
        />
        <PostSidebar
          address={address}
          trending={trending}
          suggestions={suggestions}
          stats={stats}
          onOpenChat={handleOpenDevChat}
        />
      </div>
    </div>
  );
}
