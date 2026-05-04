/**
 * useChatSounds(enabled) — MSN-flavoured two-tone "ding" via Web
 * Audio API.
 *
 * Why oscillator tones, not audio files: the original Microsoft MSN
 * Messenger sounds are copyrighted assets and shipping them in our
 * bundle is a non-starter. The Web Audio API gives us an
 * MSN-inspired two-note motif (A5 → D6) at zero file-size cost and
 * zero legal exposure.
 *
 * Each call to playMessageReceive constructs a fresh AudioContext.
 * That's cheap (~1ms) and modern browsers GC the context once both
 * oscillators stop. Safari < 14.1 still requires the webkit-prefixed
 * constructor; we fall back to it. Any failure is swallowed silently
 * (autoplay policies, no audio device, etc.) — chat must keep
 * working without sound.
 *
 * Autoplay note: most browsers gate AudioContext.start() behind a
 * user-gesture in the same task chain. Our trigger is the post-send
 * arrival of a Dev reply, which does NOT inherit the original send
 * gesture (the await chain crosses microtasks). The first ding may
 * therefore be silently blocked on a fresh page. Subsequent dings,
 * once the user has interacted with the modal at least once, work
 * because the audio "permission" is granted lazily on the next
 * gesture. Acceptable — Phase 3.5 prioritises low complexity / no
 * persistent state. If this becomes annoying, Phase 4+ can pre-warm
 * an AudioContext on the first openChatModal() click.
 */

import { useCallback } from 'react';

export function useChatSounds(enabled) {
  const playMessageReceive = useCallback(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    let ctx;
    try {
      ctx = new Ctx();
    } catch {
      return;
    }

    try {
      const start = ctx.currentTime;

      // First note — A5 (880Hz). Quick attack, ~150ms tail.
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.frequency.value = 880;
      g1.gain.value = 0;
      g1.gain.linearRampToValueAtTime(0.15, start + 0.01);
      g1.gain.linearRampToValueAtTime(0, start + 0.15);
      o1.connect(g1);
      g1.connect(ctx.destination);
      o1.start(start);
      o1.stop(start + 0.2);

      // Second note — D6 (1175Hz), starts 60ms in for the two-tone
      // overlap. Slightly longer tail so the chord fades naturally.
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.frequency.value = 1175;
      g2.gain.value = 0;
      g2.gain.linearRampToValueAtTime(0.12, start + 0.08);
      g2.gain.linearRampToValueAtTime(0, start + 0.25);
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.start(start + 0.06);
      o2.stop(start + 0.3);

      // Close the context after the second note is fully done so we
      // don't accumulate suspended contexts on a long session.
      // 50ms safety margin past the longer of the two stops.
      const closeAt = (0.3 + 0.05) * 1000;
      window.setTimeout(() => {
        try {
          ctx.close();
        } catch {
          /* already closed */
        }
      }, closeAt);
    } catch {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    }
  }, [enabled]);

  return { playMessageReceive };
}
