import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getOrderByPayment, getUserOrders } from "../controllers/order.controller.js";

const router = Router();

// orders are created only by the stripe webhook (payment.controller.js -> handleWebhook) once a
// payment succeeds. there is deliberately no POST route: the old createOrder handler trusted
// client-supplied prices/totals and let any signed-in user create unpaid orders.
router.get("/", protectRoute, getUserOrders);
router.get("/by-payment/:paymentIntentId", protectRoute, getOrderByPayment);

export default router;
