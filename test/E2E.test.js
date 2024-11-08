const { expect } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("@openzeppelin/test-helpers");

const { uniswap_abi } = require("../external_abi/uniswap.abi.json");
const { erc20_abi } = require("../external_abi/erc20.abi.json");
const { abi } = require("../artifacts/contracts/ERC721A.sol/ERC721A.json");

const {
    deploy,
    deployProxy,
    getCurrentTimestamp,
    day,
    spendTime,
    bigNum,
    smallNum,
    getETHBalance,
} = require("../scripts/utils");

describe("Marketplace End-To-End test", function () {
    let uniswapRouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    let WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

    before(async function () {
        [
            this.owner,
            this.account_1,
            this.account_2,
            this.account_3,
            this.account_4,
            this.account_5,
            this.collectionOwner_1,
            this.collectionOwner_2,
            this.scammer_1,
            this.scammer_2,
            this.mockMarketplace,
            this.mockLaunchPad,
        ] = await ethers.getSigners();

        this.dexRouter = new ethers.Contract(
            uniswapRouterAddress,
            uniswap_abi,
            this.owner
        );
        this.BUSD = await deploy("MockERC20", "MockERC20", "MockBUSD", "MBUSD");
        this.DAI = await deploy("MockERC20", "MockERC20", "MockDAI", "MDAI");
        this.nativeToken = new ethers.Contract(WETH, erc20_abi, this.owner);

        this.launchPad = await deployProxy("LaunchPad", "LaunchPad");
        this.marketplace = await deployProxy("Marketplace", "Marketplace", [
            this.mockLaunchPad.address,
            20, // 2% platformFee
        ]);

        this.mockERC721 = await deploy(
            "MockERC721",
            "MockERC721",
            "Test721",
            "TestNFT"
        );
        this.mockERC1155 = await deploy(
            "MockERC1155",
            "MockERC1155",
            "Test1155",
            "TestNFT"
        );
        this.wrapperGateway = await deployProxy(
            "WrapperGateway",
            "WrapperGateway",
            [this.mockMarketplace.address, WETH]
        );

        await this.mockERC721.transferOwnership(this.collectionOwner_1.address);
        await this.mockERC1155.transferOwnership(
            this.collectionOwner_2.address
        );
    });

    it("check deployment", async function () {
        console.log("deployed successfully!");
    });

    describe("Set WrapperGateway", function () {
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.marketplace
                    .connect(this.account_1)
                    .setWrapperGateway(this.wrapperGateway.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if wrapperGateway is zero address", async function () {
            await expect(
                this.marketplace.setWrapperGateway(constants.ZERO_ADDRESS)
            ).to.be.revertedWith("invalid wrapperGateway contract address");
        });

        it("set WrapperGateway", async function () {
            await this.marketplace.setWrapperGateway(
                this.wrapperGateway.address
            );
        });
    });

    describe("Set launchPad", function () {
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.marketplace
                    .connect(this.account_1)
                    .setLaunchPad(this.launchPad.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if launchPad is zero address", async function () {
            await expect(
                this.marketplace.setLaunchPad(constants.ZERO_ADDRESS)
            ).to.be.revertedWith("zero launchPad address");
        });

        it("setLaunchPad", async function () {
            await expect(this.marketplace.setLaunchPad(this.launchPad.address))
                .to.be.emit(this.marketplace, "LaunchPadSet")
                .withArgs(this.launchPad.address);
        });
    });

    describe("Set MaxAuctionTime", function () {
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.marketplace.connect(this.account_1).setMaxAuctionTime(0)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if maxAuctionTime is zero", async function () {
            await expect(
                this.marketplace.setMaxAuctionTime(0)
            ).to.be.revertedWith("invalid maxAuctionTime");
        });

        it("set MaxAuctionTime", async function () {
            await expect(this.marketplace.setMaxAuctionTime(10 * day))
                .to.be.emit(this.marketplace, "MaxAuctionTimeSet")
                .withArgs(10 * day);
        });
    });

    describe("WrapperGateway - setMarketplace", function () {
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.wrapperGateway
                    .connect(this.account_1)
                    .setMarketplace(this.marketplace.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if marketplace address is zero", async function () {
            await expect(
                this.wrapperGateway.setMarketplace(constants.ZERO_ADDRESS)
            ).to.be.revertedWith("invalid marketplace contract address");
        });

        it("set new Marketplace address", async function () {
            await this.wrapperGateway.setMarketplace(this.marketplace.address);
        });
    });

    describe("set platform fee", function () {
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.marketplace.connect(this.account_1).setPlatformFee(10)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if platformFee is over 100%", async function () {
            await expect(
                this.marketplace.setPlatformFee(1001)
            ).to.be.revertedWith("invalid platform fee");
        });

        it("set platform fee as 3%", async function () {
            await expect(this.marketplace.setPlatformFee(30))
                .to.be.emit(this.marketplace, "PlatformFeeSet")
                .withArgs(30);
        });
    });

    describe("set allowed token", function () {
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.marketplace
                    .connect(this.account_1)
                    .setAllowedToken([this.DAI.address], true)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if token array length is 0", async function () {
            await expect(
                this.marketplace.setAllowedToken([], true)
            ).to.be.revertedWith("invalid length");
        });

        it("set allowed token", async function () {
            await expect(
                this.marketplace.setAllowedToken([this.DAI.address, WETH], true)
            )
                .to.be.emit(this.marketplace, "AllowedTokenSet")
                .withArgs([this.DAI.address, WETH], true);
        });
    });

    describe("set blocked tokendIds", function () {
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.marketplace
                    .connect(this.account_1)
                    .setBlockedTokenIds([this.mockERC721.address], [0], true)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if array isn't matched", async function () {
            await expect(
                this.marketplace.setBlockedTokenIds(
                    [this.mockERC721.address],
                    [0, 1],
                    true
                )
            ).to.be.revertedWith("length dismatched");
        });

        it("set blocked tokenIds", async function () {
            let collections = [
                this.mockERC721.address,
                this.mockERC721.address,
                this.mockERC1155.address,
                this.mockERC1155.address,
            ];
            let tokenIds = [0, 1, 0, 1];
            await expect(
                this.marketplace.setBlockedTokenIds(collections, tokenIds, true)
            )
                .to.be.emit(this.marketplace, "BlockedTokenIdsSet")
                .withArgs(collections, tokenIds, true);
        });
    });

    describe("set blacklisted user", function () {
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.marketplace
                    .connect(this.account_1)
                    .setBlacklistedUser(
                        [this.scammer_1.address, this.scammer_2.address],
                        true
                    )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if array is 0", async function () {
            await expect(
                this.marketplace.setBlacklistedUser([], true)
            ).to.be.revertedWith("invalid length");
        });

        it("set blacklist users", async function () {
            await expect(
                this.marketplace.setBlacklistedUser(
                    [this.scammer_1.address, this.scammer_2.address],
                    true
                )
            )
                .to.be.emit(this.marketplace, "BlacklistedUserSet")
                .withArgs(
                    [this.scammer_1.address, this.scammer_2.address],
                    true
                );
        });
    });

    describe("set royalty for collection", function () {
        it("reverts if collection is zero address", async function () {
            await expect(
                this.marketplace.setRoyalty(constants.ZERO_ADDRESS, 10)
            ).to.be.revertedWith("zero collection address");
        });

        it("reverts if royaltyFee is invalid", async function () {
            await expect(
                this.marketplace.setRoyalty(this.mockERC721.address, 1001)
            ).to.be.revertedWith("invalid royalty fee");
        });

        it("reverts if owner is not the collection owner", async function () {
            await expect(
                this.marketplace.setRoyalty(this.mockERC721.address, 101)
            ).to.be.revertedWith("not collection owner");
        });

        it("set royalty for collection", async function () {
            await expect(
                this.marketplace
                    .connect(this.collectionOwner_1)
                    .setRoyalty(this.mockERC721.address, 20)
            )
                .to.be.emit(this.marketplace, "RoyaltySet")
                .withArgs(
                    this.collectionOwner_1.address,
                    this.mockERC721.address,
                    20
                );

            await expect(
                this.marketplace
                    .connect(this.collectionOwner_2)
                    .setRoyalty(this.mockERC1155.address, 30)
            )
                .to.be.emit(this.marketplace, "RoyaltySet")
                .withArgs(
                    this.collectionOwner_2.address,
                    this.mockERC1155.address,
                    30
                );
        });
    });

    describe("create ERC721Collection", function () {
        let maxSupply = 20;
        let mintPrice = 10 * 17;
        let startTimestamp;
        let endTimestamp;
        let name = "Test_1";
        let symbol = "Test_2";

        before(async function () {
            startTimestamp = BigInt(await getCurrentTimestamp()) + BigInt(day);
            endTimestamp =
                BigInt(await getCurrentTimestamp()) + BigInt(day * 3);
        });

        it("reverts if caller is blacklisted", async function () {
            await expect(
                this.marketplace
                    .connect(this.scammer_1)
                    .createERC721Collection(
                        maxSupply,
                        mintPrice,
                        startTimestamp,
                        endTimestamp,
                        BigInt(maxSupply) / BigInt(2),
                        name,
                        symbol,
                        ""
                    )
            ).to.be.revertedWith("blacklisted user");
        });

        it("reverts if maxSupply is zero", async function () {
            await expect(
                this.marketplace.createERC721Collection(
                    0,
                    mintPrice,
                    startTimestamp,
                    endTimestamp,
                    BigInt(maxSupply) / BigInt(2),
                    name,
                    symbol,
                    ""
                )
            ).to.be.revertedWith("invalid maxSupply");
        });

        it("reverts if minting price is zero", async function () {
            await expect(
                this.marketplace.createERC721Collection(
                    maxSupply,
                    0,
                    startTimestamp,
                    endTimestamp,
                    BigInt(maxSupply) / BigInt(2),
                    name,
                    symbol,
                    ""
                )
            ).to.be.revertedWith("invalid minting price");
        });

        it("reverts if endTimestamp is before current time", async function () {
            await expect(
                this.marketplace.createERC721Collection(
                    maxSupply,
                    mintPrice,
                    startTimestamp,
                    BigInt(await getCurrentTimestamp()) - BigInt(day),
                    BigInt(maxSupply) / BigInt(2),
                    name,
                    symbol,
                    ""
                )
            ).to.be.revertedWith("endTimestamp before startTimestamp");
        });

        describe("ERC721A test", function () {
            it("create ERC721A collection", async function () {
                let tx = await this.marketplace
                    .connect(this.account_1)
                    .createERC721Collection(
                        maxSupply,
                        mintPrice,
                        startTimestamp,
                        endTimestamp,
                        BigInt(maxSupply) / BigInt(2),
                        name,
                        symbol,
                        ""
                    );
                tx = await tx.wait();

                tx = tx.events.filter((x) => {
                    return x.event == "ERC721CollectionCreated";
                });
                // console.log(tx);
                console.log(tx[0].args);
                let eventParam = tx[0].args;
                expect(eventParam.creator).to.be.equal(this.account_1.address);
                let collectionAddress = eventParam.collectionAddress;
                expect(Number(eventParam.maxSupply)).to.be.equal(20);
                expect(Number(eventParam.mintPrice)).to.be.equal(170);
                expect(Number(eventParam.endTimestamp)).to.be.equal(
                    Number(endTimestamp)
                );
                expect(eventParam.name).to.be.equal(name);
                expect(eventParam.symbol).to.be.equal(symbol);

                let newCollection = new ethers.Contract(
                    collectionAddress,
                    abi,
                    this.owner
                );
                expect(await newCollection.creator()).to.be.equal(
                    this.account_1.address
                );
            });

            it("check token name and symbol", async function () {
                this.deployedCollection =
                    await this.launchPad.getDeployedCollections(
                        this.account_1.address
                    );
                this.deployedCollection = new ethers.Contract(
                    this.deployedCollection[0].collectionAddress,
                    abi,
                    this.account_1
                );
                expect(await this.deployedCollection.name()).to.be.equal(name);
                expect(await this.deployedCollection.symbol()).to.be.equal(
                    symbol
                );
            });

            describe("set whitelist", function () {
                it("reverts if caller is not the owner", async function () {
                    await expect(
                        this.deployedCollection
                            .connect(this.account_2)
                            .setWhitelist([this.account_3.address], true)
                    ).to.be.revertedWith("only creator");
                });

                it("reverts if users array is empty", async function () {
                    await expect(
                        this.deployedCollection
                            .connect(this.account_1)
                            .setWhitelist([], true)
                    ).to.be.revertedWith("invalid array");
                });

                it("set whitelist", async function () {
                    await this.deployedCollection
                        .connect(this.account_1)
                        .setWhitelist(
                            [this.account_2.address, this.account_3.address],
                            true
                        );
                });
            });

            describe("mint NFT", function () {
                it("reverts if try to mint before minting startTime", async function () {
                    await this.deployedCollection
                        .connect(this.account_1)
                        .enableWhitelistMode(false);
                    await expect(
                        this.deployedCollection
                            .connect(this.account_4)
                            .mintNFT(1, { value: mintPrice })
                    ).to.be.revertedWith("before start time");
                });

                it("reverts if sender is not whitelisted", async function () {
                    await spendTime(2 * day);
                    await this.deployedCollection
                        .connect(this.account_1)
                        .enableWhitelistMode(true);
                    await expect(
                        this.deployedCollection
                            .connect(this.account_4)
                            .mintNFT(1, { value: mintPrice })
                    ).to.be.revertedWith("only whitelist");
                });

                it("reverts if quantity is 0", async function () {
                    await expect(
                        this.deployedCollection
                            .connect(this.account_2)
                            .mintNFT(0, { value: mintPrice })
                    ).to.be.revertedWith("zero quantity");
                });

                it("reverts if price is not enough", async function () {
                    await expect(
                        this.deployedCollection
                            .connect(this.account_2)
                            .mintNFT(2, { value: mintPrice })
                    ).to.be.revertedWith("not enough cost");
                });

                it("mint NFT and check balance", async function () {
                    await this.deployedCollection
                        .connect(this.account_2)
                        .mintNFT(3, { value: BigInt(mintPrice) * BigInt(3) });
                });

                it("reverts if try to mint over minting duration", async function () {
                    await spendTime(day * 5);
                    await expect(
                        this.deployedCollection
                            .connect(this.account_3)
                            .mintNFT(1, { value: mintPrice })
                    ).to.be.revertedWith("over minting time");
                });
            });
        });
    });

    describe("Sale", function () {
        describe("list ERC721 for sale", function () {
            it("mint ERC721 collection", async function () {
                await this.mockERC721.connect(this.account_4).mintNFT(5);
            });

            it("reverts if caller is blacklisted", async function () {
                await expect(
                    this.marketplace
                        .connect(this.scammer_2)
                        .listERC721ForSale(
                            this.mockERC721.address,
                            this.DAI.address,
                            [0, 1],
                            bigNum(150)
                        )
                ).to.be.revertedWith("blacklisted user");
            });

            it("reverts if collection address is zero address", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForSale(
                            constants.ZERO_ADDRESS,
                            this.DAI.address,
                            [0, 1],
                            bigNum(150)
                        )
                ).to.be.revertedWith("zero collection address");
            });

            it("reverts if tokenIds length is 0", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForSale(
                            this.mockERC721.address,
                            this.DAI.address,
                            [],
                            bigNum(150)
                        )
                ).to.be.revertedWith("zero tokenIDs");
            });

            it("reverts if payment token is not allowed", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForSale(
                            this.mockERC721.address,
                            this.BUSD.address,
                            [0, 1],
                            bigNum(150)
                        )
                ).to.be.revertedWith("not allowed payment token");
            });

            it("reverts if collection is blocked for trading", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForSale(
                            this.mockERC721.address,
                            this.DAI.address,
                            [0, 1],
                            bigNum(150)
                        )
                ).to.be.revertedWith("blacklisted collectionId");
            });

            it("reverts if caller is not the collection owner", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForSale(
                            this.mockERC721.address,
                            this.DAI.address,
                            [3, 4],
                            bigNum(150)
                        )
                ).to.be.revertedWith("not collection Owner");
            });

            it("list ERC721 collection for sale", async function () {
                let curSaleId = await this.marketplace.saleId();
                await this.mockERC721
                    .connect(this.account_4)
                    .setApprovalForAll(this.marketplace.address, true);
                await expect(
                    this.marketplace
                        .connect(this.account_4)
                        .listERC721ForSale(
                            this.mockERC721.address,
                            WETH,
                            [3, 4],
                            bigNum(150)
                        )
                )
                    .to.be.emit(this.marketplace, "ERC721ForSaleListed")
                    .withArgs(
                        this.account_4.address,
                        this.mockERC721.address,
                        WETH,
                        [3, 4],
                        bigNum(150),
                        curSaleId
                    );
            });
        });

        describe("list ERC1155 for sale", function () {
            it("mint ERC1155 collection", async function () {
                await this.mockERC1155.mintNFT(this.account_5.address, 2);
                await this.mockERC1155.mintNFT(this.account_5.address, 2);
                await this.mockERC1155.mintNFT(this.account_5.address, 5);
                await this.mockERC1155.mintNFT(this.account_5.address, 8);
            });

            it("reverts if caller is blacklisted", async function () {
                await expect(
                    this.marketplace
                        .connect(this.scammer_2)
                        .listERC1155ForSale(
                            this.mockERC1155.address,
                            this.DAI.address,
                            0,
                            2,
                            bigNum(150)
                        )
                ).to.be.revertedWith("blacklisted user");
            });

            it("reverts if collection address is zero address", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC1155ForSale(
                            constants.ZERO_ADDRESS,
                            this.DAI.address,
                            0,
                            2,
                            bigNum(150)
                        )
                ).to.be.revertedWith("zero collection address");
            });

            it("reverts if quantity is 0", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC1155ForSale(
                            this.mockERC1155.address,
                            this.DAI.address,
                            0,
                            0,
                            bigNum(150)
                        )
                ).to.be.revertedWith("zero quantity");
            });

            it("reverts if collection is blocked for trading", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC1155ForSale(
                            this.mockERC1155.address,
                            this.DAI.address,
                            0,
                            2,
                            bigNum(150)
                        )
                ).to.be.revertedWith("blacklisted collectionId");
            });

            it("reverts if seller doesn't have enough ERC1155 collection", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC1155ForSale(
                            this.mockERC1155.address,
                            this.DAI.address,
                            2,
                            2,
                            bigNum(150)
                        )
                ).to.be.revertedWith("not enough balance");
            });

            it("reverts if payment token is not allowed", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_5)
                        .listERC1155ForSale(
                            this.mockERC1155.address,
                            this.BUSD.address,
                            2,
                            2,
                            bigNum(150)
                        )
                ).to.be.revertedWith("not allowed payment token");
            });

            it("list ERC1155 collection for sale", async function () {
                let curSaleId = await this.marketplace.saleId();
                await this.mockERC1155
                    .connect(this.account_5)
                    .setApprovalForAll(this.marketplace.address, true);
                await expect(
                    this.marketplace
                        .connect(this.account_5)
                        .listERC1155ForSale(
                            this.mockERC1155.address,
                            this.DAI.address,
                            2,
                            2,
                            bigNum(300)
                        )
                )
                    .to.be.emit(this.marketplace, "ERC1155ForSaleListed")
                    .withArgs(
                        this.account_5.address,
                        this.mockERC1155.address,
                        this.DAI.address,
                        2,
                        2,
                        bigNum(300),
                        curSaleId
                    );
            });
        });

        describe("change sale price", function () {
            it("reverts if saleId doesn't exist", async function () {
                await expect(
                    this.marketplace.changeSalePrice(
                        100,
                        bigNum(200),
                        this.DAI.address
                    )
                ).to.be.revertedWith("not exists saleId");
            });

            it("reverts if caller is seller", async function () {
                let availableSaleIds =
                    await this.marketplace.getAvailableSaleIds();
                await expect(
                    this.marketplace.changeSalePrice(
                        availableSaleIds[0],
                        bigNum(200),
                        this.DAI.address
                    )
                ).to.be.revertedWith("not seller");
            });

            it("reverts if payment token isn't allowed", async function () {
                let availableSaleIds =
                    await this.marketplace.getAvailableSaleIds();
                await expect(
                    this.marketplace
                        .connect(this.account_5)
                        .changeSalePrice(
                            availableSaleIds[1],
                            bigNum(200),
                            this.BUSD.address
                        )
                ).to.be.revertedWith("not allowed payment token");
            });

            it("change sell price", async function () {
                let availableSaleIds =
                    await this.marketplace.getAvailableSaleIds();
                await expect(
                    this.marketplace
                        .connect(this.account_5)
                        .changeSalePrice(
                            availableSaleIds[1],
                            bigNum(600),
                            this.DAI.address
                        )
                )
                    .to.be.emit(this.marketplace, "SalePriceChanged")
                    .withArgs(
                        availableSaleIds[1],
                        this.DAI.address,
                        bigNum(300),
                        this.DAI.address,
                        bigNum(600)
                    );
            });
        });

        describe("buy collection", function () {
            let availableSaleIds;
            it("get available SaleIds", async function () {
                availableSaleIds = await this.marketplace.getAvailableSaleIds();
                expect(availableSaleIds.length).to.be.equal(2);
            });

            it("reverts if caller is blacklisted", async function () {
                await expect(
                    this.marketplace
                        .connect(this.scammer_1)
                        .buyNFT(availableSaleIds[0])
                ).to.be.revertedWith("blacklisted user");
            });

            it("reverts if saleId doesn't exist", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .buyNFT(availableSaleIds[0] + 10000)
                ).to.be.revertedWith("not exists saleId");
            });

            it("reverts if caller is seller", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_4)
                        .buyNFT(availableSaleIds[0])
                ).to.be.revertedWith("caller is seller");
            });

            it("reverts if marketplace is paused", async function () {
                await expect(
                    this.marketplace.connect(this.account_1).pause()
                ).to.be.revertedWith("Ownable: caller is not the owner");

                await this.marketplace.pause();

                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .buyNFT(availableSaleIds[0])
                ).to.be.revertedWith("Pausable: paused");

                await this.marketplace.unpause();
            });

            it("buy ERC721 collection", async function () {
                let sellInfo = await this.marketplace.sellInfos(
                    availableSaleIds[0]
                );
                let price = sellInfo.price;
                let beforeBal = await this.nativeToken.balanceOf(
                    this.account_4.address
                );
                let beforeRoyaltyBal = await this.nativeToken.balanceOf(
                    this.collectionOwner_1.address
                );
                /// reverts if amount is zero
                await expect(
                    this.wrapperGateway
                        .connect(this.account_3)
                        .buyNFT(availableSaleIds[0])
                ).to.be.revertedWith("invalid nativeToken amount");

                await expect(
                    this.wrapperGateway
                        .connect(this.account_3)
                        .buyNFT(availableSaleIds[0], { value: BigInt(price) })
                ).to.be.emit(this.marketplace, "NFTBought");
                let afterBal = await this.nativeToken.balanceOf(
                    this.account_4.address
                );
                let afterRoyaltyBal = await this.nativeToken.balanceOf(
                    this.collectionOwner_1.address
                );

                let feeAmount = (BigInt(price) * BigInt(30)) / BigInt(1000);
                let royaltyFee = (BigInt(price) * BigInt(20)) / BigInt(1000);
                price = BigInt(price) - BigInt(feeAmount) - BigInt(royaltyFee);
                expect(await this.mockERC721.ownerOf(3)).to.be.equal(
                    this.account_3.address
                );
                expect(await this.mockERC721.ownerOf(4)).to.be.equal(
                    this.account_3.address
                );

                expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.equal(
                    smallNum(price)
                );
                expect(
                    smallNum(afterRoyaltyBal) - smallNum(beforeRoyaltyBal)
                ).to.be.equal(smallNum(royaltyFee));
            });

            it("buy ERC1155 collection", async function () {
                availableSaleIds = await this.marketplace.getAvailableSaleIds();
                expect(availableSaleIds.length).to.be.equal(1);

                let sellInfo = await this.marketplace.sellInfos(
                    availableSaleIds[0]
                );
                let price = sellInfo.price;
                await this.DAI.connect(this.account_2).mint(BigInt(price));
                await this.DAI.connect(this.account_2).approve(
                    this.marketplace.address,
                    BigInt(price)
                );

                let beforeBal = await this.DAI.balanceOf(
                    this.account_5.address
                );
                let beforeRoyaltyBal = await this.DAI.balanceOf(
                    this.collectionOwner_2.address
                );
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .buyNFT(availableSaleIds[0])
                ).to.be.emit(this.marketplace, "NFTBought");
                let afterBal = await this.DAI.balanceOf(this.account_5.address);
                let afterRoyaltyBal = await this.DAI.balanceOf(
                    this.collectionOwner_2.address
                );

                let feeAmount = (BigInt(price) * BigInt(30)) / BigInt(1000);
                let royaltyFee = (BigInt(price) * BigInt(30)) / BigInt(1000);
                price = BigInt(price) - BigInt(feeAmount) - BigInt(royaltyFee);
                expect(
                    await this.mockERC1155.balanceOf(this.account_2.address, 2)
                ).to.be.equal(sellInfo.quantity);
                expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.equal(
                    smallNum(price)
                );
                expect(
                    smallNum(afterRoyaltyBal) - smallNum(beforeRoyaltyBal)
                ).to.be.equal(smallNum(royaltyFee));
            });
        });

        describe("close Sale", function () {
            let availableSaleId;
            it("list NFT for sale", async function () {
                await this.mockERC1155
                    .connect(this.account_5)
                    .setApprovalForAll(this.marketplace.address, true);
                await this.marketplace
                    .connect(this.account_5)
                    .listERC1155ForSale(
                        this.mockERC1155.address,
                        this.DAI.address,
                        2,
                        2,
                        bigNum(300)
                    );
            });

            it("reverts if caller is not the seller", async function () {
                availableSaleId = await this.marketplace.getAvailableSaleIds();
                expect(availableSaleId.length).to.be.equal(1);
                availableSaleId = availableSaleId[0];

                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .closeSale(availableSaleId)
                ).to.be.revertedWith("no permission");
            });

            it("reverts if saleId doesn't exist", async function () {
                await expect(
                    this.marketplace.connect(this.account_1).closeSale(1000)
                ).to.be.revertedWith("not exists saleId");
            });

            it("close sale", async function () {
                let beforeBal = await this.mockERC1155.balanceOf(
                    this.account_5.address,
                    2
                );
                await expect(
                    this.marketplace
                        .connect(this.account_5)
                        .closeSale(availableSaleId)
                )
                    .to.be.emit(this.marketplace, "SaleClosed")
                    .withArgs(availableSaleId);
                let afterBal = await this.mockERC1155.balanceOf(
                    this.account_5.address,
                    2
                );
                expect(afterBal - beforeBal).to.be.equal(2);
            });

            it("reverts if user try to buy NFT with closed SaleId", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .buyNFT(availableSaleId)
                ).to.be.revertedWith("not exists saleId");
            });
        });
    });

    describe("Auction", function () {
        describe("list ERC721 for auction", function () {
            let auctionEndTimestamp;

            it("reverts if caller is blacklisted", async function () {
                auctionEndTimestamp = await getCurrentTimestamp();
                auctionEndTimestamp =
                    BigInt(auctionEndTimestamp) + BigInt(day * 2);

                await expect(
                    this.marketplace
                        .connect(this.scammer_1)
                        .listERC721ForAuction(
                            this.mockERC721.address,
                            this.DAI.address,
                            [2, 3],
                            bigNum(100),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("blacklisted user");
            });

            it("reverts if collection address is zero address", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForAuction(
                            constants.ZERO_ADDRESS,
                            this.DAI.address,
                            [2, 3],
                            bigNum(100),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("zero collection address");
            });

            it("reverts if tokenIds length is 0", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForAuction(
                            this.mockERC721.address,
                            this.DAI.address,
                            [],
                            bigNum(100),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("zero tokenIDs");
            });

            it("reverts if payment token is not allowed", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForAuction(
                            this.mockERC721.address,
                            this.BUSD.address,
                            [0, 1],
                            bigNum(150),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("not allowed payment token");
            });

            it("reverts if collection is blocked for trading", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForAuction(
                            this.mockERC721.address,
                            this.DAI.address,
                            [0, 1],
                            bigNum(150),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("blacklisted collectionId");
            });

            it("reverts if caller is not the collection owner", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .listERC721ForAuction(
                            this.mockERC721.address,
                            this.DAI.address,
                            [3, 4],
                            bigNum(150),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("not collection Owner");
            });

            it("reverts if invalid time auction", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .listERC721ForAuction(
                            this.mockERC721.address,
                            this.DAI.address,
                            [3, 4],
                            bigNum(150),
                            BigInt(auctionEndTimestamp) -
                                BigInt(day) * BigInt(10),
                            true
                        )
                ).to.be.revertedWith("invalid endTime");

                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .listERC721ForAuction(
                            this.mockERC721.address,
                            this.DAI.address,
                            [3, 4],
                            bigNum(150),
                            BigInt(auctionEndTimestamp) +
                                BigInt(day) * BigInt(30),
                            true
                        )
                ).to.be.revertedWith("over maxAuctionTime");
            });

            it("list ERC721 collection for auction", async function () {
                await this.mockERC721
                    .connect(this.account_3)
                    .setApprovalForAll(this.marketplace.address, true);

                let curAuctionId = await this.marketplace.auctionId();
                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .listERC721ForAuction(
                            this.mockERC721.address,
                            this.DAI.address,
                            [3, 4],
                            bigNum(150),
                            auctionEndTimestamp,
                            true
                        )
                )
                    .to.be.emit(this.marketplace, "ERC721ForAuctionListed")
                    .withArgs(
                        this.account_3.address,
                        this.mockERC721.address,
                        this.DAI.address,
                        curAuctionId,
                        [3, 4],
                        bigNum(150),
                        auctionEndTimestamp,
                        true
                    );
            });
        });

        describe("list ERC1155 for auction", function () {
            let auctionEndTimestamp;
            let startPrice = bigNum(300);
            it("reverts if caller is blacklisted", async function () {
                auctionEndTimestamp = await getCurrentTimestamp();
                auctionEndTimestamp =
                    BigInt(auctionEndTimestamp) + BigInt(day * 2);

                await expect(
                    this.marketplace
                        .connect(this.scammer_1)
                        .listERC1155ForAuction(
                            this.mockERC1155.address,
                            this.DAI.address,
                            2,
                            2,
                            BigInt(startPrice),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("blacklisted user");
            });

            it("reverts if collection address is zero address", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .listERC1155ForAuction(
                            constants.ZERO_ADDRESS,
                            this.DAI.address,
                            2,
                            2,
                            BigInt(startPrice),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("zero collection address");
            });

            it("reverts if quantity is 0", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .listERC1155ForAuction(
                            this.mockERC1155.address,
                            this.DAI.address,
                            2,
                            0,
                            BigInt(startPrice),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("zero quantity");
            });

            it("reverts if collection is blocked for trading", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .listERC1155ForAuction(
                            this.mockERC1155.address,
                            this.DAI.address,
                            0,
                            2,
                            BigInt(startPrice),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("blacklisted collectionId");
            });

            it("reverts if seller doesn't have enough ERC1155 collection", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .listERC1155ForAuction(
                            this.mockERC1155.address,
                            this.DAI.address,
                            2,
                            5,
                            BigInt(startPrice),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("not enough balance");
            });

            it("reverts if payment token is not allowed", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_5)
                        .listERC1155ForAuction(
                            this.mockERC1155.address,
                            this.BUSD.address,
                            2,
                            2,
                            BigInt(startPrice),
                            auctionEndTimestamp,
                            true
                        )
                ).to.be.revertedWith("not allowed payment token");
            });

            it("reverts if invalid time auction", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_5)
                        .listERC1155ForAuction(
                            this.mockERC1155.address,
                            this.DAI.address,
                            2,
                            2,
                            BigInt(startPrice),
                            BigInt(auctionEndTimestamp) -
                                BigInt(day) * BigInt(10),
                            true
                        )
                ).to.be.revertedWith("invalid endTime");

                await expect(
                    this.marketplace
                        .connect(this.account_5)
                        .listERC1155ForAuction(
                            this.mockERC1155.address,
                            this.DAI.address,
                            2,
                            2,
                            BigInt(startPrice),
                            BigInt(auctionEndTimestamp) +
                                BigInt(day) * BigInt(30),
                            true
                        )
                ).to.be.revertedWith("over maxAuctionTime");
            });

            it("list ERC1155 collection for auction", async function () {
                let curAuctionId = await this.marketplace.auctionId();
                await expect(
                    this.marketplace
                        .connect(this.account_5)
                        .listERC1155ForAuction(
                            this.mockERC1155.address,
                            this.DAI.address,
                            2,
                            2,
                            BigInt(startPrice),
                            0,
                            false
                        )
                )
                    .to.be.emit(this.marketplace, "ERC1155ForAuctionListed")
                    .withArgs(
                        this.account_5.address,
                        this.mockERC1155.address,
                        this.DAI.address,
                        curAuctionId,
                        2,
                        2,
                        BigInt(startPrice),
                        0,
                        false
                    );
            });
        });

        describe("bid to auction", async function () {
            let availableAuctionIds;
            it("get available AuctionIds", async function () {
                availableAuctionIds =
                    await this.marketplace.getAvailableAuctionIds();
                expect(availableAuctionIds.length).to.be.equal(2);
            });

            it("reverts if auctionId doesn't exist", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeBid(1000, bigNum(200))
                ).to.be.revertedWith("not exists auctionId");
            });

            it("reverts if caller is auction maker", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .placeBid(availableAuctionIds[0], bigNum(200))
                ).to.be.revertedWith("bider is auction maker");
            });

            it("reverts if caller is blacklisted", async function () {
                await expect(
                    this.marketplace
                        .connect(this.scammer_1)
                        .placeBid(availableAuctionIds[0], bigNum(200))
                ).to.be.revertedWith("blacklisted user");
            });

            it("reverts if bid amount is less than start price", async function () {
                let auctionInfo = await this.marketplace.auctionInfos(
                    availableAuctionIds[0]
                );
                let bidPrice = BigInt(auctionInfo.startPrice) - BigInt(200);
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeBid(availableAuctionIds[0], BigInt(bidPrice))
                ).to.be.revertedWith("low price");
            });

            it("place bid to auctions", async function () {
                let auctionInfo = await this.marketplace.auctionInfos(
                    availableAuctionIds[0]
                );
                let bidPrice =
                    BigInt(auctionInfo.startPrice) + BigInt(bigNum(30));

                await this.DAI.connect(this.account_1).mint(BigInt(bidPrice));
                await this.DAI.connect(this.account_1).approve(
                    this.marketplace.address,
                    BigInt(bidPrice)
                );
                let beforeBal = await this.DAI.balanceOf(
                    this.account_1.address
                );
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeBid(availableAuctionIds[0], BigInt(bidPrice))
                )
                    .to.be.emit(this.marketplace, "BidPlaced")
                    .withArgs(
                        this.account_1.address,
                        availableAuctionIds[0],
                        bidPrice
                    );
                let afterBal = await this.DAI.balanceOf(this.account_1.address);
                auctionInfo = await this.marketplace.auctionInfos(
                    availableAuctionIds[0]
                );
                let winPrice = auctionInfo.winPrice;
                expect(smallNum(beforeBal) - smallNum(afterBal)).to.be.equal(
                    smallNum(bidPrice)
                );
                expect(smallNum(winPrice)).to.be.equal(smallNum(bidPrice));
            });

            it("reverts if bid amount is less than last win bid amount", async function () {
                let auctionInfo = await this.marketplace.auctionInfos(
                    availableAuctionIds[0]
                );
                let bidPrice = BigInt(auctionInfo.winPrice) - BigInt(bigNum(5));

                await expect(
                    this.marketplace
                        .connect(this.account_4)
                        .placeBid(availableAuctionIds[0], BigInt(bidPrice))
                ).to.be.revertedWith("lower price than last win price");
            });

            it("place bid again and check last winner's balance", async function () {
                let auctionInfo = await this.marketplace.auctionInfos(
                    availableAuctionIds[0]
                );
                let lastPrice = auctionInfo.winPrice;
                let bidPrice =
                    BigInt(auctionInfo.winPrice) + BigInt(bigNum(30));

                await this.DAI.connect(this.account_4).mint(BigInt(bidPrice));
                await this.DAI.connect(this.account_4).approve(
                    this.marketplace.address,
                    BigInt(bidPrice)
                );
                let beforeBal = await this.DAI.balanceOf(
                    this.account_4.address
                );
                let beforeWinnerBal = await this.DAI.balanceOf(
                    this.account_1.address
                );
                await expect(
                    this.marketplace
                        .connect(this.account_4)
                        .placeBid(availableAuctionIds[0], BigInt(bidPrice))
                )
                    .to.be.emit(this.marketplace, "BidPlaced")
                    .withArgs(
                        this.account_4.address,
                        availableAuctionIds[0],
                        bidPrice
                    );
                let afterBal = await this.DAI.balanceOf(this.account_4.address);
                let afterWinnerBal = await this.DAI.balanceOf(
                    this.account_1.address
                );
                auctionInfo = await this.marketplace.auctionInfos(
                    availableAuctionIds[0]
                );
                let winPrice = auctionInfo.winPrice;
                expect(smallNum(beforeBal) - smallNum(afterBal)).to.be.equal(
                    smallNum(bidPrice)
                );
                expect(
                    smallNum(afterWinnerBal) - smallNum(beforeWinnerBal)
                ).to.be.equal(smallNum(lastPrice));
                expect(smallNum(winPrice)).to.be.equal(smallNum(bidPrice));
            });
        });

        describe("finish auction", function () {
            let availableAuctionIds;

            it("reverts if try to finish before maturity", async function () {
                availableAuctionIds =
                    await this.marketplace.getAvailableAuctionIds();
                expect(availableAuctionIds.length).to.be.equal(2);

                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .finishAuction(availableAuctionIds[0])
                ).to.be.revertedWith("before auction maturity");
            });

            it("reverts if caller is not seller or winner", async function () {
                /// spend time.
                await spendTime(10 * day);

                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .finishAuction(availableAuctionIds[0])
                ).to.be.revertedWith("no permission");
            });

            it("reverts if auctionId doesn't exist", async function () {
                await expect(
                    this.marketplace.connect(this.account_3).finishAuction(100)
                ).to.be.revertedWith("not exists auctionId");
            });

            it("reverts if try to bid over bid duration", async function () {
                await expect(
                    this.marketplace.placeBid(
                        availableAuctionIds[0],
                        bigNum(500)
                    )
                ).to.be.revertedWith("over auction duration");

                // it's fine if auction is not time auction.
                let auctionInfo = await this.marketplace.auctionInfos(
                    availableAuctionIds[1]
                );
                let bidPrice =
                    BigInt(auctionInfo.startPrice) + BigInt(bigNum(30));
                await this.DAI.connect(this.account_1).mint(BigInt(bidPrice));
                await this.DAI.connect(this.account_1).approve(
                    this.marketplace.address,
                    BigInt(bidPrice)
                );
                await this.marketplace
                    .connect(this.account_1)
                    .placeBid(availableAuctionIds[1], BigInt(bidPrice));
            });

            it("finish auction", async function () {
                let auctionInfo = await this.marketplace.auctionInfos(
                    availableAuctionIds[0]
                );
                let [collectionAddress, auctionCollection] =
                    await this.marketplace.getAuctionCollection(
                        availableAuctionIds[0]
                    );
                let beforeBal = await this.DAI.balanceOf(
                    auctionInfo.auctionMaker
                );
                let beforeCollectionBal = await this.mockERC721.balanceOf(
                    auctionInfo.winner
                );
                await expect(
                    this.marketplace
                        .connect(this.account_3)
                        .finishAuction(availableAuctionIds[0])
                ).to.be.emit(this.marketplace, "AuctionFinished");
                let afterBal = await this.DAI.balanceOf(
                    auctionInfo.auctionMaker
                );
                let afterCollectionBal = await this.mockERC721.balanceOf(
                    auctionInfo.winner
                );

                let platformFeeRate = await this.marketplace.platformFee();
                let royaltyFeeRate = (
                    await this.marketplace.royaltyInfos(collectionAddress)
                ).royaltyRate;
                let feeAmount =
                    (BigInt(auctionInfo.winPrice) * BigInt(platformFeeRate)) /
                    BigInt(1000);
                let royaltyFee =
                    (BigInt(auctionInfo.winPrice) * BigInt(royaltyFeeRate)) /
                    BigInt(1000);
                let expectAmount =
                    BigInt(auctionInfo.winPrice) -
                    BigInt(feeAmount) -
                    BigInt(royaltyFee);

                expect(
                    smallNum(BigInt(afterBal) - BigInt(beforeBal))
                ).to.be.equal(smallNum(expectAmount));
                expect(afterCollectionBal - beforeCollectionBal).to.be.equal(
                    auctionCollection.length
                );
            });
        });

        describe("close auction", function () {
            it("reverts if caller is not the owner", async function () {
                await expect(
                    this.marketplace.connect(this.account_1).closeAuction(1)
                ).to.be.revertedWith("Ownable: caller is not the owner");
            });

            it("reverts if auctionId doesn't exist", async function () {
                await expect(
                    this.marketplace.closeAuction(1000)
                ).to.be.revertedWith("not exists auctionId");
            });

            it("close auction", async function () {
                let availableAuctionIds =
                    await this.marketplace.getAvailableAuctionIds();
                let auctionId = availableAuctionIds[0];
                let auctionInfo = await this.marketplace.auctionInfos(
                    auctionId
                );
                let winner = auctionInfo.winner;
                let maker = auctionInfo.auctionMaker;
                let winPrice = auctionInfo.winPrice;
                let quantity = auctionInfo.quantity;

                let beforeWinnerBalance = await this.DAI.balanceOf(winner);
                let beforeMakerBalance = await this.mockERC1155.balanceOf(
                    maker,
                    2
                );

                await expect(this.marketplace.closeAuction(auctionId))
                    .to.be.emit(this.marketplace, "AuctionClosed")
                    .withArgs(auctionId);

                let afterMakerBalance = await this.mockERC1155.balanceOf(
                    maker,
                    2
                );
                let afterWinnerBalance = await this.DAI.balanceOf(winner);

                expect(
                    smallNum(
                        BigInt(afterWinnerBalance) - BigInt(beforeWinnerBalance)
                    )
                ).to.be.equal(smallNum(winPrice));

                expect(
                    smallNum(
                        BigInt(afterMakerBalance) - BigInt(beforeMakerBalance)
                    )
                ).to.be.equal(smallNum(quantity));
            });
        });
    });

    describe("Offer", function () {
        describe("Place Offer", function () {
            let offerERC721Info;
            let offerERC1155Info;

            it("reverts if caller is not offeror", async function () {
                offerERC721Info = {
                    owner: this.account_4.address,
                    offeror: this.account_1.address,
                    paymentToken: this.DAI.address,
                    collectionAddress: this.mockERC721.address,
                    tokenId: 3,
                    quantity: 1,
                    offerPrice: bigNum(300),
                    isERC721: true,
                };

                offerERC1155Info = {
                    owner: this.account_5.address,
                    offeror: this.account_2.address,
                    paymentToken: this.DAI.address,
                    collectionAddress: this.mockERC1155.address,
                    tokenId: 2,
                    quantity: 2,
                    offerPrice: bigNum(300),
                    isERC721: false,
                };

                await expect(
                    this.marketplace.placeOffer(offerERC721Info)
                ).to.be.revertedWith("not correct offeror");
            });

            it("reverts if caller is blacklisted", async function () {
                offerERC721Info.offeror = this.scammer_1.address;
                await expect(
                    this.marketplace
                        .connect(this.scammer_1)
                        .placeOffer(offerERC721Info)
                ).to.be.revertedWith("blacklisted user");
                offerERC721Info.offeror = this.account_1.address;
            });

            it("reverts if quantity is not correct", async function () {
                offerERC721Info.quantity = 0;
                let offerPrice = offerERC721Info.offerPrice;
                await this.DAI.connect(this.account_1).approve(
                    this.marketplace.address,
                    BigInt(offerPrice)
                );
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeOffer(offerERC721Info)
                ).to.be.revertedWith("zero quantity");

                offerERC721Info.quantity = 2;
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeOffer(offerERC721Info)
                ).to.be.revertedWith("not correct quantity");

                offerERC721Info.quantity = 1;

                offerERC1155Info.quantity = 4;
                await this.DAI.connect(this.account_2).approve(
                    this.marketplace.address,
                    BigInt(offerERC1155Info.offerPrice)
                );
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .placeOffer(offerERC1155Info)
                ).to.be.revertedWith("not enough NFT balance");
                offerERC1155Info.quantity = 2;
            });

            it("reverts if owner is not correct", async function () {
                await this.DAI.connect(this.account_1).approve(
                    this.marketplace.address,
                    BigInt(offerERC721Info.offerPrice)
                );
                offerERC721Info.owner = this.account_3.address;
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeOffer(offerERC721Info)
                ).to.be.revertedWith("not correct collection owner");
                offerERC721Info.owner = this.account_4.address;
            });

            it("reverts if payment token is not allowed", async function () {
                offerERC721Info.paymentToken = this.BUSD.address;
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeOffer(offerERC721Info)
                ).to.be.revertedWith("not allowed payment token");
                offerERC721Info.paymentToken = this.DAI.address;
            });

            it("reverts if collection is blocked", async function () {
                offerERC721Info.tokenId = 0;
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeOffer(offerERC721Info)
                ).to.be.revertedWith("blacklisted collectionId");
                offerERC721Info.tokenId = 3;
            });

            it("reverts if allowance is not enough", async function () {
                await this.DAI.connect(this.account_1).approve(
                    this.marketplace.address,
                    0
                );
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeOffer(offerERC721Info)
                ).to.be.revertedWith("not enough allowance");
            });

            it("place offer", async function () {
                await this.DAI.connect(this.account_1).approve(
                    this.marketplace.address,
                    BigInt(offerERC721Info.offerPrice)
                );
                await expect(
                    this.marketplace
                        .connect(this.account_1)
                        .placeOffer(offerERC721Info)
                )
                    .to.be.emit(this.marketplace, "OfferPlaced")
                    .withArgs(
                        offerERC721Info.owner,
                        offerERC721Info.offeror,
                        offerERC721Info.collectionAddress,
                        offerERC721Info.tokenId,
                        offerERC721Info.quantity,
                        offerERC721Info.offerPrice,
                        0
                    );

                offerERC721Info.offeror = this.account_2.address;
                await this.DAI.connect(this.account_2).approve(
                    this.marketplace.address,
                    BigInt(offerERC721Info.offerPrice)
                );
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .placeOffer(offerERC721Info)
                )
                    .to.be.emit(this.marketplace, "OfferPlaced")
                    .withArgs(
                        offerERC721Info.owner,
                        offerERC721Info.offeror,
                        offerERC721Info.collectionAddress,
                        offerERC721Info.tokenId,
                        offerERC721Info.quantity,
                        offerERC721Info.offerPrice,
                        1
                    );

                await this.DAI.connect(this.account_2).approve(
                    this.marketplace.address,
                    BigInt(offerERC1155Info.offerPrice)
                );
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .placeOffer(offerERC1155Info)
                )
                    .to.be.emit(this.marketplace, "OfferPlaced")
                    .withArgs(
                        offerERC1155Info.owner,
                        offerERC1155Info.offeror,
                        offerERC1155Info.collectionAddress,
                        offerERC1155Info.tokenId,
                        offerERC1155Info.quantity,
                        offerERC1155Info.offerPrice,
                        2
                    );
            });
        });

        describe("accept Offer", function () {
            let availableOffers, offerIds;
            it("get available offers", async function () {
                [availableOffers, offerIds] =
                    await this.marketplace.getAvailableOffers(
                        this.account_4.address,
                        this.mockERC721.address
                    );
                expect(availableOffers.length).to.be.equal(2);
            });

            it("reverts if offerId doesn't exist", async function () {
                await expect(
                    this.marketplace.connect(this.account_2).acceptOffer(100)
                ).to.be.revertedWith("not exists offerId");
            });

            it("reverts if caller is not collection owner", async function () {
                await expect(
                    this.marketplace
                        .connect(this.account_2)
                        .acceptOffer(offerIds[0])
                ).to.be.revertedWith("no permission");
            });

            it("accept offer", async function () {
                let offerInfo = availableOffers[0];

                let offerPrice = offerInfo.offerPrice;
                let collectionAddress = offerInfo.collectionAddress;
                let platformFeeRate = await this.marketplace.platformFee();
                let royaltyFeeRate = (
                    await this.marketplace.royaltyInfos(collectionAddress)
                ).royaltyRate;
                let feeAmount =
                    (BigInt(offerPrice) * BigInt(platformFeeRate)) /
                    BigInt(1000);
                let royaltyFee =
                    (BigInt(offerPrice) * BigInt(royaltyFeeRate)) /
                    BigInt(1000);
                let expectAmount =
                    BigInt(offerPrice) - BigInt(feeAmount) - BigInt(royaltyFee);

                let beforeBal = await this.DAI.balanceOf(offerInfo.owner);
                let beforeCollectionBal = await this.mockERC721.balanceOf(
                    offerInfo.offeror
                );

                await expect(
                    this.marketplace
                        .connect(this.account_4)
                        .acceptOffer(offerIds[0])
                )
                    .to.be.emit(this.marketplace, "OfferAccepted")
                    .withArgs(
                        offerInfo.owner,
                        offerInfo.offeror,
                        offerInfo.collectionAddress,
                        offerInfo.tokenId,
                        offerInfo.quantity,
                        offerInfo.offerPrice,
                        offerIds[0]
                    );

                let afterBal = await this.DAI.balanceOf(offerInfo.owner);
                let afterCollectionBal = await this.mockERC721.balanceOf(
                    offerInfo.offeror
                );

                expect(
                    smallNum(BigInt(afterBal) - BigInt(beforeBal))
                ).to.be.equal(smallNum(expectAmount));
                expect(afterCollectionBal - beforeCollectionBal).to.be.equal(
                    offerInfo.quantity
                );
            });
        });
    });
});
