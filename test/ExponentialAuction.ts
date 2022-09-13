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

const AMPLIFIER = 10

describe("Linear Auction", function () {
  async function prepare() {
    // Helper contract
    const ExponentialAuction = await ethers.getContractFactory("ExponentialAuction");
    const exponentialAuction = await ExponentialAuction.deploy();

    return {
      exponentialAuction
    };
  }

  it("Should return correct price before auction starts", async function () {
    const { exponentialAuction } = await loadFixture(prepare);

    const LENGTH = 360 // 6 minutes
    const PERIODS = 10

    for (let secs = 0; secs < LENGTH * PERIODS; secs += LENGTH) {
      const exp = await exponentialAuction.expBySeconds(~~(secs * AMPLIFIER))
      console.log(`
        Exp: ${ethers.utils.formatEther(exp)} ${ethers.utils.formatEther(BASE.sub(exp))}
      `)
    }
  });

  it("Should return correct price before auction starts", async function () {
    const { exponentialAuction } = await loadFixture(prepare);

    const currentTime = await time.latest()
    const startedAt = currentTime + HOUR_1
    const endedAt = startedAt + HOUR_1

    // Decreasing
    const currentPriceDecreasing = CASH_MAX;
    expect(await exponentialAuction.exponentialPriceDecreasing(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, AMPLIFIER
    )).to.equal(currentPriceDecreasing);
    expect(await exponentialAuction.getExponentialAuctionMakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, DECREASING, AMPLIFIER, CASH_TENTH
    )).to.equal(
      cashToAssets(currentPriceDecreasing, CASH_TENTH)
    );
    expect(await exponentialAuction.getExponentialAuctionTakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, DECREASING, AMPLIFIER, ASSET_TENTH
    )).to.equal(
      assetsToCash(currentPriceDecreasing, ASSET_TENTH)
    );

    // Increasing
    const currentPriceIncreasing = CASH_MIN;
    expect(await exponentialAuction.exponentialPriceIncreasing(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, AMPLIFIER
    )).to.equal(currentPriceIncreasing);
    expect(await exponentialAuction.getExponentialAuctionMakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, INCREASING, AMPLIFIER, CASH_TENTH
    )).to.equal(
      cashToAssets(currentPriceIncreasing, CASH_TENTH)
    );
    expect(await exponentialAuction.getExponentialAuctionTakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, INCREASING, AMPLIFIER, ASSET_TENTH
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
    const { exponentialAuction } = await loadFixture(prepare);

    const currentTime = await time.latest()
    const startedAt = currentTime - 2 * HOUR_1
    const endedAt = currentTime - HOUR_1

    // Decreasing
    const currentPriceDecreasing = CASH_MIN;
    expect(await exponentialAuction.exponentialPriceDecreasing(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, AMPLIFIER
    )).to.equal(currentPriceDecreasing);
    expect(await exponentialAuction.getExponentialAuctionMakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, DECREASING, AMPLIFIER, CASH_TENTH
    )).to.equal(
      cashToAssets(currentPriceDecreasing, CASH_TENTH)
    );
    expect(await exponentialAuction.getExponentialAuctionTakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, DECREASING, AMPLIFIER, ASSET_TENTH
    )).to.equal(
      assetsToCash(currentPriceDecreasing, ASSET_TENTH)
    );

    // Increasing
    const currentPriceIncreasing = CASH_MAX;
    expect(await exponentialAuction.exponentialPriceIncreasing(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, AMPLIFIER
    )).to.equal(currentPriceIncreasing);
    expect(await exponentialAuction.getExponentialAuctionMakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, INCREASING, AMPLIFIER, CASH_TENTH
    )).to.equal(
      cashToAssets(currentPriceIncreasing, CASH_TENTH)
    );
    expect(await exponentialAuction.getExponentialAuctionTakerAmount(
      ASSET_MAX, CASH_MAX, CASH_MIN,
      startedAt, endedAt, INCREASING, AMPLIFIER, ASSET_TENTH
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
    const { exponentialAuction } = await loadFixture(prepare);

    const currentTime = await time.latest()
    const startedAt = currentTime
    const endedAt = currentTime + HOUR_1
    const duration = endedAt - startedAt

    const intervals = 10

    for (let index = 0; index <= intervals; index++) {
      if (index > 0) {
        await time.increase(duration / intervals)
      }

      const exp = await exponentialAuction.expBySeconds(~~(index * duration * AMPLIFIER / intervals))

      // Decreasing
      const pricePaddedDecreasing = CASH_MAX.mul(exp).div(BASE);
      const currentPriceDecreasing = pricePaddedDecreasing.gt(CASH_MIN) ? pricePaddedDecreasing : CASH_MIN;

      expect(await exponentialAuction.exponentialPriceDecreasing(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, AMPLIFIER
      )).to.equal(currentPriceDecreasing);
      expect(await exponentialAuction.getExponentialAuctionMakerAmount(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, DECREASING, AMPLIFIER, CASH_TENTH
      )).to.equal(
        cashToAssets(currentPriceDecreasing, CASH_TENTH)
      );
      expect(await exponentialAuction.getExponentialAuctionTakerAmount(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, DECREASING, AMPLIFIER, ASSET_TENTH
      )).to.equal(
        assetsToCash(currentPriceDecreasing, ASSET_TENTH)
      );

      // Increasing
      const pricePaddedIncreasing = CASH_MAX.mul(BASE.sub(exp)).div(BASE);
      const currentPriceIncreasing = pricePaddedIncreasing.gt(CASH_MIN) ? pricePaddedIncreasing : CASH_MIN;

      expect(await exponentialAuction.exponentialPriceIncreasing(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, AMPLIFIER
      )).to.equal(currentPriceIncreasing);
      expect(await exponentialAuction.getExponentialAuctionMakerAmount(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, INCREASING, AMPLIFIER, CASH_TENTH
      )).to.equal(
        cashToAssets(currentPriceIncreasing, CASH_TENTH)
      );
      expect(await exponentialAuction.getExponentialAuctionTakerAmount(
        ASSET_MAX, CASH_MAX, CASH_MIN,
        startedAt, endedAt, INCREASING, AMPLIFIER, ASSET_TENTH
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
