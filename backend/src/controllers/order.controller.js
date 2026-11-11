import { stripe } from "../config/stripe.js";
import { Order } from "../models/order.model.js";
import { Review } from "../models/review.model.js";

const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9_]+$/;

// GET /api/orders/by-payment/:paymentIntentId
// Lets the app learn the outcome of a checkout. Owner only, and 404 (never 403) for anyone else
// or an unknown id, so payment ids can't be probed (spec 0001, AC-8).
export async function getOrderByPayment(req, res) {
  const notFound = () => res.status(404).json({ error: "Order not found" });

  try {
    const { paymentIntentId } = req.params;
    if (!PAYMENT_INTENT_ID.test(paymentIntentId)) return notFound();

    const order = await Order.findOne({ "paymentResult.id": paymentIntentId, clerkId: req.user.clerkId });
    if (order) {
      return res.status(200).json({
        orderId: order._id,
        status: order.status,
        paymentStatus: order.paymentResult.status,
        cancelReason: order.cancelReason,
      });
    }

    // an order exists but belongs to someone else
    if (await Order.exists({ "paymentResult.id": paymentIntentId })) return notFound();

    // no order yet: the webhook may still be working on it. check ownership on the intent itself.
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      if (error?.statusCode === 404 || error?.code === "resource_missing") return notFound();
      throw error;
    }
    if (paymentIntent.metadata?.clerkId !== req.user.clerkId) return notFound();

    res.status(202).json({ status: "processing" });
  } catch (error) {
    console.error("Error in getOrderByPayment controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUserOrders(req, res) {
  try {
    const orders = await Order.find({ clerkId: req.user.clerkId })
      .populate("orderItems.product")
      .sort({ createdAt: -1 });

    // check if each order has been reviewed

    const orderIds = orders.map((order) => order._id);
    const reviews = await Review.find({ orderId: { $in: orderIds } });
    const reviewedOrderIds = new Set(reviews.map((review) => review.orderId.toString()));

    const ordersWithReviewStatus = await Promise.all(
      orders.map(async (order) => {
        return {
          ...order.toObject(),
          hasReviewed: reviewedOrderIds.has(order._id.toString()),
        };
      })
    );

    res.status(200).json({ orders: ordersWithReviewStatus });
  } catch (error) {
    console.error("Error in getUserOrders controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
