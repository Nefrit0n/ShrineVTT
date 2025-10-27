import { createServer } from "node:http";

import { initDatabase } from "#storage/db.js";
import { getConfig } from "#config/index.js";
import { initSocketServer } from "#socket/index.js";
import { createApp } from "./app.js";
import { createApplicationContainer } from "#application/container.js";

const config = getConfig();

await initDatabase();

const applicationContainer = createApplicationContainer();
const app = createApp(applicationContainer);

const httpServer = createServer(app);

initSocketServer(httpServer, applicationContainer);

httpServer.listen(config.port, config.host, () => {
  console.log(
    `ShrineVTT server listening on http://${config.host}:${config.port}`
  );
});
