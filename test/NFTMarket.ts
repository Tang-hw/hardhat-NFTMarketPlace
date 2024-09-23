import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { Contract, ZeroAddress } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"; // 确保正确导入 SignerWithAddress

describe("NFTMarket", () => {
  let nftMarket: Contract;
  let signers: SignerWithAddress[];

  beforeEach(async () => {
    signers = await ethers.getSigners();
    const NFTMarketFactory = await ethers.getContractFactory("NFTMarket");
    nftMarket = await NFTMarketFactory.deploy(signers[0].address);
    console.log("Contract Address:", nftMarket.target); // 在 ethers.js 6.x 中使用 target 获取合约地址
    console.log("Contract Deployed!");
    console.log("----------------------------------------------------------");
  });

  const createNFT = async (tokenURI: string) => {
    const transaction = await nftMarket.createNFT(tokenURI);
    const receipt = await transaction.wait();
    const tokenID = receipt.events[0].args.tokenId;
    return tokenID;
  };

  it("should deploy contract", async () => {
    console.log("Test case running");
    expect(nftMarket.target).to.properAddress;
  });

  it("should create a new NFT and emit the NFTTransfer event", async function () {
    const tokenURI = "https://ipfs.io/ipfs/QmSomeExampleHash"; // NFT 的 tokenURI

    // Call the createNFT method to cast a new NFT
    const tx = await nftMarket.createNFT(tokenURI);

    // Wait for the deal to close
    const receipt = await tx.wait();
    //console.log("Receipt:", receipt); // 打印完整的 receipt
    // Use queryFilter to actively retrieve events
    const filter = nftMarket.filters.NFTTransfer();
    const events = await nftMarket.queryFilter(filter);

    // Ensure that the event has triggered
    expect(events.length).to.be.greaterThan(0);

    const event = events[0];
    expect(event.args.tokenID).to.equal(1); // 第一个 tokenID 应该是 1
    expect(event.args.from).to.equal(ZeroAddress); // from 地址应为 0 地址
    expect(event.args.to).to.equal(signers[0].address); // to 地址应为调用合约的地址
    expect(event.args.tokenURI).to.equal(tokenURI); // tokenURI 应该匹配
    expect(event.args.price).to.equal(0); // 初始 price 应为 0
  });
});
