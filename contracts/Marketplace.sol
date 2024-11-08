// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./interfaces/IMarketplace.sol";

contract Marketplace is
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ERC721HolderUpgradeable,
    ERC1155HolderUpgradeable,
    IMarketPlace
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    mapping(address => Royalty) public royaltyInfos;
    mapping(address => mapping(uint256 => bool)) private blacklistedTokenIds;
    mapping(uint256 => SellInfo) public sellInfos;
    mapping(uint256 => AuctionInfo) public auctionInfos;
    mapping(address => bool) public allowedTokens;
    mapping(address => bool) public blacklistedUser;
    mapping(address => EnumerableSet.UintSet) private userSaleIds;
    mapping(address => EnumerableSet.UintSet) private userAuctionIds;
    mapping(address => mapping(address => EnumerableSet.UintSet))
        private userOfferIds;
    mapping(uint256 => OfferInfo) public offerInfos;

    ILaunchPad public launchPad;
    address public wrapperGateway;

    uint256 public saleId;
    uint256 public auctionId;
    uint256 public offerId;
    uint256 public maxAuctionTime;

    uint16 public platformFee;
    uint16 public constant FIXED_POINT = 1000;

    EnumerableSet.UintSet private availableSaleIds;
    EnumerableSet.UintSet private availableAuctionIds;
    EnumerableSet.UintSet private availableOfferIds;

    modifier whenNotScammer() {
        require(!blacklistedUser[msg.sender], "blacklisted user");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _launchPad,
        uint16 _platformFee
    ) public initializer {
        __Ownable_init();
        require(_launchPad != address(0), "zero launchPad address");
        require(_platformFee < FIXED_POINT, "invalid platform fee");

        platformFee = _platformFee;
        launchPad = ILaunchPad(_launchPad);
        maxAuctionTime = 10 days;
    }

    /// @inheritdoc IMarketPlace
    function setWrapperGateway(
        address _wrapperGateway
    ) external override onlyOwner {
        require(
            _wrapperGateway != address(0),
            "invalid wrapperGateway contract address"
        );
        wrapperGateway = _wrapperGateway;
    }

    /// @inheritdoc IMarketPlace
    function setPlatformFee(uint16 _platformFee) external override onlyOwner {
        require(_platformFee < FIXED_POINT, "invalid platform fee");
        platformFee = _platformFee;

        emit PlatformFeeSet(_platformFee);
    }

    /// @inheritdoc IMarketPlace
    function setMaxAuctionTime(
        uint256 _maxAuctionTime
    ) external override onlyOwner {
        require(_maxAuctionTime > 0, "invalid maxAuctionTime");
        emit MaxAuctionTimeSet(maxAuctionTime = _maxAuctionTime);
    }

    /// @inheritdoc IMarketPlace
    function setLaunchPad(address _launchPad) external override onlyOwner {
        require(_launchPad != address(0), "zero launchPad address");
        launchPad = ILaunchPad(_launchPad);

        emit LaunchPadSet(_launchPad);
    }

    /// @inheritdoc IMarketPlace
    function setAllowedToken(
        address[] memory _tokens,
        bool _isAdd
    ) external override onlyOwner {
        uint256 length = _tokens.length;
        require(length > 0, "invalid length");
        for (uint256 i = 0; i < length; i++) {
            allowedTokens[_tokens[i]] = _isAdd;
        }

        emit AllowedTokenSet(_tokens, _isAdd);
    }

    /// @inheritdoc IMarketPlace
    function setBlockedTokenIds(
        address[] memory _collections,
        uint256[] memory _tokenIds,
        bool _isAdd
    ) external override onlyOwner {
        uint256 length = _collections.length;
        require(length > 0 && length == _tokenIds.length, "length dismatched");

        for (uint256 i = 0; i < length; i++) {
            blacklistedTokenIds[_collections[i]][_tokenIds[i]] = _isAdd;
        }

        emit BlockedTokenIdsSet(_collections, _tokenIds, _isAdd);
    }

    /// @inheritdoc IMarketPlace
    function setBlacklistedUser(
        address[] memory _users,
        bool _isAdd
    ) external override onlyOwner {
        uint256 length = _users.length;
        require(length > 0, "invalid length");
        for (uint256 i = 0; i < length; i++) {
            blacklistedUser[_users[i]] = _isAdd;
        }

        emit BlacklistedUserSet(_users, _isAdd);
    }

    /// @inheritdoc IMarketPlace
    function setRoyalty(
        address _collection,
        uint16 _royaltyRate
    ) external override whenNotPaused whenNotScammer {
        address sender = msg.sender;
        require(_collection != address(0), "zero collection address");
        require(_royaltyRate < FIXED_POINT, "invalid royalty fee");
        require(
            ICollection(_collection).owner() == sender,
            "not collection owner"
        );

        royaltyInfos[_collection] = Royalty(sender, _royaltyRate);

        emit RoyaltySet(sender, _collection, _royaltyRate);
    }

    /// @inheritdoc IMarketPlace
    function pause() external override whenNotPaused onlyOwner {
        _pause();
        emit Pause();
    }

    /// @inheritdoc IMarketPlace
    function unpause() external override whenPaused onlyOwner {
        _unpause();
        emit Unpause();
    }

    /// @inheritdoc IMarketPlace
    function createERC721Collection(
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        uint256 _maxMintAmount,
        string memory _name,
        string memory _symbol,
        string memory _baseURI
    ) external override whenNotPaused whenNotScammer {
        address sender = msg.sender;
        address deployedCollection = launchPad.deployCollection(
            _maxSupply,
            _mintPrice,
            _startTimestamp,
            _endTimestamp,
            _maxMintAmount,
            sender,
            _name,
            _symbol,
            _baseURI
        );

        emit ERC721CollectionCreated(
            sender,
            deployedCollection,
            _maxSupply,
            _mintPrice,
            _endTimestamp,
            _name,
            _symbol
        );
    }

    /// Buy

    /// @inheritdoc IMarketPlace
    function listERC1155ForSale(
        address _tokenAddress,
        address _paymentToken,
        uint256 _tokenId,
        uint256 _quantity,
        uint256 _price
    ) external override whenNotPaused whenNotScammer {
        address sender = msg.sender;
        _checkListERC1155Condition(
            sender,
            _tokenAddress,
            _paymentToken,
            _tokenId,
            _quantity
        );

        _setSaleId(saleId, sender, true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = _tokenId;
        sellInfos[saleId++] = SellInfo(
            sender,
            _tokenAddress,
            _paymentToken,
            tokenIds,
            _quantity,
            _price,
            false
        );
        IERC1155(_tokenAddress).safeTransferFrom(
            sender,
            address(this),
            _tokenId,
            _quantity,
            ""
        );

        emit ERC1155ForSaleListed(
            sender,
            _tokenAddress,
            _paymentToken,
            _tokenId,
            _quantity,
            _price,
            saleId - 1
        );
    }

    /// @inheritdoc IMarketPlace
    function listERC721ForSale(
        address _tokenAddress,
        address _paymentToken,
        uint256[] memory _tokenIds,
        uint256 _price
    ) external override whenNotPaused whenNotScammer {
        address sender = msg.sender;
        _checkListERC721Condition(
            sender,
            _tokenAddress,
            _paymentToken,
            _tokenIds
        );

        _setSaleId(saleId, sender, true);
        sellInfos[saleId++] = SellInfo(
            sender,
            _tokenAddress,
            _paymentToken,
            _tokenIds,
            1,
            _price,
            true
        );
        _batchERC721Transfer(sender, address(this), _tokenAddress, _tokenIds);

        emit ERC721ForSaleListed(
            sender,
            _tokenAddress,
            _paymentToken,
            _tokenIds,
            _price,
            saleId - 1
        );
    }

    /// @inheritdoc IMarketPlace
    function closeSale(
        uint256 _saleId
    ) external override nonReentrant whenNotPaused {
        require(availableSaleIds.contains(_saleId), "not exists saleId");
        SellInfo memory sellInfo = sellInfos[_saleId];
        require(msg.sender == sellInfo.seller, "no permission");

        _transferNFT(
            address(this),
            sellInfo.seller,
            sellInfo.collectionAddress,
            sellInfo.tokenIds,
            sellInfo.quantity,
            sellInfo.isERC721
        );
        _setSaleId(_saleId, sellInfo.seller, false);

        emit SaleClosed(_saleId);
    }

    /// @inheritdoc IMarketPlace
    function changeSalePrice(
        uint256 _saleId,
        uint256 _newPrice,
        address _paymentToken
    ) external override nonReentrant whenNotPaused {
        address sender = msg.sender;
        require(availableSaleIds.contains(_saleId), "not exists saleId");
        require(sellInfos[_saleId].seller == sender, "not seller");
        require(allowedTokens[_paymentToken], "not allowed payment token");

        emit SalePriceChanged(
            _saleId,
            sellInfos[_saleId].paymentToken,
            sellInfos[_saleId].price,
            _paymentToken,
            _newPrice
        );
        sellInfos[_saleId].price = _newPrice;
        sellInfos[_saleId].paymentToken = _paymentToken;
    }

    /// @inheritdoc IMarketPlace
    function getAvailableSaleIds()
        external
        view
        override
        returns (uint256[] memory)
    {
        return availableSaleIds.values();
    }

    /// @inheritdoc IMarketPlace
    function buyNFT(
        uint256 _saleId
    ) external override whenNotPaused nonReentrant whenNotScammer {
        address sender = msg.sender;
        SellInfo memory sellInfo = sellInfos[_saleId];
        require(availableSaleIds.contains(_saleId), "not exists saleId");
        require(sellInfo.seller != sender, "caller is seller");

        address paymentToken = sellInfo.paymentToken;
        _transferPaymentTokenWithFee(
            sellInfo.collectionAddress,
            paymentToken,
            sender,
            sellInfo.seller,
            sellInfo.price,
            true
        );
        _transferNFT(
            address(this),
            sender != wrapperGateway ? sender : tx.origin,
            sellInfo.collectionAddress,
            sellInfo.tokenIds,
            sellInfo.quantity,
            sellInfo.isERC721
        );

        _setSaleId(_saleId, sellInfo.seller, false);

        emit NFTBought(
            sender,
            sellInfo.collectionAddress,
            sellInfo.tokenIds,
            sellInfo.quantity,
            paymentToken,
            sellInfo.price,
            _saleId
        );
    }

    /// Auction

    /// @inheritdoc IMarketPlace
    function listERC721ForAuction(
        address _tokenAddress,
        address _paymentToken,
        uint256[] memory _tokenIds,
        uint256 _startPrice,
        uint256 _endTimestamp,
        bool _isTimeAuction
    ) external override whenNotPaused whenNotScammer {
        address sender = msg.sender;
        _checkListERC721Condition(
            sender,
            _tokenAddress,
            _paymentToken,
            _tokenIds
        );
        uint256 endTime = _checkAuctionTime(_isTimeAuction, _endTimestamp);
        uint256 curAuctionId = auctionId++;

        _setAuctionId(curAuctionId, sender, true);
        auctionInfos[curAuctionId] = AuctionInfo(
            sender,
            _tokenAddress,
            _paymentToken,
            address(0),
            _tokenIds,
            1,
            _startPrice,
            endTime,
            _startPrice,
            true,
            _isTimeAuction
        );
        _batchERC721Transfer(sender, address(this), _tokenAddress, _tokenIds);

        emit ERC721ForAuctionListed(
            sender,
            _tokenAddress,
            _paymentToken,
            curAuctionId,
            _tokenIds,
            _startPrice,
            endTime,
            _isTimeAuction
        );
    }

    /// @inheritdoc IMarketPlace
    function listERC1155ForAuction(
        address _tokenAddress,
        address _paymentToken,
        uint256 _tokenId,
        uint256 _quantity,
        uint256 _startPrice,
        uint256 _endTimestamp,
        bool _isTimeAuction
    ) external override whenNotPaused whenNotScammer {
        address sender = msg.sender;
        _checkListERC1155Condition(
            sender,
            _tokenAddress,
            _paymentToken,
            _tokenId,
            _quantity
        );
        uint256 endTime = _checkAuctionTime(_isTimeAuction, _endTimestamp);
        uint256 curAuctionId = (auctionId++);

        _setAuctionId(curAuctionId, sender, true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = _tokenId;
        auctionInfos[curAuctionId] = AuctionInfo(
            sender,
            _tokenAddress,
            _paymentToken,
            address(0),
            tokenIds,
            1,
            _startPrice,
            endTime,
            _startPrice,
            false,
            _isTimeAuction
        );
        IERC1155(_tokenAddress).safeTransferFrom(
            sender,
            address(this),
            _tokenId,
            _quantity,
            ""
        );

        emit ERC1155ForAuctionListed(
            sender,
            _tokenAddress,
            _paymentToken,
            curAuctionId,
            _tokenId,
            _quantity,
            _startPrice,
            endTime,
            _isTimeAuction
        );
    }

    /// @inheritdoc IMarketPlace
    function getAvailableAuctionIds()
        external
        view
        override
        returns (uint256[] memory)
    {
        return availableAuctionIds.values();
    }

    /// @inheritdoc IMarketPlace
    function placeBid(
        uint256 _auctionId,
        uint256 _amount
    ) external override whenNotPaused whenNotScammer {
        address sender = msg.sender;
        AuctionInfo storage auctionInfo = auctionInfos[_auctionId];
        require(
            availableAuctionIds.contains(_auctionId),
            "not exists auctionId"
        );
        require(auctionInfo.auctionMaker != sender, "bider is auction maker");
        require(auctionInfo.startPrice < _amount, "low price");
        require(
            auctionInfo.winPrice < _amount,
            "lower price than last win price"
        );

        if (auctionInfo.isTimeAuction) {
            require(
                block.timestamp < auctionInfo.endTimestamp,
                "over auction duration"
            );
        }

        address prevWinner = auctionInfo.winner;
        uint256 prevWinPrice = auctionInfo.winPrice;
        auctionInfo.winner = sender;
        auctionInfo.winPrice = _amount;

        /// Return bid amount to prev winner.
        if (prevWinner != address(0)) {
            IERC20(auctionInfo.paymentToken).safeTransfer(
                prevWinner,
                prevWinPrice
            );
        }
        IERC20(auctionInfo.paymentToken).safeTransferFrom(
            sender,
            address(this),
            _amount
        );

        emit BidPlaced(sender, _auctionId, _amount);
    }

    /// @inheritdoc IMarketPlace
    function closeAuction(
        uint256 _auctionId
    ) external override whenNotPaused onlyOwner {
        AuctionInfo memory auctionInfo = auctionInfos[_auctionId];
        require(
            availableAuctionIds.contains(_auctionId),
            "not exists auctionId"
        );
        _setAuctionId(_auctionId, auctionInfo.auctionMaker, false);

        _transferNFT(
            address(this),
            auctionInfo.auctionMaker,
            auctionInfo.collectionAddress,
            auctionInfo.tokenIds,
            auctionInfo.quantity,
            auctionInfo.isERC721
        );

        if (auctionInfo.winner == address(0)) {
            return;
        }

        _transferPaymentTokenWithFee(
            auctionInfo.collectionAddress,
            auctionInfo.paymentToken,
            address(this),
            auctionInfo.winner,
            auctionInfo.winPrice,
            false
        );

        emit AuctionClosed(_auctionId);
    }

    /// @inheritdoc IMarketPlace
    function getAuctionCollection(
        uint256 _auctionId
    ) external view override returns (address, uint256[] memory) {
        AuctionInfo memory auctionInfo = auctionInfos[_auctionId];
        return (auctionInfo.collectionAddress, auctionInfo.tokenIds);
    }

    /// @inheritdoc IMarketPlace
    function finishAuction(uint256 _auctionId) external override whenNotPaused {
        address sender = msg.sender;
        AuctionInfo memory auctionInfo = auctionInfos[_auctionId];
        require(
            availableAuctionIds.contains(_auctionId),
            "not exists auctionId"
        );
        if (auctionInfo.isTimeAuction) {
            require(
                block.timestamp >= auctionInfo.endTimestamp,
                "before auction maturity"
            );
            require(
                auctionInfo.auctionMaker == sender ||
                    auctionInfo.winner == sender,
                "no permission"
            );
        } else {
            require(auctionInfo.auctionMaker == sender, "no permission");
        }

        _setAuctionId(_auctionId, auctionInfo.auctionMaker, false);

        address collectionRecipient = auctionInfo.winner == address(0)
            ? auctionInfo.auctionMaker
            : auctionInfo.winner;

        _transferNFT(
            address(this),
            collectionRecipient,
            auctionInfo.collectionAddress,
            auctionInfo.tokenIds,
            auctionInfo.quantity,
            auctionInfo.isERC721
        );

        if (auctionInfo.winner == address(0)) {
            return;
        }

        _transferPaymentTokenWithFee(
            auctionInfo.collectionAddress,
            auctionInfo.paymentToken,
            address(this),
            auctionInfo.auctionMaker,
            auctionInfo.winPrice,
            true
        );

        emit AuctionFinished(
            _auctionId,
            auctionInfo.auctionMaker,
            collectionRecipient,
            auctionInfo.collectionAddress,
            auctionInfo.tokenIds,
            auctionInfo.paymentToken,
            auctionInfo.winPrice
        );
    }

    /// Offer

    /// @inheritdoc IMarketPlace
    function placeOffer(
        OfferInfo memory _offerInfo
    ) external override whenNotPaused whenNotScammer {
        address sender = msg.sender;
        require(_offerInfo.offeror == sender, "not correct offeror");
        require(_offerInfo.quantity > 0, "zero quantity");
        require(
            allowedTokens[_offerInfo.paymentToken],
            "not allowed payment token"
        );
        require(
            !blacklistedTokenIds[_offerInfo.collectionAddress][
                _offerInfo.tokenId
            ],
            "blacklisted collectionId"
        );
        require(
            IERC20(_offerInfo.paymentToken).allowance(sender, address(this)) >=
                _offerInfo.offerPrice,
            "not enough allowance"
        );

        if (_offerInfo.isERC721) {
            require(
                IERC721(_offerInfo.collectionAddress).ownerOf(
                    _offerInfo.tokenId
                ) == _offerInfo.owner,
                "not correct collection owner"
            );
            require(_offerInfo.quantity == 1, "not correct quantity");
        } else {
            require(
                IERC1155(_offerInfo.collectionAddress).balanceOf(
                    _offerInfo.owner,
                    _offerInfo.tokenId
                ) >= _offerInfo.quantity,
                "not enough NFT balance"
            );
        }

        availableOfferIds.add(offerId);
        userOfferIds[_offerInfo.owner][_offerInfo.collectionAddress].add(
            offerId
        );
        offerInfos[offerId++] = _offerInfo;

        emit OfferPlaced(
            _offerInfo.owner,
            _offerInfo.offeror,
            _offerInfo.collectionAddress,
            _offerInfo.tokenId,
            _offerInfo.quantity,
            _offerInfo.offerPrice,
            offerId - 1
        );
    }

    /// @inheritdoc IMarketPlace
    function getAvailableOffers(
        address _account,
        address _tokenAddress
    )
        external
        view
        override
        whenNotScammer
        returns (OfferInfo[] memory, uint256[] memory)
    {
        uint256 length = userOfferIds[_account][_tokenAddress].length();
        OfferInfo[] memory availableOffers = new OfferInfo[](length);
        uint256[] memory availableIds = userOfferIds[_account][_tokenAddress]
            .values();
        if (length == 0) {
            return (availableOffers, availableIds);
        }

        for (uint256 i = 0; i < length; i++) {
            uint256 id = availableIds[i];
            availableOffers[i] = offerInfos[id];
        }

        return (availableOffers, availableIds);
    }

    /// @inheritdoc IMarketPlace
    function acceptOffer(uint256 _offerId) external override whenNotPaused {
        address sender = msg.sender;
        OfferInfo memory offerInfo = offerInfos[_offerId];
        require(availableOfferIds.contains(_offerId), "not exists offerId");
        require(offerInfo.owner == sender, "no permission");
        if (offerInfo.isERC721) {
            IERC721(offerInfo.collectionAddress).transferFrom(
                offerInfo.owner,
                offerInfo.offeror,
                offerInfo.tokenId
            );
        } else {
            IERC1155(offerInfo.collectionAddress).safeTransferFrom(
                offerInfo.owner,
                offerInfo.offeror,
                offerInfo.tokenId,
                offerInfo.quantity,
                ""
            );
        }

        _transferPaymentTokenWithFee(
            offerInfo.collectionAddress,
            offerInfo.paymentToken,
            offerInfo.offeror,
            offerInfo.owner,
            offerInfo.offerPrice,
            true
        );

        _removeAllOfferIds(sender, offerInfo.collectionAddress);

        emit OfferAccepted(
            offerInfo.owner,
            offerInfo.offeror,
            offerInfo.collectionAddress,
            offerInfo.tokenId,
            offerInfo.quantity,
            offerInfo.offerPrice,
            _offerId
        );
    }

    function _batchERC721Transfer(
        address _from,
        address _to,
        address _collection,
        uint256[] memory _tokenIds
    ) internal {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            IERC721(_collection).transferFrom(_from, _to, _tokenIds[i]);
        }
    }

    function _setSaleId(
        uint256 _saleId,
        address _seller,
        bool _isAdd
    ) internal {
        if (_isAdd) {
            availableSaleIds.add(_saleId);
            userSaleIds[_seller].add(_saleId);
        } else {
            availableSaleIds.remove(_saleId);
            userSaleIds[_seller].remove(_saleId);
        }
    }

    function _setAuctionId(
        uint256 _auctionId,
        address _auctionMaker,
        bool _isAdd
    ) internal {
        if (_isAdd) {
            availableAuctionIds.add(_auctionId);
            userAuctionIds[_auctionMaker].add(_auctionId);
        } else {
            availableAuctionIds.remove(_auctionId);
            userAuctionIds[_auctionMaker].remove(_auctionId);
        }
    }

    function _checkListERC721Condition(
        address _lister,
        address _tokenAddress,
        address _paymentToken,
        uint256[] memory _tokenIds
    ) internal view {
        uint256 length = _tokenIds.length;
        require(_tokenAddress != address(0), "zero collection address");
        require(length > 0, "zero tokenIDs");
        require(allowedTokens[_paymentToken], "not allowed payment token");

        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = _tokenIds[i];
            require(
                !blacklistedTokenIds[_tokenAddress][tokenId],
                "blacklisted collectionId"
            );
            require(
                IERC721(_tokenAddress).ownerOf(tokenId) == _lister,
                "not collection Owner"
            );
        }
    }

    function _checkListERC1155Condition(
        address _lister,
        address _tokenAddress,
        address _paymentToken,
        uint256 _tokenId,
        uint256 _quantity
    ) internal view {
        require(_tokenAddress != address(0), "zero collection address");
        require(_quantity > 0, "zero quantity");
        require(
            !blacklistedTokenIds[_tokenAddress][_tokenId],
            "blacklisted collectionId"
        );
        require(
            IERC1155(_tokenAddress).balanceOf(_lister, _tokenId) > _quantity,
            "not enough balance"
        );
        require(allowedTokens[_paymentToken], "not allowed payment token");
    }

    function _removeAllOfferIds(
        address _owner,
        address _collectionAddress
    ) internal {
        uint256[] memory values = userOfferIds[_owner][_collectionAddress]
            .values();
        uint256 length = values.length;
        for (uint256 i = 0; i < length; i++) {
            uint256 value = values[i];
            userOfferIds[_owner][_collectionAddress].remove(value);
            availableOfferIds.remove(value);
        }
    }

    function _transferPaymentTokenWithFee(
        address _collectionAddress,
        address _paymentToken,
        address _from,
        address _to,
        uint256 _amount,
        bool _takeFee
    ) internal {
        if (_from != address(this)) {
            IERC20(_paymentToken).safeTransferFrom(
                _from,
                address(this),
                _amount
            );
        }

        if (_takeFee) {
            Royalty memory royalty = royaltyInfos[_collectionAddress];
            uint256 feeAmount = (_amount * platformFee) / FIXED_POINT;
            uint256 royaltyAmount = (_amount * royalty.royaltyRate) /
                FIXED_POINT;
            uint256 transferAmount = _amount - feeAmount - royaltyAmount;
            IERC20(_paymentToken).safeTransfer(_to, transferAmount);
            if (royaltyAmount > 0 && royalty.collectionOwner != address(0)) {
                IERC20(_paymentToken).safeTransfer(
                    royalty.collectionOwner,
                    royaltyAmount
                );
            }
        } else {
            IERC20(_paymentToken).safeTransfer(_to, _amount);
        }
    }

    function _transferNFT(
        address _from,
        address _to,
        address _collectionAddress,
        uint256[] memory _tokenIds,
        uint256 _quantity,
        bool _isERC721
    ) internal {
        if (_isERC721) {
            _batchERC721Transfer(_from, _to, _collectionAddress, _tokenIds);
        } else {
            IERC1155(_collectionAddress).safeTransferFrom(
                _from,
                _to,
                _tokenIds[0],
                _quantity,
                ""
            );
        }
    }

    function _checkAuctionTime(
        bool _isTimeAuction,
        uint256 _endTimestamp
    ) internal view returns (uint256) {
        require(
            !_isTimeAuction || _endTimestamp > block.timestamp,
            "invalid endTime"
        );
        if (_isTimeAuction) {
            uint256 auctionDuration = _endTimestamp - block.timestamp;
            require(auctionDuration <= maxAuctionTime, "over maxAuctionTime");
        }

        return _isTimeAuction ? _endTimestamp : 0;
    }

    uint256[100] private __gaps;
}
