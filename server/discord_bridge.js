import { Client, GatewayIntentBits } from "discord.js";
import WebSocket from "ws";
import dotenv from "dotenv";
import fetch from "node-fetch"; // добавить пакет
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ws = new WebSocket(process.env.WS_URL);

function sendToShrine(payload) {
  if (ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type: "chat_message", ...payload }));
}

// Загружает изображение как base64
async function fetchImageBase64(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const b64 = Buffer.from(buf).toString("base64");
    return `data:${contentType};base64,${b64}`;
  } catch (e) {
    console.error("Image fetch failed:", e.message);
    return null;
  }
}


client.on("ready", () =>
  console.log(`[DiscordBridge] Logged in as ${client.user.tag}`)
);

client.on("messageCreate", async (message) => {
  if (!message.author.bot || message.author.username !== "LSS") return;

  const embed = message.embeds?.[0];
  const author = embed?.author?.name || "LSS";
  const title = embed?.title || "";
  const desc = embed?.description || "";
  const thumb = embed?.thumbnail?.url || embed?.image?.url || null;

  let imageData = null;
  if (thumb) {
    imageData = await fetchImageBase64(thumb);
    console.log(`[DiscordBridge] fetched image: ${thumb} -> ${!!imageData}`);
  }

  sendToShrine({
    author,
    text: `**${title || author}**\n${desc}`,
    image: imageData,
  });
});

client.login(process.env.DISCORD_TOKEN);
