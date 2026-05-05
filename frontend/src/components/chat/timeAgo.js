/**
 * timeAgo — relative-time formatter for chat-list "last message"
 * timestamps.
 *
 * Output buckets:
 *   < 1 minute     → "just now"
 *   < 60 minutes   → "{n}m"
 *   < 24 hours     → "{n}h"
 *   < 48 hours     → "yesterday"
 *   else           → localised "Mar 5"
 *
 * Pure: no React state, safe to call inline during render. Returns
 * an empty string for falsy / unparseable input so consumers can
 * render `{formatRelativeTime(maybeNull)}` without guards.
 *
 * Locale comes from the user's browser via Date.toLocaleDateString;
 * the chat module is English-only in Phase A but the date format
 * still respects the user's regional preferences.
 */

export function formatRelativeTime(input) {
  if (!input) return '';
  const then = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(then.getTime())) return '';

  const now = new Date();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  if (diffH < 48) return 'yesterday';

  return then.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
