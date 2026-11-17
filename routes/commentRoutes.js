
const express = require("express");
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const Comment = require("../models/comment");
const Task = require("../models/Task");
const Board = require("../models/Board");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// Check whether the logged-in user can access this task's board.
async function getAccessibleTask(taskId, userId) {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    return { error: "invalid" };
  }

  const task = await Task.findById(taskId);

  if (!task) {
    return { error: "not_found" };
  }

  const board = await Board.findOne({
    _id: task.board,
    $or: [
      { owner: userId },
      { "members.user": userId }
    ]
  });

  if (!board) {
    return { error: "forbidden" };
  }

  return { task, board };
}

// GET /api/tasks/:taskId/comments
router.get("/:taskId/comments", async (req, res) => {
  try {
    const result = await getAccessibleTask(
      req.params.taskId,
      req.user.id
    );

    if (result.error === "invalid") {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID"
      });
    }

    if (result.error === "not_found") {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    if (result.error === "forbidden") {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this board"
      });
    }

    const comments = await Comment.find({
      task: result.task._id
    })
      .populate("author", "name email")
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    console.error("Load comments error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load comments"
    });
  }
});

// POST /api/tasks/:taskId/comments
router.post("/:taskId/comments", async (req, res) => {
  try {
    const result = await getAccessibleTask(
      req.params.taskId,
      req.user.id
    );

    if (result.error === "invalid") {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID"
      });
    }

    if (result.error === "not_found") {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    if (result.error === "forbidden") {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this board"
      });
    }

    const content =
      typeof req.body.content === "string"
        ? req.body.content.trim()
        : "";

    if (!content || content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Comment must contain 1 to 2000 characters"
      });
    }

    const comment = await Comment.create({
      task: result.task._id,
      author: req.user.id,
      content
    });

    const saved = await Comment.findById(comment._id)
      .populate("author", "name email");

    // Broadcast only after the comment has been saved.
    const io = req.app.get("io");

    if (io) {
      io.to(`board:${result.task.board}`).emit("comment:created", {
        eventId: randomUUID(),
        boardId: String(result.task.board),
        comment: saved
      });
    }

    res.status(201).json({
      success: true,
      comment: saved
    });
  } catch (error) {
    console.error("Create comment error:", error);

    res.status(500).json({
      success: false,
      message: "Could not add comment"
    });
  }
});

module.exports = router;
