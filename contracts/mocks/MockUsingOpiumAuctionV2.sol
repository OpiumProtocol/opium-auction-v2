//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../helpers/ArgumentsDecoder.sol";
import "../utils/UsingOpiumAuctionV2.sol";

contract MockUsingOpiumAuctionV2 is UsingOpiumAuctionV2 {
  using ArgumentsDecoder for bytes;

  address public immutable auctionHelperContract;
  address public immutable limitOrderProtocol;

  // Auction data
  enum PricingFunction {
    LINEAR,
    EXPONENTIAL
  }

  enum PricingDirection {
    INCREASING,
    DECREASING
  }
  
  struct AuctionOrder {
    IERC20 sellingToken;
    IERC20 purchasingToken;
    uint256 sellingAmount;
    PricingFunction pricingFunction;
    uint256[] pricingFunctionParams;
    PricingDirection pricingDirection;
    bool partialFill;
    uint256 minPurchasingAmount;
    uint256 maxPurchasingAmount;
    uint256 startedAt;
    uint256 endedAt;
  }

  AuctionOrder public auctionOrder;

  constructor(
    address auctionHelperContract_,
    address limitOrderProtocol_
  ) UsingOpiumAuctionV2(limitOrderProtocol_) {
    auctionHelperContract = auctionHelperContract_;
    limitOrderProtocol = limitOrderProtocol_;
  }

  function startAuction(AuctionOrder memory auctionOrder_) public {
    auctionOrder = auctionOrder_;

    auctionOrder.sellingToken.approve(limitOrderProtocol, auctionOrder.sellingAmount);
  }

  function _isValidOrder(Types.Order memory order_) internal view override returns (bool) {
    return (
      order_.makerAsset == address(auctionOrder.sellingToken) &&
      order_.takerAsset == address(auctionOrder.purchasingToken) &&
      order_.maker == address(this) &&
      order_.receiver == auctionHelperContract &&
      order_.makingAmount == auctionOrder.sellingAmount &&
      order_.takingAmount == auctionOrder.maxPurchasingAmount &&
      _isValidGetMakerAmount(order_.getMakerAmount) &&
      _isValidGetTakerAmount(order_.getTakerAmount) &&
      _isValidPredicate(order_.predicate) &&
      _isValidInteractionData(order_.interaction)
    );
  }

  function _isValidGetMakerAmount(bytes memory getMakerAmount_) private view returns (bool) {
    bytes memory realArgs = 
      auctionOrder.pricingFunction == PricingFunction.LINEAR
        ? abi.encodeWithSignature(
            "getLinearAuctionMakerAmount(uint256,uint256,uint256,uint256,uint256,bool,uint256)",
            auctionOrder.sellingAmount,
            auctionOrder.maxPurchasingAmount,
            auctionOrder.minPurchasingAmount,
            auctionOrder.startedAt, 
            auctionOrder.endedAt,
            auctionOrder.pricingDirection == PricingDirection.INCREASING,
            0
          )
        : abi.encodeWithSignature(
            "getExponentialAuctionMakerAmount(uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256)",
            auctionOrder.sellingAmount,
            auctionOrder.maxPurchasingAmount,
            auctionOrder.minPurchasingAmount,
            auctionOrder.startedAt, 
            auctionOrder.endedAt,
            auctionOrder.pricingDirection == PricingDirection.INCREASING,
            auctionOrder.pricingFunctionParams[0],
            0
          );
    return _parseArbitraryStaticCallAndCheck(
      abi.encodePacked(getMakerAmount_, uint256(0)),
      realArgs
    );
  }

  function _isValidGetTakerAmount(bytes memory getTakerAmount_) private view returns (bool) {
    bytes memory realArgs = 
      auctionOrder.pricingFunction == PricingFunction.LINEAR
        ? abi.encodeWithSignature(
            "getLinearAuctionTakerAmount(uint256,uint256,uint256,uint256,uint256,bool,uint256)",
            auctionOrder.sellingAmount,
            auctionOrder.maxPurchasingAmount,
            auctionOrder.minPurchasingAmount,
            auctionOrder.startedAt, 
            auctionOrder.endedAt,
            auctionOrder.pricingDirection == PricingDirection.INCREASING,
            0
          )
        : abi.encodeWithSignature(
            "getExponentialAuctionTakerAmount(uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256)",
            auctionOrder.sellingAmount,
            auctionOrder.maxPurchasingAmount,
            auctionOrder.minPurchasingAmount,
            auctionOrder.startedAt, 
            auctionOrder.endedAt,
            auctionOrder.pricingDirection == PricingDirection.INCREASING,
            auctionOrder.pricingFunctionParams[0],
            0
          );
    return _parseArbitraryStaticCallAndCheck(
      abi.encodePacked(getTakerAmount_, uint256(0)),
      realArgs
    );
  }

  function _parseArbitraryStaticCallAndCheck(bytes memory data_, bytes memory realArgs_) private view returns (bool) {
    bytes4 ARBITRARY_STATIC_CALL_SIGHASH = 0xbf15fcd8;

    bytes4 sighash;
    address target;
    bytes memory args;

    assembly {
      sighash := mload(add(data_, 0x20))
      target := mload(add(data_, 0x24))
      args := add(data_, 0x64)
      mstore(args, sub(mload(data_), 0x64))
    }

    return (
      sighash == ARBITRARY_STATIC_CALL_SIGHASH &&
      target == auctionHelperContract &&
      keccak256(args) == keccak256(realArgs_)
    );
  }

  function _isValidPredicate(bytes memory predicate_) private view returns (bool) {
    address[] memory addressArgs = new address[](2);
    addressArgs[0] = auctionHelperContract;
    addressArgs[1] = auctionHelperContract;

    bytes[] memory bytesArgs = new bytes[](2);
    bytesArgs[0] = abi.encodeWithSignature("nonceEquals(address,uint256)", address(this), 0);
    bytesArgs[1] = abi.encodeWithSignature("timestampBelow(uint256)", auctionOrder.endedAt);

    bytes memory realPredicate = abi.encodeWithSignature("and(address[],bytes[])", addressArgs, bytesArgs);

    return keccak256(realPredicate) == keccak256(predicate_);
  }

  function _isValidInteractionData(bytes memory interaction_) private view returns (bool) {
    (address interactionTarget, bytes memory interactionData) = interaction_.decodeTargetAndCalldata();
    (address interactionMakerAddress, uint256 requiredMakingAmount, uint256 startedAt) = abi.decode(interactionData, (address, uint256, uint256));

    return (
      interactionMakerAddress == address(this) &&
      interactionTarget == auctionHelperContract &&
      (auctionOrder.partialFill || requiredMakingAmount == auctionOrder.sellingAmount) &&
      startedAt == auctionOrder.startedAt
    );
  }
}
