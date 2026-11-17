
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const User = require("./models/User");
const Board = require("./models/Board");

const authRoutes = require("./routes/authRoutes");
const boardRoutes = require("./routes/boardRoutes");
const taskRoutes = require("./routes/taskRoutes");
const commentRoutes = require("./routes/commentRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false }));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/tasks", commentRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Project Management API is running",
  });
});

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Create HTTP and Socket.IO servers
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.set("io", io);

// Track online users by board and user.
// Multiple tabs for one user count as one online user.
const onlineByBoard = new Map();

function getOnlineUsers(boardId) {
  const boardUsers = onlineByBoard.get(boardId);

  if (!boardUsers) return [];

  return Array.from(boardUsers.entries()).map(
    ([userId, user]) => ({
      userId,
      name: user.name,
    })
  );
}

function broadcastPresence(boardId) {
  io.to(`board:${boardId}`).emit("presence:update", {
    boardId,
    onlineUsers: getOnlineUsers(boardId),
  });
}

// Remove one socket from a board's online-user tracking.
function removeSocketFromBoard(socket, boardId) {
  const boardUsers = onlineByBoard.get(boardId);
  const userEntry = boardUsers?.get(socket.user.id);

  if (!userEntry) return;

  userEntry.sockets.delete(socket.id);

  if (userEntry.sockets.size === 0) {
    boardUsers.delete(socket.user.id);
  }

  if (boardUsers.size === 0) {
    onlineByBoard.delete(boardId);
  }

  return true;
}

// Authenticate Socket.IO connections using JWT
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub);

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = {
      id: user._id.toString(),
      name: user.name,
    };

    next();
  } catch (error) {
    next(new Error("Invalid authentication token"));
  }
});

// Handle authenticated connections
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.user.name}`);

  socket.data.boardIds = new Set();

  // Join a board after verifying membership.
  socket.on("board:join", async (boardId, callback) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(boardId)) {
        return callback?.({
          success: false,
          message: "Invalid board ID",
        });
      }

      const board = await Board.findOne({
        _id: boardId,
        $or: [
          { owner: socket.user.id },
          { "members.user": socket.user.id },
        ],
      });

      if (!board) {
        return callback?.({
          success: false,
          message: "You do not have access to this board",
        });
      }

      const id = board._id.toString();
      const room = `board:${id}`;

      if (socket.data.boardIds.has(id)) {
        return callback?.({
          success: true,
          onlineUsers: getOnlineUsers(id),
        });
      }

      await socket.join(room);
      socket.data.boardIds.add(id);

      if (!onlineByBoard.has(id)) {
        onlineByBoard.set(id, new Map());
      }

      const boardUsers = onlineByBoard.get(id);

      if (!boardUsers.has(socket.user.id)) {
        boardUsers.set(socket.user.id, {
          name: socket.user.name,
          sockets: new Set(),
        });
      }

      boardUsers.get(socket.user.id).sockets.add(socket.id);

      broadcastPresence(id);

      callback?.({
        success: true,
        onlineUsers: getOnlineUsers(id),
      });
    } catch (error) {
      console.error("Board join error:", error.message);

      callback?.({
        success: false,
        message: "Could not join board",
      });
    }
  });

  // Leave a board
  socket.on("board:leave", (boardId) => {
    const id = String(boardId);

    if (!socket.data.boardIds.has(id)) return;

    socket.data.boardIds.delete(id);

    removeSocketFromBoard(socket, id);

    socket.leave(`board:${id}`);

    broadcastPresence(id);
  });

  // Clean up presence when a connection closes
  socket.on("disconnecting", () => {
    for (const id of socket.data.boardIds) {
      removeSocketFromBoard(socket, id);

      // Notify other connected users in this board room.
      socket.to(`board:${id}`).emit("presence:update", {
        boardId: id,
        onlineUsers: getOnlineUsers(id),
      });
    }

    socket.data.boardIds.clear();
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `Socket disconnected: ${socket.user.name} (${reason})`
    );
  });
});

// Handle unexpected Socket.IO errors
io.engine.on("connection_error", (error) => {
  console.error("Socket.IO connection error:", error.message);
});

// Connect database and start server
async function startServer() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    console.error("Missing MONGODB_URI or JWT_SECRET in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully");

    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
