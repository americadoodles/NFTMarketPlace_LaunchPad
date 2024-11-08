// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ERC721A.sol";
import "./interfaces/ILaunchPad.sol";
import "./interfaces/ICollection.sol";

contract LaunchPad is OwnableUpgradeable, ILaunchPad {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    mapping(address => EnumerableSet.AddressSet) private deployedCollections;

    modifier onlyCollectionOwner(address _collection) {
        require(
            deployedCollections[msg.sender].contains(_collection),
            "not collection owner"
        );
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
    }

    /// @inheritdoc ILaunchPad
    function deployCollection(
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _maxMintAmount,
        address _creator,
        string memory _name,
        string memory _symbol,
        string memory _baseURI
    ) external override returns (address) {
        address deployedCollection = address(new ERC721A());

        ICollection(deployedCollection).setBaseInfo(
            _maxSupply,
            _mintPrice,
            _startTime,
            _endTime,
            _maxMintAmount,
            _creator,
            _name,
            _symbol,
            _baseURI
        );

        deployedCollections[_creator].add(deployedCollection);

        emit CollectionDeployed(
            _creator,
            deployedCollection,
            _maxSupply,
            _mintPrice,
            _startTime,
            _endTime,
            _name,
            _symbol,
            _baseURI
        );

        return deployedCollection;
    }

    /// @inheritdoc ILaunchPad
    function getDeployedCollections(
        address _owner
    ) external view override returns (CollectionStatus[] memory) {
        uint256 length = deployedCollections[_owner].length();
        CollectionStatus[] memory collections = new CollectionStatus[](length);
        if (length == 0) {
            return collections;
        }

        for (uint256 i = 0; i < length; i++) {
            address collectionAddr = deployedCollections[_owner].at(i);
            collections[i] = CollectionStatus(
                collectionAddr,
                ICollection(collectionAddr).mintAvailable()
            );
        }

        return collections;
    }

    /// @inheritdoc ILaunchPad
    function setCollectionBaseUri(
        address _collection,
        string memory _baseUri
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).setBaseUri(_baseUri);
        emit CollectionBaseUriSet(msg.sender, _collection, _baseUri);
    }

    /// @inheritdoc ILaunchPad
    function changeStartTime(
        address _collection,
        uint256 _startTime
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).changeStartTime(_startTime);
        emit StartTimeChanged(msg.sender, _collection, _startTime);
    }

    /// @inheritdoc ILaunchPad
    function changeEndTime(
        address _collection,
        uint256 _endTime
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).changeEndTime(_endTime);
        emit EndTimeChanged(msg.sender, _collection, _endTime);
    }

    /// @inheritdoc ILaunchPad
    function enableWhitelistMode(
        address _collection,
        bool _enable
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).enableWhitelistMode(_enable);
        emit WhitelistModeEnabled(msg.sender, _collection, _enable);
    }

    /// @inheritdoc ILaunchPad
    function setWhitelistAddrs(
        address _collection,
        address[] memory _users,
        bool _isAdd
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).setWhitelist(_users, _isAdd);
        emit WhitelistAddrsSet(msg.sender, _collection, _users, _isAdd);
    }

    /// @inheritdoc ILaunchPad
    function forceFinishMinting(
        address _collection
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).forceFinishMinting();
        emit FinishMintingForced(msg.sender, _collection);
    }

    /// @inheritdoc ILaunchPad
    function changeMaxTotalSupply(
        address _collection,
        uint256 _maxTotalSupply
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).changeMaxTotalSupply(_maxTotalSupply);
        emit MaxTotalSupplyChanged(msg.sender, _collection, _maxTotalSupply);
    }

    /// @inheritdoc ILaunchPad
    function setMultiRecipients(
        address _collection,
        address[] memory _recipients,
        uint16[] memory _weights
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).setMultipleRecipients(_recipients, _weights);
        emit MultiRecipientsSet(msg.sender, _collection, _recipients, _weights);
    }

    /// @inheritdoc ILaunchPad
    function setCollectionFeeRate(
        address _collection,
        uint16 _feeRate
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).setCollectionFeeRate(_feeRate);
        emit CollectionFeeRateSet(msg.sender, _collection, _feeRate);
    }

    /// @inheritdoc ILaunchPad
    function setPriceForWhitelist(
        address _collection,
        uint256 _price
    ) external override onlyCollectionOwner(_collection) {
        ICollection(_collection).setPriceForWhitelist(_price);
        emit PriceForWhitelistSet(msg.sender, _collection, _price);
    }

    /// @inheritdoc ILaunchPad
    function mintCollection(
        address _collection,
        uint256 _quantity
    ) external payable override {
        ICollection(_collection).mintNFTTo{value: msg.value}(
            msg.sender,
            _quantity
        );
        emit CollectionMinted(msg.sender, _collection, _quantity);
    }

    /// @inheritdoc ILaunchPad
    function withdraw(address _token) external override onlyOwner {
        uint256 withdrawnAmount = 0;
        if (_token == address(0)) {
            /// native token
            withdrawnAmount = address(this).balance;
            require(withdrawnAmount > 0, "no balance to withdraw");
            (bool sent, ) = (owner()).call{value: withdrawnAmount}("");
            require(sent, "failed sending ETH");
        } else {
            withdrawnAmount = IERC20(_token).balanceOf(address(this));
            require(withdrawnAmount > 0, "no balance to withdraw");
            IERC20(_token).safeTransfer(owner(), withdrawnAmount);
        }

        emit Withdrawn(_token, withdrawnAmount);
    }

    receive() external payable {}

    uint256[100] private __gaps;
}
