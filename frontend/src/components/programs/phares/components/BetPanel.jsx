import { useState } from 'react';
import { OPTION_COLORS } from '../constants';

const PRESETS = [50, 100, 250, 500];

export default function BetPanel({ selectedMarket, selectedSide, setSelectedSide, betAmount, setBetAmount, walletConnected, nxtBalance, balanceDisplay }) {
  const [confirmed, setConfirmed] = useState(false);

  // Use real balance from wallet, fallback to 0 if not connected
  const balance = walletConnected && nxtBalance != null ? Math.floor(nxtBalance) : 0;

  if (!selectedMarket) {
    return (
      <div className="phares-panel">
        <div className="phares-panel-label">Place Prediction</div>
        <div className="phares-empty" style={{ height: 100 }}>Select a market</div>
      </div>
    );
  }

  const selectedOption = selectedMarket.options.find(
    o => o.name.toLowerCase() === selectedSide?.toLowerCase()
  );
  const amount = parseFloat(betAmount) || 0;
  const odds = selectedOption ? selectedOption.multiplier : 0;
  const potentialReturn = amount > 0 && odds > 0 ? (amount * odds).toFixed(0) : '--';
  const netProfit = amount > 0 && odds > 0 ? ((amount * odds - amount) * 0.97).toFixed(0) : '--';

  const getSubmitText = () => {
    if (confirmed) return 'CONFIRMED ✓';
    if (!walletConnected) return 'CONNECT WALLET';
    if (!selectedSide) return 'SELECT POSITION';
    if (!amount) return 'ENTER AMOUNT';
    if (amount > balance) return 'INSUFFICIENT BALANCE';
    return `CONFIRM ${selectedSide.toUpperCase()} · ${amount} NXT`;
  };

  const canSubmit = walletConnected && selectedSide && amount > 0 && amount <= balance && !confirmed;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setConfirmed(true);
    setTimeout(() => {
      setConfirmed(false);
      setSelectedSide(null);
      setBetAmount('');
    }, 2000);
  };

  return (
    <div className="phares-panel">
      <div className="phares-panel-label">Place Prediction</div>
      <div className="phares-bet-question">{selectedMarket.question}</div>

      {/* Token selector */}
      <div className="phares-token-selector">
        <button className="phares-token-btn phares-token-btn--active">$NXT</button>
        <button className="phares-token-btn phares-token-btn--disabled" disabled>
          $ETH<span className="phares-token-soon">soon</span>
        </button>
      </div>

      {/* Side buttons */}
      <div className="phares-side-buttons">
        {selectedMarket.options.map(opt => {
          const color = OPTION_COLORS[opt.color];
          const isActive = selectedSide === opt.name;
          return (
            <button
              key={opt.name}
              className={`phares-side-btn ${isActive ? 'phares-side-btn--selected' : ''}`}
              style={{
                color: isActive ? color : undefined,
                borderColor: isActive ? color : undefined,
              }}
              onClick={() => setSelectedSide(opt.name)}
            >
              {opt.name} · {opt.multiplier}x
            </button>
          );
        })}
      </div>

      {/* Amount */}
      <div className="phares-amount-header">
        <span className="phares-amount-label">Amount</span>
        <span className="phares-amount-balance">
          Balance: {walletConnected ? `${balanceDisplay || '0'} NXT` : '-- NXT'}
        </span>
      </div>
      <div className="phares-amount-wrapper">
        <input
          className="phares-amount-input"
          type="number"
          placeholder="0"
          value={betAmount}
          onChange={e => setBetAmount(e.target.value)}
          min="0"
          max={balance}
        />
        <span className="phares-amount-unit">NXT</span>
      </div>
      <div className="phares-presets">
        {PRESETS.map(p => (
          <button key={p} className="phares-preset-btn" onClick={() => setBetAmount(String(p))}>
            {p}
          </button>
        ))}
        <button className="phares-preset-btn" onClick={() => setBetAmount(String(balance))}>
          MAX
        </button>
      </div>

      {/* Summary */}
      <div className="phares-summary">
        <div className="phares-summary-row">
          <span className="phares-summary-label">Position</span>
          <span className="phares-summary-value">{selectedSide || '--'}</span>
        </div>
        <div className="phares-summary-row">
          <span className="phares-summary-label">Odds</span>
          <span className="phares-summary-value">{odds ? `${odds}x` : '--'}</span>
        </div>
        <div className="phares-summary-row">
          <span className="phares-summary-label">Potential return</span>
          <span className="phares-summary-value" style={{ color: potentialReturn !== '--' ? 'var(--accent)' : undefined }}>
            {potentialReturn !== '--' ? `${potentialReturn} NXT` : '--'}
          </span>
        </div>
        <div className="phares-summary-row phares-summary-row--profit">
          <span className="phares-summary-label">Net profit</span>
          <span className="phares-summary-value">
            {netProfit !== '--' ? `${netProfit} NXT` : '--'}
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        className={`phares-submit-btn ${confirmed ? 'phares-submit-btn--confirmed' : ''}`}
        disabled={!canSubmit && !confirmed}
        onClick={handleSubmit}
      >
        {getSubmitText()}
      </button>

      <div className="phares-fee-notice">3% protocol fee on winnings</div>
    </div>
  );
}
