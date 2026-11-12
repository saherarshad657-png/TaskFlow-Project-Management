const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const requireAuth = require("../middleware/auth");

const router = express.Router();

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

function createToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

// POST /api/auth/signup
router.post(
  "/signup",
  [
    body("name")
      .trim()
      .isLength({ min: 2, max: 60 })
      .withMessage("Name must be between 2 and 60 characters."),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Enter a valid email address.")
      .normalizeEmail(),
    body("password")
      .isString()
      .isLength({ min: 8, max: 72 })
      .withMessage("Password must be between 8 and 72 characters.")
  ],
  validateRequest,
  async (req, res) => {
    try {
      const name = req.body.name.trim();
      const email = req.body.email.trim().toLowerCase();

      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists."
        });
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 12);

      const user = await User.create({
        name,
        email,
        password: hashedPassword
      });

      return res.status(201).json({
        success: true,
        message: "Account created successfully.",
        token: createToken(user),
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists."
        });
      }

      console.error("Signup error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not create account. Please try again."
      });
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Enter a valid email address.")
      .normalizeEmail(),
    body("password")
      .isString()
      .notEmpty()
      .withMessage("Password is required.")
  ],
  validateRequest,
  async (req, res) => {
    try {
      const email = req.body.email.trim().toLowerCase();

      const user = await User.findOne({ email }).select("+password");

      if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password."
        });
      }

      return res.json({
        success: true,
        message: "Login successful.",
        token: createToken(user),
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error("Login error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not log in. Please try again."
      });
    }
  }
);

// GET /api/auth/me — protected route
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email createdAt");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found."
      });
    }

    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not load profile."
    });
  }
});

module.exports = router;
