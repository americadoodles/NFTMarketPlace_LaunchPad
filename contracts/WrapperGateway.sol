// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./interfaces/IWrapperGateway.sol";

contract WrapperGateway is OwnableUpgradeable, IWrapperGateway {
    using SafeERC20 for IERC20;
    IMarketPlace public marketplace;
    IWETH9 public WETH;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _marketplace,
        address _WETH
    ) public initializer {
        __Ownable_init();
        require(
            _marketplace != address(0),
            "invalid marketplace contract address"
        );
        require(_WETH != address(0), "invalid WETH address");
        marketplace = IMarketPlace(_marketplace);
        WETH = IWETH9(_WETH);
    }

    /// @inheritdoc IWrapperGateway
    function setMarketplace(address _marketplace) external override onlyOwner {
        require(
            _marketplace != address(0),
            "invalid marketplace contract address"
        );
        marketplace = IMarketPlace(_marketplace);
    }

    /// @inheritdoc IWrapperGateway
    function buyNFT(uint256 _saleId) external payable override {
        uint256 amount = msg.value;
        require(amount > 0, "invalid nativeToken amount");

        uint256 beforeBal = IERC20(address(WETH)).balanceOf(address(this));
        WETH.deposit{value: amount}();
        uint256 afterBal = IERC20(address(WETH)).balanceOf(address(this));
        uint256 receivedAmount = afterBal - beforeBal;
        require(receivedAmount == amount, "wrapping nativeToken failed");

        IERC20(address(WETH)).safeApprove(address(marketplace), amount);
        marketplace.buyNFT(_saleId);
    }

    receive() external payable {}
}
