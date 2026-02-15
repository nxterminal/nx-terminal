// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title INXTToken
 * @notice Interface for the $NXT ERC-20 token contract
 */
interface INXTToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title IERC20Minimal
 * @notice Minimal ERC-20 interface for alternative ERC-20 payments
 */
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title NXDevNFT v4
 * @author Ember Labs
 * @notice ERC-721 contract for NX Terminal: Protocol Wars — 35,000 AI Developer NFTs
 * @dev Features:
 *   - Dual payment: mint with ETH (native) or ERC-20 stablecoin (USDC/USDM/WETH)
 *   - Random mint (lazy Fisher-Yates shuffle via mapping, zero-init, non-sequential IDs)
 *   - 3 mint modes: Public, Whitelist (reduced price), Free Mint (per-wallet allowance)
 *   - Owner mint (free, unlimited per tx)
 *   - Dynamic metadata via tokenURI pointing to backend API
 *   - Token locking (devs on mission can't be transferred)
 *   - Token states (ACTIVE, ON_MISSION, BURNED_OUT)
 *   - Corporation assignment on-chain (6 corps)
 *   - $NXT claim system with on-chain claimable balances per dev
 *   - Approved game contracts (NXTToken, NXItems, future expansions)
 *   - Per-wallet mint limit
 *   - Pausable transfers (emergency)
 *   - 5% royalties (ERC-2981)
 *   - Batch operations for backend efficiency
 *
 * Network: MegaETH (EVM-compatible L2, Chain ID 4326)
 * Supply: 35,000
 * Mint Price: ~$5 USD in ETH or ERC-20
 *
 * ═══════════════════════════════════════════════════════════════════
 * MegaETH-specific adaptations (MegaEVM):
 * ─────────────────────────────────────────────────────────────────
 *   - Lazy Fisher-Yates shuffle using mapping instead of array
 *     to avoid hitting MegaEVM's state growth limit of 1,000
 *     new storage slots per transaction. The original constructor
 *     initialized 35,000 array slots which would revert on MegaETH.
 *   - block.prevrandao caps remaining compute gas to 20M on MegaEVM.
 *     Mint functions are lightweight after the random number generation,
 *     so this is not an issue.
 *   - MegaEVM uses multidimensional gas (compute + storage).
 *     Intrinsic gas is 60,000 (not 21,000). Tools like Foundry need
 *     --skip-simulation and --gas-limit flags for deployment.
 *   - Batch operations should stay under 500,000 KV updates per tx
 *     and 1,000 state growth (new slots) per tx.
 * ═══════════════════════════════════════════════════════════════════
 */
contract NXDevNFT is
    ERC721,
    ERC721Enumerable,
    ERC2981,
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using Strings for uint256;

    // ══════════════════════════════════════════════════════════════
    //                        CONSTANTS
    // ══════════════════════════════════════════════════════════════

    uint256 public constant MAX_SUPPLY = 35_000;
    uint256 public constant MAX_PER_TX = 20;
    uint256 public constant CLAIM_FEE_BPS = 1000; // 10%

    uint8 public constant STATE_ACTIVE = 0;
    uint8 public constant STATE_ON_MISSION = 1;
    uint8 public constant STATE_BURNED_OUT = 2;

    uint8 public constant PHASE_CLOSED = 0;
    uint8 public constant PHASE_WHITELIST = 1;
    uint8 public constant PHASE_PUBLIC = 2;

    // ══════════════════════════════════════════════════════════════
    //                      STATE VARIABLES
    // ══════════════════════════════════════════════════════════════

    // ── ETH Pricing (native) ──────────────────────────────────────

    /// @notice Public mint price in ETH (native token on MegaETH)
    uint256 public mintPrice;

    /// @notice Whitelist mint price in ETH (native token)
    uint256 public whitelistPrice;

    // ── ERC-20 Pricing (stablecoin / WETH) ────────────────────────

    /// @notice ERC-20 payment token (WETH, USDC, USDM, etc.) on MegaETH
    IERC20Minimal public paymentToken;

    /// @notice Public mint price in payment token
    uint256 public paymentTokenMintPrice;

    /// @notice Whitelist mint price in payment token
    uint256 public paymentTokenWhitelistPrice;

    // ── Mint Config ──────────────────────────────────────────────

    /// @notice Max devs a single wallet can hold (0 = no limit)
    uint256 public maxPerWallet = 100;

    /// @notice Current mint phase: 0=CLOSED, 1=WHITELIST, 2=PUBLIC
    uint8 public mintPhase;

    // ── Addresses ────────────────────────────────────────────────

    string private _baseTokenURI;
    address public backendSigner;
    address public treasuryWallet;

    // ── Connected Contracts ──────────────────────────────────────

    INXTToken public nxtToken;
    mapping(address => bool) public approvedGameContract;

    // ── Random Mint (Lazy Fisher-Yates) ──────────────────────────
    //
    // Instead of pre-populating a 35,000-element array (which would
    // exceed MegaEVM's state growth limit of 1,000 new slots/tx),
    // we use a mapping where unset entries implicitly represent
    // their natural value (index + 1). Only swapped entries are stored.

    uint256 public totalMinted;
    mapping(uint256 => uint256) private _tokenMatrix;

    // ── Token Gameplay State ─────────────────────────────────────

    mapping(uint256 => bool) public tokenLocked;
    mapping(uint256 => uint8) public tokenState;
    mapping(uint256 => uint8) public corporationOf;
    mapping(uint256 => bool) public corporationAssigned;

    // ── $NXT Claim System ────────────────────────────────────────

    mapping(uint256 => uint256) public claimableBalance;
    mapping(uint256 => uint256) public totalClaimed;
    mapping(address => uint256) public totalClaimedByWallet;
    bool public claimEnabled;

    // ── Whitelist ────────────────────────────────────────────────

    mapping(address => bool) public whitelisted;

    // ── Free Mint ────────────────────────────────────────────────

    mapping(address => uint256) public freeMintAllowance;
    mapping(address => uint256) public freeMintClaimed;

    // ══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ══════════════════════════════════════════════════════════════

    event DevMinted(address indexed owner, uint256 indexed tokenId);
    event BatchMinted(address indexed owner, uint256[] tokenIds);

    event TokenLocked(uint256 indexed tokenId, bool locked);
    event TokenStateChanged(uint256 indexed tokenId, uint8 newState);
    event CorporationAssigned(uint256 indexed tokenId, uint8 corpId);

    event ClaimableBalanceUpdated(uint256 indexed tokenId, uint256 newBalance);
    event NXTClaimed(
        address indexed player,
        uint256[] tokenIds,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 netAmount
    );

    event GameContractUpdated(address indexed contractAddress, bool approved);
    event FreeMintAssigned(address indexed wallet, uint256 quantity);

    // ══════════════════════════════════════════════════════════════
    //                         ERRORS
    // ══════════════════════════════════════════════════════════════

    error MintClosed();
    error NotWhitelisted();
    error InvalidQuantity();
    error ExceedsMaxSupply();
    error ExceedsMaxPerWallet();
    error ExceedsMaxPerTx();
    error InsufficientETH();
    error InsufficientPayment();
    error PaymentTransferFailed();
    error PaymentTokenNotSet();
    error NoFreeMints();
    error InvalidAddress();
    error InvalidState();
    error InvalidCorporation();
    error NotAuthorized();
    error NotTokenOwner();
    error TokenIsLocked();
    error TokenDoesNotExist();
    error WithdrawFailed();
    error CorporationAlreadySet();
    error ClaimDisabled();
    error NothingToClaim();
    error NXTTokenNotSet();
    error InsufficientBalance();

    // ══════════════════════════════════════════════════════════════
    //                        MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyBackendOrOwner() {
        if (msg.sender != backendSigner && msg.sender != owner())
            revert NotAuthorized();
        _;
    }

    modifier onlyGameOrBackend() {
        if (
            !approvedGameContract[msg.sender] &&
            msg.sender != backendSigner &&
            msg.sender != owner()
        ) revert NotAuthorized();
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        _;
    }

    // ══════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    /**
     * @param _treasuryWallet Address to receive ETH/ERC-20 from mints and $NXT claim fees
     * @param _baseURI Base URI for the metadata API
     * @param _mintPriceETH Public mint price in ETH (native)
     * @param _paymentTokenMintPrice Public mint price in ERC-20 payment token
     * @param _paymentTokenAddress ERC-20 payment token on MegaETH (address(0) to set later)
     *
     * @dev MegaETH note: NO array initialization in constructor.
     *      The lazy Fisher-Yates uses a mapping with implicit defaults,
     *      so constructor cost is minimal and well within state growth limits.
     */
    constructor(
        address _treasuryWallet,
        string memory _baseURI,
        uint256 _mintPriceETH,
        uint256 _paymentTokenMintPrice,
        address _paymentTokenAddress
    ) ERC721("NX Terminal: Protocol Wars", "NXDEV") Ownable(msg.sender) {
        if (_treasuryWallet == address(0)) revert InvalidAddress();

        treasuryWallet = _treasuryWallet;
        _baseTokenURI = _baseURI;

        // ETH prices
        mintPrice = _mintPriceETH;
        whitelistPrice = _mintPriceETH; // same as public by default

        // ERC-20 prices
        paymentTokenMintPrice = _paymentTokenMintPrice;
        paymentTokenWhitelistPrice = _paymentTokenMintPrice; // same as public by default

        // Payment token
        if (_paymentTokenAddress != address(0)) {
            paymentToken = IERC20Minimal(_paymentTokenAddress);
        }

        // 5% royalties to treasury
        _setDefaultRoyalty(_treasuryWallet, 500);

        // No array initialization needed — lazy Fisher-Yates via _tokenMatrix
    }

    // ══════════════════════════════════════════════════════════════
    //                  MINT FUNCTIONS (ETH native)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Public mint — pay with ETH (native token on MegaETH)
     * @param quantity Number of devs to mint (1 to MAX_PER_TX)
     */
    function mint(uint256 quantity) external payable nonReentrant whenNotPaused {
        if (mintPhase != PHASE_PUBLIC) revert MintClosed();
        if (quantity == 0 || quantity > MAX_PER_TX) revert ExceedsMaxPerTx();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (msg.value < mintPrice * quantity) revert InsufficientETH();
        _checkWalletLimit(msg.sender, quantity);

        uint256[] memory mintedIds = _mintBatch(msg.sender, quantity);

        // Refund excess ETH
        uint256 cost = mintPrice * quantity;
        if (msg.value > cost) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - cost}("");
            require(refunded, "Refund failed");
        }

        emit BatchMinted(msg.sender, mintedIds);
    }

    /**
     * @notice Whitelist mint — pay with ETH at reduced price
     * @param quantity Number of devs to mint (1 to MAX_PER_TX)
     */
    function whitelistMint(uint256 quantity) external payable nonReentrant whenNotPaused {
        if (mintPhase != PHASE_WHITELIST) revert MintClosed();
        if (!whitelisted[msg.sender]) revert NotWhitelisted();
        if (quantity == 0 || quantity > MAX_PER_TX) revert ExceedsMaxPerTx();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (msg.value < whitelistPrice * quantity) revert InsufficientETH();
        _checkWalletLimit(msg.sender, quantity);

        uint256[] memory mintedIds = _mintBatch(msg.sender, quantity);

        uint256 cost = whitelistPrice * quantity;
        if (msg.value > cost) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - cost}("");
            require(refunded, "Refund failed");
        }

        emit BatchMinted(msg.sender, mintedIds);
    }

    // ══════════════════════════════════════════════════════════════
    //                  MINT FUNCTIONS (ERC-20)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Public mint — pay with ERC-20 token (WETH/USDC/USDM)
     * @dev User must approve this contract to spend the payment token BEFORE calling.
     *      Payment goes directly to treasury wallet.
     * @param quantity Number of devs to mint (1 to MAX_PER_TX)
     */
    function mintWithToken(uint256 quantity) external nonReentrant whenNotPaused {
        if (address(paymentToken) == address(0)) revert PaymentTokenNotSet();
        if (mintPhase != PHASE_PUBLIC) revert MintClosed();
        if (quantity == 0 || quantity > MAX_PER_TX) revert ExceedsMaxPerTx();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        _checkWalletLimit(msg.sender, quantity);

        uint256 cost = paymentTokenMintPrice * quantity;
        bool success = paymentToken.transferFrom(msg.sender, treasuryWallet, cost);
        if (!success) revert PaymentTransferFailed();

        uint256[] memory mintedIds = _mintBatch(msg.sender, quantity);

        emit BatchMinted(msg.sender, mintedIds);
    }

    /**
     * @notice Whitelist mint — pay with ERC-20 token at reduced price
     * @dev User must approve this contract to spend the payment token BEFORE calling.
     * @param quantity Number of devs to mint (1 to MAX_PER_TX)
     */
    function whitelistMintWithToken(uint256 quantity) external nonReentrant whenNotPaused {
        if (address(paymentToken) == address(0)) revert PaymentTokenNotSet();
        if (mintPhase != PHASE_WHITELIST) revert MintClosed();
        if (!whitelisted[msg.sender]) revert NotWhitelisted();
        if (quantity == 0 || quantity > MAX_PER_TX) revert ExceedsMaxPerTx();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        _checkWalletLimit(msg.sender, quantity);

        uint256 cost = paymentTokenWhitelistPrice * quantity;
        bool success = paymentToken.transferFrom(msg.sender, treasuryWallet, cost);
        if (!success) revert PaymentTransferFailed();

        uint256[] memory mintedIds = _mintBatch(msg.sender, quantity);

        emit BatchMinted(msg.sender, mintedIds);
    }

    // ══════════════════════════════════════════════════════════════
    //                  MINT FUNCTIONS (Free & Owner)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Free mint — wallet must have freeMintAllowance assigned by owner
     * @param quantity Number of devs to mint (up to remaining allowance)
     */
    function freeMint(uint256 quantity) external nonReentrant whenNotPaused {
        if (mintPhase == PHASE_CLOSED) revert MintClosed();
        if (quantity == 0 || quantity > MAX_PER_TX) revert ExceedsMaxPerTx();
        if (freeMintAllowance[msg.sender] < quantity) revert NoFreeMints();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        _checkWalletLimit(msg.sender, quantity);

        freeMintAllowance[msg.sender] -= quantity;
        freeMintClaimed[msg.sender] += quantity;

        uint256[] memory mintedIds = _mintBatch(msg.sender, quantity);

        emit BatchMinted(msg.sender, mintedIds);
    }

    /**
     * @notice Owner mint — free, no per-tx limit, for testing/giveaways/reserves
     */
    function ownerMint(address to, uint256 quantity) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (quantity == 0) revert InvalidQuantity();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();

        uint256[] memory mintedIds = _mintBatch(to, quantity);

        emit BatchMinted(to, mintedIds);
    }

    // ══════════════════════════════════════════════════════════════
    //                    $NXT CLAIM SYSTEM
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Claim $NXT from one or more devs you own.
     *         Burned-out devs CAN claim. Locked devs CAN claim.
     * @param tokenIds Array of dev token IDs to claim from
     */
    function claimNXT(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        if (!claimEnabled) revert ClaimDisabled();
        if (address(nxtToken) == address(0)) revert NXTTokenNotSet();
        if (tokenIds.length == 0) revert InvalidQuantity();

        uint256 grossAmount = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

            uint256 balance = claimableBalance[tokenId];
            if (balance > 0) {
                grossAmount += balance;
                totalClaimed[tokenId] += balance;
                claimableBalance[tokenId] = 0;
            }
        }

        if (grossAmount == 0) revert NothingToClaim();

        uint256 feeAmount = (grossAmount * CLAIM_FEE_BPS) / 10_000;
        uint256 netAmount = grossAmount - feeAmount;

        nxtToken.mint(msg.sender, netAmount);
        if (feeAmount > 0) {
            nxtToken.mint(treasuryWallet, feeAmount);
        }

        totalClaimedByWallet[msg.sender] += grossAmount;

        emit NXTClaimed(msg.sender, tokenIds, grossAmount, feeAmount, netAmount);
    }

    /**
     * @notice Preview claim: returns gross, fee, and net for given devs
     */
    function previewClaim(uint256[] calldata tokenIds)
        external
        view
        returns (uint256 gross, uint256 fee, uint256 net)
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            gross += claimableBalance[tokenIds[i]];
        }
        fee = (gross * CLAIM_FEE_BPS) / 10_000;
        net = gross - fee;
    }

    /**
     * @notice Get total claimable for multiple token IDs (batch view)
     */
    function batchClaimable(uint256[] calldata tokenIds)
        external
        view
        returns (uint256 total)
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            total += claimableBalance[tokenIds[i]];
        }
    }

    /**
     * @notice Get total claimable $NXT for a wallet across ALL their devs
     */
    function walletClaimable(address wallet)
        external
        view
        returns (uint256 total, uint256 devCount)
    {
        uint256 count = balanceOf(wallet);
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(wallet, i);
            uint256 bal = claimableBalance[tokenId];
            if (bal > 0) {
                total += bal;
                devCount++;
            }
        }
    }

    // ══════════════════════════════════════════════════════════════
    //                   GAMEPLAY FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    // ── Token Locking ────────────────────────────────────────────

    function setTokenLocked(uint256 tokenId, bool locked)
        external
        onlyGameOrBackend
        tokenExists(tokenId)
    {
        tokenLocked[tokenId] = locked;
        emit TokenLocked(tokenId, locked);
    }

    function batchSetTokenLocked(uint256[] calldata tokenIds, bool locked)
        external
        onlyGameOrBackend
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_ownerOf(tokenIds[i]) != address(0)) {
                tokenLocked[tokenIds[i]] = locked;
                emit TokenLocked(tokenIds[i], locked);
            }
        }
    }

    // ── Token State ──────────────────────────────────────────────

    function setTokenState(uint256 tokenId, uint8 state)
        external
        onlyGameOrBackend
        tokenExists(tokenId)
    {
        if (state > STATE_BURNED_OUT) revert InvalidState();
        tokenState[tokenId] = state;
        emit TokenStateChanged(tokenId, state);
    }

    function batchSetTokenState(uint256[] calldata tokenIds, uint8[] calldata states)
        external
        onlyGameOrBackend
    {
        require(tokenIds.length == states.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (states[i] > STATE_BURNED_OUT) revert InvalidState();
            if (_ownerOf(tokenIds[i]) != address(0)) {
                tokenState[tokenIds[i]] = states[i];
                emit TokenStateChanged(tokenIds[i], states[i]);
            }
        }
    }

    // ── Corporation ──────────────────────────────────────────────

    function setCorporation(uint256 tokenId, uint8 corpId)
        external
        onlyBackendOrOwner
        tokenExists(tokenId)
    {
        if (corpId > 5) revert InvalidCorporation();
        if (corporationAssigned[tokenId]) revert CorporationAlreadySet();
        corporationOf[tokenId] = corpId;
        corporationAssigned[tokenId] = true;
        emit CorporationAssigned(tokenId, corpId);
    }

    function batchSetCorporation(uint256[] calldata tokenIds, uint8[] calldata corpIds)
        external
        onlyBackendOrOwner
    {
        require(tokenIds.length == corpIds.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (corpIds[i] > 5) revert InvalidCorporation();
            if (_ownerOf(tokenIds[i]) != address(0) && !corporationAssigned[tokenIds[i]]) {
                corporationOf[tokenIds[i]] = corpIds[i];
                corporationAssigned[tokenIds[i]] = true;
                emit CorporationAssigned(tokenIds[i], corpIds[i]);
            }
        }
    }

    // ── Claimable Balances ───────────────────────────────────────

    function setClaimableBalance(uint256 tokenId, uint256 amount)
        external
        onlyBackendOrOwner
        tokenExists(tokenId)
    {
        claimableBalance[tokenId] = amount;
        emit ClaimableBalanceUpdated(tokenId, amount);
    }

    function batchSetClaimableBalance(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyBackendOrOwner {
        require(tokenIds.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_ownerOf(tokenIds[i]) != address(0)) {
                claimableBalance[tokenIds[i]] = amounts[i];
                emit ClaimableBalanceUpdated(tokenIds[i], amounts[i]);
            }
        }
    }

    function addClaimableBalance(uint256 tokenId, uint256 amount)
        external
        onlyBackendOrOwner
        tokenExists(tokenId)
    {
        claimableBalance[tokenId] += amount;
        emit ClaimableBalanceUpdated(tokenId, claimableBalance[tokenId]);
    }

    function batchAddClaimableBalance(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyBackendOrOwner {
        require(tokenIds.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_ownerOf(tokenIds[i]) != address(0)) {
                claimableBalance[tokenIds[i]] += amounts[i];
                emit ClaimableBalanceUpdated(tokenIds[i], claimableBalance[tokenIds[i]]);
            }
        }
    }

    function deductClaimableBalance(uint256 tokenId, uint256 amount)
        external
        onlyGameOrBackend
        tokenExists(tokenId)
    {
        if (claimableBalance[tokenId] < amount) revert InsufficientBalance();
        claimableBalance[tokenId] -= amount;
        emit ClaimableBalanceUpdated(tokenId, claimableBalance[tokenId]);
    }

    // ══════════════════════════════════════════════════════════════
    //                  ADMIN FUNCTIONS (owner only)
    // ══════════════════════════════════════════════════════════════

    // ── ETH Pricing ──────────────────────────────────────────────

    function setMintPrice(uint256 price) external onlyOwner {
        mintPrice = price;
    }

    function setWhitelistPrice(uint256 price) external onlyOwner {
        whitelistPrice = price;
    }

    // ── ERC-20 Payment Token Config ──────────────────────────────

    function setPaymentToken(address _token) external onlyOwner {
        if (_token == address(0)) revert InvalidAddress();
        paymentToken = IERC20Minimal(_token);
    }

    function setPaymentTokenMintPrice(uint256 price) external onlyOwner {
        paymentTokenMintPrice = price;
    }

    function setPaymentTokenWhitelistPrice(uint256 price) external onlyOwner {
        paymentTokenWhitelistPrice = price;
    }

    // ── Mint Config ──────────────────────────────────────────────

    function setMintPhase(uint8 phase) external onlyOwner {
        require(phase <= PHASE_PUBLIC, "Invalid phase");
        mintPhase = phase;
    }

    function setMaxPerWallet(uint256 max) external onlyOwner {
        maxPerWallet = max;
    }

    // ── Whitelist Management ─────────────────────────────────────

    function addToWhitelist(address[] calldata wallets) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            whitelisted[wallets[i]] = true;
        }
    }

    function removeFromWhitelist(address[] calldata wallets) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            whitelisted[wallets[i]] = false;
        }
    }

    // ── Free Mint Management ─────────────────────────────────────

    function setFreeMint(address wallet, uint256 quantity) external onlyOwner {
        if (wallet == address(0)) revert InvalidAddress();
        freeMintAllowance[wallet] = quantity;
        emit FreeMintAssigned(wallet, quantity);
    }

    function batchSetFreeMint(address[] calldata wallets, uint256[] calldata quantities)
        external
        onlyOwner
    {
        require(wallets.length == quantities.length, "Length mismatch");
        for (uint256 i = 0; i < wallets.length; i++) {
            if (wallets[i] == address(0)) revert InvalidAddress();
            freeMintAllowance[wallets[i]] = quantities[i];
            emit FreeMintAssigned(wallets[i], quantities[i]);
        }
    }

    function removeFreeMint(address wallet) external onlyOwner {
        freeMintAllowance[wallet] = 0;
        emit FreeMintAssigned(wallet, 0);
    }

    // ── Connected Contracts ──────────────────────────────────────

    function setNXTToken(address _nxtToken) external onlyOwner {
        if (_nxtToken == address(0)) revert InvalidAddress();
        nxtToken = INXTToken(_nxtToken);
    }

    function setApprovedGameContract(address contractAddress, bool approved)
        external
        onlyOwner
    {
        if (contractAddress == address(0)) revert InvalidAddress();
        approvedGameContract[contractAddress] = approved;
        emit GameContractUpdated(contractAddress, approved);
    }

    function setClaimEnabled(bool enabled) external onlyOwner {
        claimEnabled = enabled;
    }

    // ── URI & Addresses ──────────────────────────────────────────

    function setBaseURI(string calldata uri) external onlyOwner {
        _baseTokenURI = uri;
    }

    function setBackendSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert InvalidAddress();
        backendSigner = signer;
    }

    function setTreasuryWallet(address wallet) external onlyOwner {
        if (wallet == address(0)) revert InvalidAddress();
        treasuryWallet = wallet;
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    // ── Emergency ────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ── Withdraw ─────────────────────────────────────────────────

    /**
     * @notice Withdraw all ETH (native) to treasury wallet
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        (bool success, ) = payable(treasuryWallet).call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    // ══════════════════════════════════════════════════════════════
    //                    VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString()));
    }

    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }

    /**
     * @notice Get full dev info in a single call
     */
    function getDevInfo(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (
            address owner_,
            bool locked_,
            uint8 state_,
            uint8 corpId_,
            bool corpSet_,
            uint256 claimable_,
            uint256 claimed_
        )
    {
        owner_ = ownerOf(tokenId);
        locked_ = tokenLocked[tokenId];
        state_ = tokenState[tokenId];
        corpId_ = corporationOf[tokenId];
        corpSet_ = corporationAssigned[tokenId];
        claimable_ = claimableBalance[tokenId];
        claimed_ = totalClaimed[tokenId];
    }

    /**
     * @notice Get all token IDs owned by an address
     */
    function tokensOfOwner(address owner_) external view returns (uint256[] memory) {
        uint256 count = balanceOf(owner_);
        uint256[] memory tokenIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner_, i);
        }
        return tokenIds;
    }

    function isApprovedGameContract(address addr) external view returns (bool) {
        return approvedGameContract[addr];
    }

    /**
     * @notice Get current mint prices for both payment methods
     * @return ethPublic ETH price for public mint
     * @return ethWL ETH price for whitelist mint
     * @return tokenPublic ERC-20 price for public mint
     * @return tokenWL ERC-20 price for whitelist mint
     */
    function getMintPrices()
        external
        view
        returns (
            uint256 ethPublic,
            uint256 ethWL,
            uint256 tokenPublic,
            uint256 tokenWL
        )
    {
        ethPublic = mintPrice;
        ethWL = whitelistPrice;
        tokenPublic = paymentTokenMintPrice;
        tokenWL = paymentTokenWhitelistPrice;
    }

    // ══════════════════════════════════════════════════════════════
    //                    INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    function _mintBatch(address to, uint256 quantity)
        internal
        returns (uint256[] memory mintedIds)
    {
        mintedIds = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _getRandomTokenId(i);
            _safeMint(to, tokenId);
            mintedIds[i] = tokenId;
            totalMinted++;
            emit DevMinted(to, tokenId);
        }
    }

    /**
     * @dev Lazy Fisher-Yates shuffle using a mapping instead of an array.
     *
     *      Mapping entries default to 0. We treat 0 as "unswapped", meaning
     *      the value at index `i` is implicitly `i + 1` (token IDs 1..35000).
     *      When we pick a random index, we read its value (or compute the default),
     *      then swap the last remaining position's value into the picked slot.
     *
     *      This avoids the 35,000-slot array initialization that would exceed
     *      MegaEVM's state growth limit of 1,000 new slots per transaction.
     *      Each mint only writes 1 new mapping entry (the swap).
     *
     *      Note: block.prevrandao caps remaining compute gas to 20M on MegaEVM.
     *      The code after the keccak256 is lightweight, so this is fine.
     */
    function _getRandomTokenId(uint256 nonce) internal returns (uint256) {
        uint256 remaining = MAX_SUPPLY - totalMinted;
        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.timestamp,
                    msg.sender,
                    totalMinted,
                    nonce
                )
            )
        ) % remaining;

        // Read value at random index (0 means unswapped → implicit value is index + 1)
        uint256 pickedValue = _tokenMatrix[randomIndex];
        if (pickedValue == 0) {
            pickedValue = randomIndex + 1;
        }

        // Read value at last position (0 means unswapped → implicit value is remaining)
        uint256 lastValue = _tokenMatrix[remaining - 1];
        if (lastValue == 0) {
            lastValue = remaining;
        }

        // Swap: put last position's value into the picked slot
        _tokenMatrix[randomIndex] = lastValue;

        // No need to update _tokenMatrix[remaining - 1] since that position
        // will never be accessed again (remaining shrinks via totalMinted++)

        return pickedValue;
    }

    function _checkWalletLimit(address wallet, uint256 quantity) internal view {
        if (maxPerWallet > 0) {
            if (balanceOf(wallet) + quantity > maxPerWallet) {
                revert ExceedsMaxPerWallet();
            }
        }
    }

    // ══════════════════════════════════════════════════════════════
    //                   REQUIRED OVERRIDES
    // ══════════════════════════════════════════════════════════════

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            if (tokenLocked[tokenId]) revert TokenIsLocked();
            if (paused()) revert("Contract is paused");
        }
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
