import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

export const getConfig = () => {
  const port = Number.parseInt(process.env.PORT ?? "8080", 10);
  const host = process.env.HOST ?? "0.0.0.0";
  const corsOrigin = process.env.CORS_ORIGIN ?? "*";
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(process.cwd(), "data");

  const corsOrigins =
    corsOrigin === "*"
      ? "*"
      : corsOrigin.split(",").map((origin) => origin.trim());

  return {
    port: Number.isNaN(port) ? 8080 : port,
    host,
    corsOrigin: corsOrigins,
    dataDir,
  };
};
