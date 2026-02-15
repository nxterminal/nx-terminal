// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title NXTToken v3
 * @author Ember Labs
 * @notice $NXT — The in-game token for NX Terminal: Protocol Wars
 * @dev Features:
 *   - Fixed supply cap: 1,000,000,000 $NXT — hardcoded, immutable, forever
 *   - Circular economy: burns free space for new mints (totalSupply can go down)
 *   - Initial supply: 0 (all tokens generated through gameplay)
 *   - Role-based minting: only authorized minters (NXDevNFT, backend)
 *   - Burn toggle: all burns disabled by default, owner activates when ready
 *   - Standard burn: any holder can burn their own tokens (when enabled)
 *   - Game burn: approved contracts can burn without allowance (when enabled)
 *   - Auto-burn: configurable % burned on every transfer (when enabled)
 *   - Auto-burn exemptions for DEX pools, treasury, game contracts
 *   - Pausable transfers (emergency)
 *   - ERC-20 recovery for tokens sent by mistake
 *   - Full burn/mint tracking for stats dashboard
 *
 * Economic Model:
 *   Simulation generates → players claim (mint) → players spend in Shop (burn) →
 *   totalSupply decreases → space opens for more minting → cycle repeats
 *   The cap applies to totalSupply(), not totalMintedTokens.
 *   Burns free space. The economy is circular.
 *
 * Network: MegaETH (EVM-compatible L2, Chain ID 4326)
 * Max Supply: 1,000,000,000 (constant, immutable)
 *
 * ═══════════════════════════════════════════════════════════════════
 * MegaETH-specific notes (MegaEVM):
 * ─────────────────────────────────────────────────────────────────
 *   - This contract is straightforward ERC-20 logic with minimal
 *     storage-heavy operations. No special adaptations needed
 *     beyond the standard MegaEVM gas estimation considerations.
 *   - Auto-burn on transfer adds one extra SSTORE per transfer
 *     when enabled. On MegaEVM, if the totalBurned slot is already
 *     nonzero, the storage gas cost for updating it is zero.
 *   - Batch mint operations should keep array sizes reasonable
 *     to stay within MegaEVM's KV update limit of 500,000/tx
 *     and state growth limit of 1,000 new slots/tx.
 * ═══════════════════════════════════════════════════════════════════
 */
