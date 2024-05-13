/* eslint-disable no-unused-vars */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NETWORK: "bsctestnet" | "bscmainnet";
      VENUS_ENV_PATH?: string;
      RPC_bsctestnet: string;
      RPC_bscmainnet: string;
    }

    interface ErrnoException extends Error {
      errno: number;
      code: "ENOENT";
      path: string;
      syscall: string;
      stack: string;
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
