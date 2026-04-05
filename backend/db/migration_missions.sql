-- ============================================================
-- NX TERMINAL: Mission Control Migration
-- Run manually on Render DB: psql $DATABASE_URL -f backend/db/migration_missions.sql
-- ============================================================

SET search_path TO nx;

-- ── 1. Add 'on_mission' to dev_status_enum ──────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'on_mission' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dev_status_enum'))
    THEN ALTER TYPE dev_status_enum ADD VALUE 'on_mission'; END IF;
END $$;

-- ── 2. Add mission action types ─────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MISSION_START' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
    THEN ALTER TYPE action_enum ADD VALUE 'MISSION_START'; END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MISSION_COMPLETE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
    THEN ALTER TYPE action_enum ADD VALUE 'MISSION_COMPLETE'; END IF;
END $$;

-- ── 3. Missions table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    lore_text TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    duration_hours INT NOT NULL,
    reward_nxt INT NOT NULL,
    min_stat VARCHAR(20),
    min_stat_value INT DEFAULT 0,
    min_devs_owned INT DEFAULT 1,
    active BOOLEAN DEFAULT true
);

-- ── 4. Player missions table ────────────────────────────────
CREATE TABLE IF NOT EXISTS player_missions (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    mission_id INT REFERENCES missions(id),
    dev_token_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_player_missions_wallet ON player_missions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_player_missions_dev ON player_missions(dev_token_id);
CREATE INDEX IF NOT EXISTS idx_player_missions_status ON player_missions(wallet_address, status);

-- ── 5. Seed missions ────────────────────────────────────────
INSERT INTO missions (title, description, lore_text, difficulty, duration_hours, reward_nxt, min_stat, min_stat_value, min_devs_owned) VALUES

-- EASY (1h, 15-25 $NXT)
('Attend a Standup Meeting',
 'Survive a 1-hour standup that could have been a Slack message.',
 'Your dev joins a virtual standup where the PM asks "any blockers?" for the 47th time. The real blocker is this meeting.',
 'easy', 1, 15, NULL, 0, 1),

('Fix a Typo in Production',
 'A critical typo in the landing page. "We revolutionize the blockchian."',
 'The CEO noticed a typo during a demo with investors. Your dev must deploy a hotfix before the Series B falls apart. The typo was in the word "blockchain." Again.',
 'easy', 1, 20, 'coding', 30, 1),

('Reply All Damage Control',
 'Someone hit Reply All with salary info. Contain the chaos.',
 'An intern accidentally replied-all with the entire company salary spreadsheet. Your dev must hack into the email server and recall 2,847 emails before HR finds out.',
 'easy', 1, 25, 'social', 30, 1),

('Explain Crypto to Your Mom',
 'Your dev gets a call from their mother asking what they actually do.',
 'Mom called. She saw Bitcoin on the news and wants to know if your dev is "doing drugs on the computer." Explain blockchain without using the word blockchain. Duration: 1 painful hour.',
 'easy', 1, 15, 'social', 20, 1),

-- MEDIUM (2-4h, 40-80 $NXT)
('Infiltrate a Competitor Hackathon',
 'Go undercover at a rival corp hackathon. Steal ideas, eat free pizza.',
 'Closed AI is hosting a hackathon with $50K prizes and unlimited Red Bull. Your dev infiltrates wearing a fake badge that says "Definitely Not A Spy." The pizza is surprisingly good.',
 'medium', 2, 40, 'hacking', 40, 1),

('Survive a Code Review from Hell',
 'A senior dev with 847 GitHub followers is reviewing your code.',
 'The reviewer has strong opinions about semicolons, tabs vs spaces, and whether your variable names spark joy. Your dev must defend every design choice without crying. Estimated duration: 3 hours of suffering.',
 'medium', 3, 60, 'coding', 50, 1),

('Debug a Smart Contract at 3 AM',
 'Production is down. The CEO is tweeting about it. No pressure.',
 'A reentrancy bug just drained 40% of the TVL. Your dev must find and patch the vulnerability while the Discord melts down and someone keeps posting "rug?" every 30 seconds.',
 'medium', 4, 80, 'coding', 60, 3),

('Pitch to VCs Without Using "AI"',
 'Present your protocol to VCs. Plot twist: you cannot say AI, Machine Learning, or GPT.',
 'Sand Hill Road. Room full of VCs. Your dev has 10 minutes to pitch without using buzzwords. One VC keeps checking his phone. Another asks if you can "add AI to it." Survive.',
 'medium', 2, 50, 'social', 50, 1),

('Liquidate a Degen Position',
 'Your dev YOLO-d into a 125x leveraged position. Unwind it before liquidation.',
 'The position is down 87% and the liquidation price is approaching fast. Your dev must execute a series of trades across 3 DEXes while the price feeds lag 200ms behind reality.',
 'medium', 3, 70, 'trading', 60, 1),

-- HARD (6-12h, 150-250 $NXT)
('Corporate Espionage at Zuck Labs',
 'Infiltrate Zuck Labs HQ and steal their proprietary algorithm.',
 'Intelligence reports indicate Zuck Labs has developed a sentiment analysis algo that predicts rug pulls 30 seconds before they happen. Your dev must bypass their biometric security, dodge the robot dogs, and extract the code via USB. The USB is 2GB. The file is 1.9GB. Pray.',
 'hard', 6, 150, 'hacking', 70, 3),

('Ship a Feature Before the Deadline',
 'The deadline is in 12 hours. The feature was specced yesterday.',
 'Product just changed the requirements for the 4th time. Design wants rounded corners with exactly 4.7px radius. QA found 23 bugs in the staging build. Your dev has 12 hours, 6 energy drinks, and zero test coverage. Ship it.',
 'hard', 12, 250, 'coding', 70, 5),

('Survive a Bear Market',
 'Portfolio is down 94%. Maintain composure for 8 hours.',
 'ETH dropped to $200. Bitcoin is at $12K. Your timeline is full of "I told you so" tweets from people who bought SPY. Your dev must continue building without posting a single doomer tweet. The urge to tweet "few understand" is overwhelming.',
 'hard', 8, 180, 'endurance', 60, 3),

('Negotiate a Partnership with Misanthropic',
 'Misanthropic wants to merge. Their terms are... creative.',
 'Misanthropic proposes a "strategic alignment" where they get 51% governance, your treasury, and naming rights. Your dev must negotiate this down to something reasonable while their legal team sends 200-page contracts every 30 minutes.',
 'hard', 6, 200, 'social', 70, 5),

('Audit a Spaghetti Contract',
 'Someone deployed 4,000 lines of uncommented Solidity. Find the backdoor.',
 'The contract has 47 modifiers, 12 proxy patterns, and variable names like "xx_temp_final_v2_REAL." There is definitely a backdoor. Your dev has 8 hours to find it before the protocol reaches $10M TVL.',
 'hard', 8, 200, 'coding', 80, 3),

-- EXTREME (12-24h, 350-500 $NXT)
('Launch a Protocol from Zero',
 'Build, audit, deploy, and market a protocol. You have 24 hours.',
 'The brief: "Like Uniswap but for memes, with AI, on MegaETH, and make it go viral." Your dev must write the contracts, deploy them, create a Twitter account, and somehow get 1,000 followers before the CEO checks tomorrow morning.',
 'extreme', 24, 500, 'coding', 80, 5),

('Survive a Congressional Hearing',
 'Your dev is called to testify before the Senate about "crypto things."',
 'Senator Johnson (age 78) wants to know "who is the CEO of DeFi." Your dev must explain blockchain to a room of people who still print emails. The hearing lasts 12 hours. Water breaks every 4 hours. Bathroom breaks require unanimous consent.',
 'extreme', 12, 350, 'social', 80, 5),

('48-Hour Hackathon Solo',
 'Enter a hackathon alone. Against teams of 5. Win anyway.',
 'The other teams have designers, PMs, and DevRel. Your dev has a laptop with 23% battery, hotel WiFi, and a dream. The judges are looking for "innovation" and "impact." Your dev is looking for the power outlet.',
 'extreme', 24, 450, 'coding', 85, 10),

-- LEGENDARY (24h, 1000-2000 $NXT)
('Overthrow a Corporation',
 'Lead a hostile takeover of an entire rival corporation.',
 'Your dev has acquired enough intelligence, allies, and blackmail material to attempt a full corporate overthrow. This requires infiltrating the board meeting, presenting falsified quarterly reports that are somehow better than the real ones, and convincing the shareholders that you are the original CEO. The real CEO is on vacation and has no WiFi.',
 'legendary', 24, 1000, 'hacking', 90, 10),

('Solve P=NP (Accidentally)',
 'Your dev finds a proof while debugging a CSS flexbox issue.',
 'While trying to center a div, your dev accidentally discovers that P equals NP. The proof is elegant, irrefutable, and entirely in CSS. Now they must write a paper, defend it against peer review from mathematicians who refuse to read CSS, and collect the $1M Millennium Prize. The Fields Medal committee is "concerned about the methodology."',
 'legendary', 24, 2000, 'coding', 95, 20)

ON CONFLICT DO NOTHING;

-- ── 6. Verify ───────────────────────────────────────────────
SELECT id, title, difficulty, duration_hours, reward_nxt FROM missions ORDER BY id;
SELECT * FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dev_status_enum');
