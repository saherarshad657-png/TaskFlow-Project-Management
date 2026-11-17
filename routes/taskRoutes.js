
const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const { randomUUID } = require("crypto");

const Task = require("../models/Task");
const Board = require("../models/Board");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Protect all task routes
router.use(requireAuth);

const statuses = ["Pending", "In Progress", "Completed"];
const priorities = ["Low", "Medium", "High"];

// ========================================
// Helper functions
// ========================================

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function getIdString(value) {
  return String(value?._id ?? value);
}

function isMember(board, userId) {
  const currentUserId = getIdString(userId);

  return board.members.some(
    (member) => getIdString(member.user) === currentUserId
  );
}

function isOwner(board, userId) {
  return getIdString(board.owner) === getIdString(userId);
}

function isAdmin(board, userId) {
  const currentUserId = getIdString(userId);

  return board.members.some(
    (member) =>
      getIdString(member.user) === currentUserId &&
      member.role === "admin"
  );
}

function isTaskCreator(task, userId) {
  return task.createdBy &&
    getIdString(task.createdBy) === getIdString(userId);
}

function canAccessBoard(board, userId) {
  return isOwner(board, userId) || isMember(board, userId);
}

function canEditTaskDetails(board, task, userId) {
  return (
    isOwner(board, userId) ||
    isAdmin(board, userId) ||
    isTaskCreator(task, userId)
  );
}

// Broadcast an event to everyone in the board room
function broadcastTaskEvent(req, eventName, boardId, data) {
  const io = req.app.get("io");

  if (io) {
    io.to(`board:${boardId}`).emit(eventName, {
      eventId: randomUUID(),
      boardId: String(boardId),
      ...data
    });
  }
}

// Validate request data
function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg
      }))
    });
  }

  next();
}

// Get a board only if the user has permission
async function getAuthorizedBoard(boardId, userId) {
  if (!validId(boardId)) {
    return { error: "invalid" };
  }

  const board = await Board.findById(boardId);

  if (!board) {
    return { error: "notFound" };
  }

  if (!canAccessBoard(board, userId)) {
    return { error: "forbidden" };
  }

  return { board };
}

// Return appropriate access errors
function sendAccessError(res, error) {
  if (error === "invalid") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID."
    });
  }

  if (error === "notFound") {
    return res.status(404).json({
      success: false,
      message: "Board or task not found."
    });
  }

  return res.status(403).json({
    success: false,
    message: "You do not have access to this board."
  });
}

// ========================================
// POST /api/tasks
// Create a task
// ========================================

router.post(
  "/",
  [
    body("title")
      .isString()
      .trim()
      .isLength({ min: 2, max: 150 })
      .withMessage("Title must be between 2 and 150 characters."),

    body("description")
      .optional()
      .isString()
      .isLength({ max: 3000 })
      .withMessage("Description cannot exceed 3000 characters."),

    body("boardId")
      .isMongoId()
      .withMessage("A valid boardId is required."),

    body("status")
      .optional()
      .isIn(statuses)
      .withMessage("Invalid task status."),

    body("priority")
      .optional()
      .isIn(priorities)
      .withMessage("Invalid task priority."),

    body("dueDate")
      .optional({ values: "null" })
      .isISO8601()
      .withMessage("Due date must be a valid ISO date."),

    body("assignee")
      .optional({ values: "null" })
      .isMongoId()
      .withMessage("Assignee must be a valid user ID.")
  ],
  validateRequest,
  async (req, res) => {
    try {
      const access = await getAuthorizedBoard(
        req.body.boardId,
        req.user.id
      );

      if (access.error) {
        return sendAccessError(res, access.error);
      }

      const taskData = {
        title: req.body.title,
        description: req.body.description || "",
        board: access.board._id,
        createdBy: req.user.id,
        status: req.body.status || "Pending",
        priority: req.body.priority || "Medium",
        dueDate: req.body.dueDate || null
      };

      if (req.body.assignee) {
        if (!isMember(access.board, req.body.assignee)) {
          return res.status(400).json({
            success: false,
            message: "Assignee must be a member of this board."
          });
        }

        taskData.assignee = req.body.assignee;
      }

      const task = await Task.create(taskData);

      await task.populate([
        { path: "assignee", select: "name email" },
        { path: "createdBy", select: "name email" }
      ]);

      // Notify other users about the new task
      broadcastTaskEvent(
        req,
        "task:created",
        task.board,
        { task }
      );

      return res.status(201).json({
        success: true,
        message: "Task created successfully.",
        task
      });
    } catch (error) {
      console.error("Create task error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not create task."
      });
    }
  }
);

