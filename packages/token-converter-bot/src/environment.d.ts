/* eslint-disable no-unused-vars */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NETWORK: "bsctestnet" | "bscmainnet";
      TELEGRAM_BOT_TOKEN: string;
      TELEGRAM_CHAT_ID: string;
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
