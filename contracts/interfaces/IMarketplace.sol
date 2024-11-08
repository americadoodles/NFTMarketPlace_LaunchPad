// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./ICollection.sol";
import "./ILaunchPad.sol";

interface IMarketPlace {
    struct SellInfo {
        address seller;
        address collectionAddress;
        address paymentToken;
        uint256[] tokenIds;
        uint256 quantity;
        uint256 price;
        bool isERC721;
    }

    struct AuctionInfo {
        address auctionMaker;
        address collectionAddress;
        address paymentToken;
        address winner;
        uint256[] tokenIds;
        uint256 quantity;
        uint256 startPrice;
        uint256 endTimestamp;
        uint256 winPrice;
        bool isERC721;
        bool isTimeAuction;
    }

    struct OfferInfo {
        address owner;
        address offeror;
        address paymentToken;
        address collectionAddress;
        uint256 tokenId;
        uint256 quantity;
        uint256 offerPrice;
        bool isERC721;
    }

    struct Royalty {
        address collectionOwner;
        uint16 royaltyRate;
    }

    /// @notice Set marketplace platform fee.
    /// @dev Only owner can call this function.
    function setPlatformFee(uint16 _platformFee) external;

    /// @notice Set wrapperGateway contract address.
    /// @dev Only owner can call this function.
    function setWrapperGateway(address _wrapperGateway) external;

    /// @notice Set maxAuctionTime.
    /// @dev Only owner can call this function.
    function setMaxAuctionTime(uint256 _maxAuctionTime) external;

    /// @notice Set launch pad address.
    /// @dev Only owner can call this function.
    function setLaunchPad(address _launchPad) external;

    /// @notice Set allowed payment token.
    /// @dev Users can't trade NFT with token that not allowed.
    ///      Only owner can call this function.
    /// @param _tokens The token addresses.
    /// @param _isAdd Add/Remove = true/false
    function setAllowedToken(address[] memory _tokens, bool _isAdd) external;

    /// @notice Set blocked collections for trading.
    /// @dev The collections that registered as blocked collection can't be trade.
    ///      Only owner can call this function.
    function setBlockedTokenIds(
        address[] memory _collections,
        uint256[] memory _tokenIds,
        bool _isAdd
    ) external;

    /// @notice Add/Remove users to blacklist.
    /// @dev Only owner can call this function.
    function setBlacklistedUser(address[] memory _users, bool _isAdd) external;

    /// @notice Set royalty for collection.
    /// @dev Only collection owner can call this function.
    ///      To do this, collection should inherit Ownable contract so that
    ///      marketplace can get owner of that and check the permission.
    ///      Collections that didn't inherit ownable, can't set royalty for them.
    function setRoyalty(address _collection, uint16 _royaltyRate) external;

    /// @notice Pause marketplace
    /// @dev Only owner can call this function.
    function pause() external;

    /// @notice Unpause marketplace
    /// @dev Only owner can call this function.
    function unpause() external;

    /// Create ERC721A

    /// @notice Create collection using ERC721A.
    /// @param _maxSupply       Max number of ERC721A can be mint.
    /// @param _mintPrice       Price to mint. (ETH)
    /// @param _startTimestamp  The unix timestamp that users can start to mint.
    /// @param _endTimestamp    The unix timestamp to finish minting.
    /// @param _maxMintAmount   The max amount that a user can mint.
    /// @param _name            Collection name.
    /// @param _symbol          Collection symbol.
    /// @param _baseURI         Collection baseURI.
    function createERC721Collection(
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        uint256 _maxMintAmount,
        string memory _name,
        string memory _symbol,
        string memory _baseURI
    ) external;

    /// Buy

    /// @notice List ERC1155 collection for sale.
    /// @dev Only collection owner can call this function.
    ///      Btw, collection owners should send their collection to marketplace.
    function listERC1155ForSale(
        address _tokenAddress,
        address _paymentToken,
        uint256 _tokenId,
        uint256 _quantity,
        uint256 _price
    ) external;

    /// @notice List ERC721 collection for sale.
    /// @dev Only collection owner can call this function.
    ///      Btw, collection owners should send their collection to marketplace.
    function listERC721ForSale(
        address _tokenAddress,
        address _paymentToken,
        uint256[] memory _tokenIds,
        uint256 _price
    ) external;

    /// @notice Close sale and retrived listed NFT for sale.
    /// @dev Only sale creator can call this function.
    function closeSale(uint256 _saleId) external;

    /// @notice Change sale price after listed collection for sale.
    /// @dev Only sale creator can call this function.
    function changeSalePrice(
        uint256 _saleId,
        uint256 _newPrice,
        address _paymentToken
    ) external;

    /// @notice Get available saleIds.
    function getAvailableSaleIds() external view returns (uint256[] memory);

    /// @notice Buy collection with saleId.
    /// @dev Buyer can't same as seller.
    function buyNFT(uint256 _saleId) external;

    /// Auction

    /// @notice list ERC721 collection for auction.
    /// @dev Similar to sale, sellers should transfer their collection to marketplace.
    /// @param _tokenAddress    The address of collection.
    /// @param _paymentToken    The address of token that winner should pay with.
    /// @param _tokenIds        The ids of collection.
    /// @param _startPrice      Min price for sell.
    /// @param _endTimestamp    Auction endTimestamp.
    /// @param _isTimeAuction   Status that this is time auction or not.
    function listERC721ForAuction(
        address _tokenAddress,
        address _paymentToken,
        uint256[] memory _tokenIds,
        uint256 _startPrice,
        uint256 _endTimestamp,
        bool _isTimeAuction
    ) external;

