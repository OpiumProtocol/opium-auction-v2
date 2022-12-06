//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../utils/UsingOpiumAuctionV2.sol";

contract MockUsingOpiumAuctionV2 is UsingOpiumAuctionV2 {
  AuctionOrder public auctionOrder;

  constructor(
    address auctionHelperContract_,
    address limitOrderProtocol_
  )
    UsingOpiumAuctionV2(auctionHelperContract_, limitOrderProtocol_)
  {}

  function startAuction(AuctionOrder memory auctionOrder_) public {
    auctionOrder = auctionOrder_;

    auctionOrder.sellingToken.approve(limitOrderProtocol, auctionOrder.sellingAmount);
  }

  function _isValidOrder(Types.Order memory order_) internal view override returns (bool) {
    Types.Order memory realOrder = auctionToLimitOrder(auctionOrder, address(this), 0);

    return hashOrder(realOrder) == hashOrder(order_);
  }
}
