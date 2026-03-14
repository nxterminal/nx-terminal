import { Check } from 'lucide-react';

const STEP_LABELS = ['Type', 'Configure', 'Features', 'Review'];

export default function StepIndicator({ current }) {
  return (
    <div className="mb-steps">
      {STEP_LABELS.map((label, i) => (
        <span key={i} style={{ display: 'contents' }}>
          <div className={`mb-step ${i < current ? 'completed' : i === current ? 'active' : ''}`}>
            <div className="mb-step-num">
              {i < current ? <Check size={12} /> : i + 1}
            </div>
            <span style={{ fontSize: 13 }}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`mb-step-line ${i < current ? 'completed' : ''}`} />
          )}
        </span>
      ))}
    </div>
  );
}