    /// @notice list ERC1155 collection for auction.
    /// @dev Similar to sale, sellers should transfer their collection to marketplace.
    /// @param _tokenAddress    The address of collection.
    /// @param _paymentToken    The address of token that winner should pay with.
    /// @param _tokenId         The id of collection.
    /// @param _quantity        The number of collection for auction.
    /// @param _startPrice      Min price for sell.
    /// @param _endTimestamp    Auction duration time. it's available when only it's time auction.
    /// @param _isTimeAuction   Status that this is time auction or not.
    function listERC1155ForAuction(
        address _tokenAddress,
        address _paymentToken,
        uint256 _tokenId,
        uint256 _quantity,
        uint256 _startPrice,
        uint256 _endTimestamp,
        bool _isTimeAuction
    ) external;

    /// @notice Get available ids of auction.
    function getAvailableAuctionIds() external view returns (uint256[] memory);

    /// @notice Get collection information by auctionId.
    function getAuctionCollection(
        uint256 _auctionId
    ) external view returns (address, uint256[] memory);

    /// @notice Bid to auction with certain auction Id.
    /// @dev Users can get auctionIds from `getAvailableAuctionIds`
    /// @dev Bidder should bid with amount that higher than last winner's bid amount.
    /// @param _auctionId The id of auction.
    /// @param _amount The amount of token to bid.
    function placeBid(uint256 _auctionId, uint256 _amount) external;

    /// @notice Close auction with the certain auction id.
    /// @dev Caller should be platform owner. This function is for emergency.
    ///      If auction maker didn't finish auction for a long time, owner can finish this.
    function closeAuction(uint256 _auctionId) external;

    /// @notice Finish auction.
    /// @dev Caller should be the auction maker.
    ///      Winner receives the collection and auction maker gets token.
    function finishAuction(uint256 _auctionId) external;

    /// Offer

    /// @notice Anyone can place offer to certain collection.
    function placeOffer(OfferInfo memory _offerInfo) external;

    /// @notice Collection owner can get available offers by each collection.
    function getAvailableOffers(
        address _account,
        address _tokenAddress
    ) external view returns (OfferInfo[] memory, uint256[] memory);

    /// @notice Collection owner accept offer with certain offer Id.
    /// @dev Collection owner can get available offer ids from `geetAvailableOffers` function.
    function acceptOffer(uint256 _offerId) external;

    event PlatformFeeSet(uint16 platformFee);

    event MaxAuctionTimeSet(uint256 maxAuctionTime);

    event LaunchPadSet(address launchPad);

    event AllowedTokenSet(address[] tokens, bool isAdd);

    event BlockedTokenIdsSet(
        address[] collections,
        uint256[] tokenIds,
        bool isAdd
    );

    event BlacklistedUserSet(address[] users, bool isAdd);

    event RoyaltySet(address setter, address collection, uint16 royaltyRate);

    event Pause();

    event Unpause();

    event ERC721CollectionCreated(
        address creator,
        address collectionAddress,
        uint256 maxSupply,
        uint256 mintPrice,
        uint256 endTimestamp,
        string name,
        string symbol
    );

    event ERC1155ForSaleListed(
        address seller,
        address tokenAddress,
        address paymentToken,
        uint256 tokenId,
        uint256 quantity,
        uint256 price,
        uint256 saleId
    );

    event ERC721ForSaleListed(
        address seller,
        address tokenAddress,
        address paymentToken,
        uint256[] tokenIds,
        uint256 price,
        uint256 saleId
    );

    event SaleClosed(uint256 saleId);

    event SalePriceChanged(
        uint256 saleId,
        address oldPaymentToken,
        uint256 oldPrice,
        address newPaymentToken,
        uint256 newPrice
    );

    event NFTBought(
        address buyer,
        address collection,
        uint256[] tokenIds,
        uint256 quantity,
        address paymentToken,
        uint256 price,
        uint256 saleId
    );

    event ERC721ForAuctionListed(
        address auctionMaker,
        address tokenAddress,
        address paymentToken,
        uint256 auctionId,
        uint256[] tokenIds,
        uint256 startPrice,
        uint256 endTimestamp,
        bool isTimeAuction
    );

    event ERC1155ForAuctionListed(
        address auctionMaker,
        address tokenAddress,
        address paymentToken,
        uint256 auctionId,
        uint256 tokenId,
        uint256 quantity,
        uint256 startPrice,
        uint256 endTimestamp,
        bool isTimeAuction
    );

    event BidPlaced(address bidder, uint256 auctionId, uint256 bidPrice);

    event AuctionClosed(uint256 auctionId);

    event AuctionFinished(
        uint256 auctionId,
        address auctionMaker,
        address auctionWinner,
        address collection,
        uint256[] tokenIds,
        address paymentToken,
        uint256 winPrice
    );

    event OfferPlaced(
        address collectionOwner,
        address offeror,
        address collectionAddress,
        uint256 tokenId,
        uint256 quantity,
        uint256 offerPrice,
        uint256 offerId
    );

    event OfferAccepted(
        address acceptor,
        address offeror,
        address collectionAddress,
        uint256 tokenId,
        uint256 quantity,
        uint256 offerPrice,
        uint256 offerId
    );
}
