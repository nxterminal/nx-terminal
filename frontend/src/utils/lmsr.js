// Logarithmic Market Scoring Rule — JavaScript port of
// backend/services/lmsr.py. Used to preview buy / exit results
// client-side before the user submits.
//
// Identical math to the backend (same logsumexp reformulation,
// same 3% sell penalty), so the preview matches the response that
// the backend will return down to the rounding step (frontend uses
// floats, backend Decimal — differences appear only past 6 decimals).

function logsumexpCost(qYes, qNo, b) {
  const a = qYes / b;
  const c = qNo / b;
  const m = Math.max(a, c);
  return b * (m + Math.log(Math.exp(a - m) + Math.exp(c - m)));
}

export function calculatePrice(sharesYes, sharesNo, liquidityB) {
  const qYes = Number(sharesYes);
  const qNo = Number(sharesNo);
  const b = Number(liquidityB);
  if (b <= 0) throw new Error('liquidity_b must be positive');

  const diff = (qNo - qYes) / b;
  let priceYes;
  if (diff >= 0) {
    const e = Math.exp(-diff);
    priceYes = e / (e + 1);
  } else {
    priceYes = 1 / (1 + Math.exp(diff));
  }
  return { price_yes: priceYes, price_no: 1 - priceYes };
}

export function calculateCostToBuy(sharesYes, sharesNo, liquidityB, side, amountNxt) {
  if (side !== 'YES' && side !== 'NO') throw new Error("side must be 'YES' or 'NO'");
  const amount = Number(amountNxt);
  if (amount <= 0) throw new Error('amount_nxt must be positive');
  const qYes = Number(sharesYes);
  const qNo = Number(sharesNo);
  const b = Number(liquidityB);
  if (b <= 0) throw new Error('liquidity_b must be positive');

  const cStart = logsumexpCost(qYes, qNo, b);
  const cTarget = cStart + amount;
  const qOther = side === 'YES' ? qNo : qYes;
  const t = cTarget / b;
  const r = qOther / b;
  if (t <= r) throw new Error('amount_nxt too small to produce any shares');
  // log(exp(t) - exp(r)) = t + log1p(-exp(r - t))
  const log1pArg = -Math.exp(r - t);
  const qNewOutcome = b * (t + Math.log1p(log1pArg));

  let newYes, newNo, sharesReceived;
  if (side === 'YES') {
    newYes = qNewOutcome;
    newNo = qNo;
    sharesReceived = newYes - qYes;
  } else {
    newYes = qYes;
    newNo = qNewOutcome;
    sharesReceived = newNo - qNo;
  }
  if (sharesReceived <= 0) throw new Error('no shares purchased (numerical underflow)');

  return {
    shares_received: sharesReceived,
    new_shares_yes: newYes,
    new_shares_no: newNo,
    average_price: amount / sharesReceived,
  };
}

export function calculateValueToSell(sharesYes, sharesNo, liquidityB, side, shares) {
  if (side !== 'YES' && side !== 'NO') throw new Error("side must be 'YES' or 'NO'");
  const s = Number(shares);
  if (s <= 0) throw new Error('shares must be positive');
  const qYes = Number(sharesYes);
  const qNo = Number(sharesNo);
  const b = Number(liquidityB);
  if (b <= 0) throw new Error('liquidity_b must be positive');

  let newYes, newNo;
  if (side === 'YES') {
    if (s > qYes) throw new Error('not enough YES shares in the pool');
    newYes = qYes - s;
    newNo = qNo;
  } else {
    if (s > qNo) throw new Error('not enough NO shares in the pool');
    newYes = qYes;
    newNo = qNo - s;
  }

  const cStart = logsumexpCost(qYes, qNo, b);
  const cEnd = logsumexpCost(newYes, newNo, b);
  const raw = cStart - cEnd;
  if (raw <= 0) throw new Error('sell would return no NXT (numerical underflow)');
  const penalty = raw * 0.03;
  const net = raw - penalty;

  return {
    value_before_penalty: raw,
    penalty_nxt: penalty,
    value_after_penalty: net,
    new_shares_yes: newYes,
    new_shares_no: newNo,
    average_price: net / s,
  };
}
