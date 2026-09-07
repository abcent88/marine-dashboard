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
const aisRoutes = require("./routes/ais");
const { requireAuth } = require("./middleware/auth");
const logger = require("./lib/logger");
const requestId = require("./middleware/requestId");
const MySQLSessionStore = require("./lib/mysqlSessionStore");

const app = express();
const server = http.createServer(app);

app.use(requestId);

const PORT = Number(process.env.NODE_PORT || 3001);
const HOST = process.env.NODE_HOST || "127.0.0.1";

const sessionSecret = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === "production" && !sessionSecret) {
  throw new Error("SESSION_SECRET is required in production");
}

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

app.use(session({
  store: new MySQLSessionStore(),
  secret: sessionSecret || "marine-dashboard-development-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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
app.use("/api/ais", aisRoutes);

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "marine-dashboard-node",
    status: "healthy",
    time: new Date().toISOString()
  });
});

/*
 * Return a consistent JSON response for unknown API routes.
 */
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

/*
 * Centralized Express error handler.
 * Route-level handlers can continue to manage expected errors,
 * while unexpected errors are logged consistently here.
 */
app.use((error, req, res, next) => {
  logger.error(
    {
      err: error,
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl
    },
    "Unhandled Express error"
  );

  if (res.headersSent) {
    return next(error);
  }

  res.status(error.status || 500).json({
    success: false,
    message: "Internal server error"
  });
});

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Socket connected");

  socket.emit("marine:connected", {
    message: "Connected to Marine Dashboard real-time service",
    time: new Date().toISOString()
  });

  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    logger.info({ host: HOST, port: PORT }, "Marine Dashboard Node service running");
  });
}

module.exports = { app, server, io };
