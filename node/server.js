require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.NODE_PORT || 3001);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "marine-dashboard-node",
    status: "healthy",
    time: new Date().toISOString()
  });
});

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.emit("marine:connected", {
    message: "Connected to Marine Dashboard real-time service",
    time: new Date().toISOString()
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Marine Dashboard Node service running on http://127.0.0.1:${PORT}`);
});
