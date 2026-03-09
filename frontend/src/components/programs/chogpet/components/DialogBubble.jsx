export default function DialogBubble({ text, visible }) {
  if (!visible || !text) return null;

  return (
    <div className="cp-bubble">
      <div className="cp-bubble-text">{text}</div>
      <div className="cp-bubble-arrow" />
    </div>
  );
}
