import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "shrinevtt-bootstrap-"));
process.env.DATA_DIR = dataDir;
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";
process.env.SEED_TEST_SCENE = "false";

const { bootstrap } = await import("../src/server.js");

test.after(async () => {
  delete process.env.DATA_DIR;
  delete process.env.PORT;
  delete process.env.HOST;
  delete process.env.SEED_TEST_SCENE;
  await rm(dataDir, { recursive: true, force: true });
});

test("bootstrap starts and stops the HTTP server", async () => {
  const { httpServer, close } = await bootstrap();

  assert.equal(httpServer.listening, true);

  const address = httpServer.address();
  assert.ok(address && typeof address.port === "number" && address.port > 0);

  const response = await fetch(`http://${address.address}:${address.port}/health`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "ok");

  await close();

  assert.equal(httpServer.listening, false);
});
