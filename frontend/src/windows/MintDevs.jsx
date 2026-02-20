import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { NXDEV_ADDRESS, NXDEV_ABI } from '../services/contract';

const PHASE_NAMES = { 0: 'CLOSED', 1: 'WHITELIST', 2: 'PUBLIC' };
const MAX_SUPPLY = 35000;

export default function MintDevs() {
  const [quantity, setQuantity] = useState(1);
  const { address, isConnected } = useAccount();

  // Read contract state
  const { data: mintPrice } = useReadContract({
    address: NXDEV_ADDRESS, abi: NXDEV_ABI, functionName: 'mintPrice',
  });
  const { data: whitelistPriceData } = useReadContract({
    address: NXDEV_ADDRESS, abi: NXDEV_ABI, functionName: 'whitelistPrice',
  });
  const { data: totalMinted } = useReadContract({
    address: NXDEV_ADDRESS, abi: NXDEV_ABI, functionName: 'totalMinted',
  });
  const { data: mintPhase } = useReadContract({
    address: NXDEV_ADDRESS, abi: NXDEV_ABI, functionName: 'mintPhase',
  });
  const { data: isWhitelisted } = useReadContract({
    address: NXDEV_ADDRESS, abi: NXDEV_ABI, functionName: 'whitelisted',
    args: [address || '0x0000000000000000000000000000000000000000'],
    enabled: !!address,
  });
  const { data: freeAllowance } = useReadContract({
    address: NXDEV_ADDRESS, abi: NXDEV_ABI, functionName: 'freeMintAllowance',
    args: [address || '0x0000000000000000000000000000000000000000'],
    enabled: !!address,
  });
  const { data: userBalance } = useReadContract({
    address: NXDEV_ADDRESS, abi: NXDEV_ABI, functionName: 'balanceOf',
    args: [address || '0x0000000000000000000000000000000000000000'],
    enabled: !!address,
  });

  // Write contract
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const phase = mintPhase !== undefined ? Number(mintPhase) : null;
  const minted = totalMinted !== undefined ? Number(totalMinted) : 0;
  const remaining = MAX_SUPPLY - minted;
  const price = phase === 1 ? whitelistPriceData : mintPrice;
  const priceETH = price ? formatEther(price) : '0';
  const totalCost = price ? formatEther(price * BigInt(quantity)) : '0';
  const owned = userBalance !== undefined ? Number(userBalance) : 0;
  const freeMintsLeft = freeAllowance !== undefined ? Number(freeAllowance) : 0;

  const canMint = () => {
    if (!isConnected) return { ok: false, msg: 'Connect wallet first' };
    if (phase === 0) return { ok: false, msg: 'Mint is closed' };
    if (phase === 1 && !isWhitelisted && freeMintsLeft === 0) return { ok: false, msg: 'Not whitelisted' };
    if (remaining < quantity) return { ok: false, msg: 'Not enough supply' };
    return { ok: true, msg: '' };
  };

  const handleMint = () => {
    if (!canMint().ok) return;

    // Free mint takes priority
    if (freeMintsLeft >= quantity) {
      writeContract({
        address: NXDEV_ADDRESS, abi: NXDEV_ABI,
        functionName: 'freeMint',
        args: [BigInt(quantity)],
      });
      return;
    }

    // Whitelist mint
    if (phase === 1 && isWhitelisted) {
      writeContract({
        address: NXDEV_ADDRESS, abi: NXDEV_ABI,
        functionName: 'whitelistMint',
        args: [BigInt(quantity)],
        value: whitelistPriceData * BigInt(quantity),
      });
      return;
    }

    // Public mint
    writeContract({
      address: NXDEV_ADDRESS, abi: NXDEV_ABI,
      functionName: 'mint',
      args: [BigInt(quantity)],
      value: mintPrice * BigInt(quantity),
    });
  };

  const { ok: mintOk, msg: mintMsg } = canMint();

  return (
    <div style={{ padding: '8px', fontSize: '12px', fontFamily: 'Fixedsys, Consolas, monospace' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, #000 0%, #0a1628 100%)',
        border: '2px solid #00ff41',
        padding: '12px',
        marginBottom: '8px',
        textAlign: 'center',
      }}>
        <div style={{ color: '#00ff41', fontSize: '16px', fontWeight: 'bold' }}>
          ▓▓ MINT YOUR DEV ▓▓
        </div>
        <div style={{ color: '#00ff41', opacity: 0.7, marginTop: '4px' }}>
          35,000 AI Developers • Random Assignment
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px',
        marginBottom: '8px',
      }}>
        <div style={statBox}>
          <div style={statLabel}>MINTED</div>
          <div style={statValue}>{minted.toLocaleString()} / {MAX_SUPPLY.toLocaleString()}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>REMAINING</div>
          <div style={statValue}>{remaining.toLocaleString()}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>PHASE</div>
          <div style={{ ...statValue, color: phase === 2 ? '#00ff41' : phase === 1 ? '#ffff00' : '#ff4444' }}>
            {phase !== null ? PHASE_NAMES[phase] : '...'}
          </div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>PRICE</div>
          <div style={statValue}>
            {freeMintsLeft > 0 ? 'FREE' : `${priceETH} ETH`}
          </div>
        </div>
      </div>

      {/* User info */}
      {isConnected && (
        <div style={{
          border: '1px solid #444',
          background: '#0a0a0a',
          padding: '8px',
          marginBottom: '8px',
        }}>
          <div style={{ color: '#888' }}>
            You own: <span style={{ color: '#00ff41' }}>{owned}</span> devs
            {freeMintsLeft > 0 && (
              <span> • <span style={{ color: '#ffff00' }}>{freeMintsLeft}</span> free mints</span>
            )}
            {isWhitelisted && <span> • <span style={{ color: '#00ccff' }}>WL</span></span>}
          </div>
        </div>
      )}

      {/* Quantity selector */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '8px', justifyContent: 'center',
      }}>
        <button
          style={qtyBtn}
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          disabled={quantity <= 1}
        >−</button>

        <div style={{
          background: '#000', border: '2px inset #888',
          padding: '6px 16px', minWidth: '40px', textAlign: 'center',
          color: '#00ff41', fontSize: '18px', fontWeight: 'bold',
        }}>
          {quantity}
        </div>

        <button
          style={qtyBtn}
          onClick={() => setQuantity(Math.min(20, quantity + 1))}
          disabled={quantity >= 20}
        >+</button>
      </div>

      {/* Total */}
      <div style={{ textAlign: 'center', marginBottom: '8px', color: '#888' }}>
        Total: <span style={{ color: '#fff', fontWeight: 'bold' }}>
          {freeMintsLeft >= quantity ? 'FREE' : `${totalCost} ETH`}
        </span>
      </div>

      {/* Mint button */}
      <button
        style={{
          ...mintButton,
          opacity: (!mintOk || isPending || isConfirming) ? 0.5 : 1,
          cursor: (!mintOk || isPending || isConfirming) ? 'not-allowed' : 'pointer',
        }}
        onClick={handleMint}
        disabled={!mintOk || isPending || isConfirming}
      >
        {isPending ? '⏳ CONFIRM IN WALLET...' :
         isConfirming ? '⛏️ MINING...' :
         isSuccess ? '✅ MINTED!' :
         !isConnected ? '🔌 CONNECT WALLET FIRST' :
         `⚡ MINT ${quantity} DEV${quantity > 1 ? 'S' : ''}`}
      </button>

      {/* Status messages */}
      {!mintOk && isConnected && (
        <div style={{ color: '#ff4444', textAlign: 'center', marginTop: '6px', fontSize: '11px' }}>
          ⚠ {mintMsg}
        </div>
      )}

      {writeError && (
        <div style={{ color: '#ff4444', textAlign: 'center', marginTop: '6px', fontSize: '11px', wordBreak: 'break-all' }}>
          ✖ {writeError.shortMessage || writeError.message}
        </div>
      )}

      {isSuccess && txHash && (
        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <a
            href={`https://megaeth.blockscout.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#00ccff', fontSize: '11px' }}
          >
            View on Explorer ↗
          </a>
        </div>
      )}

      {/* Progress bar */}
      <div style={{
        marginTop: '12px', border: '1px solid #444',
        background: '#000', height: '14px', position: 'relative',
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #004400, #00ff41)',
          height: '100%',
          width: `${(minted / MAX_SUPPLY) * 100}%`,
          transition: 'width 0.5s',
        }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: '9px', textShadow: '1px 1px 0 #000',
        }}>
          {((minted / MAX_SUPPLY) * 100).toFixed(1)}% MINTED
        </div>
      </div>
    </div>
  );
}

// Styles
const statBox = {
  border: '1px solid #333',
  background: '#0a0a0a',
  padding: '6px',
  textAlign: 'center',
};
const statLabel = { color: '#666', fontSize: '10px', marginBottom: '2px' };
const statValue = { color: '#00ff41', fontSize: '14px', fontWeight: 'bold' };
const qtyBtn = {
  width: '32px', height: '32px',
  background: '#c0c0c0', border: '2px outset #fff',
  fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
  fontFamily: 'inherit',
};
const mintButton = {
  width: '100%', padding: '10px',
  background: 'linear-gradient(180deg, #006600, #004400)',
  border: '2px outset #00ff41',
  color: '#00ff41', fontSize: '14px', fontWeight: 'bold',
  fontFamily: 'Fixedsys, Consolas, monospace',
  letterSpacing: '1px',
};
