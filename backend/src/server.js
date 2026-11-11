import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import express from "express";
import path from "path";
import cors from "cors";

import { functions, inngest } from "./config/inngest.js";

import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";

import adminRoutes from "./routes/admin.route.js";
import userRoutes from "./routes/user.route.js";
import orderRoutes from "./routes/order.route.js";
import reviewRoutes from "./routes/review.route.js";
import productRoutes from "./routes/product.route.js";
import cartRoutes from "./routes/cart.route.js";
import paymentRoutes from "./routes/payment.route.js";

const app = express();

const __dirname = path.resolve();

// cors + clerk must run before every router (including /api/payment) so that
// auth is attached and browser preflights get CORS headers
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true })); // credentials: true allows the browser to send the cookies to the server with the request
app.use(clerkMiddleware()); // adds auth object under the req => req.auth

// special handling: Stripe webhook needs raw body BEFORE any body parsing middleware
// apply raw body parser conditionally only to webhook endpoint
app.use(
  "/api/payment",
  (req, res, next) => {
    if (req.originalUrl === "/api/payment/webhook") {
      express.raw({ type: "application/json" })(req, res, next);
    } else {
      express.json()(req, res, next); // parse json for non-webhook routes
    }
  },
  paymentRoutes
);

app.use(express.json());

app.use("/api/inngest", serve({ client: inngest, functions }));

app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "Success" });
});

// unknown api routes -> json 404 (instead of falling through to the admin SPA in production)
app.use("/api", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// error handler - multer upload errors, body parse errors (4xx), and unhandled server errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isUploadError = err.name === "MulterError" || err.message?.startsWith("Only image files");
  if (isUploadError) return res.status(400).json({ message: err.message });

  const statusCode = err.status || err.statusCode;
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ message: err.message || "Bad request" });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// make our app ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../admin/dist")));

  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../admin", "dist", "index.html"));
  });
}

const startServer = async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log("Server is up and running");
  });
};

startServer();
