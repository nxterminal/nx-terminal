"""Routes: Mega Sentinel — Security Suite for MegaETH"""

import os
import re
import logging
import time
from fastapi import APIRouter, HTTPException, Query
import httpx

router = APIRouter()
log = logging.getLogger("sentinel")

MEGAETH_RPC = os.getenv("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc")
MEGAETH_CHAIN_ID = 4326
WETH = "0x4200000000000000000000000000000000000006"
QUOTER_V2 = "0x1F1a8dC7E138C34b503Ca080962aC10B75384a27"
DEXSCREENER_BASE = "https://api.dexscreener.com/token-pairs/v1/megaeth"

# ─── Helpers ──────────────────────────────────────────────


def _addr(a):
    """Normalize address to checksummed-like lowercase 0x..."""
    if not a:
        return None
    a = a.strip().lower()
    if not re.match(r'^0x[0-9a-f]{40}$', a):
        return None
    return a


def _pad32(hex_str):
    """Left-pad a hex string (without 0x) to 32 bytes."""
    return hex_str.rjust(64, '0')


def _decode_uint(hex_data):
    """Decode a uint256 from hex data."""
    if not hex_data or hex_data == '0x':
        return 0
    clean = hex_data.replace('0x', '').strip()
    if not clean:
        return 0
    return int(clean[-64:], 16)


def _decode_string(hex_data):
    """Decode a Solidity string return value."""
    if not hex_data or hex_data == '0x' or len(hex_data) < 130:
        return None
    clean = hex_data.replace('0x', '')
    try:
        offset = int(clean[0:64], 16) * 2
        length = int(clean[offset:offset+64], 16)
        str_hex = clean[offset+64:offset+64+length*2]
        return bytes.fromhex(str_hex).decode('utf-8', errors='replace').strip('\x00')
    except Exception:
        return None


def _decode_address(hex_data):
    """Decode an address from a 32-byte return value."""
    if not hex_data or hex_data == '0x' or len(hex_data) < 42:
        return None
    clean = hex_data.replace('0x', '').strip()
    if len(clean) < 40:
        return None
    addr = '0x' + clean[-40:]
    if addr == '0x' + '0' * 40:
        return None
    return addr


async def _rpc_call(client, to, data, block="latest"):
    """Make an eth_call to MegaETH RPC."""
    payload = {
        "jsonrpc": "2.0", "id": 1, "method": "eth_call",
        "params": [{"to": to, "data": data}, block],
    }
    resp = await client.post(MEGAETH_RPC, json=payload, timeout=10.0)
    result = resp.json()
    if "error" in result:
        return None
    return result.get("result")


async def _rpc_get_code(client, addr):
    """Check if address has code (is a contract)."""
    payload = {
        "jsonrpc": "2.0", "id": 1, "method": "eth_getCode",
        "params": [addr, "latest"],
    }
    resp = await client.post(MEGAETH_RPC, json=payload, timeout=10.0)
    result = resp.json()
    code = result.get("result", "0x")
    return code and code != "0x" and len(code) > 2


async def _rpc_get_logs(client, params):
    """Get logs from MegaETH RPC."""
    payload = {
        "jsonrpc": "2.0", "id": 1, "method": "eth_getLogs",
        "params": [params],
    }
    resp = await client.post(MEGAETH_RPC, json=payload, timeout=15.0)
    result = resp.json()
    if "error" in result:
        return []
    return result.get("result", [])


