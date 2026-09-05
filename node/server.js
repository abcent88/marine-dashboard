require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const http = require("http");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { Server } = require("socket.io");
const dashboardRoutes = require("./routes/dashboard");
const vesselRoutes = require("./routes/vessels");
const voyageRoutes = require("./routes/voyages");
const fuelRoutes = require("./routes/fuel");
const maintenanceRoutes = require("./routes/maintenance");
const alertsRoutes = require("./routes/alerts");
const crewRoutes = require("./routes/crew");
const catchRoutes = require("./routes/catch");
const reportsRoutes = require("./routes/reports");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const { requireAuth } = require("./middleware/auth");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.NODE_PORT || 3001);
const HOST = process.env.NODE_HOST || "127.0.0.1";

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "marine-dashboard-development-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

/*
 * Serve the Marine Dashboard frontend.
 * The project root contains index.html, login.html,
 * app.js, data.js, styles.css and session.js.
 */
app.use(express.static(require("path").resolve(__dirname, "..")));

/*
 * Protect all operational APIs.
 * Authentication routes remain public so users can
 * log in, log out, and check their current session.
 */
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/vessels", requireAuth, vesselRoutes);
app.use("/api/voyages", requireAuth, voyageRoutes);
app.use("/api/fuel", requireAuth, fuelRoutes);
app.use("/api/maintenance", requireAuth, maintenanceRoutes);
app.use("/api/alerts", requireAuth, alertsRoutes);
app.use("/api/crew", requireAuth, crewRoutes);
app.use("/api/catch", requireAuth, catchRoutes);
app.use("/api/reports", requireAuth, reportsRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

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

server.listen(PORT, HOST, () => {
  console.log(`Marine Dashboard Node service running on http://127.0.0.1:${PORT}`);
});
