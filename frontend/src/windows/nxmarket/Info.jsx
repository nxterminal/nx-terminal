// Static usage guide for NX Market. No props, no state — all content
// is hardcoded. Matches the Tahoma / Win98 aesthetic used across the
// rest of the module.

const sectionStyle = {
  marginBottom: 20,
  padding: '12px 14px',
  background: '#f7f7f2',
  border: '1px solid #d0d0c0',
  borderRadius: 2,
};

const headingStyle = {
  fontFamily: 'Tahoma, sans-serif',
  fontSize: 14,
  fontWeight: 'bold',
  marginTop: 0,
  marginBottom: 8,
  color: '#000080',
  borderBottom: '1px solid #c0c0c0',
  paddingBottom: 4,
};

const bodyStyle = {
  fontFamily: 'Tahoma, sans-serif',
  fontSize: 12,
  lineHeight: 1.5,
  color: '#333',
};

const tableStyle = {
  width: '100%',
  marginTop: 8,
  fontFamily: 'Tahoma, sans-serif',
  fontSize: 12,
  borderCollapse: 'collapse',
};

const thStyle = {
  padding: '6px 10px',
  textAlign: 'left',
  borderBottom: '2px solid #999',
};

const tdStyle = {
  padding: '5px 10px',
  borderBottom: '1px solid #e0e0e0',
};


const DEV_SCALE = [
  ['0', 'Cannot create'],
  ['1', '1'],
  ['2', '2'],
  ['3', '3'],
  ['4', '4'],
  ['5 – 19', '5'],
  ['20+', 'Unlimited'],
];


export default function Info() {
  return (
    <div style={{
      padding: 16, overflow: 'auto', maxHeight: '100%',
    }}>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>What is NX Market?</h3>
        <p style={bodyStyle}>
          NX Market is a prediction market inside NX Terminal. You buy
          YES or NO shares on questions about future events. When the
          market resolves, winners share the pool proportionally to
          their shares.
        </p>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>How does it work?</h3>
        <p style={bodyStyle}>
          Every market has two sides: YES and NO. Prices start at
          50/50 and move as people bet. The more people bet on one
          side, the more expensive that side gets. When the outcome
          is known, an admin resolves the market and winners receive
          their payout.
        </p>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>Prices and LMSR</h3>
        <p style={bodyStyle}>
          Prices are automatic, not set by users. They use LMSR
          (Logarithmic Market Scoring Rule), a standard AMM for
          prediction markets. Key ideas:
        </p>
        <ul style={{ ...bodyStyle, paddingLeft: 20, marginTop: 6 }}>
          <li>Price reflects collective belief (82% YES = market
              thinks YES is 82% likely)</li>
          <li>Buying shares costs more as the price moves in your
              favor (slippage)</li>
          <li>You can exit before resolution but pay a 3% penalty</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>Creating a market</h3>
        <p style={bodyStyle}>
          Creating a market costs <strong>1000 NXT</strong> (deducted
          from your in-game balance). You need devs to create markets,
          according to this scale:
        </p>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#e8e8e0' }}>
              <th style={thStyle}>Devs</th>
              <th style={thStyle}>Max active markets</th>
            </tr>
          </thead>
          <tbody>
            {DEV_SCALE.map(([devs, max], i) => (
              <tr key={devs} style={{
                background: i % 2 === 0 ? '#fff' : '#f7f7f2',
              }}>
                <td style={tdStyle}>{devs}</td>
                <td style={tdStyle}>{max}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...bodyStyle, marginTop: 8 }}>
          Resolving or letting a market close frees up a slot.
        </p>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>Official vs User markets</h3>
        <p style={bodyStyle}>
          <strong>Official markets</strong> are created by the admin
          team. Seed liquidity is auto-minted and doesn't cost
          anything to create. No creator commission.
        </p>
        <p style={{ ...bodyStyle, marginTop: 6 }}>
          <strong>User markets</strong> are created by any wallet with
          at least 1 dev. Cost 1000 NXT. The creator earns 5%
          commission on the final pool when the market resolves.
        </p>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>Fees and payouts</h3>
        <p style={bodyStyle}>When a market resolves:</p>
        <ul style={{ ...bodyStyle, paddingLeft: 20, marginTop: 6 }}>
          <li><strong>Treasury fee (3%)</strong> of the pool goes to
              the game treasury</li>
          <li><strong>Creator commission (5%)</strong> — only on user
              markets</li>
          <li><strong>Winners</strong> receive the remaining pool,
              split proportionally to how many winning shares they
              hold</li>
          <li><strong>Losers</strong> receive nothing (standard
              prediction market behavior)</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>Comments and Leaderboard</h3>
        <p style={bodyStyle}>
          Each market has a comments section. Any wallet connected can
          post (500 char max, 1 per minute). Like or dislike comments.
          Delete your own, or admin can moderate.
        </p>
        <p style={{ ...bodyStyle, marginTop: 6 }}>
          The <strong>Leaderboard</strong> ranks the top 25 users by
          net profit (payouts minus invested) in NX Market. Toggle
          between all-time and last 30 days.
        </p>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>FAQ</h3>

        <p style={{ ...bodyStyle, marginBottom: 4 }}>
          <strong>Q: What happens if nobody bets on the winning side?</strong>
        </p>
        <p style={{ ...bodyStyle, marginBottom: 12 }}>
          A: The full pool (after treasury fee) goes to treasury.
        </p>

        <p style={{ ...bodyStyle, marginBottom: 4 }}>
          <strong>Q: Can I change my mind after buying?</strong>
        </p>
        <p style={{ ...bodyStyle, marginBottom: 12 }}>
          A: Yes, use "Exit Position". You pay 3% penalty on the
          current value.
        </p>

        <p style={{ ...bodyStyle, marginBottom: 4 }}>
          <strong>Q: Why is my exit value less than what I paid?</strong>
        </p>
        <p style={{ ...bodyStyle, marginBottom: 12 }}>
          A: LMSR pricing means early buyers get a better price. Exit
          early = slippage against you + 3% penalty.
        </p>

        <p style={{ ...bodyStyle, marginBottom: 4 }}>
          <strong>Q: What's the dev scale for?</strong>
        </p>
        <p style={{ ...bodyStyle, marginBottom: 12 }}>
          A: To encourage minting devs and prevent spam. More devs =
          more slots.
        </p>

        <p style={{ ...bodyStyle, marginBottom: 4 }}>
          <strong>Q: Can I comment without buying?</strong>
        </p>
        <p style={{ ...bodyStyle, marginBottom: 0 }}>
          A: Yes, any connected wallet can comment.
        </p>
      </div>

    </div>
  );
}
