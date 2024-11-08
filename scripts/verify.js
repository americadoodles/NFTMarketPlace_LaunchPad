const { ethers, network } = require("hardhat");
const {
    deployProxy,
    deploy,
    getContract,
    upgradeProxy,
    verify,
    verifyProxy,
} = require("./utils");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("verify contracts with ", deployer.address);

    console.log("verify launchPad contract");
    await verifyProxy("LaunchPad", "LaunchPad");

    console.log("verify wrapperGateway contract");
    await verifyProxy("WrapperGateway", "WrapperGateway");

    console.log("verify marketplace contract");
    await verifyProxy("Marketplace", "Marketplace");

    console.log("verified successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
