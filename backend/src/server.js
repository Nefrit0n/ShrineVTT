import { createServer } from "node:http";

import app from "./app.js";

import { initDatabase } from "#storage/db.js";
import { getConfig } from "#config/index.js";
import { initSocketServer } from "#ws/index.js";

const config = getConfig();

await initDatabase();

const httpServer = createServer(app);

initSocketServer(httpServer);

httpServer.listen(config.port, config.host, () => {
  console.log(
    `ShrineVTT server listening on http://${config.host}:${config.port}`
  );
});
