import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { isNxMarketAdmin } from '../NXMarket';
import CommentInput from './CommentInput';
import CommentItem from './CommentItem';


const PAGE_SIZE = 20;


export default function CommentsList({ marketId, wallet, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = isNxMarketAdmin(wallet);

  // Fetch a page (for offset=0 we REPLACE; for offset>0 we APPEND).
  const fetchPage = useCallback(async (offset) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listComments(marketId, wallet, PAGE_SIZE, offset);
      if (offset === 0) {
        setComments(data.comments || []);
        setLoaded((data.comments || []).length);
      } else {
        setComments(prev => [...prev, ...(data.comments || [])]);
        setLoaded(prev => prev + (data.comments || []).length);
      }
      setTotal(data.total_count || 0);
      if (onCountChange) onCountChange(data.total_count || 0);
    } catch (e) {
      setError((e && e.message) || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [marketId, wallet, onCountChange]);

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const refresh = () => fetchPage(0);
  const loadMore = () => fetchPage(loaded);

  const handleDelete = async (commentId) => {
    try {
      await api.deleteComment(commentId, wallet);
      refresh();
    } catch (e) {
      setError((e && e.message) || 'Delete failed');
    }
  };

  const handleVote = async (commentId, vote) => {
    try {
      const result = await api.voteComment(commentId, wallet, vote);
      // Patch the single comment in place to avoid full refetch.
      setComments(prev => prev.map(c => c.id === commentId ? {
        ...c,
        like_count: result.like_count,
        dislike_count: result.dislike_count,
        my_vote: result.my_vote,
      } : c));
    } catch (e) {
      setError((e && e.message) || 'Vote failed');
    }
  };

  const hasMore = loaded < total;
  const remaining = Math.max(0, total - loaded);

  return (
    <div style={{ fontFamily: 'Tahoma, sans-serif' }}>
      <CommentInput marketId={marketId} wallet={wallet}
        onPosted={refresh} />

      {error && (
        <div style={{
          padding: 8, marginBottom: 8, color: '#b71c1c',
          background: '#ffebee', border: '1px solid #c62828',
          fontSize: 11,
        }}>{error}</div>
      )}

      {loading && comments.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 20, color: '#777', fontSize: 12,
        }}>Loading comments…</div>
      )}

      {!loading && comments.length === 0 && !error && (
        <div style={{
          textAlign: 'center', padding: 20, color: '#777', fontSize: 12,
        }}>
          No comments yet. Be the first!
        </div>
      )}

      {comments.map(c => (
        <CommentItem key={c.id} comment={c}
          currentWallet={wallet} isAdmin={isAdmin}
          onDelete={handleDelete} onVote={handleVote} />
      ))}

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button onClick={loadMore} className="win-btn"
            disabled={loading}
            style={{ padding: '4px 14px', fontSize: 12 }}>
            {loading ? 'Loading…' : `Load more (${remaining} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
