import Web3 from "web3";
import { ethers } from "hardhat";
import { LimitOrderBuilder, PrivateKeyProviderConnector } from "@1inch/limit-order-protocol";

import { AuctionPricingFunction, AuctionPricingDirection, buildAuctionOrder } from "../test/utils/auction.utils";

// 1inch
const CHAIN_ID = 137;
const LIMIT_ORDER_PROTOCOL_ADDRESS = "0x94bc2a1c732bcad7343b25af48385fe76e08734f";

// Auction
const AUCTION_ADDRESS = "0x3CaE05e18B9E4030fa6CDB9c42e4D75df3c00657"

const WETH_ADDRESS = "0x8800ab5de5976a682aa4acf76f01c703ce963413" // FAKE WETH
const USDC_ADDRESS = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"

const DEPLOYER = "0xe068647CDDBd46BD762aA8083D6e607C53675BD4";

const STARTED_AT = 1664316000; // Tue Sep 27 2022 22:00:00 GMT+0000
const ENDED_AT = 1666908000; // Thu Oct 27 2022 22:00:00 GMT+0000

const ETH_1 = ethers.utils.parseUnits("1", 18)
const USDC_3000 = ethers.utils.parseUnits("3000", 6)
const USDC_1500 = ethers.utils.parseUnits("1500", 6)

async function main() {
  const web3 = new Web3("https://polygon-rpc.com")
  const PKString = process.env.PRIVATE_KEY || ''
  const PKBuffer = Uint8Array.from(Buffer.from(PKString.substring(2)));
  const providerConnector = new PrivateKeyProviderConnector(PKString.substring(2), web3);
  const limitOrderBuilder = new LimitOrderBuilder(
    LIMIT_ORDER_PROTOCOL_ADDRESS,
    CHAIN_ID,
    providerConnector,
    () => "1337" // Hardcoded orders salt
  );
  const limitOrder = buildAuctionOrder(
    AUCTION_ADDRESS,
    limitOrderBuilder,
    {
      makerAssetAddress: WETH_ADDRESS,
      takerAssetAddress: USDC_ADDRESS,
      makerAddress: DEPLOYER,
      makerAmount: ETH_1.toString(),
    },
    {
      pricingFunction: AuctionPricingFunction.LINEAR,
      pricingDirection: AuctionPricingDirection.DECREASING,
      partialFill: true,
      minTakerAmount: USDC_1500.toString(),
      maxTakerAmount: USDC_3000.toString(),
      startedAt: STARTED_AT,
      endedAt: ENDED_AT
    }
  );
  const limitOrderTypedData = limitOrderBuilder.buildLimitOrderTypedData(limitOrder);
  const limitOrderSignature = await limitOrderBuilder.buildOrderSignature(DEPLOYER, limitOrderTypedData);
  
  console.log(JSON.stringify(
    {
      limitOrder,
      limitOrderSignature
    },
    null, 2
  ))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
