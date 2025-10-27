import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { initDatabase, getDatabase } from "#storage/db.js";
import { getConfig } from "#config/index.js";
import { initSocketServer } from "#socket/index.js";
import { createApp } from "./app.js";
import { createApplicationContainer } from "#application/container.js";

const TERMINATION_SIGNALS = ["SIGINT", "SIGTERM"];

export const bootstrap = async () => {
  const config = getConfig();

  await initDatabase();
  const db = getDatabase();

  const applicationContainer = createApplicationContainer({ db });
  const app = createApp(applicationContainer);
  const httpServer = createServer(app);
  const io = initSocketServer(httpServer, applicationContainer);

  await new Promise((resolve, reject) => {
    const handleError = (error) => {
      httpServer.off("error", handleError);
      reject(error);
    };

    httpServer.once("error", handleError);
    httpServer.listen(config.port, config.host, () => {
      httpServer.off("error", handleError);
      console.log(
        `ShrineVTT server listening on http://${config.host}:${config.port}`
      );
      resolve();
    });
  });

  let shuttingDown = false;
  const signalHandlers = new Map();

  const close = async ({ signal, exitProcess = false } = {}) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    for (const [registeredSignal, handler] of signalHandlers.entries()) {
      process.off(registeredSignal, handler);
    }
    signalHandlers.clear();

    const stopHttpServer = async () =>
      new Promise((resolve) => {
        if (!httpServer.listening) {
          resolve();
          return;
        }

        httpServer.close((error) => {
          if (error) {
            console.error("Error while closing HTTP server", error);
          }
          resolve();
        });
      });

    const stopSocketServer = async () =>
      new Promise((resolve) => {
        io.close((error) => {
          if (error) {
            console.error("Error while closing Socket.IO server", error);
          }
          resolve();
        });
      });

    try {
      await stopSocketServer();
      await stopHttpServer();
      try {
        await db.write();
      } catch (error) {
        console.error("Error while flushing database", error);
      }
    } catch (error) {
      console.error("Error during shutdown", error);
      if (exitProcess) {
        process.exit(1);
      }
      return;
    }

    if (exitProcess) {
      process.exit(0);
    }
  };

  for (const signal of TERMINATION_SIGNALS) {
    const handler = () => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      close({ signal, exitProcess: true }).catch((error) => {
        console.error("Error during graceful shutdown", error);
        process.exit(1);
      });
    };
    signalHandlers.set(signal, handler);
    process.once(signal, handler);
  }

  return { httpServer, io, close, config, applicationContainer };
};

const isExecutedDirectly =
  typeof process.argv[1] === "string" &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isExecutedDirectly) {
  bootstrap().catch((error) => {
    console.error("Failed to bootstrap ShrineVTT", error);
    process.exit(1);
  });
}
