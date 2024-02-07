import { ethers } from "hardhat";

export const getBlockTimestamp = async () => (await ethers.provider.getBlock("latest")).timestamp;