contract NXTToken is ERC20, ERC20Burnable, Ownable, ReentrancyGuard, Pausable {

    // ══════════════════════════════════════════════════════════════
    //                        CONSTANTS
    // ══════════════════════════════════════════════════════════════

    /// @notice Maximum supply that can ever exist at any point in time (1 billion)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice Maximum auto-burn rate: 10% (1000 bps)
    uint256 public constant MAX_AUTO_BURN_BPS = 1000;

    // ══════════════════════════════════════════════════════════════
    //                      STATE VARIABLES
    // ══════════════════════════════════════════════════════════════

    /// @notice Treasury wallet for fees and recovered tokens
    address public treasuryWallet;

    // ── Roles ────────────────────────────────────────────────────

    /// @notice Addresses authorized to mint (NXDevNFT, backend signer)
    mapping(address => bool) public isMinter;

    /// @notice Addresses authorized to burn without allowance (game contracts)
    mapping(address => bool) public isApprovedBurner;

    // ── Burn Toggle ──────────────────────────────────────────────

    /// @notice Whether burning is enabled (ALL burn types: voluntary, game, auto)
    /// @dev Starts as false. Owner activates when economy is ready.
    bool public burnEnabled;

    // ── Auto-Burn ────────────────────────────────────────────────

    /// @notice Auto-burn rate in basis points (0 = disabled, 100 = 1%)
    uint256 public autoBurnRate;

    /// @notice Addresses exempt from auto-burn (DEX pools, treasury, game contracts)
    mapping(address => bool) public autoBurnExempt;

    // ── Tracking ─────────────────────────────────────────────────

    /// @notice Total $NXT minted historically (never decreases)
    uint256 public totalMintedTokens;

    /// @notice Total $NXT burned historically (never decreases)
    uint256 public totalBurned;

    // ══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ══════════════════════════════════════════════════════════════

    event MinterUpdated(address indexed account, bool authorized);
    event ApprovedBurnerUpdated(address indexed account, bool authorized);
    event BurnEnabledUpdated(bool enabled);
    event AutoBurnRateUpdated(uint256 oldRate, uint256 newRate);
    event AutoBurnExemptUpdated(address indexed account, bool exempt);
    event GameBurned(address indexed from, uint256 amount, address indexed burner);
    event AutoBurned(address indexed from, uint256 amount);
    event TokensRecovered(address indexed token, uint256 amount, address indexed to);

    // ══════════════════════════════════════════════════════════════
    //                         ERRORS
    // ══════════════════════════════════════════════════════════════

    error NotMinter();
    error NotApprovedBurner();
    error ExceedsMaxSupply();
    error BurnNotEnabled();
    error InvalidAddress();
    error InvalidRate();
    error NothingToRecover();
    error CannotRecoverNXT();

    // ══════════════════════════════════════════════════════════════
    //                        MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyMinter() {
        if (!isMinter[msg.sender]) revert NotMinter();
        _;
    }

    modifier onlyApprovedBurner() {
        if (!isApprovedBurner[msg.sender]) revert NotApprovedBurner();
        _;
    }

    // ══════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    /**
     * @param _treasuryWallet Address for fees and recovered tokens
     */
    constructor(
        address _treasuryWallet
    ) ERC20("NX Token", "NXT") Ownable(msg.sender) {
        if (_treasuryWallet == address(0)) revert InvalidAddress();
        treasuryWallet = _treasuryWallet;

        // Treasury and owner are auto-burn exempt by default
        autoBurnExempt[_treasuryWallet] = true;
        autoBurnExempt[msg.sender] = true;
    }

    // ══════════════════════════════════════════════════════════════
    //                      MINT FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Mint $NXT to an address
     * @dev Only callable by authorized minters. Checks against MAX_SUPPLY
     *      which is based on totalSupply() — so burned tokens free space.
     * @param to Recipient address
     * @param amount Amount to mint (18 decimals)
     */
    function mint(address to, uint256 amount) external onlyMinter whenNotPaused {
        if (to == address(0)) revert InvalidAddress();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        totalMintedTokens += amount;
        _mint(to, amount);
    }

    /**
     * @notice Batch mint to multiple addresses in one tx
     * @dev For season rewards, event payouts, airdrops.
     *      On MegaETH: keep arrays reasonable (< 500 recipients)
     *      to stay within MegaEVM's per-tx KV update limits.
     */
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyMinter whenNotPaused {
        require(recipients.length == amounts.length, "Length mismatch");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        if (totalSupply() + totalAmount > MAX_SUPPLY) revert ExceedsMaxSupply();

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert InvalidAddress();
            totalMintedTokens += amounts[i];
            _mint(recipients[i], amounts[i]);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //                      BURN FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Burn own tokens (override from ERC20Burnable)
     * @dev Gated by burnEnabled. When disabled, voluntary burns revert.
     */
    function burn(uint256 amount) public override {
        if (!burnEnabled) revert BurnNotEnabled();
        super.burn(amount);
    }

    /**
     * @notice Burn tokens from another wallet with allowance (override)
     * @dev Gated by burnEnabled. Used by contracts the user has approved.
     */
    function burnFrom(address account, uint256 amount) public override {
        if (!burnEnabled) revert BurnNotEnabled();
        super.burnFrom(account, amount);
    }

    /**
     * @notice Game burn — approved contracts burn without allowance
     * @dev Gated by burnEnabled. For shop purchases, dev actions, sabotage, etc.
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function gameBurn(address from, uint256 amount)
        external
        onlyApprovedBurner
    {
        if (!burnEnabled) revert BurnNotEnabled();
        _burn(from, amount);
        emit GameBurned(from, amount, msg.sender);
    }

    // ══════════════════════════════════════════════════════════════
    //                   AUTO-BURN ON TRANSFER
    // ══════════════════════════════════════════════════════════════

    /**
     * @dev Override _update to implement:
     *   1. Pausable transfers
     *   2. Auto-burn on transfers (if burnEnabled AND autoBurnRate > 0)
     *   3. Burn tracking for ALL burn types
     *
     * Auto-burn only fires when:
     *   - burnEnabled is true
     *   - autoBurnRate > 0
     *   - It's a transfer (not mint/burn)
     *   - Neither sender nor receiver is exempt
     */
    function _update(address from, address to, uint256 value)
        internal
        override
    {
        // Enforce pause on transfers (not on mint/burn)
        if (from != address(0) && to != address(0)) {
            require(!paused(), "Token is paused");
        }

        // Track burns (to == address(0) means burn)
        if (to == address(0) && from != address(0)) {
            totalBurned += value;
        }

        // Auto-burn: only on transfers, only when burn is enabled
        if (
            burnEnabled &&
            autoBurnRate > 0 &&
            from != address(0) &&
            to != address(0) &&
            !autoBurnExempt[from] &&
            !autoBurnExempt[to]
        ) {
            uint256 burnAmount = (value * autoBurnRate) / 10_000;
            if (burnAmount > 0) {
                super._update(from, address(0), burnAmount);
                totalBurned += burnAmount;
                emit AutoBurned(from, burnAmount);

                super._update(from, to, value - burnAmount);
                return;
            }
        }

        super._update(from, to, value);
    }

    // ══════════════════════════════════════════════════════════════
    //                  ADMIN: ROLE MANAGEMENT
    // ══════════════════════════════════════════════════════════════

    function addMinter(address account) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        isMinter[account] = true;
        emit MinterUpdated(account, true);
    }

    function removeMinter(address account) external onlyOwner {
        isMinter[account] = false;
        emit MinterUpdated(account, false);
    }

    function addApprovedBurner(address account) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        isApprovedBurner[account] = true;
        emit ApprovedBurnerUpdated(account, true);
    }

    function removeApprovedBurner(address account) external onlyOwner {
        isApprovedBurner[account] = false;
        emit ApprovedBurnerUpdated(account, false);
    }

    // ══════════════════════════════════════════════════════════════
    //                  ADMIN: BURN TOGGLE
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Enable or disable ALL burn functionality
     * @dev When false: burn(), burnFrom(), gameBurn(), and auto-burn all revert/skip.
     *      When true: all burn types become active.
     *      Start disabled. Activate when the economy has enough tokens circulating.
     */
    function setBurnEnabled(bool enabled) external onlyOwner {
        burnEnabled = enabled;
        emit BurnEnabledUpdated(enabled);
    }

    // ══════════════════════════════════════════════════════════════
    //                  ADMIN: AUTO-BURN CONFIG
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Set the auto-burn rate on transfers
     * @dev Only takes effect when burnEnabled is true
     * @param bps Rate in basis points (0 = disabled, 100 = 1%, max 1000 = 10%)
     */
    function setAutoBurnRate(uint256 bps) external onlyOwner {
        if (bps > MAX_AUTO_BURN_BPS) revert InvalidRate();
        uint256 oldRate = autoBurnRate;
        autoBurnRate = bps;
        emit AutoBurnRateUpdated(oldRate, bps);
    }

    /**
     * @notice Set auto-burn exemption for an address
     * @dev MUST exempt: DEX pools, treasury, game contracts, router
     */
    function setAutoBurnExempt(address account, bool exempt) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        autoBurnExempt[account] = exempt;
        emit AutoBurnExemptUpdated(account, exempt);
    }

    /**
     * @notice Batch set auto-burn exemptions
     */
    function batchSetAutoBurnExempt(
        address[] calldata accounts,
        bool exempt
    ) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == address(0)) revert InvalidAddress();
            autoBurnExempt[accounts[i]] = exempt;
            emit AutoBurnExemptUpdated(accounts[i], exempt);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //                  ADMIN: GENERAL
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Set treasury wallet (auto-manages auto-burn exemptions)
     */
    function setTreasury(address wallet) external onlyOwner {
        if (wallet == address(0)) revert InvalidAddress();
        autoBurnExempt[treasuryWallet] = false;
        treasuryWallet = wallet;
        autoBurnExempt[wallet] = true;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Recover ERC-20 tokens sent by mistake (cannot recover $NXT)
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(this)) revert CannotRecoverNXT();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0 || amount == 0) revert NothingToRecover();
        if (amount > balance) amount = balance;
        IERC20(token).transfer(treasuryWallet, amount);
        emit TokensRecovered(token, amount, treasuryWallet);
    }

    // ══════════════════════════════════════════════════════════════
    //                    VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Remaining mintable supply (space freed by burns counts)
     */
    function remainingMintable() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @notice Supply utilization as basis points (for frontend progress bar)
     * @return bps How full the supply is (5000 = 50%)
     */
    function supplyUtilization() external view returns (uint256 bps) {
        return (totalSupply() * 10_000) / MAX_SUPPLY;
    }

    /**
     * @notice Complete supply metrics for the stats dashboard
     * @return minted Total ever minted (cumulative, never decreases)
     * @return burned Total ever burned (cumulative, never decreases)
     * @return circulating Current tokens in existence (totalSupply)
     * @return cap Maximum that can exist at once (1B, constant)
     * @return mintable Space available for new mints right now
     */
    function supplyStats()
        external
        view
        returns (
            uint256 minted,
            uint256 burned,
            uint256 circulating,
            uint256 cap,
            uint256 mintable
        )
    {
        minted = totalMintedTokens;
        burned = totalBurned;
        circulating = totalSupply();
        cap = MAX_SUPPLY;
        mintable = MAX_SUPPLY - circulating;
    }
}
