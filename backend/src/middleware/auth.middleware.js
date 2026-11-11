import { User } from "../models/user.model.js";
import { ENV } from "../config/env.js";

// note: clerk's requireAuth() redirects unauthenticated requests to "/" (302) - which in production
// serves the admin index.html with a 200. an API must answer 401 json instead, so we check
// req.auth() (populated by clerkMiddleware() in server.js) ourselves.
export const protectRoute = async (req, res, next) => {
  try {
    const clerkId = req.auth?.()?.userId;
    if (!clerkId) return res.status(401).json({ message: "Unauthorized - invalid token" });

    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ message: "User not found" });

    req.user = user;

    next();
  } catch (error) {
    console.error("Error in protectRoute middleware", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized - user not found" });
  }

  const adminEmail = ENV.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || req.user.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ message: "Forbidden - admin access only" });
  }

  next();
};
