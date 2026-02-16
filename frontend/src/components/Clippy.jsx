import { useState, useEffect, useRef } from 'react';

const TIPS = [
  "It looks like you're trying to hack a protocol! Would you like help?",
  "Tip: Remember to collect your salary every cycle!",
  "Did you know? DEGEN devs have a 40% chance of 100x... and 60% chance of ruin.",
  "Your devs are working hard. Maybe check on them?",
  "Pro tip: The Leaderboard updates every 30 seconds.",
  "Fun fact: Nobody has ever beaten Bug Sweeper on the first try. Allegedly.",
  "Warning: The FED is always watching. Act natural.",
  "Have you tried investing in protocols? What could go wrong?",
  "Tip: Right-click in Bug Sweeper to place flags!",
  "It looks like you're reading the lore. Excellent choice, Operator.",
  "Remember: In Protocol Wars, trust is a liability.",
  "Your inbox has unread messages! (They're probably spam.)",
  "The LURKER archetype is underrated. Just saying.",
  "Did you know? The first commit was pushed by [REDACTED].",
  "Tip: Use Notepad to track your strategies!",
];

export default function Clippy({ onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [tip, setTip] = useState('');
  const timerRef = useRef(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const schedule = () => {
      const delay = 30000 + Math.random() * 60000; // 30-90 seconds
      timerRef.current = setTimeout(() => {
        if (!dismissedRef.current) {
          setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
          setVisible(true);
          // Auto-hide after 12 seconds
          setTimeout(() => setVisible(false), 12000);
        }
        schedule();
      }, delay);
    };

    // Show first tip after 15-25 seconds
    timerRef.current = setTimeout(() => {
      setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
      setVisible(true);
      setTimeout(() => setVisible(false), 12000);
      schedule();
    }, 15000 + Math.random() * 10000);

    return () => clearTimeout(timerRef.current);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="clippy-container">
      <div className="clippy-bubble">
        <button className="clippy-close" onClick={handleDismiss}>&times;</button>
        <div className="clippy-text">{tip}</div>
      </div>
      <div className="clippy-character">
        <div className="clippy-body">📎</div>
      </div>
    </div>
  );
}
