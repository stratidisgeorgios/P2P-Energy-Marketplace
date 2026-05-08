// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./UserRegistry.sol";
import "./EnergyToken.sol";
import "./RenewableEnergyCertificate.sol";

/**
 * @title EnergyMarketplace
 * @dev Handles energy trading between producers and consumers
 * Producers create sell offers, consumers accept them
 * Issues proof-of-purchase certificates on acceptance
 * Implements reentrancy protection and access control
 */
contract EnergyMarketplace is ReentrancyGuard, AccessControl {
    // References to other contracts
    UserRegistry public userRegistry;
    EnergyToken public energyToken;
    RenewableEnergyCertificate public certificateContract;

    // Role for address that can conclude trades (oracle)
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // Offer type enum
    enum OfferType {
        SELL,  // Producer selling energy
        BUY    // Consumer buying energy
    }

    // Offer status enum
    enum OfferStatus {
        ACTIVE,
        ACCEPTED,
        CANCELLED,
        COMPLETED
    }

    // Offer struct
    struct Offer {
        uint256 offerId;
        address creator;       // Producer (for SELL) or Consumer (for BUY)
        OfferType offerType;   // SELL or BUY
        uint256 energyAmount;  // in kWh
        uint256 pricePerUnit;  // in wei
        uint256 totalPrice;    // pricePerUnit * energyAmount
        OfferStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        address counterparty;  // Producer (for BUY) or Consumer (for SELL) who accepted
    }

    // Trade struct (created when offer is accepted)
    struct Trade {
        uint256 tradeId;
        uint256 offerId;
        address producer;
        address consumer;
        uint256 energyAmount;
        uint256 totalPrice;
        uint256 createdAt;
        uint256 certificateId; // Proof of purchase certificate issued on acceptance
        bool deliveryConfirmed;
        bool settled;
    }

    // State variables
    uint256 public nextOfferId = 1;
    uint256 public nextTradeId = 1;
    uint256 public offerDuration = 7 days; // Default offer expiration time

    // Mappings
    mapping(uint256 => Offer) public offers;
    mapping(uint256 => Trade) public trades;
    mapping(address => uint256[]) public producerOffers; // Producer -> offer IDs
    mapping(address => uint256[]) public consumerTrades; // Consumer -> trade IDs
    mapping(address => uint256) public pendingBalance; // Locked funds for consumers
    mapping(address => uint256) public reservedTokens; // Tokens locked for producers in pending trades

    // Events
    event OfferCreated(
        uint256 indexed offerId,
        address indexed producer,
        uint256 energyAmount,
        uint256 pricePerUnit,
        uint256 expiresAt
    );
    event OfferCancelled(uint256 indexed offerId, address indexed producer);
    event OfferAccepted(
        uint256 indexed offerId,
        uint256 indexed tradeId,
        uint256 indexed certificateId,
        address consumer
    );
    event TradeDeliveryConfirmed(
        uint256 indexed tradeId,
        address indexed oracle
    );
    event TradeSettled(
        uint256 indexed tradeId,
        address indexed consumer,
        address indexed producer
    );
    event TradeCancelled(uint256 indexed tradeId);

    /**
     * @dev Constructor
     * @param _userRegistry Address of UserRegistry contract
     * @param _energyToken Address of EnergyToken contract
     * @param _certificateContract Address of RenewableEnergyCertificate contract
     */
    constructor(address _userRegistry, address _energyToken, address _certificateContract) {
        require(_userRegistry != address(0), "Invalid registry address");
        require(_energyToken != address(0), "Invalid token address");
        require(_certificateContract != address(0), "Invalid certificate address");

        userRegistry = UserRegistry(_userRegistry);
        energyToken = EnergyToken(_energyToken);
        certificateContract = RenewableEnergyCertificate(_certificateContract);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    /**
     * @dev Mint test energy tokens for testing (only producers can use)
     * @param _amount Amount of test tokens to mint (in kWh)
     */
    function mintTestEnergy(uint256 _amount) external {
        require(
            userRegistry.isUserActive(msg.sender),
            "User not registered"
        );
        require(
            userRegistry.isProducer(msg.sender),
            "Only producers can mint test tokens"
        );
        require(_amount > 0, "Amount must be greater than 0");

        energyToken.mintEnergy(msg.sender, _amount);
    }

    /**
     * @dev Create a new energy offer (SELL for producers, BUY for consumers)
     * For SELL offers: no payment needed at creation
     * For BUY offers: consumer must deposit funds in escrow
     * @param _offerType Type of offer: SELL (producer) or BUY (consumer)
     * @param _energyAmount Amount of energy to sell/buy (in kWh)
     * @param _pricePerUnit Price per kWh in wei
     */
    function createOffer(uint8 _offerType, uint256 _energyAmount, uint256 _pricePerUnit)
        external
        payable
        nonReentrant
    {
        // Validate caller
        require(
            userRegistry.isUserActive(msg.sender),
            "Caller not registered"
        );

        // Validate offer type
        OfferType offerType = OfferType(_offerType);
        uint256 totalPrice = _energyAmount * _pricePerUnit;
        
        if (offerType == OfferType.SELL) {
            // Producers create SELL offers (no payment at creation)
            require(
                userRegistry.isProducer(msg.sender),
                "Only producers can create SELL offers"
            );
            require(msg.value == 0, "SELL offers: do not send payment at creation");
            
            // Check available balance (actual - reserved tokens)
            // Scale energy amount to 18 decimals for comparison
            uint256 scaledEnergyAmount = _energyAmount * (10 ** 18);
            uint256 actualBalance = energyToken.balanceOf(msg.sender);
            uint256 availableBalance = actualBalance > reservedTokens[msg.sender] 
                ? actualBalance - reservedTokens[msg.sender] 
                : 0;
            require(
                availableBalance >= scaledEnergyAmount,
                "Insufficient available energy (some tokens may be reserved for pending trades)"
            );
            
            // Auto-mint energy tokens if producer doesn't have enough
            uint256 balance = energyToken.balanceOf(msg.sender);
            uint256 scaledAmount = _energyAmount * (10 ** 18);
            if (balance < scaledAmount) {
                uint256 needed = scaledAmount - balance;
                energyToken.mintEnergy(msg.sender, needed);
            }
        } else if (offerType == OfferType.BUY) {
            // Consumers create BUY offers (must deposit funds to escrow)
            require(
                userRegistry.isConsumer(msg.sender),
                "Only consumers can create BUY offers"
            );
            require(msg.value == totalPrice, "BUY offers: must deposit full amount for escrow");
        } else {
            revert("Invalid offer type");
        }

        // Validate inputs
        require(_energyAmount > 0, "Energy amount must be greater than 0");
        require(_pricePerUnit > 0, "Price per unit must be greater than 0");

        // Create new offer
        uint256 offerId = nextOfferId;
        uint256 expiresAt = block.timestamp + offerDuration;

        Offer memory newOffer = Offer({
            offerId: offerId,
            creator: msg.sender,
            offerType: offerType,
            energyAmount: _energyAmount,
            pricePerUnit: _pricePerUnit,
            totalPrice: totalPrice,
            status: OfferStatus.ACTIVE,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            counterparty: address(0)
        });

        offers[offerId] = newOffer;
        producerOffers[msg.sender].push(offerId);
        
        // Lock funds in contract for BUY offers
        if (offerType == OfferType.BUY) {
            pendingBalance[address(this)] += msg.value;
        }
        nextOfferId++;

        emit OfferCreated(
            offerId,
            msg.sender,
            _energyAmount,
            _pricePerUnit,
            expiresAt
        );
    }

    /**
     * @dev Cancel an active offer
     * For SELL offers: just mark as cancelled
     * For BUY offers: refund escrowed funds to consumer
     * @param _offerId ID of offer to cancel
     */
    function cancelOffer(uint256 _offerId) external nonReentrant {
        Offer storage offer = offers[_offerId];

        require(offer.offerId != 0, "Offer does not exist");
        require(offer.creator == msg.sender, "Only creator can cancel");
        require(
            offer.status == OfferStatus.ACTIVE,
            "Only active offers can be cancelled"
        );

        offer.status = OfferStatus.CANCELLED;
        
        // If this is a BUY offer, refund escrowed funds to consumer
        if (offer.offerType == OfferType.BUY) {
            uint256 escrowAmount = offer.totalPrice;
            require(
                pendingBalance[address(this)] >= escrowAmount,
                "Insufficient escrow balance to refund"
            );
            
            // Release funds from escrow
            pendingBalance[address(this)] -= escrowAmount;
            
            // Refund to consumer (offer creator)
            (bool success, ) = payable(msg.sender).call{value: escrowAmount}("");
            require(success, "Refund failed");
        }

        emit OfferCancelled(_offerId, msg.sender);
    }

    /**
     * @dev Accept an energy offer and create a trade
     * For SELL: consumer accepts and pays escrow
     * For BUY: producer accepts (consumer has funds ready)
     * @param _offerId ID of offer to accept
     */
    function acceptOffer(uint256 _offerId)
        external
        payable
        nonReentrant
    {
        // Validate offer
        Offer storage offer = offers[_offerId];
        require(offer.offerId != 0, "Offer does not exist");
        require(offer.status == OfferStatus.ACTIVE, "Offer is not active");
        require(block.timestamp <= offer.expiresAt, "Offer has expired");
        require(msg.sender != offer.creator, "Creator cannot accept own offer");

        // Validate caller and offer type
        require(
            userRegistry.isUserActive(msg.sender),
            "Caller not registered"
        );

        address producer;
        address consumer;

        if (offer.offerType == OfferType.SELL) {
            // Consumer accepts SELL offer from producer
            require(
                userRegistry.isConsumer(msg.sender),
                "Only consumers can accept SELL offers"
            );
            producer = offer.creator;
            consumer = msg.sender;

            // Check if producer has sufficient available energy (not reserved)
            uint256 scaledEnergyAmount = offer.energyAmount * (10 ** 18);
            uint256 actualBalance = energyToken.balanceOf(producer);
            uint256 availableBalance = actualBalance > reservedTokens[producer] 
                ? actualBalance - reservedTokens[producer] 
                : 0;
            require(
                availableBalance >= scaledEnergyAmount,
                "Producer no longer has sufficient available energy (some tokens may be reserved for other pending trades)"
            );

            // Consumer must pay
            require(msg.value == offer.totalPrice, "Incorrect payment amount");
        } else { // BUY offer
            // Producer accepts BUY offer from consumer
            require(
                userRegistry.isProducer(msg.sender),
                "Only producers can accept BUY offers"
            );
            producer = msg.sender;
            consumer = offer.creator;

            // Check if producer has sufficient available energy (not reserved)
            uint256 scaledEnergyAmount = offer.energyAmount * (10 ** 18);
            uint256 actualBalance = energyToken.balanceOf(producer);
            uint256 availableBalance = actualBalance > reservedTokens[producer] 
                ? actualBalance - reservedTokens[producer] 
                : 0;
            require(
                availableBalance >= scaledEnergyAmount,
                "Insufficient available energy (some tokens may be reserved for other pending trades)"
            );
            
            // For BUY offers, no payment at acceptance time
            // The consumer created the offer, implying intent to pay
            require(msg.value == 0, "BUY offers: producer should not send payment");
        }

        // Update offer status
        offer.status = OfferStatus.ACCEPTED;
        offer.counterparty = msg.sender;

        // Create trade record
        uint256 tradeId = nextTradeId;
        
        // Issue proof-of-purchase certificate to consumer
        string memory metadata = string(
            abi.encodePacked(
                '{"offerId":"', _uintToString(_offerId),
                '","energyAmount":"', _uintToString(offer.energyAmount),
                '","pricePerUnit":"', _uintToString(offer.pricePerUnit),
                '"}'
            )
        );
        
        uint256 certificateId = certificateContract.issueCertificate(
            consumer,
            RenewableEnergyCertificate.EnergySource.OTHER,
            offer.energyAmount,
            metadata
        );
        
        Trade memory newTrade = Trade({
            tradeId: tradeId,
            offerId: _offerId,
            producer: producer,
            consumer: consumer,
            energyAmount: offer.energyAmount,
            totalPrice: offer.totalPrice,
            createdAt: block.timestamp,
            certificateId: certificateId,
            deliveryConfirmed: false,
            settled: false
        });

        trades[tradeId] = newTrade;
        consumerTrades[consumer].push(tradeId);

        // Lock funds in contract (for SELL offers, consumer sends payment)
        if (msg.value > 0) {
            pendingBalance[address(this)] += msg.value;
        }

        // Lock producer tokens for this trade (prevent double-spending)
        // Convert to 18 decimals to match ERC20 token scaling
        uint256 energyAmountScaled = offer.energyAmount * (10 ** 18);
        reservedTokens[producer] += energyAmountScaled;

        nextTradeId++;

        emit OfferAccepted(_offerId, tradeId, certificateId, msg.sender);
    }

    /**
     * @dev Oracle confirms delivery and triggers settlement
     * @param _tradeId ID of trade to confirm
     */
    function confirmDelivery(uint256 _tradeId)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
    {
        Trade storage trade = trades[_tradeId];

        require(trade.tradeId != 0, "Trade does not exist");
        require(!trade.deliveryConfirmed, "Delivery already confirmed");
        require(!trade.settled, "Trade already settled");

        // Mark delivery as confirmed
        trade.deliveryConfirmed = true;

        // Unreserve tokens from producer (convert to 18 decimals)
        uint256 energyAmountScaled = trade.energyAmount * (10 ** 18);
        require(
            reservedTokens[trade.producer] >= energyAmountScaled,
            "Reserved tokens inconsistency"
        );
        reservedTokens[trade.producer] -= energyAmountScaled;

        // Transfer energy tokens from producer to consumer (scaled to 18 decimals)
        uint256 transferAmount = energyAmountScaled;
        require(
            energyToken.balanceOf(trade.producer) >= transferAmount,
            "Insufficient producer balance"
        );

        // Use marketplace's TRANSFER_ROLE to transfer tokens on behalf of producer
        bool transferSuccess = energyToken.transferOnBehalf(
            trade.producer,
            trade.consumer,
            transferAmount
        );
        require(transferSuccess, "Energy transfer failed");

        // Update consumer's smart meter with received energy
        userRegistry.updateMeterReading(trade.consumer, transferAmount);

        emit TradeDeliveryConfirmed(_tradeId, msg.sender);
    }

    /**
     * @dev Settle a trade - release payment to producer
     * @param _tradeId ID of trade to settle
     */
    function settleTrade(uint256 _tradeId)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
    {
        Trade storage trade = trades[_tradeId];

        require(trade.tradeId != 0, "Trade does not exist");
        require(trade.deliveryConfirmed, "Delivery not confirmed");
        require(!trade.settled, "Trade already settled");

        trade.settled = true;

        // Release funds to producer
        uint256 paymentAmount = trade.totalPrice;
        pendingBalance[address(this)] -= paymentAmount;

        (bool success, ) = payable(trade.producer).call{value: paymentAmount}(
            ""
        );
        require(success, "Payment transfer failed");

        emit TradeSettled(_tradeId, trade.consumer, trade.producer);
    }

    /**
     * @dev Cancel a trade and refund consumer
     * Only callable if delivery is not confirmed
     * @param _tradeId ID of trade to cancel
     */
    function cancelTrade(uint256 _tradeId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        Trade storage trade = trades[_tradeId];

        require(trade.tradeId != 0, "Trade does not exist");
        require(
            !trade.deliveryConfirmed,
            "Cannot cancel after delivery confirmed"
        );
        require(!trade.settled, "Trade already settled");

        // Unreserve producer tokens (convert to 18 decimals)
        uint256 energyAmountScaled = trade.energyAmount * (10 ** 18);
        if (reservedTokens[trade.producer] >= energyAmountScaled) {
            reservedTokens[trade.producer] -= energyAmountScaled;
        }

        // Update state
        offers[trade.offerId].status = OfferStatus.CANCELLED;
        trade.settled = true;

        // Refund consumer
        uint256 refundAmount = trade.totalPrice;
        pendingBalance[address(this)] -= refundAmount;

        (bool success, ) = payable(trade.consumer).call{value: refundAmount}(
            ""
        );
        require(success, "Refund transfer failed");

        emit TradeCancelled(_tradeId);
    }

    /**
     * @dev Get offer details
     * @param _offerId ID of offer
     * @return Offer struct
     */
    function getOffer(uint256 _offerId) external view returns (Offer memory) {
        require(offers[_offerId].offerId != 0, "Offer does not exist");
        return offers[_offerId];
    }

    /**
     * @dev Get trade details
     * @param _tradeId ID of trade
     * @return Trade struct
     */
    function getTrade(uint256 _tradeId) external view returns (Trade memory) {
        require(trades[_tradeId].tradeId != 0, "Trade does not exist");
        return trades[_tradeId];
    }

    /**
     * @dev Get total active offers from a producer
     * @param _producer Producer address
     * @return uint256 Number of active offers
     */
    function getProducerOffersCount(address _producer)
        external
        view
        returns (uint256)
    {
        return producerOffers[_producer].length;
    }

    /**
     * @dev Get total trades for a consumer
     * @param _consumer Consumer address
     * @return uint256 Number of trades
     */
    function getConsumerTradesCount(address _consumer)
        external
        view
        returns (uint256)
    {
        return consumerTrades[_consumer].length;
    }

    /**
     * @dev Set offer duration
     * @param _newDuration New duration in seconds
     */
    function setOfferDuration(uint256 _newDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_newDuration > 0, "Duration must be positive");
        offerDuration = _newDuration;
    }

    /**
     * @dev Get pending balance (locked funds)
     * @return uint256 Current pending balance
     */
    function getPendingBalance() external view returns (uint256) {
        return pendingBalance[address(this)];
    }

    /**
     * @dev Helper function to convert uint to string
     */
    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
