import zod from "zod";
import { Address, getAddress } from "viem";

export const addressValidation = zod
  .custom<Address>(val => {
    try {
      getAddress(val as string);
      return true;
    } catch (e) {
      return val === undefined;
    }
  })
  .transform(val => val.toLowerCase() as Address);
