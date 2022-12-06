import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { VoidSigner } from "ethers";
import {
  buildAuctionOrder,
  encodeOrder,
  AuctionPricingFunction,
  AuctionPricingDirection,
  EthersSignerConnector,
} from '@opiumteam/opium-auction-v2-utils';

import {
  LimitOrderBuilder,
  LimitOrderProtocolFacade,
} from "@1inch/limit-order-protocol";

// 1inch constants
const CHAIN_ID = 42161;
const LIMIT_ORDER_PROTOCOL_ADDRESS =
  "0x7f069df72b7a39bce9806e3afaf579e54d8cf2b9";

// Test constants
const ETH_1 = ethers.utils.parseUnits("1", 18)
const USDC_3000 = ethers.utils.parseUnits("3000", 6)
const USDC_1500 = ethers.utils.parseUnits("1500", 6)
const USDC_2300 = ethers.utils.parseUnits("2300", 6)
const USDC_2250 = ethers.utils.parseUnits("2250", 6)

const HOUR_1 = 3600

// Auction constants
const INCREASING = true
const DECREASING = false

const FEE_BASE = 100_000

const SALT = "1337"

describe("UsingOpiumAuctionV2", function () {
  async function prepare() {
    const [ owner, random, taker, feesReceiver ] = await ethers.getSigners();

    // Signers preparation
    const randomProviderConnector = new EthersSignerConnector(random as unknown as VoidSigner);
    const randomLimitOrderBuilder = new LimitOrderBuilder(
      LIMIT_ORDER_PROTOCOL_ADDRESS,
      CHAIN_ID,
      randomProviderConnector,
      () => SALT // Hardcoded orders salt
    );

    // Mocks
    const MockToken = await ethers.getContractFactory("MockToken");
    const weth = await MockToken.deploy("WETH", "WETH", 18);
    const usdc = await MockToken.deploy("USDC", "USDC", 6);

    // Limit Order Protocol
    const takerProviderConnector = new EthersSignerConnector(taker as unknown as VoidSigner);
    const takerLimitOrderProtocolFacade = new LimitOrderProtocolFacade(
      LIMIT_ORDER_PROTOCOL_ADDRESS,
      takerProviderConnector
    );

    // Helper contract
    const OpiumAuctionV2Helper = await ethers.getContractFactory("OpiumAuctionV2Helper");
    const helper = await OpiumAuctionV2Helper.deploy(feesReceiver.address);

    // Helper contract
    const MockUsingOpiumAuctionV2 = await ethers.getContractFactory("MockUsingOpiumAuctionV2");
    const usingContract = await MockUsingOpiumAuctionV2.deploy(helper.address, LIMIT_ORDER_PROTOCOL_ADDRESS);

    // Setup Mocks
    await weth.transfer(usingContract.address, ETH_1);
    await usdc.transfer(taker.address, USDC_3000);

    return {
      // Accounts
      owner, taker, feesReceiver,
      randomLimitOrderBuilder,
      takerLimitOrderProtocolFacade,
      // Contracts
      helper, usingContract,
      usdc, weth,
    };
  }

  it("Should settle decreasing linear auction via maker amount", async function () {
    const { taker, feesReceiver, randomLimitOrderBuilder, takerLimitOrderProtocolFacade, helper, usingContract, weth, usdc } = await loadFixture(prepare);

    expect(await weth.balanceOf(usingContract.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(taker.address)).to.equal(USDC_3000);

    // Set an auction current to the half
    const currentTime = await time.latest()
    const startedAt = currentTime - HOUR_1 / 2
    const endedAt = currentTime + HOUR_1 / 2

    // Maker preparation
    await usingContract.startAuction({
      sellingToken: weth.address,
      purchasingToken: usdc.address,
      sellingAmount: ETH_1.toString(),
      pricingFunction: AuctionPricingFunction.LINEAR,
      pricingFunctionParams: [],
      pricingDirection: AuctionPricingDirection.DECREASING,
      partialFill: true,
      minPurchasingAmount: USDC_1500.toString(),
      maxPurchasingAmount: USDC_3000.toString(),
      startedAt,
      endedAt,
      salt: SALT
    });
    const makerLimitOrder = buildAuctionOrder(
      helper.address,
      randomLimitOrderBuilder,
      {
        makerAssetAddress: weth.address,
        takerAssetAddress: usdc.address,
        makerAddress: usingContract.address,
        makerAmount: ETH_1.toString(),
        nonce: 0
      },
      {
        pricingFunction: AuctionPricingFunction.LINEAR,
        pricingDirection: AuctionPricingDirection.DECREASING,
        partialFill: true,
        minTakerAmount: USDC_1500.toString(),
        maxTakerAmount: USDC_3000.toString(),
        startedAt,
        endedAt
      }
    );
    const makerLimitOrderSignature = encodeOrder(makerLimitOrder);

    // Taker preparation
    const callData = takerLimitOrderProtocolFacade.fillLimitOrder(
      makerLimitOrder,
      makerLimitOrderSignature,
      ETH_1.toString(),
      "0",
      USDC_2250.toString()
    );
    await usdc.connect(taker).approve(LIMIT_ORDER_PROTOCOL_ADDRESS, USDC_2250);
    await taker.sendTransaction({
      to: LIMIT_ORDER_PROTOCOL_ADDRESS,
      data: callData,
    });
    
    const finalPrice = await helper.getLinearAuctionTakerAmount(
      ETH_1,
      USDC_3000,
      USDC_1500,
      startedAt,
      endedAt,
      DECREASING,
      ETH_1
    )
    const fee = await helper.fee()
    const fees = finalPrice.mul(fee).div(FEE_BASE)

    expect(await weth.balanceOf(taker.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(usingContract.address)).to.equal(finalPrice.sub(fees));
    expect(await usdc.balanceOf(feesReceiver.address)).to.equal(fees);
  });
});
