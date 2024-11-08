// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MockERC721 is ERC721, Ownable {
   using Counters for Counters.Counter;
   Counters.Counter private tokenId;

   constructor(
      string memory name_,
      string memory symbol_
   ) ERC721(name_, symbol_) {}

   function mintNFT(uint256 amount_) external {
      for (uint256 i = 0; i < amount_; i ++) {
         _safeMint(msg.sender, tokenId.current());
         tokenId.increment();
      }
   }
}