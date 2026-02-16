import { useState, useEffect } from 'react';

export default function NotificationBalloon({ onOpen, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 1500);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 9500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [onDismiss]);

  if (!visible) return null;

  const handleClick = () => {
    setVisible(false);
    onOpen?.();
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div className="notification-balloon" onClick={handleClick}>
      <button className="balloon-close" onClick={handleClose}>x</button>
      <div className="balloon-header">
        <span>{'\u2709'}</span>
        <span>New Mail</span>
      </div>
      <div className="balloon-body">
        You have a message from HR Department. Read it to start hiring devs.
      </div>
    </div>
  );
}
