// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./ICollection.sol";

interface ILaunchPad {
    struct CollectionStatus {
        address collectionAddress;
        bool availableMint;
    }

    /// @notice Deploy new ERC721A collection.
    /// @dev Anyone can call this function.
    /// @param _maxSupply The limit supply amount that users can mint.
    /// @param _mintPrice The price to mint.
    /// @param _startTime Unix timestamp that users can start minting.
    /// @param _endTime Unix timestamp to finish minting.
    /// @param _maxMintAmount Max amount that a user can mint.
    /// @param _creator The address of collection creator.
    /// @param _name The collections's name.
    /// @param _symbol The collection's symbol.
    /// @param _baseUri The collection's base uri.
    /// @return The deployed address of the collection.
    function deployCollection(
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _maxMintAmount,
        address _creator,
        string memory _name,
        string memory _symbol,
        string memory _baseUri
    ) external returns (address);

    /// @notice Get collection addresses and minting available status of user deployed.
    /// @param _owner The address of collection deployer.
    /// @return Information of collections. collection address and minting available status.
    function getDeployedCollections(
        address _owner
    ) external view returns (CollectionStatus[] memory);

    /// @notice Set collection's base uri.
    /// @dev Only collection deployer can call this function.
    /// @param _collection The address of collection.
    /// @param _baseUri The base uri of collection.
    function setCollectionBaseUri(
        address _collection,
        string memory _baseUri
    ) external;

    /// @notice Change collection's minting start timestamp.
    /// @dev Only collection deployer can call this function.
    /// @param _collection The address of collection.
    /// @param _startTime The timestamp to start collection minting.
    function changeStartTime(address _collection, uint256 _startTime) external;

    /// @notice Change collection's minting end timestamp.
    /// @dev Only collection deployer can call this function.
    /// @param _collection The address of collection.
    /// @param _endTime The timestamp to finish collection minting.
    function changeEndTime(address _collection, uint256 _endTime) external;

    /// @notice Change collection's whitelist mode.
    /// @dev Only collection deployer can call this function.
    ///      If whitelist mode is true, only whitelisted users can mint collections.
    /// @param _collection The address of collection.
    /// @param _enable Enable/Disable whitelist mode = true/false.
    function enableWhitelistMode(address _collection, bool _enable) external;

    /// @notice Add/Remove whitelist addresses.
    /// @dev Only collection deployer can call this function.
    /// @param _collection The address of collection.
    /// @param _users The address of users.
    /// @param _isAdd Add/Remove whitelists = true/false.
    function setWhitelistAddrs(
        address _collection,
        address[] memory _users,
        bool _isAdd
    ) external;

    /// @notice Finish collection's minting process any time.
    /// @dev Only collection deployer can call this function.
    /// @param _collection The address of collection.
    function forceFinishMinting(address _collection) external;

    /// @notice Change max total supply amount of collection.
    /// @dev Only collection deployer can call this function.
    /// @param _collection The address of collection.
    /// @param _maxTotalSupply The max total suppy of collection.
    function changeMaxTotalSupply(
        address _collection,
        uint256 _maxTotalSupply
    ) external;

    /// @notice Add/Remove multiple fee recipients.
    /// @dev Only collection deployer can call this function.
    ///      The platform fee goes to recipients.
    /// @param _collection The address of collection.
    /// @param _recipients The address of recipients.
    /// @param _weights The rate wights by each recipient.
    function setMultiRecipients(
        address _collection,
        address[] memory _recipients,
        uint16[] memory _weights
    ) external;

    /// @notice Set fee rate for minting.
    /// @dev Only collection deployer can call this function.
    /// @param _collection The address of collection.
    /// @param _feeRate The fee rate.
    function setCollectionFeeRate(
        address _collection,
        uint16 _feeRate
    ) external;

    /// @notice Set fee rate for minting.
    /// @dev Only collection deployer can call this function.
    /// @param _collection The address of collection.
    /// @param _quantity Amount of collection to mint.
    function mintCollection(
        address _collection,
        uint256 _quantity
    ) external payable;

    /// @notice Modify minting price for whitelisted users.
    /// @dev Only collection deployer can call this function.
    /// @param _collection The address of collection.
    /// @param _price The minting price for whitelisted users.
    function setPriceForWhitelist(address _collection, uint256 _price) external;

    /// @notice withdraw tokens stored as fee.
    /// @dev Only owner can call this function.
    /// @param _token The address of token.
    function withdraw(address _token) external;

    event CollectionDeployed(
        address indexed collectionOwner,
        address indexed collectionAddress,
        uint256 maxSupply,
        uint256 mintPrice,
        uint256 startTime,
        uint256 endTime,
        string name,
        string symbol,
        string baseUri
    );

    event CollectionBaseUriSet(
        address indexed collectionOwner,
        address indexed collectionAddress,
        string baseUri
    );

    event StartTimeChanged(
        address indexed collectionOwner,
        address indexed collectionAddress,
        uint256 startTime
    );

    event EndTimeChanged(
        address indexed collectionOwner,
        address indexed collectionAddress,
        uint256 endtime
    );

    event WhitelistModeEnabled(
        address indexed collectionOwner,
        address indexed collectionAddress,
        bool enable
    );

    event WhitelistAddrsSet(
        address indexed collectionOwner,
        address indexed collectionAddress,
        address[] indexed users,
        bool isAdd
    );

    event FinishMintingForced(
        address indexed collectionOwner,
        address indexed collectionAddress
    );

    event MaxTotalSupplyChanged(
        address indexed collectionOwner,
        address indexed collectionAddress,
        uint256 maxTotalSupply
    );

    event MultiRecipientsSet(
        address indexed collectionOwner,
        address indexed collectionAddress,
        address[] indexed recipients,
        uint16[] weights
    );

    event CollectionFeeRateSet(
        address indexed collectionOwner,
        address indexed collectionAddress,
        uint16 feeRate
    );

    event CollectionMinted(
        address indexed minter,
        address indexed collectionAddress,
        uint256 quantity
    );

    event PriceForWhitelistSet(
        address indexed collectionOwner,
        address indexed collectionAddress,
        uint256 price
    );

    event Withdrawn(address indexed tokenAddress, uint256 withdrawnAmount);
}
