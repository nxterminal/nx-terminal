import { useState } from 'react';

const TRASH_ITEMS = [
  {
    name: 'my_seed_phrase.txt',
    type: 'Text Document',
    size: '256 B',
    deleted: 'Jan 15, 2025',
    icon: '[TXT]',
    detail: 'Contents: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"\n\nThis is the default BIP39 seed phrase. You wrote it down thinking it was YOUR seed phrase. It controls $0.00 in assets. The real seed phrase is still on that napkin at Denny\'s.',
  },
  {
    name: 'bitcoin_whitepaper_v2_MY_EDITS.pdf',
    type: 'PDF Document',
    size: '1.2 MB',
    deleted: 'Feb 3, 2025',
    icon: '[PDF]',
    detail: 'Your "improved" version of the Bitcoin whitepaper where you replaced "proof-of-work" with "proof-of-vibes" and added a section about how your coin will do 1000x.\n\nPeer reviews: 0\nDownloads: 1 (you)\nCitations: lol',
  },
  {
    name: 'LUNA_position_screenshot.png',
    type: 'PNG Image',
    size: '847 KB',
    deleted: 'May 12, 2022',
    icon: '[IMG]',
    detail: 'A screenshot of your $47,000 LUNA position at $119.18.\n\nCurrent value of LUNA: ~$0.00003\nCurrent value of screenshot: Priceless (as a reminder of hubris)\n\nYou kept this in the Recycle Bin because you can\'t bring yourself to permanently delete it. It\'s been 3 years.',
  },
  {
    name: 'definitely_not_a_rugpull.sol',
    type: 'Solidity File',
    size: '4.2 KB',
    deleted: 'Mar 22, 2025',
    icon: '[SOL]',
    detail: 'A smart contract you found on GitHub called "SafeMoonElonCumRocket.sol".\n\nHighlights:\n- Owner can mint unlimited tokens (Line 47)\n- Transfer tax: 99% (Line 112)\n- Comment on Line 1: "// trust me bro"\n- License: UNLICENSED\n\nYou almost deployed this. The only thing that saved you was running out of ETH for gas.',
  },
  {
    name: 'nft_collection/',
    type: 'Folder',
    size: '2.4 GB',
    deleted: 'Aug 8, 2025',
    icon: '[DIR]',
    detail: 'Your NFT collection, once valued at 12 ETH:\n\n- Bored Ape knockoff #4832 (bought: 0.5 ETH, worth: 0.001 ETH)\n- CryptoPunk tribute #9911 (bought: 2 ETH, worth: 0.0003 ETH)\n- "Abstract Art" that was actually a broken IPFS link (bought: 0.3 ETH, worth: 404)\n- AI-generated monkey wearing a hat (bought: 1 ETH, worth: a lesson)\n- Right-click saved Fidenza (free, somehow worth more than the rest combined)',
  },
  {
    name: 'trading_bot_v17_FINAL_FINAL.py',
    type: 'Python Script',
    size: '12 KB',
    deleted: 'Nov 30, 2025',
    icon: '[PY]',
    detail: 'Your 17th attempt at a trading bot. Previous versions:\n- v1-v5: Lost money\n- v6-v10: Lost money faster\n- v11-v15: Briefly profitable, then lost everything\n- v16: Accidentally bought $50,000 of a coin called "SCAM"\n- v17: Works perfectly in backtesting, loses money in real-time\n\nTotal spent on API fees: $2,340\nTotal profit: -$8,712\nTotal lessons learned: 0',
  },
  {
    name: 'letter_to_SEC.docx',
    type: 'Word Document',
    size: '28 KB',
    deleted: 'Dec 1, 2025',
    icon: '[DOC]',
    detail: 'Draft letter to the SEC explaining why your DeFi protocol is "definitely not a security."\n\nPage 1: Legal arguments\nPage 2: More legal arguments\nPage 3: "Please, I can\'t afford another lawyer"\nPage 4: Diagram of a duck explaining the Howey Test\nPage 5: (blank - you gave up)\n\nNever sent. Your lawyer said it would "make things significantly worse."',
  },
  {
    name: 'crypto_taxes_2024.xlsx',
    type: 'Excel Spreadsheet',
    size: '156 KB',
    deleted: 'Apr 14, 2025',
    icon: '[XLS]',
    detail: 'Your attempt to calculate crypto taxes for 2024.\n\nTransactions: 4,847\nExchanges used: 11\nDeFi protocols: 23\nChains bridged: 7\nCSV files downloaded: 34\nCSV files that actually imported correctly: 0\n\nFinal tax liability: ¯\\_(ツ)_/¯\n\nYour accountant quit. The new accountant also quit.',
  },
  {
    name: 'gm.eth_receipt.pdf',
    type: 'PDF Document',
    size: '89 KB',
    deleted: 'Sep 5, 2025',
    icon: '[PDF]',
    detail: 'Receipt for purchasing the ENS domain "gm.eth" for 3.5 ETH ($8,400 at the time).\n\nCurrent usage: None\nRenewal cost: 0.012 ETH/year\nTimes you\'ve typed "gm" in any chat since buying it: 3,847\nPeople who were impressed: 0\n\nYou put this in the recycle bin when someone offered to buy it for 0.02 ETH.',
  },
  {
    name: 'therapist_crypto_notes.txt',
    type: 'Text Document',
    size: '3 KB',
    deleted: 'Jan 2, 2026',
    icon: '[TXT]',
    detail: 'Notes from your therapy session about crypto addiction:\n\n"Patient reports checking portfolio 47 times per day. States they \'can stop anytime\' while refreshing CoinGecko during session.\n\nRecommendation: Touch grass. Patient asked if grass was available on Uniswap.\n\nFollow-up: Patient now meditating. Asked if mindfulness could be tokenized.\n\nStatus: Not improving. Patient tried to pay for session in $NXT."',
  },
];

