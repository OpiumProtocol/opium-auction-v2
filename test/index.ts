import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { VoidSigner } from "ethers";
import {
  buildAuctionOrder,
  AuctionPricingFunction,
  AuctionPricingDirection,
  EthersSignerConnector
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

describe("Opium Auction V2", function () {
  async function prepare() {
    const [ owner, maker, taker, feesReceiver ] = await ethers.getSigners();

    // Signers preparation
    const makerProviderConnector = new EthersSignerConnector(maker as unknown as VoidSigner);
    const makerLimitOrderBuilder = new LimitOrderBuilder(
      LIMIT_ORDER_PROTOCOL_ADDRESS,
      CHAIN_ID,
      makerProviderConnector,
      () => "1337" // Hardcoded orders salt
    );

    // Mocks
    const MockToken = await ethers.getContractFactory("MockToken");
    const weth = await MockToken.deploy("WETH", "WETH", 18);
    const usdc = await MockToken.deploy("USDC", "USDC", 6);
    await weth.transfer(maker.address, ETH_1);
    await usdc.transfer(taker.address, USDC_3000);

    // Limit Order Protocol
    const takerProviderConnector = new EthersSignerConnector(maker as unknown as VoidSigner);
    const takerLimitOrderProtocolFacade = new LimitOrderProtocolFacade(
      LIMIT_ORDER_PROTOCOL_ADDRESS,
      takerProviderConnector
    );

    // Helper contract
    const OpiumAuctionV2Helper = await ethers.getContractFactory("OpiumAuctionV2Helper");
    const helper = await OpiumAuctionV2Helper.deploy(feesReceiver.address);

    return {
      // Accounts
      owner, maker, taker, feesReceiver,
      makerLimitOrderBuilder,
      takerLimitOrderProtocolFacade,
      // Contracts
      helper,
      usdc, weth,
    };
  }

  it("Should settle ordinary limit order protocol swap", async function () {
    const { maker, taker, makerLimitOrderBuilder, takerLimitOrderProtocolFacade, weth, usdc } = await loadFixture(prepare);

    expect(await weth.balanceOf(maker.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(taker.address)).to.equal(USDC_3000);

    // Maker preparation
    await weth.connect(maker).approve(LIMIT_ORDER_PROTOCOL_ADDRESS, ETH_1)
    const makerLimitOrder = makerLimitOrderBuilder.buildLimitOrder({
      makerAssetAddress: weth.address,
      takerAssetAddress: usdc.address,
      makerAddress: maker.address,
      makerAmount: ETH_1.toString(),
      takerAmount: USDC_3000.toString(),
      predicate: "0x",
      permit: "0x",
      interaction: "0x",
    });
    const makerLimitOrderTypedData = makerLimitOrderBuilder.buildLimitOrderTypedData(makerLimitOrder);
    const makerLimitOrderSignature = await makerLimitOrderBuilder.buildOrderSignature(maker.address, makerLimitOrderTypedData);

    // Taker preparation
    const callData = takerLimitOrderProtocolFacade.fillLimitOrder(
      makerLimitOrder,
      makerLimitOrderSignature,
      ETH_1.toString(),
      "0",
      USDC_3000.toString()
    );
    await usdc.connect(taker).approve(LIMIT_ORDER_PROTOCOL_ADDRESS, USDC_3000);
    await taker.sendTransaction({
      to: LIMIT_ORDER_PROTOCOL_ADDRESS,
      data: callData,
    });

    expect(await weth.balanceOf(taker.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(maker.address)).to.equal(USDC_3000);
  });

  it("Should settle decreasing linear auction via maker amount", async function () {
    const { maker, taker, feesReceiver, makerLimitOrderBuilder, takerLimitOrderProtocolFacade, helper, weth, usdc } = await loadFixture(prepare);

    expect(await weth.balanceOf(maker.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(taker.address)).to.equal(USDC_3000);

    // Set an auction current to the half
    const currentTime = await time.latest()
    const startedAt = currentTime - HOUR_1 / 2
    const endedAt = currentTime + HOUR_1 / 2

    // Maker preparation
    await weth.connect(maker).approve(LIMIT_ORDER_PROTOCOL_ADDRESS, ETH_1)
    const makerLimitOrder = buildAuctionOrder(
      helper.address,
      makerLimitOrderBuilder,
      {
        makerAssetAddress: weth.address,
        takerAssetAddress: usdc.address,
        makerAddress: maker.address,
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

    const makerLimitOrderTypedData = makerLimitOrderBuilder.buildLimitOrderTypedData(makerLimitOrder);
    const makerLimitOrderSignature = await makerLimitOrderBuilder.buildOrderSignature(maker.address, makerLimitOrderTypedData);

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
    expect(await usdc.balanceOf(maker.address)).to.equal(finalPrice.sub(fees));
    expect(await usdc.balanceOf(feesReceiver.address)).to.equal(fees);
  });

  it("Should settle decreasing linear auction via taker amount", async function () {
    const { maker, taker, feesReceiver, makerLimitOrderBuilder, takerLimitOrderProtocolFacade, helper, weth, usdc } = await loadFixture(prepare);

    expect(await weth.balanceOf(maker.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(taker.address)).to.equal(USDC_3000);

    // Set an auction current to the half
    const currentTime = await time.latest()
    const startedAt = currentTime - HOUR_1 / 2
    const endedAt = currentTime + HOUR_1 / 2

    // Maker preparation
    await weth.connect(maker).approve(LIMIT_ORDER_PROTOCOL_ADDRESS, ETH_1)
    const makerLimitOrder = buildAuctionOrder(
      helper.address,
      makerLimitOrderBuilder,
      {
        makerAssetAddress: weth.address,
        takerAssetAddress: usdc.address,
        makerAddress: maker.address,
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

    const makerLimitOrderTypedData = makerLimitOrderBuilder.buildLimitOrderTypedData(makerLimitOrder);
    const makerLimitOrderSignature = await makerLimitOrderBuilder.buildOrderSignature(maker.address, makerLimitOrderTypedData);

    // Taker preparation
    const callData = takerLimitOrderProtocolFacade.fillLimitOrder(
      makerLimitOrder,
      makerLimitOrderSignature,
      "0",
      USDC_2250.toString(),
      ETH_1.toString()
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
    expect(await usdc.balanceOf(maker.address)).to.equal(finalPrice.sub(fees));
    expect(await usdc.balanceOf(feesReceiver.address)).to.equal(fees);
  });

  it("Should settle increasing linear auction via maker amount", async function () {
    const { maker, taker, feesReceiver, makerLimitOrderBuilder, takerLimitOrderProtocolFacade, helper, weth, usdc } = await loadFixture(prepare);

    expect(await weth.balanceOf(maker.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(taker.address)).to.equal(USDC_3000);

    // Set an auction current to the half
    const currentTime = await time.latest()
    const startedAt = currentTime - HOUR_1 / 2
    const endedAt = currentTime + HOUR_1 / 2

    // Maker preparation
    await weth.connect(maker).approve(LIMIT_ORDER_PROTOCOL_ADDRESS, ETH_1)
    const makerLimitOrder = buildAuctionOrder(
      helper.address,
      makerLimitOrderBuilder,
      {
        makerAssetAddress: weth.address,
        takerAssetAddress: usdc.address,
        makerAddress: maker.address,
        makerAmount: ETH_1.toString(),
        nonce: 0
      },
      {
        pricingFunction: AuctionPricingFunction.LINEAR,
        pricingDirection: AuctionPricingDirection.INCREASING,
        partialFill: true,
        minTakerAmount: USDC_1500.toString(),
        maxTakerAmount: USDC_3000.toString(),
        startedAt,
        endedAt
      }
    );

    const makerLimitOrderTypedData = makerLimitOrderBuilder.buildLimitOrderTypedData(makerLimitOrder);
    const makerLimitOrderSignature = await makerLimitOrderBuilder.buildOrderSignature(maker.address, makerLimitOrderTypedData);

    // Taker preparation
    const callData = takerLimitOrderProtocolFacade.fillLimitOrder(
      makerLimitOrder,
      makerLimitOrderSignature,
      ETH_1.toString(),
      "0",
      USDC_2300.toString()
    );
    await usdc.connect(taker).approve(LIMIT_ORDER_PROTOCOL_ADDRESS, USDC_2300);
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
      INCREASING,
      ETH_1
    )
    const fee = await helper.fee()
    const fees = finalPrice.mul(fee).div(FEE_BASE)

    expect(await weth.balanceOf(taker.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(maker.address)).to.equal(finalPrice.sub(fees));
    expect(await usdc.balanceOf(feesReceiver.address)).to.equal(fees);
  });

  it("Should settle increasing linear auction via taker amount", async function () {
    const { maker, taker, feesReceiver, makerLimitOrderBuilder, takerLimitOrderProtocolFacade, helper, weth, usdc } = await loadFixture(prepare);

    expect(await weth.balanceOf(maker.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(taker.address)).to.equal(USDC_3000);

    // Set an auction current to the half
    const currentTime = await time.latest()
    const startedAt = currentTime - HOUR_1 / 2
    const endedAt = currentTime + HOUR_1 / 2

    // Maker preparation
    await weth.connect(maker).approve(LIMIT_ORDER_PROTOCOL_ADDRESS, ETH_1)
    const makerLimitOrder = buildAuctionOrder(
      helper.address,
      makerLimitOrderBuilder,
      {
        makerAssetAddress: weth.address,
        takerAssetAddress: usdc.address,
        makerAddress: maker.address,
        makerAmount: ETH_1.toString(),
        nonce: 0
      },
      {
        pricingFunction: AuctionPricingFunction.LINEAR,
        pricingDirection: AuctionPricingDirection.INCREASING,
        partialFill: true,
        minTakerAmount: USDC_1500.toString(),
        maxTakerAmount: USDC_3000.toString(),
        startedAt,
        endedAt
      }
    );

    const makerLimitOrderTypedData = makerLimitOrderBuilder.buildLimitOrderTypedData(makerLimitOrder);
    const makerLimitOrderSignature = await makerLimitOrderBuilder.buildOrderSignature(maker.address, makerLimitOrderTypedData);

    // Taker preparation
    const callData = takerLimitOrderProtocolFacade.fillLimitOrder(
      makerLimitOrder,
      makerLimitOrderSignature,
      "0",
      USDC_2300.toString(),
      ETH_1.toString()
    );
    await usdc.connect(taker).approve(LIMIT_ORDER_PROTOCOL_ADDRESS, USDC_2300);
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
      INCREASING,
      ETH_1
    )
    const fee = await helper.fee()
    const fees = finalPrice.mul(fee).div(FEE_BASE)

    expect(await weth.balanceOf(taker.address)).to.equal(ETH_1);
    expect(await usdc.balanceOf(maker.address)).to.equal(finalPrice.sub(fees));
    expect(await usdc.balanceOf(feesReceiver.address)).to.equal(fees);
  });
});
