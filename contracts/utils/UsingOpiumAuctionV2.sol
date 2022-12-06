//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./UsingLimitOrderProtocolV2.sol";

abstract contract UsingOpiumAuctionV2 is UsingLimitOrderProtocolV2 {
  address public immutable auctionHelperContract;

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
    uint256 salt;
  }

  constructor(
    address auctionHelperContract_,
    address limitOrderProtocol_
  ) UsingLimitOrderProtocolV2(limitOrderProtocol_) {
    auctionHelperContract = auctionHelperContract_;
  }

  function auctionToLimitOrder(
    AuctionOrder memory auctionOrder_,
    address maker_,
    uint256 nonce_
  ) public view returns (Types.Order memory order) {
    order.salt = auctionOrder_.salt;
    order.makerAsset = address(auctionOrder_.sellingToken);
    order.takerAsset = address(auctionOrder_.purchasingToken);
    order.maker = maker_;
    order.receiver = auctionHelperContract;
    order.allowedSender = address(0x0000000000000000000000000000000000000000);
    order.makingAmount = auctionOrder_.sellingAmount;
    order.takingAmount = auctionOrder_.maxPurchasingAmount;
    // Omit: order.makerAssetData;
    // Omit: order.takerAssetData;
    order.getMakerAmount = _prepareGetMakerAmount(auctionOrder_);
    order.getTakerAmount = _prepareGetTakerAmount(auctionOrder_);
    order.predicate = _preparePredicate(auctionOrder_, maker_, nonce_);
    // Omit: order.permit;
    order.interaction = _prepareInteraction(auctionOrder_, maker_);
  }

  function _prepareGetMakerAmount(AuctionOrder memory auctionOrder_) internal view returns (bytes memory getMakerAmount) {
    getMakerAmount = 
      auctionOrder_.pricingFunction == PricingFunction.LINEAR
        ? abi.encodeWithSignature(
            "getLinearAuctionMakerAmount(uint256,uint256,uint256,uint256,uint256,bool,uint256)",
            auctionOrder_.sellingAmount,
            auctionOrder_.maxPurchasingAmount,
            auctionOrder_.minPurchasingAmount,
            auctionOrder_.startedAt, 
            auctionOrder_.endedAt,
            auctionOrder_.pricingDirection == PricingDirection.INCREASING,
            0
          )
        : abi.encodeWithSignature(
            "getExponentialAuctionMakerAmount(uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256)",
            auctionOrder_.sellingAmount,
            auctionOrder_.maxPurchasingAmount,
            auctionOrder_.minPurchasingAmount,
            auctionOrder_.startedAt, 
            auctionOrder_.endedAt,
            auctionOrder_.pricingDirection == PricingDirection.INCREASING,
            auctionOrder_.pricingFunctionParams[0],
            0
          );

    getMakerAmount = abi.encodeWithSignature("arbitraryStaticCall(address,bytes)", auctionHelperContract, getMakerAmount);
    
    getMakerAmount = _slice(getMakerAmount, 0, getMakerAmount.length - 60);
  }

  function _prepareGetTakerAmount(AuctionOrder memory auctionOrder_) internal view returns (bytes memory getTakerAmount) {
    getTakerAmount = 
      auctionOrder_.pricingFunction == PricingFunction.LINEAR
        ? abi.encodeWithSignature(
            "getLinearAuctionTakerAmount(uint256,uint256,uint256,uint256,uint256,bool,uint256)",
            auctionOrder_.sellingAmount,
            auctionOrder_.maxPurchasingAmount,
            auctionOrder_.minPurchasingAmount,
            auctionOrder_.startedAt, 
            auctionOrder_.endedAt,
            auctionOrder_.pricingDirection == PricingDirection.INCREASING,
            0
          )
        : abi.encodeWithSignature(
            "getExponentialAuctionTakerAmount(uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256)",
            auctionOrder_.sellingAmount,
            auctionOrder_.maxPurchasingAmount,
            auctionOrder_.minPurchasingAmount,
            auctionOrder_.startedAt, 
            auctionOrder_.endedAt,
            auctionOrder_.pricingDirection == PricingDirection.INCREASING,
            auctionOrder_.pricingFunctionParams[0],
            0
          );

    getTakerAmount = abi.encodeWithSignature("arbitraryStaticCall(address,bytes)", auctionHelperContract, getTakerAmount);

    getTakerAmount = _slice(getTakerAmount, 0, getTakerAmount.length - 60);
  }

  function _preparePredicate(
    AuctionOrder memory auctionOrder_,
    address maker_,
    uint256 nonce_
  ) internal view returns (bytes memory predicate) {
    address[] memory addressArgs = new address[](2);
    addressArgs[0] = auctionHelperContract;
    addressArgs[1] = auctionHelperContract;

    bytes[] memory bytesArgs = new bytes[](2);
    bytesArgs[0] = abi.encodeWithSignature("nonceEquals(address,uint256)", maker_, nonce_);
    bytesArgs[1] = abi.encodeWithSignature("timestampBelow(uint256)", auctionOrder_.endedAt);

    predicate = abi.encodeWithSignature("and(address[],bytes[])", addressArgs, bytesArgs);
  }

  function _prepareInteraction(
    AuctionOrder memory auctionOrder_,
    address maker_
  ) internal view returns (bytes memory interaction) {
    bytes memory interactionData = abi.encode(
      maker_,
      !auctionOrder_.partialFill ? auctionOrder_.sellingAmount : 0,
      auctionOrder_.startedAt
    );

    interaction = abi.encodePacked(auctionHelperContract, interactionData);
  }

  function _slice(
    bytes memory _bytes,
    uint256 _start,
    uint256 _length
  ) internal pure returns (bytes memory) {
    require(_length + 31 >= _length, "slice_overflow");
    require(_bytes.length >= _start + _length, "slice_outOfBounds");

    bytes memory tempBytes;

    assembly {
      switch iszero(_length)
      case 0 {
        // Get a location of some free memory and store it in tempBytes as
        // Solidity does for memory variables.
        tempBytes := mload(0x40)

        // The first word of the slice result is potentially a partial
        // word read from the original array. To read it, we calculate
        // the length of that partial word and start copying that many
        // bytes into the array. The first word we copy will start with
        // data we don't care about, but the last `lengthmod` bytes will
        // land at the beginning of the contents of the new array. When
        // we're done copying, we overwrite the full first word with
        // the actual length of the slice.
        let lengthmod := and(_length, 31)

        // The multiplication in the next line is necessary
        // because when slicing multiples of 32 bytes (lengthmod == 0)
        // the following copy loop was copying the origin's length
        // and then ending prematurely not copying everything it should.
        let mc := add(add(tempBytes, lengthmod), mul(0x20, iszero(lengthmod)))
        let end := add(mc, _length)

        for {
          // The multiplication in the next line has the same exact purpose
          // as the one above.
          let cc := add(add(add(_bytes, lengthmod), mul(0x20, iszero(lengthmod))), _start)
        } lt(mc, end) {
          mc := add(mc, 0x20)
          cc := add(cc, 0x20)
        } {
          mstore(mc, mload(cc))
        }

        mstore(tempBytes, _length)

        //update free-memory pointer
        //allocating the array padded to 32 bytes like the compiler does now
        mstore(0x40, and(add(mc, 31), not(31)))
      }
      //if we want a zero-length slice let's just return a zero-length array
      default {
        tempBytes := mload(0x40)
        //zero out the 32 bytes slice we are about to return
        //we need to do it because Solidity does not garbage collect
        mstore(tempBytes, 0)

        mstore(0x40, add(tempBytes, 0x20))
      }
    }

    return tempBytes;
  }
}
