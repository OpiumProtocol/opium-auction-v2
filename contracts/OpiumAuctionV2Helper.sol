// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./helpers/NonceManager.sol";
import "./helpers/Misc.sol";

import "./ExponentialAuction.sol";

import "hardhat/console.sol";

contract OpiumAuctionV2Helper is ExponentialAuction, NonceManager, Misc {
  using SafeERC20 for IERC20;

  uint256 constant public FEE_BASE = 100_000;
  uint256 public fee = 10;

  address public feesReceiver;

  constructor(address feesReceiver_) {
    feesReceiver = feesReceiver_;
  }

  // Auction contract is set as a receiver, thus it handles additional checks, fees and sends the taking amount further to the maker
  function notifyFillOrder(
    address /* taker */,
    address /* makerAsset */,
    address takerAsset,
    uint256 makingAmount,
    uint256 takingAmount,
    bytes memory interactiveData
  ) external {
    // Decode interactive data
    (
      address maker,
      uint256 requiredMakingAmount,
      uint256 startedAt
    ) = abi.decode(interactiveData, (address, uint256, uint256));

    // Check if auction already started
    require(timestampAbove(startedAt), "Not started yet");
    
    // requiredMakingAmount = 0 -> Partial fill allowed
    // requiredMakingAmount != 0 -> Only filling of the provided amount allowed
    if (requiredMakingAmount != 0 && requiredMakingAmount != makingAmount) {
      revert("Partial fill not allowed");
    }

    // Calculate auction fees
    uint256 fees = takingAmount * fee / FEE_BASE;

    // Transfer the amount to maker without fees
    IERC20(takerAsset).safeTransfer(maker, takingAmount - fees);

    // Transfer the fees if non-zero
    if (fees != 0) {
      IERC20(takerAsset).safeTransfer(feesReceiver, fees);
    }
  }
}
