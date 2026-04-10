// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EnergyToken
 * @dev ERC20 token representing energy units (1 token = 1 kWh)
 * Only authorized oracle/minters can mint tokens
 * Burnable by token holders
 */
contract EnergyToken is ERC20, AccessControl {
    // Role for accounts that can mint tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    // Role for accounts that can transfer tokens on behalf of others (marketplace)
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");

    // Tracks total energy minted (in kWh)
    uint256 public totalEnergyMinted;

    // Events
    event EnergyMinted(
        address indexed producer,
        uint256 amount,
        uint256 timestamp
    );
    event EnergyBurned(
        address indexed account,
        uint256 amount,
        uint256 timestamp
    );
    event MinterAdded(address indexed newMinter, uint256 timestamp);
    event MinterRemoved(address indexed minter, uint256 timestamp);

    /**
     * @dev Constructor - initializes ERC20 token with name "Energy" and symbol "NRG"
     */
    constructor() ERC20("Energy", "NRG") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev Mint energy tokens (only authorized minters - typically oracle)
     * @param _to Address to mint tokens to
     * @param _amount Amount of kWh to mint
     */
    function mintEnergy(address _to, uint256 _amount)
        external
        onlyRole(MINTER_ROLE)
    {
        require(_to != address(0), "Cannot mint to zero address");
        require(_amount > 0, "Amount must be greater than 0");

        _mint(_to, _amount);
        totalEnergyMinted += _amount;

        emit EnergyMinted(_to, _amount, block.timestamp);
    }

    /**
     * @dev Burn energy tokens (can be called by token holder or marketplace)
     * @param _account Account to burn tokens from
     * @param _amount Amount of kWh to burn
     */
    function burnEnergy(address _account, uint256 _amount)
        external
        onlyRole(MINTER_ROLE)
    {
        require(_account != address(0), "Cannot burn from zero address");
        require(_amount > 0, "Amount must be greater than 0");
        require(balanceOf(_account) >= _amount, "Insufficient balance");

        _burn(_account, _amount);

        emit EnergyBurned(_account, _amount, block.timestamp);
    }

    /**
     * @dev Allow token holders to burn their own tokens
     * @param _amount Amount of kWh to burn
     */
    function burn(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= _amount, "Insufficient balance");

        _burn(msg.sender, _amount);

        emit EnergyBurned(msg.sender, _amount, block.timestamp);
    }

    /**
     * @dev Add a new minter
     * @param _newMinter Address to grant MINTER_ROLE
     */
    function addMinter(address _newMinter)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_newMinter != address(0), "Invalid address");
        _grantRole(MINTER_ROLE, _newMinter);
        emit MinterAdded(_newMinter, block.timestamp);
    }

    /**
     * @dev Remove a minter
     * @param _minter Address to revoke MINTER_ROLE from
     */
    function removeMinter(address _minter)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_minter != address(0), "Invalid address");
        _revokeRole(MINTER_ROLE, _minter);
        emit MinterRemoved(_minter, block.timestamp);
    }

    /**
     * @dev Transfer tokens on behalf of another account (marketplace use only)
     * @param _from Address to transfer from
     * @param _to Address to transfer to
     * @param _amount Amount to transfer
     */
    function transferOnBehalf(address _from, address _to, uint256 _amount)
        external
        onlyRole(TRANSFER_ROLE)
        returns (bool)
    {
        require(_from != address(0), "Invalid from address");
        require(_to != address(0), "Invalid to address");
        require(_amount > 0, "Amount must be greater than 0");
        require(balanceOf(_from) >= _amount, "Insufficient balance");

        _transfer(_from, _to, _amount);
        return true;
    }

    /**
     * @dev Get total energy minted so far
     * @return uint256 Total energy minted in kWh
     */
    function getTotalEnergyMinted() external view returns (uint256) {
        return totalEnergyMinted;
    }

    /**
     * @dev Get total supply (inherited from ERC20)
     * @return uint256 Current total supply
     */
    function getTotalSupply() external view returns (uint256) {
        return totalSupply();
    }

    /**
     * @dev Get user's energy balance
     * @param _account User's address
     * @return uint256 Balance in kWh
     */
    function getBalance(address _account) external view returns (uint256) {
        return balanceOf(_account);
    }
}
