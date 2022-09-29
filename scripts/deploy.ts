import { ethers } from "hardhat";

const DEPLOYER = "0xe068647CDDBd46BD762aA8083D6e607C53675BD4";

async function main() {
  const OpiumAuctionV2Helper = await ethers.getContractFactory("OpiumAuctionV2Helper");
  const auction = await OpiumAuctionV2Helper.deploy(DEPLOYER);

  await auction.deployed();

  console.log(`Deployed to ${auction.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
