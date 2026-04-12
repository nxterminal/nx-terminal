import { COLORS } from '../constants';
import InfoTooltip from '../components/InfoTooltip';

function formatBlockNum(n) {
  if (!n) return '---';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toLocaleString();
}

const STAGES = [
  { label: 'PROPOSE',  key: 'propose',  color: '#00FFFF', offset: 2, tip: 'Propose — Leader proposes a new block containing ordered transactions. Block N+2 is proposed while earlier blocks are still being finalized.' },
  { label: 'VOTE',     key: 'vote',     color: '#7B2FBE', offset: 1, tip: 'Vote — Validators vote on the proposed block. AsyncBFT requires 2/3+ validator agreement for consensus.' },
  { label: 'FINALIZE', key: 'finalize', color: '#30FF60', offset: 0, tip: 'Finalize — Block is finalized after receiving sufficient votes. Finality achieved in ~800ms (2 block times).' },
  { label: 'EXECUTE',  key: 'execute',  color: '#FFD700', offset: -3, tip: 'Execute — Deferred execution: transactions execute after finalization. This allows consensus and execution to run in parallel.' },
];

export default function PipelineStatus({ blockNumber = 0 }) {
  return (
    <div style={{
      height: '100%',
      padding: '8px 10px',
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      color: COLORS.text,
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <InfoTooltip text="AsyncBFT Pipeline — 4 consensus stages run in parallel on different blocks. While one block is proposed, the previous is voted on, the one before finalized, and an earlier one executed.">
        <div style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: '10px', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '4px' }}>
          ASYNCBFT PIPELINE
        </div>
      </InfoTooltip>

      {STAGES.map((stage) => {
        const block = blockNumber + stage.offset;
        return (
          <InfoTooltip key={stage.key} text={stage.tip}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: stage.color, width: '60px', fontWeight: 'bold', fontSize: '10px', flexShrink: 0 }}>
                {stage.label}
              </span>
              <div style={{
                flex: 1,
                height: '14px',
                background: '#111',
                border: `1px solid ${COLORS.border}`,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Progress sweep */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: '40%',
                  background: `linear-gradient(90deg, transparent, ${stage.color}33, transparent)`,
                  animation: 'plx-pipeline-sweep 0.4s linear infinite',
                }} />
                <span style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '9px',
                  color: '#ccc',
                  whiteSpace: 'nowrap',
                }}>
                  Block {formatBlockNum(block)}
                </span>
              </div>
            </div>
          </InfoTooltip>
        );
      })}

      <div style={{ color: '#a0a0a0', fontSize: '9px', marginTop: '2px' }}>
        4 stages process different blocks simultaneously
      </div>
    </div>
  );
}
