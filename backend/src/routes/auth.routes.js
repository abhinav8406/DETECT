import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";

const router = Router();

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        message: "Email and password are required."
      });
    }

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    res.json({
      token: signToken(user),
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        qualificationStatus: user.qualificationStatus
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Login failed. Please try again."
    });
  }
});

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password
    } = req.body;

    const cleanName = name?.trim();
    const cleanUsername = username?.trim();
    const cleanEmail = email?.trim().toLowerCase();

    // Validate required fields
    if (!cleanName || !cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({
        message: "Name, username, email and password are required."
      });
    }

    // Basic validation
    if (cleanName.length < 2) {
      return res.status(400).json({
        message: "Name must contain at least 2 characters."
      });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        message: "Username must contain at least 3 characters."
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return res.status(400).json({
        message: "Username can contain only letters, numbers and underscores."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must contain at least 6 characters."
      });
    }

    // Check duplicate email OR username
    const existingUser = await User.findOne({
      $or: [
        { email: cleanEmail },
        { username: cleanUsername }
      ]
    });

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        return res.status(409).json({
          message: "An account with this email already exists."
        });
      }

      if (existingUser.username === cleanUsername) {
        return res.status(409).json({
          message: "This username is already taken."
        });
      }

      return res.status(409).json({
        message: "An account with these details already exists."
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create participant account
    const user = await User.create({
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      role: "participant",
      qualificationStatus: "PENDING",
      round1Status: "NOT_STARTED",
      round1Score: 0
    });

    // Automatically log the new user in
    res.status(201).json({
      message: "Registration successful.",
      token: signToken(user),
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        qualificationStatus: user.qualificationStatus
      }
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handles MongoDB unique-index race conditions
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      return res.status(409).json({
        message:
          duplicateField === "email"
            ? "An account with this email already exists."
            : "This username is already taken."
      });
    }

    res.status(500).json({
      message: "Registration failed. Please try again."
    });
  }
});

export default router;
