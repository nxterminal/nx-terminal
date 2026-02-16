import { useState } from 'react';

const QUIZ_OPTIONS = [
  { text: "Ship a hotfix. Blog about it later.", corp: 'CLOSED AI' },
  { text: "Stop everything. 14 safety checks.", corp: 'MISANTHROPIC' },
  { text: "Publish a research paper. Never fix it.", corp: 'SHALLOW MIND' },
  { text: "Pivot the entire product.", corp: 'ZUCK LABS' },
  { text: "Tweet 'we're aware' and go back to sleep.", corp: 'Y.AI' },
  { text: "Fork someone else's working code.", corp: 'MISTRIAL SYSTEMS' },
];

const CORP_DATA = {
  'CLOSED AI': {
    motto: 'We promised to be open.',
    ceo: 'Scam Altwoman',
    perk: '+25% protocol visibility',
    debuff: '15% undisclosed bugs',
  },
  'MISANTHROPIC': {
    motto: 'Safe AI. Hates everyone.',
    ceo: 'Dario Annoyed-ei',
    perk: '50% fewer bugs',
    debuff: '30% slower shipping',
  },
  'SHALLOW MIND': {
    motto: 'Infinite compute. Zero products.',
    ceo: 'Sundial Richy',
    perk: 'Better market intel',
    debuff: '40% slower to ship',
  },
  'ZUCK LABS': {
    motto: "Pivot to whatever's trending.",
    ceo: 'Mark Zuckatron',
    perk: 'Free location changes',
    debuff: 'Protocols rename -10%',
  },
  'Y.AI': {
    motto: 'Tweet before we build.',
    ceo: 'FelonUsk',
    perk: '2x trollbox visibility',
    debuff: "50% features don't work",
  },
  'MISTRIAL SYSTEMS': {
    motto: 'Open source. When convenient.',
    ceo: 'Pierre-Antoine du Code',
    perk: 'Fork cost -50%',
    debuff: 'Docs always incomplete',
  },
};

export default function HireDevs({ onStartDialUp }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);
  const [corp, setCorp] = useState(null);
  const [devCount, setDevCount] = useState(1);

  const handleQuizSelect = (option) => {
    setSelected(option);
    setCorp(option.corp);
  };

  const costETH = (devCount * 0.0011).toFixed(4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Progress dots */}
      <div className="wizard-dots">
        <div className={`wizard-dot${step >= 1 ? (step > 1 ? ' done' : ' active') : ''}`} />
        <div className={`wizard-dot${step >= 2 ? (step > 2 ? ' done' : ' active') : ''}`} />
        <div className={`wizard-dot${step >= 3 ? ' active' : ''}`} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {/* Step 1: Corp Interview */}
        {step === 1 && (
          <>
            <div style={{
              fontFamily: "'VT323', monospace",
              fontSize: '16px',
              color: 'var(--terminal-cyan)',
              marginBottom: '8px',
            }}>
              {'>> CORP INTERVIEW'}
            </div>
            <div style={{ fontSize: '11px', marginBottom: '12px', fontWeight: 'bold' }}>
              A critical bug is found in production. What do you do?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {QUIZ_OPTIONS.map((opt, i) => (
                <button
                  key={i}
                  className="win-btn"
                  onClick={() => handleQuizSelect(opt)}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    background: selected === opt ? 'var(--selection)' : undefined,
                    color: selected === opt ? 'var(--selection-text)' : undefined,
                  }}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Your Corp */}
        {step === 2 && corp && (
          <>
            <div style={{
              fontFamily: "'VT323', monospace",
              fontSize: '16px',
              color: 'var(--terminal-cyan)',
              marginBottom: '8px',
            }}>
              {'>> YOUR CORPORATION'}
            </div>
            <div className="gold-box">
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '6px' }}>{corp}</div>
              <div style={{ fontStyle: 'italic', marginBottom: '8px' }}>"{CORP_DATA[corp].motto}"</div>
              <div style={{ lineHeight: '1.8' }}>
                <div><span style={{ color: 'var(--terminal-amber)' }}>CEO:</span> {CORP_DATA[corp].ceo}</div>
                <div><span style={{ color: 'var(--terminal-green)' }}>Perk:</span> {CORP_DATA[corp].perk}</div>
                <div><span style={{ color: 'var(--terminal-red)' }}>Debuff:</span> {CORP_DATA[corp].debuff}</div>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Hire Your Team */}
        {step === 3 && (
          <>
            <div style={{
              fontFamily: "'VT323', monospace",
              fontSize: '16px',
              color: 'var(--terminal-cyan)',
              marginBottom: '8px',
            }}>
              {'>> HIRE YOUR TEAM'}
            </div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', marginBottom: '8px' }}>How many devs do you want to hire?</div>
              <div className="number-selector" style={{ justifyContent: 'center' }}>
                <button
                  className="win-btn"
                  onClick={() => setDevCount(c => Math.max(1, c - 1))}
                  style={{ width: 30, padding: '2px' }}
                >-</button>
                <div className="num-display">{devCount}</div>
                <button
                  className="win-btn"
                  onClick={() => setDevCount(c => Math.min(20, c + 1))}
                  style={{ width: 30, padding: '2px' }}
                >+</button>
              </div>
            </div>
            <div className="gold-box" style={{ textAlign: 'center' }}>
              <div>Cost: <span style={{ fontSize: '18px' }}>{costETH} ETH</span></div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                Salary: {devCount * 200} $NXT/day ({devCount} devs x 200 $NXT)
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        padding: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px solid var(--border-dark)',
      }}>
        <button
          className="win-btn"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
        >
          &lt; Back
        </button>
        {step < 3 ? (
          <button
            className="win-btn"
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 && !selected}
          >
            {step === 2 ? 'Accept Assignment >' : 'Next >'}
          </button>
        ) : (
          <button
            className="win-btn primary"
            onClick={() => onStartDialUp?.(devCount, corp)}
            style={{ padding: '4px 16px' }}
          >
            Hire \u2014 {costETH} ETH
          </button>
        )}
      </div>
    </div>
  );
}
