import winston from "winston";
import TelegramLogger from "winston-telegram";

import config from "../../config";

const logger = winston.createLogger({
  format: winston.format.combine(winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new TelegramLogger({
      token: config.telegramBotToken,
      chatId: config.telegramChatId,
      silent: !!process.env.LOCAL,
      formatMessage: ({ level, message }) => {
        if (level === "error") {
          return `❌ ${message}`;
        }
        if (level === "warning") {
          return `⚠️ ${message}`;
        }
        if (level === "info") {
          return `ℹ️ ${message}`;
        }
        return message;
      },
    }),
  ],
});

export default logger;
