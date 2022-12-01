// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract Misc {
  function timestampBelow(uint256 time) external view returns(bool) {
    return block.timestamp < time;
  }

  function timestampAbove(uint256 time) public view returns(bool) {
    return block.timestamp > time;
  }
}
