import { createServer } from "http";
import { randomUUID } from "crypto";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import express from "express";
import { promises as fs } from "fs";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_FILE = join(__dirname, "data", "scenes.json");

// Простое хранилище сцен с чтением/записью в JSON-файл
class SceneStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { scenes: [], activeSceneId: null };
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      this.state = JSON.parse(raw);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const sampleScenes = this.createSampleScenes();
      this.state = {
        scenes: sampleScenes,
        activeSceneId: sampleScenes[0]?.id ?? null,
      };
      await this.save();
    }
    this.initialized = true;
  }

  createSampleScenes() {
    const firstId = randomUUID();
    const secondId = randomUUID();
    return [
      {
        id: firstId,
        name: "Туманное поле",
        thumbnail:
          "https://images.unsplash.com/photo-1528184039930-bd03972bd974?auto=format&fit=crop&w=400&q=60",
        background:
          "https://images.unsplash.com/photo-1528184039930-bd03972bd974?auto=format&fit=crop&w=1600&q=80",
        width: 60,
        height: 40,
        gridSize: 5,
        mode: "tactical",
        status: "active",
        tags: ["лес", "ночь"],
      },
      {
        id: secondId,
        name: "Зал совета",
        thumbnail:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=60",
        background:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
        width: 30,
        height: 20,
        gridSize: 2,
        mode: "theatre",
        status: "hidden",
        tags: ["город", "интрига"],
      },
    ];
  }

  async save() {
    await fs.writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf-8");
  }

  async getState() {
    await this.init();
    return this.state;
  }

  async getScenes() {
    const state = await this.getState();
    return state.scenes;
  }

  async getScene(id) {
    const scenes = await this.getScenes();
    return scenes.find((scene) => scene.id === id) ?? null;
  }

  async setScenes(nextScenes) {
    this.state.scenes = nextScenes;
    await this.save();
  }

  async setActiveSceneId(sceneId) {
    this.state.activeSceneId = sceneId;
    await this.save();
  }
}

const store = new SceneStore(DATA_FILE);

const app = express();
app.use(express.json({ limit: "10mb" }));

// Простейшая поддержка CORS для клиентского приложения
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

