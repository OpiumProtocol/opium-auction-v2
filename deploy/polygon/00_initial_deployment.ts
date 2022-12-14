import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const ID = "0-POLY-MAINNET";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, ethers, network } = hre;
  const { deploy } = deployments;

  // Skip if network is not Polygon Mainnet
  if (network.name !== "polygon") {
    return;
  }

  const [deployer] = await ethers.getSigners();

  const deployOpiumAuctionV2HelperResult = await deploy(
    "OpiumAuctionV2Helper",
    {
      from: deployer.address,
      args: [deployer.address],
      log: true,
    }
  );

  console.log(
    `✓ OpiumAuctionV2Helper Deployed at ${deployOpiumAuctionV2HelperResult.address}`
  );

  return true;
};

export default func;
func.id = ID;
func.tags = [
  "OpiumAuctionV2Helper",
];
