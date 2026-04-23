import { useEffect, useState } from 'react';
import {
  useStatus,
  useConnect,
  useDisconnect,
  useBalances,
  useGetFromContract,
  mega,
} from '@megaeth-labs/wallet-sdk-react';
import {
  NXDEVNFT_ADDRESS,
  NXDEVNFT_ABI,
} from '../services/contract';
import styles from './MossTest.module.css';

// MossTest — internal diagnostic route for validating the MegaETH
// Wallet SDK end-to-end before exposing it to users.
//
// Not linked from the app menu. Accessible at /moss-test for anyone
// who knows the URL. Safe to share with the MegaETH tester group.
//
// Sections:
//   1. Status       — initialised flag, connection status, address
//   2. Connect/     — buttons that fire useConnect/useDisconnect and
//      Disconnect     surface any error from the SDK
//   3. Balances     — token list with USD prices from the SDK
//   4. Read NXDevNFT — balanceOf(address) call against the live contract
//   5. Debug JSON   — raw output of every hook for deep inspection

export default function MossTest() {
  const status = useStatus();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const balances = useBalances();

  // State for the on-demand NXDevNFT read. Triggered by button click rather
  // than on every render so we don't spam the RPC with balanceOf calls.
  const getFromContract = useGetFromContract();
  const [nftBalance, setNftBalance] = useState(null);
  const [nftError, setNftError] = useState(null);

  const handleReadNftBalance = () => {
    if (!status.address) return;
    setNftError(null);
    getFromContract.mutate(
      {
        address: NXDEVNFT_ADDRESS,
        abi: NXDEVNFT_ABI,
        functionName: 'balanceOf',
        args: [status.address],
      },
      {
        onSuccess: (result) => setNftBalance(result?.toString() ?? 'null'),
        onError: (err) => setNftError(err?.message || String(err)),
      }
    );
  };

  // Listen to raw status changes from the core SDK for extra debugging
  // visibility. useStatus() reads this same stream under the hood, but
  // surfacing the raw events here helps diagnose race conditions during
  // the iframe bootstrap.
  const [rawEvents, setRawEvents] = useState([]);
  useEffect(() => {
    const handler = (evt) => {
      setRawEvents((prev) => [
        { ts: new Date().toISOString(), event: evt },
        ...prev.slice(0, 9),
      ]);
    };
    mega.events.onStatusChange(handler);
    // The SDK's event API doesn't expose an unsubscribe — leaving this
    // mounted once per page load is fine for a diagnostic route.
    return undefined;
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>MOSS SDK — Diagnostic Route</h1>
        <p className={styles.subtitle}>
          Internal page for validating MegaETH Wallet SDK integration.
          Not intended for end users.
        </p>
      </header>

      {/* ─── 1. Status ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Status</h2>
        <div className={styles.statusGrid}>
          <div className={styles.statusItem}>
            <span className={styles.label}>initialised</span>
            <span className={styles.value}>
              {status.initialised ? '✅ true' : '⏳ false'}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.label}>status</span>
            <span className={styles.value}>{status.status || '—'}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.label}>address</span>
            <span className={styles.valueMono}>
              {status.address || '—'}
            </span>
          </div>
        </div>
      </section>

      {/* ─── 2. Connect / Disconnect ───────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Connect / Disconnect</h2>
        <div className={styles.buttonRow}>
          <button
            className={styles.primaryBtn}
            onClick={() => connect.mutate()}
            disabled={connect.isPending || status.status === 'connected'}
          >
            {connect.isPending ? 'Connecting…' : 'Connect'}
          </button>
          <button
            className={styles.secondaryBtn}
            onClick={() => disconnect.mutate()}
            disabled={
              disconnect.isPending || status.status !== 'connected'
            }
          >
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
        {connect.error && (
          <p className={styles.error}>
            Connect error: {connect.error.message || String(connect.error)}
          </p>
        )}
        {disconnect.error && (
          <p className={styles.error}>
            Disconnect error:{' '}
            {disconnect.error.message || String(disconnect.error)}
          </p>
        )}
      </section>

      {/* ─── 3. Balances ───────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Balances</h2>
        {balances.isLoading && <p>Loading balances…</p>}
        {balances.error && (
          <p className={styles.error}>
            {balances.error.message || String(balances.error)}
          </p>
        )}
        {balances.data && balances.data.length === 0 && (
          <p className={styles.muted}>No tokens found.</p>
        )}
        {balances.data && balances.data.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Balance</th>
                <th>USD Price</th>
                <th>USD Balance</th>
              </tr>
            </thead>
            <tbody>
              {balances.data.map((t) => (
                <tr key={t.address}>
                  <td>{t.symbol}</td>
                  <td>{t.name}</td>
                  <td>{t.displayBalance}</td>
                  <td>{t.usdPrice ?? '—'}</td>
                  <td>{t.usdBalance ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ─── 4. Read NXDevNFT ──────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Read NXDevNFT.balanceOf</h2>
        <p className={styles.muted}>
          Contract: <code>{NXDEVNFT_ADDRESS}</code>
        </p>
        <div className={styles.buttonRow}>
          <button
            className={styles.primaryBtn}
            onClick={handleReadNftBalance}
            disabled={!status.address || getFromContract.isPending}
          >
            {getFromContract.isPending
              ? 'Reading…'
              : 'Read balanceOf(me)'}
          </button>
        </div>
        {nftBalance !== null && (
          <p className={styles.success}>
            balanceOf returned: <strong>{nftBalance}</strong> aNFTs
          </p>
        )}
        {nftError && <p className={styles.error}>{nftError}</p>}
      </section>

      {/* ─── 5. Debug JSON ─────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Debug (raw hook output)</h2>
        <details className={styles.details}>
          <summary>useStatus()</summary>
          <pre className={styles.pre}>
            {JSON.stringify(status, null, 2)}
          </pre>
        </details>
        <details className={styles.details}>
          <summary>useBalances() — metadata</summary>
          <pre className={styles.pre}>
            {JSON.stringify(
              {
                isLoading: balances.isLoading,
                isError: balances.isError,
                isSuccess: balances.isSuccess,
                dataCount: balances.data?.length ?? null,
              },
              null,
              2
            )}
          </pre>
        </details>
        <details className={styles.details}>
          <summary>Recent status events (last 10)</summary>
          <pre className={styles.pre}>
            {JSON.stringify(rawEvents, null, 2)}
          </pre>
        </details>
      </section>

      <footer className={styles.footer}>
        <p>NX Terminal · MOSS integration · {new Date().toISOString()}</p>
      </footer>
    </div>
  );
}