function normalizeScenePayload(payload = {}) {
  const name = String(payload.name ?? "").trim();
  if (!name) {
    throw new Error("Название сцены обязательно");
  }

  const width = Number(payload.width) || 0;
  const height = Number(payload.height) || 0;
  const gridSize = Number(payload.gridSize) || 0;
  if (width <= 0 || height <= 0 || gridSize <= 0) {
    throw new Error("Некорректные размеры карты или сетки");
  }

  const mode = payload.mode === "tactical" ? "tactical" : "theatre";
  const status =
    payload.status === "hidden"
      ? "hidden"
      : payload.status === "active"
        ? "active"
        : "draft";

  let tags = [];
  if (Array.isArray(payload.tags)) {
    tags = payload.tags.map((tag) => String(tag).trim()).filter(Boolean);
  } else if (typeof payload.tags === "string") {
    tags = payload.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  const background = typeof payload.background === "string" ? payload.background : undefined;
  const thumbnail = typeof payload.thumbnail === "string" ? payload.thumbnail : background;

  return {
    name,
    background,
    thumbnail,
    width,
    height,
    gridSize,
    mode,
    status,
    tags,
  };
}

function broadcast(wss, message) {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

// Получение списка сцен и активной сцены
app.get("/api/scenes", async (_req, res) => {
  const state = await store.getState();
  res.json(state);
});

// Получение одной сцены по идентификатору
app.get("/api/scenes/:id", async (req, res) => {
  const scene = await store.getScene(req.params.id);
  if (!scene) {
    res.status(404).send("Сцена не найдена");
    return;
  }
  res.json(scene);
});

// Создание новой сцены
app.post("/api/scenes", async (req, res) => {
  try {
    const payload = normalizeScenePayload(req.body);
    const state = await store.getState();
    const id = randomUUID();
    const scene = { id, ...payload };

    const becameActive = payload.status === "active";
    if (becameActive) {
      state.scenes = state.scenes.map((item) =>
        item.status === "active" ? { ...item, status: "hidden" } : item
      );
      state.activeSceneId = id;
    }

    state.scenes.push(scene);
    await store.save();

    if (becameActive) {
      broadcast(wss, { type: "sceneActivated", sceneId: id });
    }
    broadcast(wss, { type: "scenesUpdated" });
    res.status(201).json(scene);
  } catch (error) {
    res.status(400).send(error.message ?? "Не удалось создать сцену");
  }
});

// Обновление данных сцены
app.put("/api/scenes/:id", async (req, res) => {
  try {
    const payload = normalizeScenePayload(req.body);
    const state = await store.getState();
    const index = state.scenes.findIndex((scene) => scene.id === req.params.id);
    if (index === -1) {
      res.status(404).send("Сцена не найдена");
      return;
    }

    const updatedScene = { ...state.scenes[index], ...payload };
    state.scenes[index] = updatedScene;

    const becameActive = payload.status === "active";
    if (becameActive) {
      state.scenes = state.scenes.map((scene) =>
        scene.id === updatedScene.id
          ? { ...updatedScene, status: "active" }
          : { ...scene, status: scene.id === state.activeSceneId ? "hidden" : scene.status }
      );
      state.activeSceneId = updatedScene.id;
    }

    await store.save();

    if (becameActive) {
      broadcast(wss, { type: "sceneActivated", sceneId: updatedScene.id });
    }
    broadcast(wss, { type: "scenesUpdated" });
    res.json(updatedScene);
  } catch (error) {
    res.status(400).send(error.message ?? "Не удалось обновить сцену");
  }
});

// Удаление сцены
app.delete("/api/scenes/:id", async (req, res) => {
  const state = await store.getState();
  const index = state.scenes.findIndex((scene) => scene.id === req.params.id);
  if (index === -1) {
    res.status(404).send("Сцена не найдена");
    return;
  }

  if (state.activeSceneId === req.params.id) {
    res.status(400).send("Нельзя удалить активную сцену");
    return;
  }

  state.scenes.splice(index, 1);
  await store.save();

  broadcast(wss, { type: "scenesUpdated" });
  res.status(204).end();
});

// Дублирование сцены
app.post("/api/scenes/:id/duplicate", async (req, res) => {
  const state = await store.getState();
  const scene = state.scenes.find((item) => item.id === req.params.id);
  if (!scene) {
    res.status(404).send("Сцена не найдена");
    return;
  }

  const duplicated = {
    ...scene,
    id: randomUUID(),
    name: `${scene.name} (копия)`,
    status: "draft",
  };

  state.scenes.push(duplicated);
  await store.save();

  broadcast(wss, { type: "scenesUpdated" });
  res.status(201).json(duplicated);
});

// Пересортировка сцен по переданному порядку идентификаторов
app.post("/api/scenes/reorder", async (req, res) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids)) {
    res.status(400).send("Некорректные данные для сортировки");
    return;
  }

  const normalized = ids
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter(Boolean);

  if (!normalized.length) {
    res.status(400).send("Список идентификаторов пуст");
    return;
  }

  const state = await store.getState();
  const seen = new Set();
  const reordered = [];

  for (const id of normalized) {
    if (seen.has(id)) continue;
    seen.add(id);
    const existing = state.scenes.find((scene) => scene.id === id);
    if (existing) {
      reordered.push(existing);
    }
  }

  if (!reordered.length) {
    res.status(400).send("Не удалось сопоставить идентификаторы сцен");
    return;
  }

  const leftovers = state.scenes.filter((scene) => !seen.has(scene.id));
  state.scenes = [...reordered, ...leftovers];
  await store.save();

  broadcast(wss, { type: "scenesUpdated" });
  res.json({ success: true });
});

// Активация сцены и оповещение игроков
app.post("/api/scenes/:id/activate", async (req, res) => {
  const state = await store.getState();
  const scene = state.scenes.find((item) => item.id === req.params.id);
  if (!scene) {
    res.status(404).send("Сцена не найдена");
    return;
  }

  state.scenes = state.scenes.map((item) =>
    item.id === scene.id
      ? { ...item, status: "active" }
      : item.status === "active"
        ? { ...item, status: "hidden" }
        : item
  );
  state.activeSceneId = scene.id;
  await store.save();

  broadcast(wss, { type: "sceneActivated", sceneId: scene.id });
  broadcast(wss, { type: "scenesUpdated" });

  res.json({ success: true });
});

const server = createServer(app);
const wss = new WebSocketServer({ port: 3001 });

server.listen(3000, async () => {
  await store.init();
  console.log("ShrineVTT API running on http://localhost:3000");
  console.log("ShrineVTT WebSocket running on ws://localhost:3001");
});

// При подключении клиента проксируем сообщения чата и служебные события
wss.on("connection", (socket) => {
  socket.on("message", async (raw) => {
    const data = JSON.parse(raw);

    if (data.type === "chat_message") {
      broadcast(wss, {
        ...data,
        timestamp: data.timestamp ?? new Date().toISOString(),
        origin: data.origin ?? "player",
      });
    }

    if (data.type === "lss_roll") {
      const { user, text } = data.payload;
      broadcast(wss, {
        type: "chat_message",
        author: user,
        text,
        timestamp: new Date().toISOString(),
        origin: "discord",
      });
    }
  });
});