// ========================================
// GET /api/tasks/board/:boardId
// Get all tasks belonging to a board
// ========================================

router.get("/board/:boardId", async (req, res) => {
  try {
    const access = await getAuthorizedBoard(
      req.params.boardId,
      req.user.id
    );

    if (access.error) {
      return sendAccessError(res, access.error);
    }

    const tasks = await Task.find({
      board: access.board._id
    })
      .populate("assignee", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error("List tasks error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not load tasks."
    });
  }
});

// ========================================
// PATCH /api/tasks/:id
// Update a task
// ========================================

router.patch(
  "/:id",
  [
    body("title")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 150 })
      .withMessage("Title must be between 2 and 150 characters."),

    body("description")
      .optional()
      .isString()
      .isLength({ max: 3000 })
      .withMessage("Description cannot exceed 3000 characters."),

    body("status")
      .optional()
      .isIn(statuses)
      .withMessage("Invalid task status."),

    body("priority")
      .optional()
      .isIn(priorities)
      .withMessage("Invalid task priority."),

    body("dueDate")
      .optional({ values: "null" })
      .isISO8601()
      .withMessage("Due date must be a valid ISO date."),

    body("assignee")
      .optional({ values: "null" })
      .isMongoId()
      .withMessage("Assignee must be a valid user ID.")
  ],
  validateRequest,
  async (req, res) => {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID."
      });
    }

    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "assignee"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update."
      });
    }

    try {
      const task = await Task.findById(req.params.id);

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Task not found."
        });
      }

      const access = await getAuthorizedBoard(
        task.board,
        req.user.id
      );

      if (access.error) {
        return sendAccessError(res, access.error);
      }

      const detailFields = [
        "title",
        "description",
        "priority",
        "dueDate",
        "assignee"
      ];

      const editingDetails = detailFields.some(
        (field) => Object.prototype.hasOwnProperty.call(updates, field)
      );

      if (
        editingDetails &&
        !canEditTaskDetails(access.board, task, req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot edit these task details."
        });
      }

      if (updates.assignee) {
        if (!isMember(access.board, updates.assignee)) {
          return res.status(400).json({
            success: false,
            message: "Assignee must be a member of this board."
          });
        }
      }

      if (updates.dueDate === null || updates.dueDate === "") {
        updates.dueDate = null;
      }

      Object.assign(task, updates);

      await task.save();

      await task.populate([
        { path: "assignee", select: "name email" },
        { path: "createdBy", select: "name email" }
      ]);

      // Notify other users about the updated task
      broadcastTaskEvent(
        req,
        "task:updated",
        task.board,
        { task }
      );

      return res.status(200).json({
        success: true,
        message: "Task updated successfully.",
        task
      });
    } catch (error) {
      console.error("Update task error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not update task."
      });
    }
  }
);

// ========================================
// DELETE /api/tasks/:id
// Delete a task
// ========================================

router.delete("/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID."
    });
  }

  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found."
      });
    }

    const access = await getAuthorizedBoard(
      task.board,
      req.user.id
    );

    if (access.error) {
      return sendAccessError(res, access.error);
    }

    const canDelete =
      canEditTaskDetails(access.board, task, req.user.id);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete this task."
      });
    }

    const boardId = task.board;
    const taskId = task._id;

    await task.deleteOne();

    // Notify other users about the deleted task
    broadcastTaskEvent(
      req,
      "task:deleted",
      boardId,
      { taskId: String(taskId) }
    );

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully."
    });
  } catch (error) {
    console.error("Delete task error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not delete task."
    });
  }
});

module.exports = router;
