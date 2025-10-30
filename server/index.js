import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3001 });
console.log("ShrineVTT WebSocket running on ws://localhost:3001");

function broadcast(msg) {
  const json = JSON.stringify(msg);
  for (const client of wss.clients)
    if (client.readyState === 1) client.send(json);
}

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    const data = JSON.parse(raw);
    if (data.type === "chat_message") broadcast(data);
    if (data.type === "lss_roll") {
      const { user, text } = data.payload;
      broadcast({
        type: "chat_message",
        author: user,
        text: text,
      });
    }
  });
});
