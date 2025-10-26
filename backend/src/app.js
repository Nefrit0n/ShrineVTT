import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import morgan from "morgan";

import { getConfig } from "#config/index.js";
import authRouter from "#routes/auth.js";
import sessionRouter from "#routes/session.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const config = getConfig();

const corsOptions = Array.isArray(config.corsOrigin)
  ? { origin: config.corsOrigin, credentials: true }
  : config.corsOrigin === "*"
    ? { origin: true, credentials: true }
    : { origin: config.corsOrigin, credentials: true };

app.use(cors(corsOptions));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/session", sessionRouter);

const staticDir = path.join(__dirname, "../static");
app.use(express.static(staticDir));

app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  res.sendFile(path.join(staticDir, "index.html"), (err) => {
    if (err) {
      next();
    }
  });
});

export default app;
