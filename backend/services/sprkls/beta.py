"""Backend mirror of the NX Souls / Sprkls beta allowlist.

Phase 4.1 reuses the same allowlist the frontend uses
(config/betaFeatures.js). Sprkls are visibility-only on the frontend
(SprklsLayer ships in Phase 4.2), so the scheduler gate here only
exists to avoid generating posts for wallets that have no way to
see them yet — pure cost / noise control, NOT a security boundary.
The /api/posts/timeline endpoint remains public; sprkl rows are just
not generated for unlisted wallets.

Stored lowercase. The `is_in_sprkls_beta` helper lowercases the
input so wagmi-style EIP-55 checksum casing matches.
"""

from __future__ import annotations

# Operator wallet — same allowlist as frontend/src/config/betaFeatures.js
# NX_SOULS_BETA_WALLETS. Kept in sync manually for now; Phase 5+ may
# centralise via shared config or env var.
SPRKLS_BETA_WALLETS: frozenset[str] = frozenset({
    "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b",  # operator
})

# When True, generation runs for every owner. Mirrors the frontend's
# NX_SOULS_BETA_OPEN flag — flip together when opening to community.
SPRKLS_BETA_OPEN = False


def is_in_sprkls_beta(wallet_address: str | None) -> bool:
    """Returns True iff the wallet should have sprkls generated for it.

    None / empty input is False — no point generating posts for a
    wallet we can't address. EIP-55 checksum casing is normalised by
    lowercasing the input before the set lookup.
    """
    if SPRKLS_BETA_OPEN:
        return True
    if not wallet_address:
        return False
    return wallet_address.lower() in SPRKLS_BETA_WALLETS
