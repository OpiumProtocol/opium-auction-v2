import { ethers, BigNumberish } from "ethers";
import { OpiumAuctionV2Helper__factory } from "../../typechain-types/";

import { LimitOrderBuilder } from "@1inch/limit-order-protocol";

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
  LINEAR = 'LINEAR'
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
    endedAt: number
  }
) => {
  const makerLimitOrder = limitOrderBuilder.buildLimitOrder({
    makerAssetAddress: order.makerAssetAddress,
    takerAssetAddress: order.takerAssetAddress,
    makerAddress: order.makerAddress,
    makerAmount: order.makerAmount,
    takerAmount: auction.maxTakerAmount,
    permit: order.permit,
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
  } else {
    throw new Error('Unsupported pricing function')
  }

  makerLimitOrder.interaction = 
    helperAddress +
    abiCoder.encode(
      ["address", "uint256", "uint256"],
      [order.makerAddress, auction.partialFill ? '0' : order.makerAmount, auction.startedAt]
    ).substring(2)

  makerLimitOrder.receiver = helperAddress

  makerLimitOrder.predicate = generatePredicate(helperAddress, order.makerAddress, 0, auction.endedAt);

  return makerLimitOrder
}
