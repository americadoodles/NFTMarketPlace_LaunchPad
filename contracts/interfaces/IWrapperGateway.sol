// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./IMarketplace.sol";
import "./IWETH9.sol";

interface IWrapperGateway {
    /// @notice Set marketplace contract address.
    /// @dev Only owner can call this function.
    function setMarketplace(address _marketplace) external;

    /// @notice Buy NFT with native token.
    /// @dev Call buy function of NFT marketplace with ERC20 that wrapped native token.
    function buyNFT(uint256 _saleId) external payable;
}