async def _rpc_block_number(client):
    """Get latest block number."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []}
    resp = await client.post(MEGAETH_RPC, json=payload, timeout=10.0)
    result = resp.json()
    return int(result.get("result", "0x0"), 16)


# ─── Health ───────────────────────────────────────────────


@router.get("/health")
async def sentinel_health():
    """Health check for Mega Sentinel."""
    return {"status": "operational", "modules": 5, "version": "1.0", "chain_id": MEGAETH_CHAIN_ID}


# ─── XRAY.mega — Token Scanner ───────────────────────────


async def _fetch_token_info(client, contract):
    """Fetch basic ERC-20 info from contract via RPC."""
    selectors = {
        "name": "0x06fdde03",
        "symbol": "0x95d89b41",
        "decimals": "0x313ce567",
        "totalSupply": "0x18160ddd",
        "owner": "0x8da5cb5b",
    }

    results = {}
    for key, sel in selectors.items():
        try:
            raw = await _rpc_call(client, contract, sel)
            if raw:
                if key in ("name", "symbol"):
                    results[key] = _decode_string(raw)
                elif key == "decimals":
                    results[key] = _decode_uint(raw)
                elif key == "totalSupply":
                    results[key] = _decode_uint(raw)
                elif key == "owner":
                    results[key] = _decode_address(raw)
        except Exception:
            pass

    return results


async def _check_contract_features(client, contract):
    """Check for pausable, blacklist, proxy features."""
    checks = {}

    # Check if paused() exists (0x5c975abb)
    try:
        raw = await _rpc_call(client, contract, "0x5c975abb")
        checks["isPausable"] = raw is not None and raw != "0x"
    except Exception:
        checks["isPausable"] = False

    # Check if blacklist function exists — try isBlacklisted(address(0))
    try:
        zero_addr = _pad32("0" * 40)
        raw = await _rpc_call(client, contract, "0xfe575a87" + zero_addr)
        checks["hasBlacklist"] = raw is not None and raw != "0x"
    except Exception:
        checks["hasBlacklist"] = False

    # EIP-1967 proxy detection — read implementation slot
    try:
        slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
        payload = {
            "jsonrpc": "2.0", "id": 1, "method": "eth_getStorageAt",
            "params": [contract, slot, "latest"],
        }
        resp = await client.post(MEGAETH_RPC, json=payload, timeout=10.0)
        result = resp.json().get("result", "0x" + "0" * 64)
        impl = _decode_address(result)
        checks["isProxy"] = impl is not None
        checks["implementation"] = impl
    except Exception:
        checks["isProxy"] = False
        checks["implementation"] = None

    return checks


async def _fetch_dexscreener(client, contract):
    """Fetch market data from DexScreener."""
    try:
        resp = await client.get(f"{DEXSCREENER_BASE}/{contract}", timeout=10.0)
        if resp.status_code != 200:
            return None
        data = resp.json()
        pairs = data if isinstance(data, list) else data.get("pairs", data.get("data", []))
        if not pairs or len(pairs) == 0:
            return None
        # Use the pair with highest liquidity
        pair = max(pairs, key=lambda p: float(p.get("liquidity", {}).get("usd", 0) if isinstance(p.get("liquidity"), dict) else 0))
        return pair
    except Exception as e:
        log.debug("DexScreener error: %s", e)
        return None


async def _honeypot_check(client, contract, decimals=18):
    """Simulate buy+sell via Kumbaya QuoterV2 to detect honeypots."""
    fee_tiers = [500, 3000, 10000]
    # Test amount: 0.001 ETH in wei
    test_amount = 10**15  # 0.001 ETH

    for fee in fee_tiers:
        try:
            # Build quoteExactInputSingle struct call (0xc6a5026a)
            # struct QuoteExactInputSingleParams { tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96 }
            buy_data = "0xc6a5026a"
            buy_data += _pad32(WETH.replace("0x", ""))       # tokenIn = WETH
            buy_data += _pad32(contract.replace("0x", ""))     # tokenOut = TOKEN
            buy_data += _pad32(hex(test_amount)[2:])          # amountIn
            buy_data += _pad32(hex(fee)[2:])                  # fee
            buy_data += _pad32("0")                           # sqrtPriceLimitX96 = 0

            buy_result = await _rpc_call(client, QUOTER_V2, buy_data)
            if not buy_result or buy_result == "0x":
                # Try legacy selector 0xf7729d43
                buy_data_legacy = "0xf7729d43"
                buy_data_legacy += _pad32(WETH.replace("0x", ""))
                buy_data_legacy += _pad32(contract.replace("0x", ""))
                buy_data_legacy += _pad32(hex(fee)[2:])
                buy_data_legacy += _pad32(hex(test_amount)[2:])
                buy_data_legacy += _pad32("0")
                buy_result = await _rpc_call(client, QUOTER_V2, buy_data_legacy)

            if not buy_result or buy_result == "0x":
                continue

            buy_output = _decode_uint(buy_result)
            if buy_output == 0:
                continue

            # Now simulate SELL: TOKEN -> WETH
            sell_data = "0xc6a5026a"
            sell_data += _pad32(contract.replace("0x", ""))    # tokenIn = TOKEN
            sell_data += _pad32(WETH.replace("0x", ""))        # tokenOut = WETH
            sell_data += _pad32(hex(buy_output)[2:])           # amountIn = buy output
            sell_data += _pad32(hex(fee)[2:])                  # fee
            sell_data += _pad32("0")                           # sqrtPriceLimitX96 = 0

            sell_result = await _rpc_call(client, QUOTER_V2, sell_data)
            sell_output = 0
            sell_reverted = True

            if sell_result and sell_result != "0x":
                sell_output = _decode_uint(sell_result)
                sell_reverted = False

            # Calculate taxes
            # Ideal: sell_output should equal test_amount (round-trip)
            # Buy tax ~ (ideal_buy_output - actual_buy_output) / ideal_buy_output
            # But we don't know ideal, so we estimate via round-trip loss
            if sell_output > 0 and test_amount > 0:
                round_trip_loss = 1 - (sell_output / test_amount)
                # Split approximately: assume equal buy/sell slippage + fees
                # Subtract expected DEX fee (fee / 1e6) for each leg
                dex_fee = fee / 1_000_000
                expected_loss = dex_fee * 2  # Two legs of fees
                sell_tax = max(0, round_trip_loss - expected_loss)
                buy_tax = 0  # Can't separate easily, roll into sell_tax
            else:
                buy_tax = 0
                sell_tax = 0

            return {
                "isHoneypot": sell_reverted,
                "buyTax": round(buy_tax * 100, 2),
                "sellTax": round(sell_tax * 100, 2),
                "sellReverted": sell_reverted,
                "feeTier": fee,
                "buyOutput": str(buy_output),
                "sellOutput": str(sell_output),
                "testAmountWei": str(test_amount),
            }
        except Exception as e:
            log.debug("Honeypot check fee=%d error: %s", fee, e)
            continue

    return {
        "isHoneypot": None,
        "buyTax": None,
        "sellTax": None,
        "sellReverted": None,
        "feeTier": None,
        "error": "No pool found on supported fee tiers",
    }


def _calculate_risk_score(checks, market, honeypot, has_code, token_info):
    """Calculate risk score 0-100 and flags."""
    score = 100
    flags = []

    if not has_code:
        score -= 30
        flags.append("No contract code found")
        return score, flags

    # Contract checks
    if checks.get("isPausable"):
        score -= 10
        flags.append("Has pause function")
    if checks.get("hasBlacklist"):
        score -= 15
        flags.append("Has blacklist function")
    if checks.get("isProxy"):
        score -= 10
        flags.append("Upgradeable proxy contract")
    if token_info.get("owner"):
        score -= 5
        flags.append("Owner not renounced")

    # Market checks
    if not market:
        score -= 20
        flags.append("Not listed on any DEX")
    else:
        liq = float(market.get("liquidity", {}).get("usd", 0) if isinstance(market.get("liquidity"), dict) else 0)
        vol = float(market.get("volume", {}).get("h24", 0) if isinstance(market.get("volume"), dict) else 0)
        if liq < 1000:
            score -= 15
            flags.append(f"Low liquidity (${liq:,.0f})")
        if vol < 100:
            score -= 10
            flags.append(f"Low 24h volume (${vol:,.0f})")

        # Token age
        created = market.get("pairCreatedAt")
        if created:
            try:
                age_hours = (time.time() * 1000 - created) / (1000 * 3600)
                if age_hours < 24:
                    score -= 10
                    flags.append("Token less than 24h old")
            except Exception:
                pass

    # Honeypot checks
    if honeypot:
        if honeypot.get("isHoneypot"):
            score -= 40
            flags.append("HONEYPOT: Sell transaction reverts")
        elif honeypot.get("sellTax") is not None:
            if honeypot["sellTax"] > 25:
                score -= 25
                flags.append(f"Very high sell tax ({honeypot['sellTax']}%)")
            elif honeypot["sellTax"] > 10:
                score -= 15
                flags.append(f"High sell tax ({honeypot['sellTax']}%)")
            elif honeypot["sellTax"] > 5:
                score -= 10
                flags.append(f"Moderate sell tax ({honeypot['sellTax']}%)")

    score = max(0, min(100, score))
    return score, flags


@router.get("/xray")
async def xray_scan(contract: str = Query(..., description="Token contract address")):
    """XRAY.mega — Full token security scan."""
    contract = _addr(contract)
    if not contract:
        raise HTTPException(status_code=400, detail="Invalid contract address")

    async with httpx.AsyncClient() as client:
        # 1. Check contract exists
        has_code = await _rpc_get_code(client, contract)

        # 2. Fetch token info
        token_info = await _fetch_token_info(client, contract) if has_code else {}

        # 3. Contract feature checks
        checks = await _check_contract_features(client, contract) if has_code else {}

        # 4. DexScreener market data
        dex_pair = await _fetch_dexscreener(client, contract)

        # 5. Honeypot detection
        decimals = token_info.get("decimals", 18)
        honeypot = await _honeypot_check(client, contract, decimals) if has_code else {}

        # 6. Build market data
        market_data = None
        if dex_pair:
            liq = dex_pair.get("liquidity", {})
            vol = dex_pair.get("volume", {})
            price_change = dex_pair.get("priceChange", {})
            created = dex_pair.get("pairCreatedAt")
            age_str = None
            if created:
                try:
                    age_s = (time.time() * 1000 - created) / 1000
                    days = int(age_s // 86400)
                    hours = int((age_s % 86400) // 3600)
                    age_str = f"{days}d {hours}h" if days > 0 else f"{hours}h"
                except Exception:
                    pass

            market_data = {
                "price": dex_pair.get("priceUsd"),
                "priceChange24h": price_change.get("h24") if isinstance(price_change, dict) else None,
                "volume24h": vol.get("h24") if isinstance(vol, dict) else None,
                "marketCap": dex_pair.get("marketCap") or dex_pair.get("fdv"),
                "liquidity": liq.get("usd") if isinstance(liq, dict) else None,
                "pairAddress": dex_pair.get("pairAddress"),
                "dexId": dex_pair.get("dexId"),
                "tokenAge": age_str,
                "pairCreatedAt": created,
            }

        # 7. Risk score
        owner = token_info.get("owner")
        checks["ownerRenounced"] = owner is None
        score, flags = _calculate_risk_score(checks, dex_pair, honeypot, has_code, token_info)

        level = "SAFE" if score >= 80 else "WARNING" if score >= 60 else "DANGER" if score >= 40 else "CRITICAL"

        # 8. Format total supply
        total_supply_raw = token_info.get("totalSupply", 0)
        dec = token_info.get("decimals", 18)
        total_supply_formatted = total_supply_raw / (10 ** dec) if dec else total_supply_raw

        return {
            "contract": {
                "address": contract,
                "name": token_info.get("name"),
                "symbol": token_info.get("symbol"),
                "decimals": dec,
                "totalSupply": str(total_supply_raw),
                "totalSupplyFormatted": total_supply_formatted,
                "owner": owner,
                "hasCode": has_code,
            },
            "checks": {
                "isPausable": checks.get("isPausable", False),
                "hasBlacklist": checks.get("hasBlacklist", False),
                "isProxy": checks.get("isProxy", False),
                "ownerRenounced": checks.get("ownerRenounced", True),
                "implementation": checks.get("implementation"),
            },
            "market": market_data,
            "honeypot": honeypot,
            "risk": {
                "score": score,
                "level": level,
                "flags": flags,
            },
        }


# ─── FIREWALL.exe — Wallet Antivirus ─────────────────────

# ERC-20 Approval event topic
APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
UNLIMITED_THRESHOLD = 2**128


async def _fetch_approvals(client, wallet):
    """Scan Approval events where wallet is the owner."""
    wallet_padded = "0x" + _pad32(wallet.replace("0x", ""))

    # Get recent block range (last ~500k blocks to avoid timeout)
    current_block = await _rpc_block_number(client)
    from_block = max(0, current_block - 500_000)

    logs = await _rpc_get_logs(client, {
        "fromBlock": hex(from_block),
        "toBlock": "latest",
        "topics": [APPROVAL_TOPIC, wallet_padded],
    })

    # Deduplicate by (token, spender) — keep latest
    approvals = {}
    for log_entry in logs:
        token = log_entry.get("address", "").lower()
        topics = log_entry.get("topics", [])
        if len(topics) < 3:
            continue
        spender = "0x" + topics[2][-40:]
        data = log_entry.get("data", "0x")
        amount = _decode_uint(data) if data and data != "0x" else 0
        block = int(log_entry.get("blockNumber", "0x0"), 16)

        key = (token, spender)
        if key not in approvals or block > approvals[key]["block"]:
            approvals[key] = {
                "token": token,
                "spender": spender,
                "loggedAmount": amount,
                "block": block,
            }

    return list(approvals.values())


async def _check_current_allowance(client, token, owner, spender):
    """Check current allowance via eth_call."""
    # allowance(address,address) = 0xdd62ed9e
    data = "0xdd62ed9e" + _pad32(owner.replace("0x", "")) + _pad32(spender.replace("0x", ""))
    result = await _rpc_call(client, token, data)
    return _decode_uint(result) if result else 0


async def _get_token_name_symbol(client, token):
    """Quick fetch of name and symbol for a token."""
    name = _decode_string(await _rpc_call(client, token, "0x06fdde03") or "0x")
    symbol = _decode_string(await _rpc_call(client, token, "0x95d89b41") or "0x")
    return name, symbol


@router.get("/firewall/scan")
async def firewall_scan(wallet: str = Query(..., description="Wallet address to scan")):
    """FIREWALL.exe — Scan wallet for dangerous token approvals."""
    wallet = _addr(wallet)
    if not wallet:
        raise HTTPException(status_code=400, detail="Invalid wallet address")

    async with httpx.AsyncClient() as client:
        raw_approvals = await _fetch_approvals(client, wallet)

        results = []
        unlimited_count = 0
        health_score = 100

        for appr in raw_approvals:
            token = appr["token"]
            spender = appr["spender"]

            # Get current on-chain allowance
            allowance = await _check_current_allowance(client, token, wallet, spender)
            if allowance == 0:
                continue  # Already revoked, skip

            # Get token info
            name, symbol = await _get_token_name_symbol(client, token)

            # Check if spender is a contract
            spender_is_contract = await _rpc_get_code(client, spender)

            is_unlimited = allowance >= UNLIMITED_THRESHOLD

            # Determine risk
            if is_unlimited and not spender_is_contract:
                risk = "CRITICAL"
                health_score -= 25
            elif is_unlimited:
                risk = "WARNING"
                health_score -= 8
            else:
                risk = "SAFE"

            if is_unlimited:
                unlimited_count += 1

            results.append({
                "token": {"address": token, "name": name, "symbol": symbol},
                "spender": spender,
                "spenderIsContract": spender_is_contract,
                "allowance": str(allowance),
                "isUnlimited": is_unlimited,
                "risk": risk,
            })

        health_score = max(0, min(100, health_score))

        return {
            "wallet": wallet,
            "approvals": results,
            "healthScore": health_score,
            "totalApprovals": len(results),
            "unlimitedApprovals": unlimited_count,
        }


@router.post("/firewall/revoke")
async def firewall_revoke(body: dict):
    """Build an approve(spender, 0) transaction for the user to sign."""
    token = _addr(body.get("token"))
    spender = _addr(body.get("spender"))
    wallet = _addr(body.get("wallet"))

    if not token or not spender or not wallet:
        raise HTTPException(status_code=400, detail="Missing token, spender, or wallet")

    # approve(address,uint256) = 0x095ea7b3
    data = "0x095ea7b3" + _pad32(spender.replace("0x", "")) + _pad32("0")

    return {
        "tx": {
            "from": wallet,
            "to": token,
            "data": data,
            "chainId": hex(MEGAETH_CHAIN_ID),
        }
    }


# ─── RUG AUTOPSY — Forensic Analysis ─────────────────────

# Transfer event topic
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ZERO_ADDR_PADDED = "0x" + "0" * 64


async def _find_deployer(client, contract):
    """Find the deployer by looking at first Transfer from 0x0 (mint)."""
    logs = await _rpc_get_logs(client, {
        "address": contract,
        "fromBlock": "0x0",
        "toBlock": "latest",
        "topics": [TRANSFER_TOPIC, ZERO_ADDR_PADDED],
    })

    if logs:
        first_mint = logs[0]
        topics = first_mint.get("topics", [])
        if len(topics) >= 3:
            return "0x" + topics[2][-40:]
        block = int(first_mint.get("blockNumber", "0x0"), 16)
        return None

    return None


async def _build_timeline(client, contract, dex_pair):
    """Build event timeline from Transfer logs."""
    events = []

    # Get Transfer events (limited to last 100k blocks for performance)
    current_block = await _rpc_block_number(client)
    from_block = max(0, current_block - 100_000)

    # Mint events (from 0x0)
    mints = await _rpc_get_logs(client, {
        "address": contract,
        "fromBlock": hex(from_block) if from_block > 0 else "0x0",
        "toBlock": "latest",
        "topics": [TRANSFER_TOPIC, ZERO_ADDR_PADDED],
    })

    for m in mints[:20]:  # Cap to avoid huge responses
        block = int(m.get("blockNumber", "0x0"), 16)
        data = m.get("data", "0x")
        amount = _decode_uint(data) if data != "0x" else 0
        topics = m.get("topics", [])
        to_addr = "0x" + topics[2][-40:] if len(topics) >= 3 else None
        events.append({
            "block": block,
            "event": "mint",
            "to": to_addr,
            "amount": str(amount),
        })

    # Burns (to 0x0)
    burns = await _rpc_get_logs(client, {
        "address": contract,
        "fromBlock": hex(from_block) if from_block > 0 else "0x0",
        "toBlock": "latest",
        "topics": [TRANSFER_TOPIC, None, ZERO_ADDR_PADDED],
    })

    for b in burns[:20]:
        block = int(b.get("blockNumber", "0x0"), 16)
        data = b.get("data", "0x")
        amount = _decode_uint(data) if data != "0x" else 0
        topics = b.get("topics", [])
        from_addr = "0x" + topics[1][-40:] if len(topics) >= 2 else None
        events.append({
            "block": block,
            "event": "burn",
            "from": from_addr,
            "amount": str(amount),
        })

    # Add DEX listing event if available
    if dex_pair and dex_pair.get("pairCreatedAt"):
        events.append({
            "block": 0,
            "event": "dex_listing",
            "dex": dex_pair.get("dexId", "unknown"),
            "pairAddress": dex_pair.get("pairAddress"),
            "timestamp": dex_pair["pairCreatedAt"],
        })

    # Sort by block
    events.sort(key=lambda e: e.get("block", 0))
    return events


async def _count_affected_wallets(client, contract):
    """Count unique wallets that received this token."""
    current_block = await _rpc_block_number(client)
    from_block = max(0, current_block - 100_000)

    logs = await _rpc_get_logs(client, {
        "address": contract,
        "fromBlock": hex(from_block),
        "toBlock": "latest",
        "topics": [TRANSFER_TOPIC],
    })

    wallets = set()
    for log_entry in logs:
        topics = log_entry.get("topics", [])
        if len(topics) >= 3:
            to_addr = "0x" + topics[2][-40:]
            if to_addr != "0x" + "0" * 40:
                wallets.add(to_addr)

    return len(wallets)


def _get_deployer_history(deployer):
    """Look up deployer history from DB."""
    try:
        from backend.api.deps import fetch_all
        rows = fetch_all(
            "SELECT token_address, token_name, token_symbol, status, first_seen_at FROM sentinel_deployer_history WHERE deployer_address = %s ORDER BY first_seen_at DESC",
            (deployer,),
        )
        return rows or []
    except Exception:
        return []


def _save_deployer_token(deployer, contract, name, symbol):
    """Save deployer+token to history table (upsert)."""
    try:
        from backend.api.deps import fetch_one, execute
        existing = fetch_one(
            "SELECT id FROM sentinel_deployer_history WHERE deployer_address = %s AND token_address = %s",
            (deployer, contract),
        )
        if not existing:
            execute(
                "INSERT INTO sentinel_deployer_history (deployer_address, token_address, token_name, token_symbol) VALUES (%s, %s, %s, %s)",
                (deployer, contract, name, symbol),
            )
    except Exception as e:
        log.debug("save_deployer_token error: %s", e)


@router.get("/autopsy")
async def rug_autopsy(contract: str = Query(..., description="Token contract address")):
    """RUG AUTOPSY — Forensic analysis of a token."""
    contract = _addr(contract)
    if not contract:
        raise HTTPException(status_code=400, detail="Invalid contract address")

    async with httpx.AsyncClient() as client:
        # 1. Basic token info
        has_code = await _rpc_get_code(client, contract)
        token_info = await _fetch_token_info(client, contract) if has_code else {}

        # 2. Find deployer
        deployer = await _find_deployer(client, contract)

        # 3. DexScreener data
        dex_pair = await _fetch_dexscreener(client, contract)

        # 4. Build event timeline
        timeline = await _build_timeline(client, contract, dex_pair)

        # 5. Count affected wallets
        affected = await _count_affected_wallets(client, contract)

        # 6. Deployer history
        deployer_history = []
        if deployer:
            deployer_history = _get_deployer_history(deployer)
            # Save this token to deployer history
            _save_deployer_token(deployer, contract, token_info.get("name"), token_info.get("symbol"))

        rug_count = sum(1 for h in deployer_history if h.get("status") == "rugged")
        total_deployed = len(deployer_history)

        # 7. Estimate damage
        price = float(dex_pair.get("priceUsd", 0)) if dex_pair else 0
        liq = float(dex_pair.get("liquidity", {}).get("usd", 0) if dex_pair and isinstance(dex_pair.get("liquidity"), dict) else 0)
        estimated_loss = liq if liq > 0 else 0  # LP drained = liquidity lost

        # 8. Verdict
        if dex_pair and price == 0 and liq < 100:
            verdict = "LIKELY_RUG"
        elif rug_count >= 2:
            verdict = "SERIAL_RUGGER"
        elif liq < 500 and affected > 50:
            verdict = "SUSPICIOUS"
        else:
            verdict = "INCONCLUSIVE"

        return {
            "token": {
                "address": contract,
                "name": token_info.get("name"),
                "symbol": token_info.get("symbol"),
                "hasCode": has_code,
                "deployer": deployer,
            },
            "timeline": timeline[:50],
            "deployer": {
                "address": deployer,
                "previousTokens": [
                    {"name": h.get("token_name"), "symbol": h.get("token_symbol"),
                     "address": h.get("token_address"), "status": h.get("status")}
                    for h in deployer_history
                    if h.get("token_address") != contract
                ],
                "isSerialDeployer": total_deployed > 3,
                "totalTokensDeployed": total_deployed,
                "rugCount": rug_count,
            },
            "damage": {
                "estimatedLossUsd": estimated_loss,
                "affectedWallets": affected,
                "currentPrice": price,
                "currentLiquidity": liq,
            },
            "verdict": verdict,
        }


# ─── HOLOGRAM DETECTOR — Legitimacy Verifier ─────────────

# Known verified MegaETH projects (hardcoded)
VERIFIED_PROJECTS = {
    "0x4200000000000000000000000000000000000006": {"name": "WETH", "type": "canonical"},
    "0x2f55e14f0b2b2118d2026d20ad2c39eacbdcac47": {"name": "NXT Token", "type": "game_token"},
    "0x5fe9cc9c0c859832620c8200fce5617befe407f7": {"name": "NXDevNFT", "type": "nft"},
}


@router.get("/hologram")
async def hologram_check(contract: str = Query(..., description="Token contract address")):
    """HOLOGRAM DETECTOR — Verify token legitimacy."""
    contract = _addr(contract)
    if not contract:
        raise HTTPException(status_code=400, detail="Invalid contract address")

    async with httpx.AsyncClient() as client:
        checks = {}
        score = 0
        max_score = 0

        # 1. Contract exists
        max_score += 20
        has_code = await _rpc_get_code(client, contract)
        checks["contractExists"] = {"pass": has_code, "weight": 20, "label": "Contract has bytecode"}
        if has_code:
            score += 20

        # 2. Token info readable
        max_score += 10
        token_info = await _fetch_token_info(client, contract) if has_code else {}
        has_name = bool(token_info.get("name"))
        checks["hasMetadata"] = {"pass": has_name, "weight": 10, "label": "ERC-20 metadata readable"}
        if has_name:
            score += 10

        # 3. Listed on DEX
        max_score += 20
        dex_pair = await _fetch_dexscreener(client, contract)
        checks["listedOnDex"] = {"pass": dex_pair is not None, "weight": 20, "label": "Listed on DEX"}
        if dex_pair:
            score += 20

        # 4. Has liquidity > $1000
        max_score += 15
        liq = 0
        if dex_pair:
            liq = float(dex_pair.get("liquidity", {}).get("usd", 0) if isinstance(dex_pair.get("liquidity"), dict) else 0)
        has_liquidity = liq > 1000
        checks["hasLiquidity"] = {"pass": has_liquidity, "weight": 15, "label": f"Liquidity > $1,000 (${liq:,.0f})"}
        if has_liquidity:
            score += 15

        # 5. Recent activity (volume > $100 in 24h)
        max_score += 10
        vol = 0
        if dex_pair:
            vol = float(dex_pair.get("volume", {}).get("h24", 0) if isinstance(dex_pair.get("volume"), dict) else 0)
        has_activity = vol > 100
        checks["recentActivity"] = {"pass": has_activity, "weight": 10, "label": f"24h volume > $100 (${vol:,.0f})"}
        if has_activity:
            score += 10

        # 6. Token age > 7 days
        max_score += 10
        age_days = 0
        if dex_pair and dex_pair.get("pairCreatedAt"):
            try:
                age_days = (time.time() * 1000 - dex_pair["pairCreatedAt"]) / (1000 * 86400)
            except Exception:
                pass
        is_mature = age_days > 7
        checks["tokenAge"] = {"pass": is_mature, "weight": 10, "label": f"Token age > 7 days ({age_days:.1f}d)"}
        if is_mature:
            score += 10

        # 7. Owner status
        max_score += 10
        owner = token_info.get("owner")
        owner_renounced = owner is None
        checks["ownerStatus"] = {
            "pass": owner_renounced, "weight": 10,
            "label": "Owner renounced" if owner_renounced else f"Owner active: {owner[:10]}...",
        }
        if owner_renounced:
            score += 10

        # 8. Known verified project
        max_score += 5
        is_verified = contract in VERIFIED_PROJECTS
        verified_info = VERIFIED_PROJECTS.get(contract)
        checks["verifiedProject"] = {
            "pass": is_verified, "weight": 5,
            "label": f"Verified: {verified_info['name']}" if is_verified else "Not in verified project list",
        }
        if is_verified:
            score += 5

        # Calculate percentage
        pct = round(score / max_score * 100) if max_score > 0 else 0
        level = "LEGITIMATE" if pct >= 80 else "LIKELY_LEGIT" if pct >= 60 else "SUSPICIOUS" if pct >= 40 else "LIKELY_FAKE"

        return {
            "contract": contract,
            "name": token_info.get("name"),
            "symbol": token_info.get("symbol"),
            "checks": checks,
            "score": pct,
            "maxScore": max_score,
            "rawScore": score,
            "level": level,
            "isVerifiedProject": is_verified,
            "verifiedInfo": verified_info,
        }


# ─── GRADUATION TRACKER — Token Tracker ──────────────────


@router.get("/graduation")
async def graduation_tracker(
    filter: str = Query("all", description="Filter: all, trending, graduating, dead"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """GRADUATION TRACKER — Track MegaETH token lifecycle."""
    async with httpx.AsyncClient() as client:
        # Fetch tokens from DexScreener
        try:
            resp = await client.get(f"{DEXSCREENER_BASE}/0x4200000000000000000000000000000000000006", timeout=10.0)
            all_pairs = []
            if resp.status_code == 200:
                data = resp.json()
                all_pairs = data if isinstance(data, list) else data.get("pairs", data.get("data", []))
        except Exception as e:
            log.debug("Graduation tracker DexScreener error: %s", e)
            all_pairs = []

        # Also try fetching popular pairs by querying NXT token
        try:
            resp2 = await client.get(f"{DEXSCREENER_BASE}/0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47", timeout=10.0)
            if resp2.status_code == 200:
                data2 = resp2.json()
                pairs2 = data2 if isinstance(data2, list) else data2.get("pairs", data2.get("data", []))
                all_pairs.extend(pairs2)
        except Exception:
            pass

        # Deduplicate by pairAddress
        seen = set()
        unique_pairs = []
        for p in all_pairs:
            pa = p.get("pairAddress", "")
            if pa and pa not in seen:
                seen.add(pa)
                unique_pairs.append(p)

        # Classify each token
        tokens = []
        for pair in unique_pairs:
            liq = float(pair.get("liquidity", {}).get("usd", 0) if isinstance(pair.get("liquidity"), dict) else 0)
            vol = float(pair.get("volume", {}).get("h24", 0) if isinstance(pair.get("volume"), dict) else 0)
            price_change = pair.get("priceChange", {})
            change_24h = float(price_change.get("h24", 0)) if isinstance(price_change, dict) and price_change.get("h24") else 0
            created = pair.get("pairCreatedAt")
            age_days = 0
            if created:
                try:
                    age_days = (time.time() * 1000 - created) / (1000 * 86400)
                except Exception:
                    pass

            # Classify
            if vol > 10000 and change_24h > 0:
                status = "trending"
            elif liq > 50000 and age_days > 7 and vol > 1000:
                status = "graduating"
            elif vol < 100 and change_24h < -80:
                status = "dead"
            elif vol < 100 and liq < 500:
                status = "dead"
            else:
                status = "active"

            # Get token info from pair
            base_token = pair.get("baseToken", {})
            quote_token = pair.get("quoteToken", {})

            tokens.append({
                "address": base_token.get("address", pair.get("baseToken", {}).get("address")),
                "name": base_token.get("name"),
                "symbol": base_token.get("symbol"),
                "price": pair.get("priceUsd"),
                "priceChange24h": change_24h,
                "volume24h": vol,
                "liquidity": liq,
                "marketCap": pair.get("marketCap") or pair.get("fdv"),
                "ageDays": round(age_days, 1),
                "pairAddress": pair.get("pairAddress"),
                "dexId": pair.get("dexId"),
                "status": status,
            })

        # Filter
        if filter != "all":
            tokens = [t for t in tokens if t["status"] == filter]

        # Sort: trending first, then by volume
        tokens.sort(key=lambda t: (
            0 if t["status"] == "trending" else 1 if t["status"] == "graduating" else 2 if t["status"] == "active" else 3,
            -t.get("volume24h", 0),
        ))

        # Paginate
        total = len(tokens)
        start = (page - 1) * limit
        tokens_page = tokens[start:start + limit]

        return {
            "tokens": tokens_page,
            "total": total,
            "page": page,
            "limit": limit,
            "filters": {
                "all": sum(1 for _ in tokens if True),  # recount from unfiltered would be better
                "trending": sum(1 for t in tokens if t["status"] == "trending"),
                "graduating": sum(1 for t in tokens if t["status"] == "graduating"),
                "active": sum(1 for t in tokens if t["status"] == "active"),
                "dead": sum(1 for t in tokens if t["status"] == "dead"),
            },
        }
