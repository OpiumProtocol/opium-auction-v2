// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.9;

import "./LinearAuction.sol";

contract ExponentialAuction is LinearAuction {
  function expBySeconds(uint256 secs) public pure returns(uint256 result) {
    result = BASE;
    assembly { // solhint-disable-line no-inline-assembly
      if and(secs, 0x00000F) {
        if and(secs, 0x000001) {
          result := div(mul(result, 999900000000000000000000000000000000), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x000002) {
          result := div(mul(result, 999800010000000000000000000000000000), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x000004) {
          result := div(mul(result, 999600059996000100000000000000000000), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x000008) {
          result := div(mul(result, 999200279944006999440027999200010000), 1000000000000000000000000000000000000)
        }
      }

      if and(secs, 0x0000F0) {
        if and(secs, 0x000010) {
          result := div(mul(result, 998401199440181956328006856128688560), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x000020) {
          result := div(mul(result, 996804955043593987145855519554957648), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x000040) {
          result := div(mul(result, 993620118399461429792290614928235372), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x000080) {
          result := div(mul(result, 987280939688159750172898466482272707), 1000000000000000000000000000000000000)
        }
      }

      if and(secs, 0x000F00) {
        if and(secs, 0x000100) {
          result := div(mul(result, 974723653871535730138973062438582481), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x000200) {
          result := div(mul(result, 950086201416677390961738571086337286), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x000400) {
          result := div(mul(result, 902663790122371280016479918855854806), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x000800) {
          result := div(mul(result, 814801917998084346828628782199508463), 1000000000000000000000000000000000000)
        }
      }

      if and(secs, 0x00F000) {
        if and(secs, 0x001000) {
          result := div(mul(result, 663902165573356968243491567819400493), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x002000) {
          result := div(mul(result, 440766085452993090398118811102456830), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x004000) {
          result := div(mul(result, 194274742085555207178862579417407102), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x008000) {
          result := div(mul(result, 37742675412408995610179844414960649), 1000000000000000000000000000000000000)
        }
      }

      if and(secs, 0x0F0000) {
        if and(secs, 0x010000) {
          result := div(mul(result, 1424509547286462546864068778806188), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x020000) {
          result := div(mul(result, 2029227450310282474813662564103), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x040000) {
          result := div(mul(result, 4117764045092769930387910), 1000000000000000000000000000000000000)
        }
        if and(secs, 0x080000) {
          result := div(mul(result, 16955980731058), 1000000000000000000000000000000000000)
        }
      }
    }
  }

  function exponentialPriceDecreasing(
    uint256 orderMakerAmount,
    uint256 orderTakerAmount,
    uint256 thresholdOrderTakerAmount,
    uint256 startedAt,
    uint256 endedAt,
    uint256 amplifier
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
    uint256 pricePadded = maxPricePadded * expBySeconds(timeElapsed * amplifier) / BASE;

    return pricePadded > minPricePadded ? pricePadded : minPricePadded;
  }

  function exponentialPriceIncreasing(
    uint256 orderMakerAmount,
    uint256 orderTakerAmount,
    uint256 thresholdOrderTakerAmount,
    uint256 startedAt,
    uint256 endedAt,
    uint256 amplifier
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
    uint256 pricePadded = maxPricePadded * (BASE - expBySeconds(timeElapsed * amplifier)) / BASE;

    return pricePadded > minPricePadded ? pricePadded : minPricePadded;
  }

  function getExponentialAuctionMakerAmount(
    uint256 orderMakerAmount,
    uint256 orderTakerAmount,
    uint256 thresholdOrderTakerAmount,
    uint256 startedAt,
    uint256 endedAt,
    bool increasing,
    uint256 amplifier,
    uint256 swapTakerAmount
  ) public view returns(uint256) {
    return 
      swapTakerAmount
      * BASE
      / (
        increasing
        ? exponentialPriceIncreasing(
          orderMakerAmount,
          orderTakerAmount,
          thresholdOrderTakerAmount,
          startedAt,
          endedAt,
          amplifier
        )
        : exponentialPriceDecreasing(
          orderMakerAmount,
          orderTakerAmount,
          thresholdOrderTakerAmount,
          startedAt,
          endedAt,
          amplifier
        )
      );
  }

  function getExponentialAuctionTakerAmount(
    uint256 orderMakerAmount,
    uint256 orderTakerAmount,
    uint256 thresholdOrderTakerAmount,
    uint256 startedAt,
    uint256 endedAt,
    bool increasing,
    uint256 amplifier,
    uint256 swapMakerAmount
  ) public view returns(uint256) {
    return 
      swapMakerAmount 
      * (
        increasing
        ? exponentialPriceIncreasing(
          orderMakerAmount,
          orderTakerAmount,
          thresholdOrderTakerAmount,
          startedAt,
          endedAt,
          amplifier
        )
        : exponentialPriceDecreasing(
          orderMakerAmount,
          orderTakerAmount,
          thresholdOrderTakerAmount,
          startedAt,
          endedAt,
          amplifier
        )
      )
      / BASE;
  }
}