export default function RecycleBin() {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const selected = selectedIdx !== null ? TRASH_ITEMS[selectedIdx] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '4px 8px',
        background: 'var(--win-bg)',
        borderBottom: '1px solid var(--border-dark)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '11px',
      }}>
        <span style={{ fontWeight: 'bold' }}>Recycle Bin</span>
        <span style={{ color: '#666' }}>|</span>
        <span>{TRASH_ITEMS.length} items</span>
        {selected && (
          <>
            <span style={{ color: '#666' }}>|</span>
            <button
              className="win-btn"
              onClick={() => setSelectedIdx(null)}
              style={{ fontSize: '10px', padding: '1px 8px' }}
            >
              Back to list
            </button>
          </>
        )}
      </div>

      {!selected ? (
        <div className="win-panel" style={{ flex: 1, overflow: 'auto' }}>
          <table className="win-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '24px' }}></th>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Date Deleted</th>
              </tr>
            </thead>
            <tbody>
              {TRASH_ITEMS.map((item, i) => (
                <tr
                  key={i}
                  className="clickable"
                  onClick={() => setSelectedIdx(i)}
                >
                  <td style={{ textAlign: 'center' }}>{item.icon}</td>
                  <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                  <td>{item.type}</td>
                  <td>{item.size}</td>
                  <td>{item.deleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--border-dark)',
          }}>
            <span style={{ fontSize: '28px' }}>{selected.icon}</span>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{selected.name}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>
                {selected.type} — {selected.size} — Deleted {selected.deleted}
              </div>
            </div>
          </div>
          <pre style={{
            fontFamily: "'Tahoma', sans-serif",
            fontSize: '11px',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            padding: '8px',
            background: '#fffff8',
            border: '1px solid var(--border-dark)',
          }}>
            {selected.detail}
          </pre>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button className="win-btn" style={{ fontSize: '10px', padding: '3px 12px', color: '#999', cursor: 'not-allowed' }} disabled>
              Restore (not available)
            </button>
            <button className="win-btn" style={{ fontSize: '10px', padding: '3px 12px', color: '#999', cursor: 'not-allowed' }} disabled>
              Delete permanently (why bother)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
