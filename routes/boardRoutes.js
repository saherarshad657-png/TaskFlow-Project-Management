
const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");

const Board = require("../models/Board");
const User = require("../models/User");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Protect all board routes
router.use(requireAuth);

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

// Validate MongoDB IDs
function validId(id) {
  return mongoose.isValidObjectId(id);
}

// Convert populated documents and ObjectIds into comparable strings
function getIdString(value) {
  return String(value?._id || value);
}

// Check whether a user belongs to a board
function isMember(board, userId) {
  const currentUserId = getIdString(userId);

  return board.members.some(
    (member) => getIdString(member.user) === currentUserId
  );
}

// Check whether a user owns a board
function isOwner(board, userId) {
  return getIdString(board.owner) === getIdString(userId);
}

// Check whether a user can access a board
function canAccessBoard(board, userId) {
  return isOwner(board, userId) || isMember(board, userId);
}

// ========================================
// POST /api/boards
// Create a new board
// ========================================

router.post(
  "/",
  [
    body("name")
      .isString()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Board name must be between 2 and 100 characters."),

    body("description")
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage("Description cannot exceed 1000 characters.")
  ],
  validateRequest,
  async (req, res) => {
    try {
      const board = await Board.create({
        name: req.body.name,
        description: req.body.description || "",
        owner: req.user.id,
        members: [
          {
            user: req.user.id,
            role: "admin"
          }
        ]
      });

      return res.status(201).json({
        success: true,
        message: "Board created successfully.",
        board
      });
    } catch (error) {
      console.error("Create board error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not create board."
      });
    }
  }
);

// ========================================
// GET /api/boards
// Get all boards accessible to the user
// ========================================

router.get("/", async (req, res) => {
  try {
    const boards = await Board.find({
      $or: [
        { "members.user": req.user.id },
        { owner: req.user.id }
      ]
    })
      .populate("owner", "name email")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: boards.length,
      boards
    });
  } catch (error) {
    console.error("Get boards error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not load boards."
    });
  }
});

// ========================================
// GET /api/boards/:id
// Get a specific board
// ========================================

router.get("/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid board ID."
    });
  }

  try {
    const board = await Board.findById(req.params.id)
      .populate("owner", "name email")
      .populate("members.user", "name email");

    if (!board) {
      return res.status(404).json({
        success: false,
        message: "Board not found."
      });
    }

    if (!canAccessBoard(board, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this board."
      });
    }

    return res.status(200).json({
      success: true,
      board
    });
  } catch (error) {
    console.error("Get board error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not load board."
    });
  }
});

// ========================================
// POST /api/boards/:id/members
// Add a member to a board
// Only the board owner can add members
// ========================================

router.post(
  "/:id/members",
  [
    body("email")
      .isEmail()
      .withMessage("Enter a valid email address.")
      .normalizeEmail()
  ],
  validateRequest,
  async (req, res) => {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid board ID."
      });
    }

    try {
      const board = await Board.findById(req.params.id);

      if (!board) {
        return res.status(404).json({
          success: false,
          message: "Board not found."
        });
      }

      // Only the owner can add new members
      if (!isOwner(board, req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "Only the board owner can add members."
        });
      }

      const email = req.body.email.trim().toLowerCase();

      const user = await User.findOne({ email })
        .select("_id name email");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No registered user found with that email."
        });
      }

      // Prevent duplicate members
      if (isMember(board, user._id)) {
        return res.status(409).json({
          success: false,
          message: "This user is already a board member."
        });
      }

      board.members.push({
        user: user._id,
        role: "member"
      });

      await board.save();

      return res.status(200).json({
        success: true,
        message: "Board member added successfully.",
        member: user
      });
    } catch (error) {
      console.error("Add board member error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not add board member."
      });
    }
  }
);

module.exports = router;
