import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.27", // 根据你需要的 Solidity 版本
  networks: {
    hardhat: {
      chainId: 1337, // 默认的 Hardhat 本地网络
    },
  },
};

export default config;
