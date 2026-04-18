"""Decode the NXDevNFT ``NXTClaimed`` event out of a receipt log array.

The receipt shape matches what ``eth_getTransactionReceipt`` returns
(hex-encoded fields). We never trust the amounts the client POSTs —
the caller parses the event and uses those values instead.
"""

from __future__ import annotations

from typing import Iterable, Optional, TypedDict

from eth_utils import keccak


# keccak256("NXTClaimed(address,uint256[],uint256,uint256,uint256)")
NXT_CLAIMED_TOPIC = "0x" + keccak(
    text="NXTClaimed(address,uint256[],uint256,uint256,uint256)"
).hex()


class NxtClaimedEvent(TypedDict):
    user: str
    token_ids: list
    gross: int
    fee: int
    net: int
    block_number: int


def _hex_to_int(value: Optional[str]) -> int:
    if not value:
        return 0
    return int(value, 16) if value.startswith(("0x", "0X")) else int(value, 16)


def _decode_nxt_claimed_data(data_hex: str) -> dict:
    """Decode the non-indexed fields of NXTClaimed.

    ABI layout of ``data`` (each word is 32 bytes / 64 hex chars):
        word 0: offset (in bytes) to ``tokenIds`` array
        word 1: grossAmount
        word 2: feeAmount
        word 3: netAmount
        at (offset / 32) word index:
            length of the tokenIds array, followed by that many words
            each holding a token id.
    """
    if data_hex.startswith(("0x", "0X")):
        data_hex = data_hex[2:]

    def word(i: int) -> int:
        chunk = data_hex[i * 64:(i + 1) * 64]
        if len(chunk) != 64:
            raise ValueError("truncated data")
        return int(chunk, 16)

    offset_words = word(0) // 32
    gross = word(1)
    fee = word(2)
    net = word(3)

    array_length = word(offset_words)
    token_ids = [word(offset_words + 1 + i) for i in range(array_length)]

    return {
        "token_ids": token_ids,
        "gross": gross,
        "fee": fee,
        "net": net,
    }


def parse_nxt_claimed_event(
    logs: Iterable[dict],
    contract_address: str,
) -> Optional[NxtClaimedEvent]:
    """Return the first ``NXTClaimed`` event emitted by ``contract_address``.

    Returns ``None`` if no matching event is present. Skips logs whose
    ``address`` doesn't match (anti-spoof: the same topic emitted from
    another contract is rejected).
    """
    if not contract_address:
        return None
    target = contract_address.lower()
    topic = NXT_CLAIMED_TOPIC.lower()

    for log in logs or []:
        if (log.get("address") or "").lower() != target:
            continue
        topics = log.get("topics") or []
        if not topics or (topics[0] or "").lower() != topic:
            continue

        try:
            user_topic = topics[1]
            user = "0x" + user_topic[-40:]
            decoded = _decode_nxt_claimed_data(log.get("data") or "")
            block_hex = log.get("blockNumber") or "0x0"
            return {
                "user": user.lower(),
                "token_ids": decoded["token_ids"],
                "gross": decoded["gross"],
                "fee": decoded["fee"],
                "net": decoded["net"],
                "block_number": int(block_hex, 16),
            }
        except Exception:
            # Malformed log — move on and let the next iteration try.
            continue

    return None
