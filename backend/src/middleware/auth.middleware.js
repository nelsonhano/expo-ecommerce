import { clerkClient } from "@clerk/express";
import { User } from "../models/user.model.js";
import { ENV } from "../config/env.js";

// only a primary email that clerk has verified is trusted (adminOnly matches on it)
const getPrimaryVerifiedEmail = (clerkUser) => {
  const primary = clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId);
  if (!primary || primary.verification?.status !== "verified") return null;
  return primary.emailAddress.toLowerCase();
};

// fallback for when the clerk -> inngest "clerk/user.created" sync never ran (local dev without the
// inngest dev server, or a missed webhook in production). data comes straight from clerk's api.
const createUserFromClerk = async (clerkId) => {
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const email = getPrimaryVerifiedEmail(clerkUser);
  if (!email) return null;

  try {
    return await User.create({
      clerkId,
      email,
      name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
      imageUrl: clerkUser.imageUrl || "",
      addresses: [],
      wishlist: [],
    });
  } catch (error) {
    // duplicate key: the inngest sync (or a parallel request) created it first
    if (error.code === 11000) return User.findOne({ clerkId });
    throw error;
  }
};

// note: clerk's requireAuth() redirects unauthenticated requests to "/" (302) - which in production
// serves the admin index.html with a 200. an API must answer 401 json instead, so we check
// req.auth() (populated by clerkMiddleware() in server.js) ourselves.
export const protectRoute = async (req, res, next) => {
  try {
    const clerkId = req.auth?.()?.userId;
    if (!clerkId) return res.status(401).json({ message: "Unauthorized - invalid token" });

    const user = (await User.findOne({ clerkId })) || (await createUserFromClerk(clerkId));
    if (!user) return res.status(401).json({ message: "Unauthorized - user not found" });

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
