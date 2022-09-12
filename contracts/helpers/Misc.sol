// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract Misc {
    function arbitraryStaticCall(address target, bytes memory data) external view {}
    function and(address[] calldata targets, bytes[] calldata data) external view {}

    function timestampBelow(uint256 time) external view returns(bool) {
        return block.timestamp < time;
    }

    function timestampAbove(uint256 time) public view returns(bool) {
        return block.timestamp > time;
    }
}
