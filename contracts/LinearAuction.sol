// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.9;

contract LinearAuction {
  uint256 constant public BASE = 1e18;

  function linearPriceDecreasing(
    uint256 orderMakerAmount,
    uint256 orderTakerAmount,
    uint256 thresholdOrderTakerAmount,
    uint256 startedAt,
    uint256 endedAt
  ) public view returns(uint256) {
    uint256 maxPricePadded = orderTakerAmount * BASE / orderMakerAmount;
    uint256 minPricePadded = thresholdOrderTakerAmount * BASE / orderMakerAmount;

    // If not started yet
    if (startedAt > block.timestamp) {
      return maxPricePadded;
    }

    // If already finished
    if (endedAt < block.timestamp) {
      return minPricePadded;
    }

    uint256 timeElapsed = block.timestamp - startedAt;
    uint256 timeMax = endedAt - startedAt;

    return maxPricePadded - minPricePadded * timeElapsed / timeMax;
  }

  function linearPriceIncreasing(
    uint256 orderMakerAmount,
    uint256 orderTakerAmount,
    uint256 thresholdOrderTakerAmount,
    uint256 startedAt,
    uint256 endedAt
  ) public view returns(uint256) {
    uint256 maxPricePadded = orderTakerAmount * BASE / orderMakerAmount;
    uint256 minPricePadded = thresholdOrderTakerAmount * BASE / orderMakerAmount;

    // If not started yet
    if (startedAt > block.timestamp) {
      return minPricePadded;
    }

    // If already finished
    if (endedAt < block.timestamp) {
      return maxPricePadded;
    }

    uint256 timeElapsed = block.timestamp - startedAt;
    uint256 timeMax = endedAt - startedAt;

    return (maxPricePadded - minPricePadded) * timeElapsed / timeMax + minPricePadded;
  }

  function getLinearAuctionMakerAmount(
    uint256 orderMakerAmount,
    uint256 orderTakerAmount,
    uint256 thresholdOrderTakerAmount,
    uint256 startedAt,
    uint256 endedAt,
    bool increasing,
    uint256 swapTakerAmount
  ) public view returns(uint256) {
    return 
      swapTakerAmount
      * BASE
      / (
        increasing
        ? linearPriceIncreasing(
          orderMakerAmount,
          orderTakerAmount,
          thresholdOrderTakerAmount,
          startedAt,
          endedAt
        )
        : linearPriceDecreasing(
          orderMakerAmount,
          orderTakerAmount,
          thresholdOrderTakerAmount,
          startedAt,
          endedAt
        )
      );
  }

  function getLinearAuctionTakerAmount(
    uint256 orderMakerAmount,
    uint256 orderTakerAmount,
    uint256 thresholdOrderTakerAmount,
    uint256 startedAt,
    uint256 endedAt,
    bool increasing,
    uint256 swapMakerAmount
  ) public view returns(uint256) {
    return 
      swapMakerAmount 
      * (
        increasing
        ? linearPriceIncreasing(
          orderMakerAmount,
          orderTakerAmount,
          thresholdOrderTakerAmount,
          startedAt,
          endedAt
        )
        : linearPriceDecreasing(
          orderMakerAmount,
          orderTakerAmount,
          thresholdOrderTakerAmount,
          startedAt,
          endedAt
        )
      )
      / BASE;
  }
}
