// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RenewableEnergyCertificate
 * @dev Tracks the source and origin of renewable energy
 * Issues certificates for renewable energy generation
 * Links certificates to energy tokens for verification
 */
contract RenewableEnergyCertificate is AccessControl {
    // Role for oracle/issuer that can create certificates
    bytes32 public constant CERTIFICATE_ISSUER_ROLE =
        keccak256("CERTIFICATE_ISSUER_ROLE");

    // Energy source types
    enum EnergySource {
        SOLAR,
        WIND,
        HYDRO,
        GEOTHERMAL,
        BIOMASS,
        OTHER
    }

    // Certificate struct
    struct Certificate {
        uint256 certificateId;
        address producer;
        EnergySource source;
        uint256 energyAmount; // in kWh
        uint256 issuedAt;
        uint256 expiresAt;
        string metadata; // JSON metadata with location, capacity factor, etc.
        bool isValid;
        uint256 linkedTradeId; // Reference to marketplace trade
    }

    // State variables
    uint256 public nextCertificateId = 1;
    uint256 public certificateValidity = 365 days; // Validity period

    // Mappings
    mapping(uint256 => Certificate) public certificates;
    mapping(address => uint256[]) public producerCertificates; // Producer -> cert IDs
    mapping(uint256 => uint256[]) public tradeCertificates; // Trade -> cert IDs
    mapping(EnergySource => uint256) public totalEnergyBySource; // Track energy per source

    // Events
    event CertificateIssued(
        uint256 indexed certificateId,
        address indexed producer,
        EnergySource indexed source,
        uint256 energyAmount,
        uint256 expiresAt
    );
    event CertificateVerified(
        uint256 indexed certificateId,
        address indexed verifier
    );
    event CertificateRevoked(
        uint256 indexed certificateId,
        address indexed revoker
    );
    event CertificateLinkedToTrade(
        uint256 indexed certificateId,
        uint256 indexed tradeId
    );

    /**
     * @dev Constructor
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CERTIFICATE_ISSUER_ROLE, msg.sender);
    }

    /**
     * @dev Issue a new renewable energy certificate
     * @param _producer Address of energy producer
     * @param _source Type of renewable energy source
     * @param _energyAmount Amount of renewable energy generated (in kWh)
     * @param _metadata JSON metadata (location, installation date, capacity, etc.)
     * @return certificateId ID of newly issued certificate
     */
    function issueCertificate(
        address _producer,
        EnergySource _source,
        uint256 _energyAmount,
        string calldata _metadata
    ) external onlyRole(CERTIFICATE_ISSUER_ROLE) returns (uint256) {
        require(_producer != address(0), "Invalid producer address");
        require(_energyAmount > 0, "Energy amount must be greater than 0");

        uint256 certificateId = nextCertificateId;
        uint256 expiresAt = block.timestamp + certificateValidity;

        Certificate memory newCert = Certificate({
            certificateId: certificateId,
            producer: _producer,
            source: _source,
            energyAmount: _energyAmount,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            metadata: _metadata,
            isValid: true,
            linkedTradeId: 0
        });

        certificates[certificateId] = newCert;
        producerCertificates[_producer].push(certificateId);
        totalEnergyBySource[_source] += _energyAmount;

        nextCertificateId++;

        emit CertificateIssued(
            certificateId,
            _producer,
            _source,
            _energyAmount,
            expiresAt
        );

        return certificateId;
    }

    /**
     * @dev Verify a certificate's authenticity
     * @param _certificateId ID of certificate to verify
     * @return bool True if certificate is valid
     */
    function verifyCertificate(uint256 _certificateId)
        external
        onlyRole(CERTIFICATE_ISSUER_ROLE)
        returns (bool)
    {
        Certificate storage cert = certificates[_certificateId];

        require(cert.certificateId != 0, "Certificate does not exist");
        require(cert.isValid, "Certificate is not valid");
        require(
            block.timestamp <= cert.expiresAt,
            "Certificate has expired"
        );

        emit CertificateVerified(_certificateId, msg.sender);
        return true;
    }

    /**
     * @dev Revoke a certificate
     * @param _certificateId ID of certificate to revoke
     */
    function revokeCertificate(uint256 _certificateId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        Certificate storage cert = certificates[_certificateId];

        require(cert.certificateId != 0, "Certificate does not exist");
        require(cert.isValid, "Certificate is already revoked");

        cert.isValid = false;
        totalEnergyBySource[cert.source] -= cert.energyAmount;

        emit CertificateRevoked(_certificateId, msg.sender);
    }

    /**
     * @dev Link a certificate to a marketplace trade
     * @param _certificateId ID of certificate
     * @param _tradeId ID of marketplace trade
     */
    function linkCertificateToTrade(uint256 _certificateId, uint256 _tradeId)
        external
        onlyRole(CERTIFICATE_ISSUER_ROLE)
    {
        Certificate storage cert = certificates[_certificateId];

        require(cert.certificateId != 0, "Certificate does not exist");
        require(cert.isValid, "Certificate is not valid");
        require(cert.linkedTradeId == 0, "Certificate already linked");

        cert.linkedTradeId = _tradeId;
        tradeCertificates[_tradeId].push(_certificateId);

        emit CertificateLinkedToTrade(_certificateId, _tradeId);
    }

    /**
     * @dev Get certificate details
     * @param _certificateId ID of certificate
     * @return Certificate struct
     */
    function getCertificate(uint256 _certificateId)
        external
        view
        returns (Certificate memory)
    {
        require(
            certificates[_certificateId].certificateId != 0,
            "Certificate does not exist"
        );
        return certificates[_certificateId];
    }

    /**
     * @dev Verify certificate validity
     * @param _certificateId ID of certificate
     * @return bool True if valid and not expired
     */
    function isCertificateValid(uint256 _certificateId)
        external
        view
        returns (bool)
    {
        Certificate memory cert = certificates[_certificateId];
        return (cert.isValid && block.timestamp <= cert.expiresAt);
    }

    /**
     * @dev Get producer's certificates count
     * @param _producer Producer address
     * @return uint256 Number of certificates issued to producer
     */
    function getProducerCertificatesCount(address _producer)
        external
        view
        returns (uint256)
    {
        return producerCertificates[_producer].length;
    }

    /**
     * @dev Get total energy generated from a specific source
     * @param _source Energy source type
     * @return uint256 Total energy in kWh from that source
     */
    function getTotalEnergyBySource(EnergySource _source)
        external
        view
        returns (uint256)
    {
        return totalEnergyBySource[_source];
    }

    /**
     * @dev Get all certificates linked to a trade
     * @param _tradeId Trade ID
     * @return uint256[] Array of certificate IDs
     */
    function getCertificatesForTrade(uint256 _tradeId)
        external
        view
        returns (uint256[] memory)
    {
        return tradeCertificates[_tradeId];
    }

    /**
     * @dev Get energy source as string
     * @param _source Enum value
     * @return string Source name
     */
    function getSourceName(EnergySource _source)
        external
        pure
        returns (string memory)
    {
        if (_source == EnergySource.SOLAR) return "Solar";
        if (_source == EnergySource.WIND) return "Wind";
        if (_source == EnergySource.HYDRO) return "Hydro";
        if (_source == EnergySource.GEOTHERMAL) return "Geothermal";
        if (_source == EnergySource.BIOMASS) return "Biomass";
        return "Other";
    }

    /**
     * @dev Set certificate validity duration
     * @param _newValidity New validity period in seconds
     */
    function setCertificateValidity(uint256 _newValidity)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_newValidity > 0, "Validity must be positive");
        certificateValidity = _newValidity;
    }

    /**
     * @dev Get certificates count for producer at index
     * @param _producer Producer address
     * @param _index Index in array
     * @return uint256 Certificate ID at index
     */
    function getProducerCertificateAtIndex(address _producer, uint256 _index)
        external
        view
        returns (uint256)
    {
        require(
            _index < producerCertificates[_producer].length,
            "Index out of bounds"
        );
        return producerCertificates[_producer][_index];
    }
}
