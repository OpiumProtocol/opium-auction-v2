import { ethers, BigNumberish } from "ethers";
import { OpiumAuctionV2Helper__factory } from "../../typechain-types/";

import { LimitOrderBuilder, LimitOrder } from "@1inch/limit-order-protocol";

const abiCoder = new ethers.utils.AbiCoder();

/** Linear Auction */
const generateGetAmountLinear = (
  method: "getLinearAuctionTakerAmount" | "getLinearAuctionMakerAmount",
  helperAddress: string,
  orderMakerAmount: BigNumberish,
  orderTakerAmount: BigNumberish,
  thresholdOrderTakerAmount: BigNumberish,
  startedAt: BigNumberish,
  endedAt: BigNumberish,
  increasing: boolean
) => {
  // Generate calldata for the function
  const calldataOne = OpiumAuctionV2Helper__factory.createInterface().encodeFunctionData(
    method as never,
    [
      orderMakerAmount,
      orderTakerAmount,
      thresholdOrderTakerAmount,
      startedAt,
      endedAt,
      increasing,
      0 // Will be removed from calldata
    ]
  );

  const calldataTwo = OpiumAuctionV2Helper__factory.createInterface().encodeFunctionData(
    "arbitraryStaticCall",
    [helperAddress, calldataOne]
  )

  return calldataTwo.substring(0, calldataTwo.length - 120)
}

const generateGetAmountExponential = (
  method: "getExponentialAuctionTakerAmount" | "getExponentialAuctionMakerAmount",
  helperAddress: string,
  orderMakerAmount: BigNumberish,
  orderTakerAmount: BigNumberish,
  thresholdOrderTakerAmount: BigNumberish,
  startedAt: BigNumberish,
  endedAt: BigNumberish,
  increasing: boolean,
  amplifier: number
) => {
  // Generate calldata for the function
  const calldataOne = OpiumAuctionV2Helper__factory.createInterface().encodeFunctionData(
    method as never,
    [
      orderMakerAmount,
      orderTakerAmount,
      thresholdOrderTakerAmount,
      startedAt,
      endedAt,
      increasing,
      amplifier,
      0 // Will be removed from calldata
    ]
  );

  const calldataTwo = OpiumAuctionV2Helper__factory.createInterface().encodeFunctionData(
    "arbitraryStaticCall",
    [helperAddress, calldataOne]
  )

  return calldataTwo.substring(0, calldataTwo.length - 120)
}

/** General */
const generatePredicate = (helperAddress: string, makerAddress: string, nonce: number, timestamp: number) => {
  return OpiumAuctionV2Helper__factory.createInterface().encodeFunctionData("and", [
    [ helperAddress, helperAddress ],
    [
      OpiumAuctionV2Helper__factory.createInterface().encodeFunctionData("nonceEquals", [makerAddress, nonce]),
      OpiumAuctionV2Helper__factory.createInterface().encodeFunctionData("timestampBelow", [timestamp])
    ]
  ])
}

/** External */
export enum AuctionPricingFunction {
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL'
}

export enum AuctionPricingDirection {
  INCREASING = 'INCREASING',
  DECREASING = 'DECREASING'
}

export const buildAuctionOrder = (
  helperAddress: string,
  limitOrderBuilder: LimitOrderBuilder,
  order: {
    makerAssetAddress: string,
    takerAssetAddress: string,
    makerAddress: string,
    makerAmount: string,
    permit?: string,
  },
  auction: {
    pricingFunction: AuctionPricingFunction,
    pricingDirection: AuctionPricingDirection,
    partialFill: boolean,
    minTakerAmount: string,
    maxTakerAmount: string,
    startedAt: number,
    endedAt: number,
    amplifier?: number
  }
) => {
  const makerLimitOrder = limitOrderBuilder.buildLimitOrder({
    makerAssetAddress: order.makerAssetAddress,
    takerAssetAddress: order.takerAssetAddress,
    makerAddress: order.makerAddress,
    makerAmount: order.makerAmount,
    takerAmount: auction.maxTakerAmount,
    permit: order.permit,
    receiver: helperAddress,
    predicate: generatePredicate(helperAddress, order.makerAddress, 0, auction.endedAt),
  });

  if (auction.pricingFunction === AuctionPricingFunction.LINEAR) {
    makerLimitOrder.getTakerAmount = generateGetAmountLinear(
      "getLinearAuctionTakerAmount",
      helperAddress,
      order.makerAmount,
      auction.maxTakerAmount,
      auction.minTakerAmount,
      auction.startedAt,
      auction.endedAt,
      auction.pricingDirection === AuctionPricingDirection.INCREASING
    )
    makerLimitOrder.getMakerAmount = generateGetAmountLinear(
      "getLinearAuctionMakerAmount",
      helperAddress,
      order.makerAmount,
      auction.maxTakerAmount,
      auction.minTakerAmount,
      auction.startedAt,
      auction.endedAt,
      auction.pricingDirection === AuctionPricingDirection.INCREASING
    )
  } else if (auction.pricingFunction === AuctionPricingFunction.EXPONENTIAL) {
    makerLimitOrder.getTakerAmount = generateGetAmountExponential(
      "getExponentialAuctionTakerAmount",
      helperAddress,
      order.makerAmount,
      auction.maxTakerAmount,
      auction.minTakerAmount,
      auction.startedAt,
      auction.endedAt,
      auction.pricingDirection === AuctionPricingDirection.INCREASING,
      auction.amplifier ?? 1
    )
    makerLimitOrder.getMakerAmount = generateGetAmountExponential(
      "getExponentialAuctionMakerAmount",
      helperAddress,
      order.makerAmount,
      auction.maxTakerAmount,
      auction.minTakerAmount,
      auction.startedAt,
      auction.endedAt,
      auction.pricingDirection === AuctionPricingDirection.INCREASING,
      auction.amplifier ?? 1
    )
  } else {
    throw new Error('Unsupported pricing function')
  }

  makerLimitOrder.interaction = 
    helperAddress +
    abiCoder.encode(
      ["address", "uint256", "uint256"],
      [order.makerAddress, auction.partialFill ? '0' : order.makerAmount, auction.startedAt]
    ).substring(2)

  return makerLimitOrder
}

export const encodeOrder = (order: LimitOrder) => {
  const abiCoder = new ethers.utils.AbiCoder();
  return abiCoder.encode(
    [
      "tuple(uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, bytes makerAssetData, bytes takerAssetData, bytes getMakerAmount, bytes getTakerAmount, bytes predicate, bytes permit, bytes interaction) order",
    ],
    [order]
  );
};