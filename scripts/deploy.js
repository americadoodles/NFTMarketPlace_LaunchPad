const { ethers, network } = require("hardhat");
const { deployProxy, deploy, getContract, upgradeProxy } = require("./utils");

async function updateMarketplace() {
    let marketplace = await getContract(
        "Marketplace",
        "Marketplace",
        network.name
    );

    await upgradeProxy("Marketplace", "Marketplace", marketplace.address);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    let platformFee = 20; /// 2%
    let WETH = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";
    const launchPad = await deployProxy("LaunchPad", "LaunchPad");
    const marketplace = await deployProxy("Marketplace", "Marketplace", [
        launchPad.address,
        platformFee,
    ]);
    const wrapperGateway = await deployProxy(
        "WrapperGateway",
        "WrapperGateway",
        [marketplace.address, WETH]
    );

    /// deploy mockDAI for test.
    // const mockDAI = await deploy("MockERC20", "MockDAI", "MockDAI", "MDAI");
    // const mockBUSD = await deploy("MockERC20", "MockBUSD", "MockBUSD", "MBUSD");
    const mockDAI = await getContract("MockERC20", "MockDAI");
    const mockBUSD = await getContract("MockERC20", "MockBUSD");

    let tx = await marketplace.setAllowedToken(
        [mockDAI.address, mockBUSD.address, WETH],
        true
    );
    await tx.wait();

    tx = await marketplace.setWrapperGateway(wrapperGateway.address);
    await tx.wait();

    // await updateMarketplace();

    console.log("deployed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
