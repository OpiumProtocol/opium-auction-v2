// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/interfaces/IERC1271.sol";

import "../helpers/Types.sol";
import "../helpers/EIP712Alien.sol";

abstract contract UsingLimitOrderProtocolV2 is IERC1271, EIP712Alien {
  bytes32 constant private _LIMIT_ORDER_TYPEHASH = keccak256(
    "Order(uint256 salt,address makerAsset,address takerAsset,address maker,address receiver,address allowedSender,uint256 makingAmount,uint256 takingAmount,bytes makerAssetData,bytes takerAssetData,bytes getMakerAmount,bytes getTakerAmount,bytes predicate,bytes permit,bytes interaction)"
  );

  address public immutable limitOrderProtocol;

  constructor(address limitOrderProtocol_) EIP712Alien(limitOrderProtocol_, "1inch Limit Order Protocol", "2") {
    limitOrderProtocol = limitOrderProtocol_;
  }

  function isValidSignature(bytes32 hash, bytes memory signature) public view returns(bytes4) {
    Types.Order memory order = abi.decode(signature, (Types.Order));

    require(
      hashOrder(order) == hash &&
      _isValidOrder(order)
    );

    return this.isValidSignature.selector;
  }

  function _isValidOrder(Types.Order memory order_) internal view virtual returns (bool);

  function hashOrder(Types.Order memory order) public view returns(bytes32) {
    Types.StaticOrder memory staticOrder;
    assembly {  // solhint-disable-line no-inline-assembly
      staticOrder := order
    }
    return _hashTypedDataV4(
      keccak256(
        abi.encode(
          _LIMIT_ORDER_TYPEHASH,
          staticOrder,
          keccak256(order.makerAssetData),
          keccak256(order.takerAssetData),
          keccak256(order.getMakerAmount),
          keccak256(order.getTakerAmount),
          keccak256(order.predicate),
          keccak256(order.permit),
          keccak256(order.interaction)
        )
      )
    );
  }
}
