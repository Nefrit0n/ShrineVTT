import { Client, GatewayIntentBits, Partials } from "discord.js";
import WebSocket from "ws";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const REQUIRED_ENV = ["DISCORD_TOKEN", "WS_URL"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(
    `[DiscordBridge] Missing required environment variables: ${missingEnv.join(", ")}`
  );
  process.exit(1);
}

const SOURCE_BOT_ID = process.env.SOURCE_BOT_ID;
const SOURCE_BOT_NAME = process.env.SOURCE_BOT_NAME || "LSS";
const WATCH_CHANNEL_ID = process.env.WATCH_CHANNEL_ID;
const IMAGE_FETCH_TIMEOUT = Number(process.env.IMAGE_FETCH_TIMEOUT ?? 10_000);
const MAX_IMAGE_SIZE_BYTES = Number(process.env.MAX_IMAGE_SIZE_BYTES ?? 8 * 1024 * 1024);

class ShrineSocket {
  #url;
  #ws;
  #queue = [];
  #reconnectDelay = 1_000;
  #maxReconnectDelay = 30_000;

  constructor(url) {
    this.#url = url;
    this.#connect();
  }

  send(payload) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(payload));
      return;
    }

    this.#queue.push(payload);
  }

  #connect() {
    this.#ws = new WebSocket(this.#url);

    this.#ws.on("open", () => {
      console.log(`[DiscordBridge] Connected to Shrine at ${this.#url}`);
      this.#flushQueue();
      this.#reconnectDelay = 1_000;
    });

    this.#ws.on("close", (code, reason) => {
      const msg = reason?.toString() || "no reason";
      console.warn(
        `[DiscordBridge] Shrine socket closed (code=${code}, reason=${msg}). Reconnecting in ${this.#reconnectDelay}ms`
      );
      this.#scheduleReconnect();
    });

    this.#ws.on("error", (err) => {
      console.error(`[DiscordBridge] Shrine socket error: ${err.message}`);
      this.#ws.terminate();
    });
  }

  #flushQueue() {
    if (this.#queue.length === 0) return;

    const queued = [...this.#queue];
    this.#queue.length = 0;
    queued.forEach((payload) => this.send(payload));
  }

  #scheduleReconnect() {
    setTimeout(() => {
      this.#reconnectDelay = Math.min(
        this.#reconnectDelay * 2,
        this.#maxReconnectDelay
      );
      this.#connect();
    }, this.#reconnectDelay);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const shrineSocket = new ShrineSocket(process.env.WS_URL);

async function fetchImageBase64(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "ShrineBridgeBot/1.0 (+https://github.com/)",
        Accept: "image/*",
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const size = Number(res.headers.get("content-length")) || 0;
    if (size && size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image too large (${size} bytes)`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image too large (${buf.length} bytes)`);
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn(`[DiscordBridge] Image fetch timed out for ${url}`);
    } else {
      console.error(`[DiscordBridge] Image fetch failed for ${url}: ${err.message}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractTextFromMessage(message) {
  const embed = message.embeds?.[0];
  const lines = [];

  if (embed?.title) lines.push(`**${embed.title.trim()}**`);
  if (embed?.description) lines.push(embed.description.trim());

  if (embed?.fields?.length) {
    embed.fields.forEach((field) => {
      if (!field?.value) return;
      const fieldName = field.name ? `**${field.name.trim()}**` : null;
      const fieldValue = field.value.trim();
      lines.push(fieldName ? `${fieldName}\n${fieldValue}` : fieldValue);
    });
  }

  const content = message.content?.trim();
  if (content) lines.push(content);

  return lines.join("\n\n").trim();
}

function extractCharacterName(message) {
  const embed = message.embeds?.[0];

  const authorName = embed?.author?.name?.trim();
  if (authorName) return authorName;

  const footerName = embed?.footer?.text?.trim();
  if (footerName) return footerName;

  return null;
}

async function resolveImage(message) {
  const embed = message.embeds?.[0];
  const attachment = message.attachments?.first?.();

  const url =
    embed?.image?.url ||
    embed?.thumbnail?.url ||
    attachment?.url ||
    null;

  if (!url) return null;
  return fetchImageBase64(url);
}

function shouldProxyMessage(message) {
  if (!message.author?.bot) return false;
  if (SOURCE_BOT_ID && message.author.id !== SOURCE_BOT_ID) return false;
  if (!SOURCE_BOT_ID && message.author.username !== SOURCE_BOT_NAME) return false;
  if (WATCH_CHANNEL_ID && message.channelId !== WATCH_CHANNEL_ID) return false;
  return true;
}

client.on("ready", () => {
  console.log(`[DiscordBridge] Logged in as ${client.user.tag}`);
});

client.on("error", (err) => {
  console.error(`[DiscordBridge] Discord client error: ${err.message}`);
});

client.on("messageCreate", async (message) => {
  if (!shouldProxyMessage(message)) return;

  try {
    const text = extractTextFromMessage(message);
    const characterName = extractCharacterName(message);
    const image = await resolveImage(message);

    const payload = {
      type: "chat_message",
      author: message.author.globalName || message.author.username,
      text: text || "",
      image,
      timestamp: message.createdAt?.toISOString?.() ?? new Date().toISOString(),
      messageId: message.id,
      origin: "discord",
      characterName: characterName || undefined,
    };

    shrineSocket.send(payload);
  } catch (err) {
    console.error(`[DiscordBridge] Failed to proxy message ${message.id}: ${err.message}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
