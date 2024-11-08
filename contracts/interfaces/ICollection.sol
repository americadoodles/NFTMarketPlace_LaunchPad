// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

interface ICollection {
    function owner() external view returns (address);

    function getTimestamp()
        external
        view
        returns (uint256 currentTime, uint256 endTime);

    function setBaseUri(string memory _uri) external;

    function changeStartTime(uint256 _startTime) external;

    function changeEndTime(uint256 _endTime) external;

    function enableWhitelistMode(bool _enable) external;

    function forceFinishMinting() external;

    function changeMaxTotalSupply(uint256 _maxTotalSupply) external;

    function setMultipleRecipients(
        address[] memory _recipients,
        uint16[] memory _weights
    ) external;

    function setCollectionFeeRate(uint16 _feeRate) external;

    function setPriceForWhitelist(uint256 _price) external;

    function setWhitelist(address[] memory _users, bool _isAdd) external;

    function mintNFTTo(address _recipient, uint256 _quantity) external payable;

    function mintAvailable() external view returns (bool);

    /// @notice set baseInfo.
    /// @dev Only owner can call this function.
    function setBaseInfo(
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        uint256 _maxMintAmount,
        address _creator,
        string memory name_,
        string memory symbol_,
        string memory baseUri_
    ) external;
}
