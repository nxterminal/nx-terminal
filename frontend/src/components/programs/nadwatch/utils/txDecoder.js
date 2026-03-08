import { TX_METHOD_SIGNATURES } from '../constants';

function shortenAddress(addr) {
  if (!addr || addr.length < 10) return addr || '—';
  return addr.slice(0, 6) + '..' + addr.slice(-4);
}

function shortenHash(hash) {
  if (!hash || hash.length < 10) return hash || '—';
  return hash.slice(0, 10) + '..' + hash.slice(-6);
}

function hexWeiToMon(hexValue) {
  try {
    const wei = BigInt(hexValue);
    const mon = Number(wei) / 1e18;
    if (mon === 0) return '0';
    if (mon < 0.001) return '<0.001';
    return mon.toFixed(3);
  } catch {
    return '0';
  }
}

function inferTxType(input, to) {
  if (!to || to === '0x0000000000000000000000000000000000000000') {
    return { name: 'Deploy', color: '#00FFFF' };
  }
  if (!input || input === '0x' || input === '0x0') {
    return TX_METHOD_SIGNATURES['0x'];
  }
  const sig = input.slice(0, 10).toLowerCase();
  return TX_METHOD_SIGNATURES[sig] || TX_METHOD_SIGNATURES['default'];
}

export function decodeTx(tx) {
  const txType = inferTxType(tx.input, tx.to);
  return {
    typeName: txType.name,
    typeColor: txType.color,
    fromShort: shortenAddress(tx.from),
    toShort: shortenAddress(tx.to || ''),
    valueMon: hexWeiToMon(tx.value),
    hash: tx.hash,
    hashShort: shortenHash(tx.hash),
    gas: tx.gas,
    timestamp: tx.timestamp,
  };
}
