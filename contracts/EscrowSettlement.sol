// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EscrowSettlement
 * @dev Manages escrow of funds during energy trades
 * Handles payment release only after oracle confirmation
 * Provides dispute resolution and automatic refunds
 */
contract EscrowSettlement is ReentrancyGuard, AccessControl {
    // Roles
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");

    // Escrow status enum
    enum EscrowStatus {
        PENDING,
        CONFIRMED,
        RELEASED,
        REFUNDED,
        DISPUTED
    }

    // Escrow record struct
    struct EscrowRecord {
        uint256 escrowId;
        uint256 tradeId;
        address buyer;
        address seller;
        uint256 amount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 releaseTime;
        bool disputeRaised;
    }

    // State variables
    uint256 public nextEscrowId = 1;
    uint256 public defaultReleaseTime = 48 hours; // Time after which escrow auto-releases if not confirmed
    uint256 public totalEscrowedFunds = 0;

    // Mappings
    mapping(uint256 => EscrowRecord) public escrows;
    mapping(uint256 => uint256) public tradeEscrows; // Trade ID -> Escrow ID
    mapping(address => uint256) public buyerEscrows; // Buyer -> Escrow balance
    mapping(address => uint256) public sellerWithdrawable; // Seller -> Withdrawable balance

    // Events
    event EscrowCreated(
        uint256 indexed escrowId,
        uint256 indexed tradeId,
        address indexed buyer,
        address seller,
        uint256 amount
    );
    event DeliveryConfirmedByOracle(
        uint256 indexed escrowId,
        uint256 indexed tradeId,
        address indexed oracle
    );
    event FundsReleased(
        uint256 indexed escrowId,
        address indexed seller,
        uint256 amount
    );
    event FundsRefunded(
        uint256 indexed escrowId,
        address indexed buyer,
        uint256 amount
    );
    event DisputeRaised(
        uint256 indexed escrowId,
        uint256 indexed tradeId,
        string reason
    );
    event DisputeResolved(
        uint256 indexed escrowId,
        address indexed resolvedBy,
        address recipient,
        uint256 amount,
        bool releasedToSeller
    );
    event WithdrawalProcessed(
        address indexed seller,
        uint256 amount
    );

    /**
     * @dev Constructor
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    /**
     * @dev Create an escrow record when a trade is initiated
     * Called by marketplace when buyer accepts offer
     * @param _tradeId ID of the marketplace trade
     * @param _buyer Address of buyer
     * @param _seller Address of seller
     * @param _amount Amount being escrowed in wei
     */
    function createEscrow(
        uint256 _tradeId,
        address _buyer,
        address _seller,
        uint256 _amount
    ) external payable onlyRole(MARKETPLACE_ROLE) nonReentrant {
        require(_buyer != address(0), "Invalid buyer address");
        require(_seller != address(0), "Invalid seller address");
        require(_amount > 0, "Escrow amount must be greater than 0");
        require(msg.value == _amount, "Sent value must match escrow amount");
        require(tradeEscrows[_tradeId] == 0, "Escrow already exists for trade");

        uint256 escrowId = nextEscrowId;
        uint256 releaseTime = block.timestamp + defaultReleaseTime;

        EscrowRecord memory newEscrow = EscrowRecord({
            escrowId: escrowId,
            tradeId: _tradeId,
            buyer: _buyer,
            seller: _seller,
            amount: _amount,
            status: EscrowStatus.PENDING,
            createdAt: block.timestamp,
            releaseTime: releaseTime,
            disputeRaised: false
        });

        escrows[escrowId] = newEscrow;
        tradeEscrows[_tradeId] = escrowId;
        buyerEscrows[_buyer] += _amount;
        totalEscrowedFunds += _amount;

        nextEscrowId++;

        emit EscrowCreated(escrowId, _tradeId, _buyer, _seller, _amount);
    }

    /**
     * @dev Oracle confirms delivery and marks escrow as confirmed
     * After this, funds can be released to seller
     * @param _escrowId ID of escrow record
     */
    function confirmDeliveryByOracle(uint256 _escrowId)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
    {
        EscrowRecord storage escrow = escrows[_escrowId];

        require(escrow.escrowId != 0, "Escrow does not exist");
        require(
            escrow.status == EscrowStatus.PENDING,
            "Escrow is not pending"
        );
        require(!escrow.disputeRaised, "Dispute has been raised");

        escrow.status = EscrowStatus.CONFIRMED;

        emit DeliveryConfirmedByOracle(_escrowId, escrow.tradeId, msg.sender);
    }

    /**
     * @dev Release confirmed funds to seller
     * Can be called by seller or oracle after delivery confirmation
     * @param _escrowId ID of escrow record
     */
    function releaseFundsToSeller(uint256 _escrowId)
        external
        nonReentrant
    {
        EscrowRecord storage escrow = escrows[_escrowId];

        require(escrow.escrowId != 0, "Escrow does not exist");
        require(
            escrow.status == EscrowStatus.CONFIRMED,
            "Escrow must be confirmed first"
        );
        require(!escrow.disputeRaised, "Dispute has been raised");

        escrow.status = EscrowStatus.RELEASED;

        // Add to seller's withdrawable balance
        sellerWithdrawable[escrow.seller] += escrow.amount;
        buyerEscrows[escrow.buyer] -= escrow.amount;
        totalEscrowedFunds -= escrow.amount;

        emit FundsReleased(_escrowId, escrow.seller, escrow.amount);
    }

    /**
     * @dev Refund buyer if delivery not confirmed within time window
     * Can be called by buyer or oracle after timeout
     * @param _escrowId ID of escrow record
     */
    function refundBuyer(uint256 _escrowId) external nonReentrant {
        EscrowRecord storage escrow = escrows[_escrowId];

        require(escrow.escrowId != 0, "Escrow does not exist");
        require(
            escrow.status == EscrowStatus.PENDING ||
                escrow.status == EscrowStatus.DISPUTED,
            "Escrow cannot be refunded in current state"
        );

        // Only allow refund if time has passed or dispute is resolved
        if (escrow.status == EscrowStatus.PENDING) {
            require(
                block.timestamp > escrow.releaseTime,
                "Release time not reached"
            );
        }

        escrow.status = EscrowStatus.REFUNDED;

        // Refund buyer
        uint256 refundAmount = escrow.amount;
        buyerEscrows[escrow.buyer] -= refundAmount;
        totalEscrowedFunds -= refundAmount;

        (bool success, ) = payable(escrow.buyer).call{value: refundAmount}(
            ""
        );
        require(success, "Refund transfer failed");

        emit FundsRefunded(_escrowId, escrow.buyer, refundAmount);
    }

    /**
     * @dev Raise a dispute for an escrow
     * Prevents automatic release and flags for admin review
     * @param _escrowId ID of escrow record
     * @param _reason Reason for dispute
     */
    function raiseDispute(uint256 _escrowId, string calldata _reason)
        external
        nonReentrant
    {
        EscrowRecord storage escrow = escrows[_escrowId];

        require(escrow.escrowId != 0, "Escrow does not exist");
        require(!escrow.disputeRaised, "Dispute already raised");
        require(
            msg.sender == escrow.buyer || msg.sender == escrow.seller,
            "Only buyer or seller can raise dispute"
        );

        escrow.status = EscrowStatus.DISPUTED;
        escrow.disputeRaised = true;

        emit DisputeRaised(_escrowId, escrow.tradeId, _reason);
    }

    /**
     * @dev Resolve a dispute (admin function)
     * @param _escrowId ID of escrow record
     * @param _releaseFundsToSeller True to release to seller, false to refund buyer
     */
    function resolveDispute(
        uint256 _escrowId,
        bool _releaseFundsToSeller
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        EscrowRecord storage escrow = escrows[_escrowId];

        require(escrow.escrowId != 0, "Escrow does not exist");
        require(
            escrow.status == EscrowStatus.DISPUTED,
            "Escrow is not disputed"
        );

        if (_releaseFundsToSeller) {
            escrow.status = EscrowStatus.RELEASED;
            sellerWithdrawable[escrow.seller] += escrow.amount;
            buyerEscrows[escrow.buyer] -= escrow.amount;
            totalEscrowedFunds -= escrow.amount;

            emit DisputeResolved(
                _escrowId,
                msg.sender,
                escrow.seller,
                escrow.amount,
                true
            );
        } else {
            escrow.status = EscrowStatus.REFUNDED;
            buyerEscrows[escrow.buyer] -= escrow.amount;
            totalEscrowedFunds -= escrow.amount;

            (bool success, ) = payable(escrow.buyer).call{
                value: escrow.amount
            }("");
            require(success, "Refund transfer failed");

            emit DisputeResolved(
                _escrowId,
                msg.sender,
                escrow.buyer,
                escrow.amount,
                false
            );
        }
    }

    /**
     * @dev Seller withdraws their released funds
     */
    function withdrawFunds() external nonReentrant {
        uint256 withdrawAmount = sellerWithdrawable[msg.sender];
        require(withdrawAmount > 0, "No funds to withdraw");

        sellerWithdrawable[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: withdrawAmount}(
            ""
        );
        require(success, "Withdrawal transfer failed");

        emit WithdrawalProcessed(msg.sender, withdrawAmount);
    }

    /**
     * @dev Get escrow details
     * @param _escrowId ID of escrow
     * @return EscrowRecord struct
     */
    function getEscrow(uint256 _escrowId)
        external
        view
        returns (EscrowRecord memory)
    {
        require(escrows[_escrowId].escrowId != 0, "Escrow does not exist");
        return escrows[_escrowId];
    }

    /**
     * @dev Get escrow for a specific trade
     * @param _tradeId Trade ID
     * @return EscrowRecord struct
     */
    function getEscrowByTradeId(uint256 _tradeId)
        external
        view
        returns (EscrowRecord memory)
    {
        uint256 escrowId = tradeEscrows[_tradeId];
        require(escrowId != 0, "No escrow for this trade");
        return escrows[escrowId];
    }

    /**
     * @dev Get total funds escrowed
     * @return uint256 Total escrowed amount in wei
     */
    function getTotalEscrowedFunds() external view returns (uint256) {
        return totalEscrowedFunds;
    }

    /**
     * @dev Get buyer's total escrowed funds
     * @param _buyer Buyer address
     * @return uint256 Total amount buyer has escrowed
     */
    function getBuyerEscrowedAmount(address _buyer)
        external
        view
        returns (uint256)
    {
        return buyerEscrows[_buyer];
    }

    /**
     * @dev Get seller's withdrawable balance
     * @param _seller Seller address
     * @return uint256 Amount seller can withdraw
     */
    function getSellerWithdrawableBalance(address _seller)
        external
        view
        returns (uint256)
    {
        return sellerWithdrawable[_seller];
    }

    /**
     * @dev Update default release time
     * @param _newReleaseTime New time in seconds
     */
    function setDefaultReleaseTime(uint256 _newReleaseTime)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_newReleaseTime > 0, "Release time must be positive");
        defaultReleaseTime = _newReleaseTime;
    }

    /**
     * @dev Grant marketplace role to a contract
     * @param _marketplace Marketplace contract address
     */
    function grantMarketplaceRole(address _marketplace)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_marketplace != address(0), "Invalid address");
        _grantRole(MARKETPLACE_ROLE, _marketplace);
    }
}
