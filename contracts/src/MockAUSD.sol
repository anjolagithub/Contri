// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title Test AUSD (testnet only)
/// @notice A stand-in for Agora's AUSD dollar stablecoin on Monad testnet: 6 decimals and EIP-2612
///         permit, so the app can stay gasless. Anyone can mint a small amount for testing.
///         On mainnet Contri takes real AUSD (or USDC); this contract is never deployed there.
contract MockAUSD is ERC20, ERC20Permit {
    uint256 public constant FAUCET_AMOUNT = 1_000e6;

    constructor() ERC20("Test AUSD", "tAUSD") ERC20Permit("Test AUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint up to 1,000 test dollars to any address.
    function faucet(address to, uint256 amount) external {
        require(amount <= FAUCET_AMOUNT, "max 1000 per call");
        _mint(to, amount);
    }
}
