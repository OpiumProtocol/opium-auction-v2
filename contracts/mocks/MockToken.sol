//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
  uint8 private _decimals;

  constructor (string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
    _mint(msg.sender, 100_000e18);

    _decimals = decimals_;
  }

  function decimals() public view virtual override returns (uint8) {
    return _decimals;
  }
}
