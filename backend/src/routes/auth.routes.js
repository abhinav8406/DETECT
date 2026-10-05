import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  res.json({
    token: signToken(user),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      qualificationStatus: user.qualificationStatus
    }
  });
});

export default router;
