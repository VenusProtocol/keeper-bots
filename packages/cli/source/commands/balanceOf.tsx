import "dotenv/config";
import { useEffect, useState } from "react";
import { option } from "pastel";
import { Text, useApp } from "ink";
import zod from "zod";
import getBalanceOf from "../queries/getBalanceOf.js";
import { addressValidation } from "../utils/validation.js";

export const options = zod.object({
  tokenAddress: addressValidation.describe(
    option({
      description: "Token Address",
      alias: "t",
    }),
  ),
  contractAddress: addressValidation.describe(
    option({
      description: "Contract Address",
      alias: "c",
    }),
  ),
  blockNumber: zod
    .string()
    .describe(
      option({
        description: "Block Number",
        alias: "bn",
      }),
    )
    .optional(),
});

interface Props {
  options: zod.infer<typeof options>;
}

/**
 * Helper command to easily query balance at a specific block
 */
export default function BalanceOf({ options }: Props) {
  const { tokenAddress, contractAddress, blockNumber } = options;

  const [balance, setBalance] = useState<bigint>();

  const { exit } = useApp();

  useEffect(() => {
    (async () => {
      const result = await getBalanceOf({
        tokenAddress,
        contractAddress,
        blockNumber,
      });
      setBalance(result);
    })().finally(exit);
  }, []);

  return (
    <Text>
      {contractAddress} has {balance?.toString()} of {tokenAddress}
    </Text>
  );
}
