import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { Server } from "socket.io";

import authRoutes from "./routes/auth.routes.js";
import detectiveRoutes from "./routes/detective.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/detective", detectiveRoutes);
app.use("/api/admin", adminRoutes);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL }
});
app.set("io", io);

io.on("connection", socket => {
  socket.on("admin:join", () => socket.join("admins"));
});

const port = process.env.PORT || 5000;

await mongoose.connect(process.env.MONGO_URI);
server.listen(port, () => console.log(`API listening on ${port}`));
