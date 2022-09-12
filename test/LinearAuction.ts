import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

// Test constants
const BASE = ethers.utils.parseUnits("1", 18)

const ASSET_MAX = ethers.utils.parseUnits("1", 18)
const ASSET_TENTH = ASSET_MAX.div(10)

const CASH_MAX = ethers.utils.parseUnits("3000", 6)
const CASH_MIN = CASH_MAX.div(2)
const CASH_TENTH = CASH_MAX.div(10)

const HOUR_1 = 3600

const INCREASING = true
const DECREASING = false

const cashToAssets = (price: BigNumber, cash: BigNumber) => cash.mul(BASE).div(price)
const assetsToCash = (price: BigNumber, assets: BigNumber) => assets.mul(price).div(BASE)

describe("Linear Auction", function () {
  async function prepare() {
    // Helper contract
    const LinearAuction = await ethers.getContractFactory("LinearAuction");
    const linearAuction = await LinearAuction.deploy();

    return {
      linearAuction
    };
  }

  it("Should return correct price before auction starts", async function () {
    const { linearAuction } = await loadFixture(prepare);

    const currentTime = await time.latest()
    const startedAt = currentTime + HOUR_1
    const endedAt = startedAt + HOUR_1

    // Decreasing
    const currentPriceDecreasing = CASH_MAX;
    expect(await linearAuction.linearPriceDecreasing(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt
    )).to.equal(currentPriceDecreasing);
    expect(await linearAuction.getLinearAuctionMakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, DECREASING, CASH_TENTH
    )).to.equal(
      cashToAssets(currentPriceDecreasing, CASH_TENTH)
    );
    expect(await linearAuction.getLinearAuctionTakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, DECREASING, ASSET_TENTH
    )).to.equal(
      assetsToCash(currentPriceDecreasing, ASSET_TENTH)
    );

    // Increasing
    const currentPriceIncreasing = CASH_MIN;
    expect(await linearAuction.linearPriceIncreasing(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt
    )).to.equal(currentPriceIncreasing);
    expect(await linearAuction.getLinearAuctionMakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, INCREASING, CASH_TENTH
    )).to.equal(
      cashToAssets(currentPriceIncreasing, CASH_TENTH)
    );
    expect(await linearAuction.getLinearAuctionTakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, INCREASING, ASSET_TENTH
    )).to.equal(
      assetsToCash(currentPriceIncreasing, ASSET_TENTH)
    );

    console.log(`
      Before auction:
      - Price decreasing: ${currentPriceDecreasing}
      - Price increasing: ${currentPriceIncreasing}
    `)
  });

  it("Should return correct price after auction ended", async function () {
    const { linearAuction } = await loadFixture(prepare);

    const currentTime = await time.latest()
    const startedAt = currentTime - 2 * HOUR_1
    const endedAt = currentTime - HOUR_1

    // Decreasing
    const currentPriceDecreasing = CASH_MIN;
    expect(await linearAuction.linearPriceDecreasing(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt
    )).to.equal(currentPriceDecreasing);
    expect(await linearAuction.getLinearAuctionMakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, DECREASING, CASH_TENTH
    )).to.equal(
      cashToAssets(currentPriceDecreasing, CASH_TENTH)
    );
    expect(await linearAuction.getLinearAuctionTakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, DECREASING, ASSET_TENTH
    )).to.equal(
      assetsToCash(currentPriceDecreasing, ASSET_TENTH)
    );

    // Increasing
    const currentPriceIncreasing = CASH_MAX;
    expect(await linearAuction.linearPriceIncreasing(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt
    )).to.equal(currentPriceIncreasing);
    expect(await linearAuction.getLinearAuctionMakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, INCREASING, CASH_TENTH
    )).to.equal(
      cashToAssets(currentPriceIncreasing, CASH_TENTH)
    );
    expect(await linearAuction.getLinearAuctionTakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, INCREASING, ASSET_TENTH
    )).to.equal(
      assetsToCash(currentPriceIncreasing, ASSET_TENTH)
    );

    console.log(`
      After auction:
      - Price decreasing: ${currentPriceDecreasing}
      - Price increasing: ${currentPriceIncreasing}
    `)
  });

  it("Should return correct price during the auction", async function () {
    const { linearAuction } = await loadFixture(prepare);

    const currentTime = await time.latest()
    const startedAt = currentTime
    const endedAt = currentTime + HOUR_1
    const duration = endedAt - startedAt

    const intervals = 10
    const priceDelta = CASH_MAX.sub(CASH_MIN).div(intervals)

    for (let index = 0; index <= intervals; index++) {
      if (index > 0) {
        await time.increase(duration / intervals)
      }

      // Decreasing
      const currentPriceDecreasing = CASH_MAX.sub(priceDelta.mul(index))

      expect(await linearAuction.linearPriceDecreasing(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt
      )).to.equal(currentPriceDecreasing);
      expect(await linearAuction.getLinearAuctionMakerAmount(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, DECREASING, CASH_TENTH
      )).to.equal(
        cashToAssets(currentPriceDecreasing, CASH_TENTH)
      );
      expect(await linearAuction.getLinearAuctionTakerAmount(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, DECREASING, ASSET_TENTH
      )).to.equal(
        assetsToCash(currentPriceDecreasing, ASSET_TENTH)
      );

      // Increasing
      const currentPriceIncreasing = CASH_MIN.add(priceDelta.mul(index))

      expect(await linearAuction.linearPriceIncreasing(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt
      )).to.equal(currentPriceIncreasing);
      expect(await linearAuction.getLinearAuctionMakerAmount(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, INCREASING, CASH_TENTH
      )).to.equal(
        cashToAssets(currentPriceIncreasing, CASH_TENTH)
      );
      expect(await linearAuction.getLinearAuctionTakerAmount(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, INCREASING, ASSET_TENTH
      )).to.equal(
        assetsToCash(currentPriceIncreasing, ASSET_TENTH)
      );

      console.log(`
        During auction:
        - Price decreasing: ${currentPriceDecreasing}
        - Price increasing: ${currentPriceIncreasing}
      `)
    }
  });
});
