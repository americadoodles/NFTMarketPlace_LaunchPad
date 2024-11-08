const { expect } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("@openzeppelin/test-helpers");

const { abi } = require("../artifacts/contracts/ERC721A.sol/ERC721A.json");

const {
    deploy,
    getCurrentTimestamp,
    day,
    hour,
    getETHBalance,
    smallNum,
    bigNum,
    spendTime,
    deployProxy,
} = require("../scripts/utils");

describe("LaunchPad End-To-End test", function () {
    before(async function () {
        [
            this.deployer,
            this.collectionOwner_1,
            this.collectionOwner_2,
            this.collectionMinter_1,
            this.collectionMinter_2,
            this.collectionMinter_3,
            this.account_1,
            this.account_2,
            this.feeReceiver_1,
            this.feeReceiver_2,
            this.feeReceiver_3,
        ] = await ethers.getSigners();

        this.launchPad = await deployProxy("LaunchPad", "LaunchPad");
    });

    it("check deployment", async function () {
        console.log("deployed successfully!");
    });

    describe("deploy collection", function () {
        let maxSupply = 100;
        let mintPrice = ethers.utils.parseEther("0.5");
        let startTime;
        let endTime;
        let name = "collection_1";
        let symbol = "COL_1";
        let baseURI = "";

        it("reverts if maxSupply is zero", async function () {
            startTime = BigInt(await getCurrentTimestamp()) + BigInt(day);
            endTime = BigInt(startTime) + BigInt(day) * BigInt(5);

            await expect(
                this.launchPad
                    .connect(this.collectionOwner_1)
                    .deployCollection(
                        0,
                        BigInt(mintPrice),
                        BigInt(startTime),
                        BigInt(endTime),
                        0,
                        this.collectionOwner_1.address,
                        name,
                        symbol,
                        baseURI
                    )
            ).to.be.revertedWith("invalid maxSupply");
        });

        it("reverts if minting price is zero", async function () {
            await expect(
                this.launchPad
                    .connect(this.collectionOwner_1)
                    .deployCollection(
                        maxSupply,
                        0,
                        BigInt(startTime),
                        BigInt(endTime),
                        BigInt(maxSupply) / BigInt(2),
                        this.collectionOwner_1.address,
                        name,
                        symbol,
                        baseURI
                    )
            ).to.be.revertedWith("invalid minting price");
        });

        it("reverts if startTime is before current time", async function () {
            await expect(
                this.launchPad
                    .connect(this.collectionOwner_1)
                    .deployCollection(
                        maxSupply,
                        BigInt(mintPrice),
                        BigInt(startTime) - BigInt(2) * BigInt(day),
                        BigInt(endTime),
                        BigInt(maxSupply) / BigInt(2),
                        this.collectionOwner_1.address,
                        name,
                        symbol,
                        baseURI
                    )
            ).to.be.revertedWith("startTimestamp before current time");
        });

        it("reverts if endTime is before startTime", async function () {
            await expect(
                this.launchPad
                    .connect(this.collectionOwner_1)
                    .deployCollection(
                        maxSupply,
                        BigInt(mintPrice),
                        BigInt(startTime),
                        BigInt(startTime) - BigInt(hour),
                        BigInt(maxSupply) / BigInt(2),
                        this.collectionOwner_1.address,
                        name,
                        symbol,
                        baseURI
                    )
            ).to.be.revertedWith("endTimestamp before startTimestamp");
        });

        it("reverts if creator is zero address", async function () {
            await expect(
                this.launchPad
                    .connect(this.collectionOwner_1)
                    .deployCollection(
                        maxSupply,
                        BigInt(mintPrice),
                        BigInt(startTime),
                        BigInt(endTime),
                        BigInt(maxSupply) / BigInt(2),
                        constants.ZERO_ADDRESS,
                        name,
                        symbol,
                        baseURI
                    )
            ).to.be.revertedWith("zero creator address");
        });

        it("deploy collection", async function () {
            await this.launchPad
                .connect(this.collectionOwner_1)
                .deployCollection(
                    maxSupply,
                    BigInt(mintPrice),
                    BigInt(startTime),
                    BigInt(endTime),
                    BigInt(maxSupply) / BigInt(2),
                    this.collectionOwner_1.address,
                    name,
                    symbol,
                    baseURI
                );
        });

        it("get deployed collection addresses", async function () {
            let deployedCollections =
                await this.launchPad.getDeployedCollections(
                    this.collectionOwner_1.address
                );
            expect(deployedCollections.length).to.be.equal(1);
        });
    });

    describe("mint collection", function () {
        describe("mint through LaunchPad", function () {
            let deployedCollection;
            let mintingPrice;
            it("reverts if try to mint before startTime", async function () {
                deployedCollection =
                    await this.launchPad.getDeployedCollections(
                        this.collectionOwner_1.address
                    );
                expect(deployedCollection[0].availableMint).to.be.equal(false);

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .enableWhitelistMode(
                        deployedCollection[0].collectionAddress,
                        false
                    );

                await expect(
                    this.launchPad
                        .connect(this.collectionMinter_1)
                        .mintCollection(
                            deployedCollection[0].collectionAddress,
                            10
                        )
                ).to.be.revertedWith("before start time");
            });

            it("enable whitelist mode", async function () {
                deployedCollection =
                    await this.launchPad.getDeployedCollections(
                        this.collectionOwner_1.address
                    );
                deployedCollection = deployedCollection[0].collectionAddress;
                let collection = new ethers.Contract(
                    deployedCollection,
                    abi,
                    this.deployer
                );
                mintingPrice = await collection.mintingPrice();
                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .enableWhitelistMode(deployedCollection, true);
            });

            it("only whitelisted user can mint before startTime", async function () {
                await expect(
                    this.launchPad
                        .connect(this.collectionMinter_1)
                        .mintCollection(deployedCollection, 2)
                ).to.be.revertedWith("only whitelist");
            });

            it("add whitelists", async function () {
                await expect(
                    this.launchPad
                        .connect(this.collectionOwner_2)
                        .setWhitelistAddrs(
                            deployedCollection,
                            [
                                this.collectionMinter_1.address,
                                this.collectionMinter_2.address,
                            ],
                            true
                        )
                ).to.be.revertedWith("not collection owner");

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .setWhitelistAddrs(
                        deployedCollection,
                        [
                            this.collectionMinter_1.address,
                            this.collectionMinter_2.address,
                        ],
                        true
                    );
            });

            it("change startTime", async function () {
                /// reverts if caller is not collection owner
                await expect(
                    this.launchPad
                        .connect(this.collectionOwner_2)
                        .changeStartTime(
                            deployedCollection,
                            BigInt(await getCurrentTimestamp()) + BigInt(day)
                        )
                ).to.be.revertedWith("not collection owner");

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .changeStartTime(
                        deployedCollection,
                        BigInt(await getCurrentTimestamp()) + BigInt(day)
                    );
            });

            it("reverts if minter is not whitelisted", async function () {
                await expect(
                    this.launchPad
                        .connect(this.collectionMinter_3)
                        .mintCollection(deployedCollection, 1, {
                            value: BigInt(mintingPrice),
                        })
                ).to.be.revertedWith("only whitelist");
            });

            it("change whitelist minting price", async function () {
                let whitelistMintingPrice = ethers.utils.parseEther("0.3");
                await expect(
                    this.launchPad
                        .connect(this.collectionOwner_2)
                        .setPriceForWhitelist(
                            deployedCollection,
                            BigInt(whitelistMintingPrice)
                        )
                ).to.be.revertedWith("not collection owner");

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .setPriceForWhitelist(
                        deployedCollection,
                        BigInt(whitelistMintingPrice)
                    );
            });

            it("mint collection and check payment distribution", async function () {
                let amountForMinting = ethers.utils.parseEther("0.5");
                let whitelistMintingPrice = ethers.utils.parseEther("0.3");
                let collection = new ethers.Contract(
                    deployedCollection,
                    abi,
                    this.deployer
                );
                let feeRate = await collection.feeRate();
                console.log("feeRate: ", feeRate);
                expect(Number(feeRate)).to.be.equal(0);
                let beforeETHBal = await getETHBalance(
                    this.collectionMinter_1.address
                );
                let beforeCreatorBal = await getETHBalance(
                    this.collectionOwner_1.address
                );
                await this.launchPad
                    .connect(this.collectionMinter_1)
                    .mintCollection(deployedCollection, 1, {
                        value: BigInt(amountForMinting),
                    });
                let afterETHBal = await getETHBalance(
                    this.collectionMinter_1.address
                );
                let afterCreatorBal = await getETHBalance(
                    this.collectionOwner_1.address
                );

                expect(
                    smallNum(BigInt(beforeETHBal) - BigInt(afterETHBal))
                ).to.be.closeTo(smallNum(whitelistMintingPrice), 0.001);

                expect(
                    smallNum(BigInt(afterCreatorBal) - BigInt(beforeCreatorBal))
                ).to.be.equal(smallNum(whitelistMintingPrice));
            });

            it("set collection fee", async function () {
                let feeRate = 100; // 10%
                /// reverts if caller is not collection owner.
                await expect(
                    this.launchPad
                        .connect(this.collectionOwner_2)
                        .setCollectionFeeRate(deployedCollection, feeRate)
                ).to.be.revertedWith("not collection owner");

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .setCollectionFeeRate(deployedCollection, feeRate);
            });

            it("mint collection and check payment distribution", async function () {
                let amountForMinting = ethers.utils.parseEther("0.5");
                let whitelistMintingPrice = ethers.utils.parseEther("0.3");
                let collection = new ethers.Contract(
                    deployedCollection,
                    abi,
                    this.deployer
                );
                let feeRate = await collection.feeRate();
                console.log("feeRate: ", feeRate);
                expect(Number(feeRate)).to.be.greaterThan(0);

                let beforeETHBal = await getETHBalance(
                    this.collectionMinter_1.address
                );
                let beforeCreatorBal = await getETHBalance(
                    this.collectionOwner_1.address
                );
                let beforeOwnerBal = await getETHBalance(
                    this.launchPad.address
                );
                await this.launchPad
                    .connect(this.collectionMinter_1)
                    .mintCollection(deployedCollection, 1, {
                        value: BigInt(amountForMinting),
                    });
                let afterETHBal = await getETHBalance(
                    this.collectionMinter_1.address
                );
                let afterCreatorBal = await getETHBalance(
                    this.collectionOwner_1.address
                );
                let afterOwnerBal = await getETHBalance(this.launchPad.address);

                expect(
                    smallNum(BigInt(beforeETHBal) - BigInt(afterETHBal))
                ).to.be.closeTo(smallNum(whitelistMintingPrice), 0.001);

                let feeAmount =
                    (BigInt(whitelistMintingPrice) * BigInt(feeRate)) /
                    BigInt(1000);
                let expectReceiveAmount =
                    BigInt(whitelistMintingPrice) - BigInt(feeAmount);

                expect(smallNum(feeAmount)).to.be.equal(
                    smallNum(BigInt(afterOwnerBal) - BigInt(beforeOwnerBal))
                );
                expect(smallNum(expectReceiveAmount)).to.be.equal(
                    smallNum(BigInt(afterCreatorBal) - BigInt(beforeCreatorBal))
                );
            });

            it("reverts if payment is not enough for minting", async function () {
                let amountForMinting = ethers.utils.parseEther("0.5");
                await expect(
                    this.launchPad
                        .connect(this.collectionMinter_1)
                        .mintCollection(deployedCollection, 2, {
                            value: BigInt(amountForMinting),
                        })
                ).to.be.revertedWith("not enough cost");
            });

            it("mint collection as many as users can", async function () {
                let collection = new ethers.Contract(
                    deployedCollection,
                    abi,
                    this.deployer
                );
                let maxSupply = await collection.maxSupply();
                let totalSupply = await collection.totalSupply();
                let availableMint = maxSupply - totalSupply;
                availableMint = BigInt(availableMint) / BigInt(2);
                let mintingPrice = await collection.whitelistMintingPrice();
                console.log("availableMint amount: ", availableMint);

                let requiredETH = BigInt(mintingPrice) * BigInt(availableMint);
                await this.launchPad
                    .connect(this.collectionMinter_2)
                    .mintCollection(deployedCollection, availableMint, {
                        value: BigInt(requiredETH),
                    });

                await this.launchPad
                    .connect(this.collectionMinter_2)
                    .mintCollection(deployedCollection, availableMint, {
                        value: BigInt(requiredETH),
                    });
            });

            it("reverts if collection supply amount exceed to maxSupply", async function () {
                await expect(
                    this.launchPad
                        .connect(this.collectionMinter_1)
                        .mintCollection(deployedCollection, 1, {
                            value: bigNum(1),
                        })
                ).to.be.revertedWith("over maxSupply");
            });

            it("change maxTotalSupply", async function () {
                await expect(
                    this.launchPad
                        .connect(this.collectionOwner_2)
                        .changeMaxTotalSupply(deployedCollection, 200)
                ).to.be.revertedWith("not collection owner");

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .changeMaxTotalSupply(deployedCollection, 200);
            });

            it("set multiple recipients", async function () {
                /// reverts if caller is not collection owner.
                await expect(
                    this.launchPad
                        .connect(this.collectionMinter_2)
                        .setMultiRecipients(
                            deployedCollection,
                            [
                                this.feeReceiver_1.address,
                                this.feeReceiver_2.address,
                                this.feeReceiver_3.address,
                            ],
                            [200, 300, 500]
                        )
                ).to.be.revertedWith("not collection owner");

                /// reverts if weights are invalid
                await expect(
                    this.launchPad
                        .connect(this.collectionOwner_1)
                        .setMultiRecipients(
                            deployedCollection,
                            [
                                this.feeReceiver_1.address,
                                this.feeReceiver_2.address,
                                this.feeReceiver_3.address,
                            ],
                            [200, 300, 400]
                        )
                ).to.be.revertedWith("invalid weight");

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .setMultiRecipients(
                        deployedCollection,
                        [
                            this.feeReceiver_1.address,
                            this.feeReceiver_2.address,
                            this.feeReceiver_3.address,
                        ],
                        [200, 300, 500]
                    );
            });

            it("mint collection and check payment distribution", async function () {
                let collection = new ethers.Contract(
                    deployedCollection,
                    abi,
                    this.deployer
                );
                let feeDistributions = await collection.getFeeDistributions();
                expect(feeDistributions.length).to.be.equal(3);

                let whitelistMintingPrice = ethers.utils.parseEther("0.3");
                let quantity = 10;
                let requireETH =
                    BigInt(whitelistMintingPrice) * BigInt(quantity);
                let feeRate = await collection.feeRate();
                console.log("feeRate: ", feeRate);

                let beforeBal_1 = await getETHBalance(
                    feeDistributions[0].recipient
                );
                let beforeBal_2 = await getETHBalance(
                    feeDistributions[1].recipient
                );
                let beforeBal_3 = await getETHBalance(
                    feeDistributions[2].recipient
                );
                await this.launchPad
                    .connect(this.collectionMinter_1)
                    .mintCollection(deployedCollection, quantity, {
                        value: BigInt(requireETH),
                    });
                let afterBal_1 = await getETHBalance(
                    feeDistributions[0].recipient
                );
                let afterBal_2 = await getETHBalance(
                    feeDistributions[1].recipient
                );
                let afterBal_3 = await getETHBalance(
                    feeDistributions[2].recipient
                );

                let feeAmount =
                    (BigInt(requireETH) * BigInt(feeRate)) / BigInt(1000);
                let expectReceiveAmount =
                    BigInt(requireETH) - BigInt(feeAmount);
                let expectFee_1 =
                    (BigInt(expectReceiveAmount) *
                        BigInt(feeDistributions[0].rate)) /
                    BigInt(1000);
                let expectFee_2 =
                    (BigInt(expectReceiveAmount) *
                        BigInt(feeDistributions[1].rate)) /
                    BigInt(1000);
                let expectFee_3 =
                    BigInt(expectReceiveAmount) -
                    BigInt(expectFee_1) -
                    BigInt(expectFee_2);

                expect(
                    smallNum(BigInt(afterBal_1) - BigInt(beforeBal_1))
                ).to.be.equal(smallNum(expectFee_1));
                expect(
                    smallNum(BigInt(afterBal_2) - BigInt(beforeBal_2))
                ).to.be.equal(smallNum(expectFee_2));
                expect(
                    smallNum(BigInt(afterBal_3) - BigInt(beforeBal_3))
                ).to.be.equal(smallNum(expectFee_3));
            });

            it("change endTime", async function () {
                let collection = new ethers.Contract(
                    deployedCollection,
                    abi,
                    this.deployer
                );
                let endTimestamp =
                    BigInt(await collection.mintingStartTime()) +
                    BigInt(day) * BigInt(5);
                await expect(
                    this.launchPad
                        .connect(this.account_1)
                        .changeEndTime(deployedCollection, BigInt(endTimestamp))
                ).to.be.revertedWith("not collection owner");

                let mintingStartTime = await collection.mintingStartTime();
                await expect(
                    this.launchPad
                        .connect(this.collectionOwner_1)
                        .changeEndTime(
                            deployedCollection,
                            BigInt(mintingStartTime)
                        )
                ).to.be.revertedWith("before startTime");

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .changeEndTime(deployedCollection, BigInt(endTimestamp));

                expect(BigInt(await collection.mintingEndTime())).to.be.equal(
                    BigInt(endTimestamp)
                );
            });

            it("disable whitelist and let anyone can mint", async function () {
                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .enableWhitelistMode(deployedCollection, false);

                await expect(
                    this.launchPad
                        .connect(this.collectionMinter_3)
                        .mintCollection(deployedCollection, 2, {
                            value: bigNum(1),
                        })
                ).to.be.revertedWith("before start time");

                await spendTime(day);

                let beforeBal = await getETHBalance(
                    this.collectionMinter_3.address
                );
                await this.launchPad
                    .connect(this.collectionMinter_3)
                    .mintCollection(deployedCollection, 1, {
                        value: bigNum(1),
                    });
                let afterBal = await getETHBalance(
                    this.collectionMinter_3.address
                );

                let collection = new ethers.Contract(
                    deployedCollection,
                    abi,
                    this.deployer
                );
                mintingPrice = await collection.mintingPrice();
                expect(
                    smallNum(BigInt(beforeBal) - BigInt(afterBal))
                ).to.be.closeTo(smallNum(mintingPrice), 0.001);
            });

            it("force finishMinting and check totalSupply", async function () {
                let collection = new ethers.Contract(
                    deployedCollection,
                    abi,
                    this.deployer
                );
                let deployedCollectionInfo =
                    await this.launchPad.getDeployedCollections(
                        this.collectionOwner_1.address
                    );
                expect(deployedCollectionInfo[0].availableMint).to.be.equal(
                    true
                );
                let maxSupply = await collection.maxSupply();
                let totalSupply = await collection.totalSupply();
                expect(Number(maxSupply)).to.be.greaterThan(
                    Number(totalSupply)
                );

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .forceFinishMinting(deployedCollection);

                deployedCollectionInfo =
                    await this.launchPad.getDeployedCollections(
                        this.collectionOwner_1.address
                    );
                expect(deployedCollectionInfo[0].availableMint).to.be.equal(
                    false
                );
                maxSupply = await collection.maxSupply();
                totalSupply = await collection.totalSupply();
                expect(Number(maxSupply)).to.be.equal(Number(totalSupply));
            });

            it("withdraw", async function () {
                /// reverts if caller is not the owner
                await expect(
                    this.launchPad
                        .connect(this.collectionOwner_1)
                        .withdraw(constants.ZERO_ADDRESS)
                ).to.be.revertedWith("Ownable: caller is not the owner");

                let balance = await getETHBalance(this.launchPad.address);
                let beforeBal = await getETHBalance(this.deployer.address);
                await this.launchPad.withdraw(constants.ZERO_ADDRESS);
                let afterBal = await getETHBalance(this.deployer.address);

                expect(
                    smallNum(BigInt(afterBal) - BigInt(beforeBal))
                ).to.be.closeTo(smallNum(balance), 0.001);
            });
        });

        describe("mint through collection directly", function () {
            let maxSupply = 100;
            let mintPrice = ethers.utils.parseEther("0.5");
            let startTime;
            let endTime;
            let name = "collection_2";
            let symbol = "COL_2";
            let baseURI = "";
            let deployedCollection;
            let mintingPrice;
            it("deploy collection", async function () {
                startTime = BigInt(await getCurrentTimestamp()) + BigInt(day);
                endTime = BigInt(startTime) + BigInt(day) * BigInt(5);

                await this.launchPad
                    .connect(this.collectionOwner_1)
                    .deployCollection(
                        maxSupply,
                        BigInt(mintPrice),
                        BigInt(startTime),
                        BigInt(endTime),
                        BigInt(maxSupply) / BigInt(2),
                        this.collectionOwner_1.address,
                        name,
                        symbol,
                        baseURI
                    );
            });

            it("reverts if try to mint before startTime", async function () {
                deployedCollection =
                    await this.launchPad.getDeployedCollections(
                        this.collectionOwner_1.address
                    );
                expect(deployedCollection[1].availableMint).to.be.equal(false);

                deployedCollection = new ethers.Contract(
                    deployedCollection[1].collectionAddress,
                    abi,
                    this.deployer
                );
                await deployedCollection
                    .connect(this.collectionOwner_1)
                    .enableWhitelistMode(false);
                await expect(
                    deployedCollection
                        .connect(this.collectionMinter_1)
                        .mintNFT(10)
                ).to.be.revertedWith("before start time");
            });

            it("enable whitelist mode", async function () {
                await deployedCollection
                    .connect(this.collectionOwner_1)
                    .enableWhitelistMode(true);
            });

            it("reverts if minter is not whitelisted", async function () {
                await expect(
                    deployedCollection
                        .connect(this.collectionMinter_1)
                        .mintNFT(2)
                ).to.be.revertedWith("only whitelist");
            });

            it("add whitelist", async function () {
                await deployedCollection
                    .connect(this.collectionOwner_1)
                    .setWhitelist(
                        [
                            this.collectionMinter_1.address,
                            this.collectionMinter_2.address,
                        ],
                        true
                    );
            });

            it("change whitelist minting price", async function () {
                let whitelistMintingPrice = ethers.utils.parseEther("0.3");
                await expect(
                    deployedCollection
                        .connect(this.collectionOwner_2)
                        .setPriceForWhitelist(BigInt(whitelistMintingPrice))
                ).to.be.revertedWith("only creator");

                await deployedCollection
                    .connect(this.collectionOwner_1)
                    .setPriceForWhitelist(BigInt(whitelistMintingPrice));
            });

            it("mint collection and check payment distribution", async function () {
                let amountForMinting = ethers.utils.parseEther("0.5");
                let whitelistMintingPrice = ethers.utils.parseEther("0.3");
                let feeRate = await deployedCollection.feeRate();
                console.log("feeRate: ", feeRate);
                expect(Number(feeRate)).to.be.equal(0);
                let beforeETHBal = await getETHBalance(
                    this.collectionMinter_1.address
                );
                let beforeCreatorBal = await getETHBalance(
                    this.collectionOwner_1.address
                );
                await deployedCollection
                    .connect(this.collectionMinter_1)
                    .mintNFT(1, { value: BigInt(amountForMinting) });
                let afterETHBal = await getETHBalance(
                    this.collectionMinter_1.address
                );
                let afterCreatorBal = await getETHBalance(
                    this.collectionOwner_1.address
                );

                expect(
                    smallNum(BigInt(beforeETHBal) - BigInt(afterETHBal))
                ).to.be.closeTo(smallNum(whitelistMintingPrice), 0.001);

                expect(
                    smallNum(BigInt(afterCreatorBal) - BigInt(beforeCreatorBal))
                ).to.be.equal(smallNum(whitelistMintingPrice));
            });

            it("set collection fee", async function () {
                let feeRate = 100; // 10%
                /// reverts if caller is only creator.
                await expect(
                    deployedCollection
                        .connect(this.collectionOwner_2)
                        .setCollectionFeeRate(feeRate)
                ).to.be.revertedWith("only creator");

                await deployedCollection
                    .connect(this.collectionOwner_1)
                    .setCollectionFeeRate(feeRate);
            });

            it("mint collection and check payment distribution", async function () {
                let amountForMinting = ethers.utils.parseEther("0.5");
                let whitelistMintingPrice = ethers.utils.parseEther("0.3");
                let feeRate = await deployedCollection.feeRate();
                console.log("feeRate: ", feeRate);
                expect(Number(feeRate)).to.be.greaterThan(0);

                let beforeETHBal = await getETHBalance(
                    this.collectionMinter_1.address
                );
                let beforeCreatorBal = await getETHBalance(
                    this.collectionOwner_1.address
                );
                let beforeOwnerBal = await getETHBalance(
                    this.launchPad.address
                );
                await deployedCollection
                    .connect(this.collectionMinter_1)
                    .mintNFT(1, { value: BigInt(amountForMinting) });
                let afterETHBal = await getETHBalance(
                    this.collectionMinter_1.address
                );
                let afterCreatorBal = await getETHBalance(
                    this.collectionOwner_1.address
                );
                let afterOwnerBal = await getETHBalance(this.launchPad.address);

                expect(
                    smallNum(BigInt(beforeETHBal) - BigInt(afterETHBal))
                ).to.be.closeTo(smallNum(whitelistMintingPrice), 0.001);

                let feeAmount =
                    (BigInt(whitelistMintingPrice) * BigInt(feeRate)) /
                    BigInt(1000);
                let expectReceiveAmount =
                    BigInt(whitelistMintingPrice) - BigInt(feeAmount);

                expect(smallNum(feeAmount)).to.be.equal(
                    smallNum(BigInt(afterOwnerBal) - BigInt(beforeOwnerBal))
                );
                expect(smallNum(expectReceiveAmount)).to.be.equal(
                    smallNum(BigInt(afterCreatorBal) - BigInt(beforeCreatorBal))
                );
            });

            it("reverts if payment is not enough for minting", async function () {
                let amountForMinting = ethers.utils.parseEther("0.5");
                await expect(
                    deployedCollection
                        .connect(this.collectionMinter_1)
                        .mintNFT(2, { value: BigInt(amountForMinting) })
                ).to.be.revertedWith("not enough cost");
            });

            it("mint collection as many as users can", async function () {
                let maxSupply = await deployedCollection.maxSupply();
                let totalSupply = await deployedCollection.totalSupply();
                let availableMint = maxSupply - totalSupply;
                availableMint = BigInt(availableMint) / BigInt(2);
                let mintingPrice =
                    await deployedCollection.whitelistMintingPrice();
                console.log("availableMint amount: ", availableMint);

                let requiredETH = BigInt(mintingPrice) * BigInt(availableMint);
                await deployedCollection
                    .connect(this.collectionMinter_2)
                    .mintNFT(availableMint, { value: BigInt(requiredETH) });

                await deployedCollection
                    .connect(this.collectionMinter_2)
                    .mintNFT(availableMint, { value: BigInt(requiredETH) });
            });

            it("reverts if collection supply amount exceed to maxSupply", async function () {
                await expect(
                    deployedCollection
                        .connect(this.collectionMinter_1)
                        .mintNFT(1, { value: bigNum(1) })
                ).to.be.revertedWith("over maxSupply");
            });

            it("change maxTotalSupply", async function () {
                await expect(
                    deployedCollection
                        .connect(this.collectionOwner_2)
                        .changeMaxTotalSupply(200)
                ).to.be.revertedWith("only creator");

                await deployedCollection
                    .connect(this.collectionOwner_1)
                    .changeMaxTotalSupply(200);
            });

            it("set multiple recipients", async function () {
                /// reverts if caller is only creator.
                await expect(
                    deployedCollection
                        .connect(this.collectionMinter_2)
                        .setMultipleRecipients(
                            [
                                this.feeReceiver_1.address,
                                this.feeReceiver_2.address,
                                this.feeReceiver_3.address,
                            ],
                            [200, 300, 500]
                        )
                ).to.be.revertedWith("only creator");

                /// reverts if weights are invalid
                await expect(
                    deployedCollection
                        .connect(this.collectionOwner_1)
                        .setMultipleRecipients(
                            [
                                this.feeReceiver_1.address,
                                this.feeReceiver_2.address,
                                this.feeReceiver_3.address,
                            ],
                            [200, 300, 400]
                        )
                ).to.be.revertedWith("invalid weight");

                await deployedCollection
                    .connect(this.collectionOwner_1)
                    .setMultipleRecipients(
                        [
                            this.feeReceiver_1.address,
                            this.feeReceiver_2.address,
                            this.feeReceiver_3.address,
                        ],
                        [200, 300, 500]
                    );
            });

            it("mint collection and check payment distribution", async function () {
                let feeDistributions =
                    await deployedCollection.getFeeDistributions();
                expect(feeDistributions.length).to.be.equal(3);

                let whitelistMintingPrice = ethers.utils.parseEther("0.3");
                let quantity = 10;
                let requireETH =
                    BigInt(whitelistMintingPrice) * BigInt(quantity);
                let feeRate = await deployedCollection.feeRate();
                console.log("feeRate: ", feeRate);

                let beforeBal_1 = await getETHBalance(
                    feeDistributions[0].recipient
                );
                let beforeBal_2 = await getETHBalance(
                    feeDistributions[1].recipient
                );
                let beforeBal_3 = await getETHBalance(
                    feeDistributions[2].recipient
                );
                await deployedCollection
                    .connect(this.collectionMinter_1)
                    .mintNFT(quantity, { value: BigInt(requireETH) });
                let afterBal_1 = await getETHBalance(
                    feeDistributions[0].recipient
                );
                let afterBal_2 = await getETHBalance(
                    feeDistributions[1].recipient
                );
                let afterBal_3 = await getETHBalance(
                    feeDistributions[2].recipient
                );

                let feeAmount =
                    (BigInt(requireETH) * BigInt(feeRate)) / BigInt(1000);
                let expectReceiveAmount =
                    BigInt(requireETH) - BigInt(feeAmount);
                let expectFee_1 =
                    (BigInt(expectReceiveAmount) *
                        BigInt(feeDistributions[0].rate)) /
                    BigInt(1000);
                let expectFee_2 =
                    (BigInt(expectReceiveAmount) *
                        BigInt(feeDistributions[1].rate)) /
                    BigInt(1000);
                let expectFee_3 =
                    BigInt(expectReceiveAmount) -
                    BigInt(expectFee_1) -
                    BigInt(expectFee_2);

                expect(
                    smallNum(BigInt(afterBal_1) - BigInt(beforeBal_1))
                ).to.be.equal(smallNum(expectFee_1));
                expect(
                    smallNum(BigInt(afterBal_2) - BigInt(beforeBal_2))
                ).to.be.equal(smallNum(expectFee_2));
                expect(
                    smallNum(BigInt(afterBal_3) - BigInt(beforeBal_3))
                ).to.be.equal(smallNum(expectFee_3));
            });

            it("disable whitelist and let anyone can mint", async function () {
                await deployedCollection
                    .connect(this.collectionOwner_1)
                    .enableWhitelistMode(false);

                await expect(
                    deployedCollection
                        .connect(this.collectionMinter_3)
                        .mintNFT(2, { value: bigNum(1) })
                ).to.be.revertedWith("before start time");

                await spendTime(day);

                let beforeBal = await getETHBalance(
                    this.collectionMinter_3.address
                );
                await deployedCollection
                    .connect(this.collectionMinter_3)
                    .mintNFT(1, { value: bigNum(1) });
                let afterBal = await getETHBalance(
                    this.collectionMinter_3.address
                );

                mintingPrice = await deployedCollection.mintingPrice();
                expect(
                    smallNum(BigInt(beforeBal) - BigInt(afterBal))
                ).to.be.closeTo(smallNum(mintingPrice), 0.001);
            });

            it("foce finishMinting and check totalSupply", async function () {
                let deployedCollectionInfo =
                    await this.launchPad.getDeployedCollections(
                        this.collectionOwner_1.address
                    );
                expect(deployedCollectionInfo[1].availableMint).to.be.equal(
                    true
                );
                let maxSupply = await deployedCollection.maxSupply();
                let totalSupply = await deployedCollection.totalSupply();
                expect(Number(maxSupply)).to.be.greaterThan(
                    Number(totalSupply)
                );

                await deployedCollection
                    .connect(this.collectionOwner_1)
                    .forceFinishMinting();

                deployedCollectionInfo =
                    await this.launchPad.getDeployedCollections(
                        this.collectionOwner_1.address
                    );
                expect(deployedCollectionInfo[1].availableMint).to.be.equal(
                    false
                );
                maxSupply = await deployedCollection.maxSupply();
                totalSupply = await deployedCollection.totalSupply();
                expect(Number(maxSupply)).to.be.equal(Number(totalSupply));
            });
        });
    });
});
