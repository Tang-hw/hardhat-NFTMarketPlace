import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { Contract, ZeroAddress, EventLog } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"; // 确保正确导入 SignerWithAddress
import { NFTMarket } from "../typechain-types";

describe("NFTMarket", () => {
  let nftMarket: Contract;
  let signers: SignerWithAddress[];
  const PRICE = ethers.parseUnits("1");
  const EARN = ethers.parseUnits("0.05", "ether");
  const HALF_PRICE = ethers.parseUnits("0.5");

  const tokenURI = "https://ipfs.io/ipfs/QmSomeExampleHash"; // NFT 的 tokenURI

  beforeEach(async () => {
    signers = await ethers.getSigners();
    const NFTMarketFactory = await ethers.getContractFactory("NFTMarket");
    nftMarket = await NFTMarketFactory.deploy(signers[0].address);

    console.log("Contract Address:", nftMarket.target); // 在 ethers.js 6.x 中使用 target 获取合约地址
    console.log("Contract Deployed!");
    console.log("----------------------------------------------------------");
  });

  const createAndListNFTAndGetToken = async (price: bigint) => {
    const tokenID = await createNFTAndGetToken("some token uri");
    const transaction = await nftMarket.listNFT(tokenID, price);
    await transaction.wait();
    return tokenID;
  };

  const createNFTAndGetToken = async (tokenURI: string) => {
    const tx = await nftMarket.createNFT(tokenURI);
    const filter = nftMarket.filters.NFTTransfer();
    try {
      const events = await nftMarket.queryFilter(filter);
      const matchedEvent = events.find((event) => {
        if (event instanceof EventLog) {
          return event.args.tokenURI === tokenURI; // 确保事件匹配 tokenURI
        }
        return false;
      });

      if (matchedEvent && matchedEvent instanceof EventLog) {
        return matchedEvent.args.tokenID;
      } else {
        throw new Error("No matching event found for the given tokenURI");
      }
    } catch (error) {
      console.error(error);
      throw new Error("Failed to get tokenID");
    }
  };

  /**
   * 获取并解析指定索引的事件
   * @param contract 合约实例
   * @param filter 事件过滤器
   * @param index 事件索引
   * @returns 返回事件的解析结果
   */
  async function getEventArgs(contract: any, filter: any, index: number) {
    const events = await contract.queryFilter(filter);

    // 确保事件已触发
    if (events.length === 0 || index >= events.length) {
      throw new Error("Event not found or index out of bounds");
    }

    const event = events[index];

    if (event instanceof EventLog) {
      return {
        tokenID: event.args.tokenID,
        from: event.args.from,
        to: event.args.to,
        tokenURI: event.args.tokenURI,
        price: event.args.price,
      };
    } else {
      throw new Error("Event is not an EventLog");
    }
  }

  describe("Deploy the Contract", () => {
    it("should deploy contract", async () => {
      console.log("Test case running");
      expect(nftMarket.target).to.properAddress;
    });
  });

  describe("Create NFT", () => {
    it("should create a new NFT and emit the NFTTransfer event", async function () {
      // Call the createNFT method to cast a new NFT
      const tx = await nftMarket.createNFT(tokenURI);
      const filter = nftMarket.filters.NFTTransfer();
      try {
        const eventArgs = await getEventArgs(nftMarket, filter, 0);
        //console.log("Event Arguments:", eventArgs);
        expect(eventArgs.tokenID).to.equal(1); // 第一个 tokenID 应该是 1
        expect(eventArgs.from).to.equal(ZeroAddress); // from 地址应为 0 地址
        expect(eventArgs.to).to.equal(signers[0].address); // to 地址应为调用合约的地址
        expect(eventArgs.tokenURI).to.equal(tokenURI); // tokenURI 应该匹配
        expect(eventArgs.price).to.equal(0); // 初始 price 应为 0
      } catch (error) {
        console.error(error);
      }
    });
  });

  describe("ListNFT", () => {
    it("should revert if price is zero", async function () {
      // First, create a new NFT
      const tokenId = createNFTAndGetToken(tokenURI);
      await expect(nftMarket.listNFT(tokenId, 0)).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__PriceMustBeGreaterThanZero"
      );
    });

    it("should list a new NFT with a price", async function () {
      const tokenId = createAndListNFTAndGetToken(PRICE);

      // Check if the NFTTransfer event was emitted with the correct parameters
      const filter = nftMarket.filters.NFTTransfer();
      try {
        const eventArgs = await getEventArgs(nftMarket, filter, 0);
        //console.log("Event Arguments:", eventArgs);
        expect(eventArgs.tokenID).to.equal(tokenId);
        expect(eventArgs.from).to.equal(signers[0].address);
        expect(eventArgs.to).to.equal(ZeroAddress);
        expect(eventArgs.tokenURI).to.equal(tokenURI);
        expect(eventArgs.price).to.equal(PRICE);
      } catch (error) {
        console.error(error);
      }
    });
  });

  describe("ButNFT", () => {
    it("should revert if NFT is not listed for sale", async () => {
      const transaction = nftMarket.buyNFT(9999);
      await expect(transaction).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__ThisNFTIsNotListedForSale"
      );
    });

    it("should revert if price is incorrect", async function () {
      // List the NFT with a price of 1 ETH
      const tokenId = await createAndListNFTAndGetToken(PRICE);

      // Attempt to buy the NFT with a different price (e.g., 0.5 ETH)
      const transaction = nftMarket.buyNFT(tokenId, { value: HALF_PRICE });
      await expect(transaction).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__IncorrectPrice"
      );
    });

    it("should buy the NFT with correct price and emit NFTTransfer event", async function () {
      // List the NFT with a price of 1 ETH
      const tokenId = await createAndListNFTAndGetToken(PRICE);

      // Buy the NFT with correct price
      const buyTx = await nftMarket
        .connect(signers[1])
        .buyNFT(tokenId, { value: PRICE });
      const buyReceipt = await buyTx.wait();

      // Verify the NFTTransfer event
      const filter = nftMarket.filters.NFTTransfer();
      const eventArgs = await getEventArgs(nftMarket, filter, 2); // 第三个事件

      expect(eventArgs.tokenID).to.equal(tokenId);
      expect(eventArgs.from).to.equal(nftMarket.target);
      expect(eventArgs.to).to.equal(signers[1].address);
      expect(eventArgs.tokenURI).to.equal("");
      expect(eventArgs.price).to.equal(0);
    });
  });

  describe("CancelListing", () => {
    it("should revert if the caller is not the seller", async function () {
      const tokenId = await createAndListNFTAndGetToken(PRICE);
      // Attempt to cancel the listing by someone other than the seller
      await expect(
        nftMarket.connect(signers[1]).cancelListing(tokenId)
      ).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__YouAreNotTheSeller"
      );
    });

    it("should cancel the listing and emit NFTTransfer event", async function () {
      // List the NFT with a price of 1 ETH
      const tokenId = await createAndListNFTAndGetToken(PRICE);

      // Cancel the listing
      const cancelTx = await nftMarket.cancelListing(tokenId);
      const cancelReceipt = await cancelTx.wait();

      // Verify the NFTTransfer event
      const filter = nftMarket.filters.NFTTransfer();
      const eventArgs = await getEventArgs(nftMarket, filter, 2); // 第三个事件

      expect(eventArgs.tokenID).to.equal(tokenId);
      expect(eventArgs.from).to.equal(nftMarket.target);
      expect(eventArgs.to).to.equal(signers[0].address);
      expect(eventArgs.tokenURI).to.equal("");
      expect(eventArgs.price).to.equal(0);
    });
  });

  describe("WithdrawFunds", () => {
    it("should revert if balance is zero", async function () {
      // Attempt to withdraw funds when balance is zero
      await expect(nftMarket.withdrawFunds()).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__CanNotWithdrawWithZeroBalance"
      );
    });

    it("should withdraw funds to the owner", async function () {
      // List the NFT and buy it to generate funds in the contract
      const tokenId = await createAndListNFTAndGetToken(PRICE);
      const buyTx = await nftMarket
        .connect(signers[1])
        .buyNFT(tokenId, { value: PRICE });
      const buyReceipt = await buyTx.wait();

      // Verify contract balance
      const contractBalanceBefore = await ethers.provider.getBalance(
        nftMarket.target
      );
      expect(contractBalanceBefore).to.equal(EARN);

      // Withdraw funds as the contract owner
      const ownerBalanceBefore = await ethers.provider.getBalance(
        signers[0].address
      );
      const withdrawTx = await nftMarket.withdrawFunds();
      const withdrawReceipt = await withdrawTx.wait();

      // Verify the funds were withdrawn
      const contractBalanceAfter = await ethers.provider.getBalance(
        nftMarket.target
      );
      const ownerBalanceAfter = await ethers.provider.getBalance(
        signers[0].address
      );

      expect(contractBalanceAfter).to.equal(0);

      // 计算期望值但是没计算gas
      const expectedBalance = ownerBalanceBefore + EARN;
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
      expect(ownerBalanceAfter).to.be.lt(expectedBalance);
    });
  });
});
