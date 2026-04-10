// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title UserRegistry
 * @dev Manages user registration and roles for the P2P Energy Trading Marketplace
 * Users can be registered as Producers or Consumers
 */
contract UserRegistry is Ownable, AccessControl {
    // Define roles
    bytes32 public constant PRODUCER_ROLE = keccak256("PRODUCER_ROLE");
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // Enum for user role type
    enum RoleType { PRODUCER, CONSUMER }

    // User struct to store user information
    struct User {
        address wallet;
        string name;
        uint256 registrationTime;
        RoleType role; // Single role: either PRODUCER or CONSUMER
        bool isActive;
        string metadata; // Additional info (location, capacity, etc.)
    }

    // Mappings for efficient lookup
    mapping(address => User) public users;
    mapping(address => bool) public isRegistered;
    address[] public registeredUsers;

    // Events
    event UserRegistered(
        address indexed userAddress,
        string name,
        RoleType role,
        uint256 timestamp
    );
    event UserRoleUpdated(
        address indexed userAddress,
        RoleType newRole,
        uint256 timestamp
    );
    event UserStatusChanged(
        address indexed userAddress,
        bool isActive,
        uint256 timestamp
    );

    /**
     * @dev Constructor - sets up default admin role
     */
    constructor() Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    /**
     * @dev Allow users to self-register with a single role
     * @param _name Username
     * @param _role Role (PRODUCER or CONSUMER only, not BOTH)
     */
    function registerUser(
        string memory _name,
        string memory _role
    ) external {
        require(msg.sender != address(0), "Invalid address");
        require(!isRegistered[msg.sender], "User already registered");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_role).length > 0, "Role cannot be empty");
        
        // Only allow PRODUCER or CONSUMER - not BOTH
        bool isProducerRole = keccak256(bytes(_role)) == keccak256(bytes("PRODUCER"));
        bool isConsumerRole = keccak256(bytes(_role)) == keccak256(bytes("CONSUMER"));
        require(isProducerRole || isConsumerRole, "Invalid role - use PRODUCER or CONSUMER only");

        RoleType userRole = isProducerRole ? RoleType.PRODUCER : RoleType.CONSUMER;

        User memory newUser = User({
            wallet: msg.sender,
            name: _name,
            registrationTime: block.timestamp,
            role: userRole,
            isActive: true,
            metadata: ""
        });

        users[msg.sender] = newUser;
        isRegistered[msg.sender] = true;
        registeredUsers.push(msg.sender);

        // Grant appropriate role
        if (isProducerRole) {
            _grantRole(PRODUCER_ROLE, msg.sender);
        } else {
            _grantRole(CONSUMER_ROLE, msg.sender);
        }

        emit UserRegistered(
            msg.sender,
            _name,
            userRole,
            block.timestamp
        );
    }

    /**
     * @dev Admin-only registration (deprecated, kept for compatibility)
     * Now enforces single role
     */
    function registerUserAsAdmin(
        address _userAddress,
        string calldata _name,
        RoleType _role,
        string calldata _metadata
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_userAddress != address(0), "Invalid address");
        require(!isRegistered[_userAddress], "User already registered");

        User memory newUser = User({
            wallet: _userAddress,
            name: _name,
            registrationTime: block.timestamp,
            role: _role,
            isActive: true,
            metadata: _metadata
        });

        users[_userAddress] = newUser;
        isRegistered[_userAddress] = true;
        registeredUsers.push(_userAddress);

        // Grant appropriate role
        if (_role == RoleType.PRODUCER) {
            _grantRole(PRODUCER_ROLE, _userAddress);
        } else {
            _grantRole(CONSUMER_ROLE, _userAddress);
        }

        emit UserRegistered(
            _userAddress,
            _name,
            _role,
            block.timestamp
        );
    }

    /**
     * @dev Update user role (change from PRODUCER to CONSUMER or vice versa)
     * @param _userAddress Address of user to update
     * @param _newRole New role (PRODUCER or CONSUMER)
     */
    function updateUserRole(
        address _userAddress,
        RoleType _newRole
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isRegistered[_userAddress], "User not registered");

        User storage user = users[_userAddress];
        RoleType oldRole = user.role;
        user.role = _newRole;

        // Revoke old role and grant new role
        if (oldRole == RoleType.PRODUCER) {
            _revokeRole(PRODUCER_ROLE, _userAddress);
        } else {
            _revokeRole(CONSUMER_ROLE, _userAddress);
        }

        if (_newRole == RoleType.PRODUCER) {
            _grantRole(PRODUCER_ROLE, _userAddress);
        } else {
            _grantRole(CONSUMER_ROLE, _userAddress);
        }

        emit UserRoleUpdated(
            _userAddress,
            _newRole,
            block.timestamp
        );
    }

    /**
     * @dev Activate or deactivate a user
     * @param _userAddress Address of user to update
     * @param _isActive New active status
     */
    function setUserStatus(address _userAddress, bool _isActive)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(isRegistered[_userAddress], "User not registered");
        users[_userAddress].isActive = _isActive;
        emit UserStatusChanged(_userAddress, _isActive, block.timestamp);
    }

    /**
     * @dev Get user information
     * @param _userAddress Address of user to query
     * @return User struct with all information
     */
    function getUser(address _userAddress)
        external
        view
        returns (User memory)
    {
        require(isRegistered[_userAddress], "User not registered");
        return users[_userAddress];
    }

    /**
     * @dev Check if user is registered and active
     * @param _userAddress Address to check
     * @return bool True if user is registered and active
     */
    function isUserActive(address _userAddress) external view returns (bool) {
        return isRegistered[_userAddress] && users[_userAddress].isActive;
    }

    /**
     * @dev Check if user is a producer
     * @param _userAddress Address to check
     * @return bool True if user has PRODUCER_ROLE
     */
    function isProducer(address _userAddress) external view returns (bool) {
        return hasRole(PRODUCER_ROLE, _userAddress);
    }

    /**
     * @dev Check if user is a consumer
     * @param _userAddress Address to check
     * @return bool True if user has CONSUMER_ROLE
     */
    function isConsumer(address _userAddress) external view returns (bool) {
        return hasRole(CONSUMER_ROLE, _userAddress);
    }

    /**
     * @dev Get total number of registered users
     * @return uint256 Total registered users
     */
    function getUserCount() external view returns (uint256) {
        return registeredUsers.length;
    }

    /**
     * @dev Get registered user at index (for enumeration)
     * @param _index Index in registeredUsers array
     * @return address User address at index
     */
    function getUserAtIndex(uint256 _index)
        external
        view
        returns (address)
    {
        require(_index < registeredUsers.length, "Index out of bounds");
        return registeredUsers[_index];
    }

    /**
     * @dev Allow user to deregister (unregister themselves)
     * This allows them to re-register with different roles
     */
    function deregisterUser() external {
        require(isRegistered[msg.sender], "User not registered");
        
        User storage user = users[msg.sender];
        
        // Revoke roles based on user's role
        if (user.role == RoleType.PRODUCER) {
            _revokeRole(PRODUCER_ROLE, msg.sender);
        } else if (user.role == RoleType.CONSUMER) {
            _revokeRole(CONSUMER_ROLE, msg.sender);
        }
        
        // Mark as deregistered
        isRegistered[msg.sender] = false;
        user.isActive = false;
        
        emit UserStatusChanged(msg.sender, false, block.timestamp);
    }
}
