// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.9;

import "./helpers/NonceManager.sol";
import "./helpers/FeesManager.sol";

import "./ExponentialAuction.sol";

contract OpiumAuctionV2Helper is ExponentialAuction, NonceManager, FeesManager {
  constructor(address feesReceiver_) FeesManager(feesReceiver_) {}
}
