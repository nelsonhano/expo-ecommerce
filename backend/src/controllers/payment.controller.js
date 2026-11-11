import mongoose from "mongoose";
import { ENV } from "../config/env.js";
import { stripe } from "../config/stripe.js";
import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";
import { reconcilePaymentIntent } from "../services/checkout.service.js";

// stripe caps each metadata value at 500 characters
const METADATA_VALUE_LIMIT = 500;

// every event that can move a manual capture PaymentIntent; all go through one reconcile (spec 0001)
const HANDLED_EVENTS = new Set([
  "payment_intent.amount_capturable_updated",
  "payment_intent.canceled",
  "payment_intent.succeeded",
]);

export async function createPaymentIntent(req, res) {
  try {
    const { cartItems, shippingAddress } = req.body;
    const user = req.user;

    // Validate cart items
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // the order is only created later by the webhook - if the address is incomplete there, the
    // customer would be charged without an order being saved. so validate it up front.
    const addressFields = ["fullName", "streetAddress", "city", "state", "zipCode", "phoneNumber"];
    if (!shippingAddress || typeof shippingAddress !== "object") {
      return res.status(400).json({ error: "A complete shipping address is required" });
    }

    for (const field of addressFields) {
      const val = shippingAddress[field];
      if (typeof val !== "string" || !val.trim() || val.length > 150) {
        return res.status(400).json({ error: `Valid ${field} is required (max 150 characters)` });
      }
    }

    // Calculate total from server-side (don't trust client - ever.)
    let subtotal = 0;
    const validatedItems = [];

    for (const item of cartItems) {
      // negative / fractional quantities would let a client lower the total
      if (!Number.isInteger(item?.quantity) || item.quantity < 1) {
        return res.status(400).json({ error: "Invalid item quantity" });
      }

      const productId = item.product?._id;
      const product = mongoose.isValidObjectId(productId) ? await Product.findById(productId) : null;
      if (!product) {
        return res.status(404).json({ error: `Product ${item.product?.name || ""} not found` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      subtotal += product.price * item.quantity;
      validatedItems.push({
        product: product._id.toString(),
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.images[0],
      });
    }

    const shipping = 10.0; // $10
    const tax = subtotal * 0.08; // 8%
    const total = subtotal + shipping + tax;

    if (total <= 0) {
      return res.status(400).json({ error: "Invalid order total" });
    }

    // find or create the stripe customer
    let customer;
    if (user.stripeCustomerId) {
      // find the customer
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
    } else {
      // create the customer
      customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          clerkId: user.clerkId,
          userId: user._id.toString(),
        },
      });

      // add the stripe customer ID to the  user object in the DB
      await User.findByIdAndUpdate(user._id, { stripeCustomerId: customer.id });
    }

    // store only ids, quantities, and the unit price in cents charged now (c), so the webhook
    // prices order lines at what the customer paid even if the product price changes (AC-15)
    const orderItemsMeta = JSON.stringify(
      validatedItems.map((i) => ({ p: i.product, q: i.quantity, c: Math.round(i.price * 100) }))
    );
    if (orderItemsMeta.length > METADATA_VALUE_LIMIT) {
      return res.status(400).json({ error: "Cart too large, please split your order" });
    }

    const shippingAddressMeta = JSON.stringify(
      Object.fromEntries(addressFields.map((field) => [field, shippingAddress[field].trim()]))
    );
    if (shippingAddressMeta.length > METADATA_VALUE_LIMIT) {
      return res.status(400).json({ error: "Shipping address too long, please shorten details" });
    }

    // authorize only: the webhook reserves stock first and captures after (spec 0001).
    // "card" covers Apple Pay and Google Pay, and every card method supports a separate capture.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // convert to cents
      currency: "usd",
      customer: customer.id,
      capture_method: "manual",
      payment_method_types: ["card"],
      metadata: {
        clerkId: user.clerkId,
        userId: user._id.toString(),
        orderItems: orderItemsMeta,
        shippingAddress: shippingAddressMeta,
        totalPrice: total.toFixed(2),
      },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
}

export async function handleWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, ENV.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (!HANDLED_EVENTS.has(event.type)) return res.json({ received: true });

  const paymentIntentId = event.data.object.id;
  try {
    // decisions come from the live PaymentIntent, never from the event type or a stale payload
    await reconcilePaymentIntent(stripe, paymentIntentId);
  } catch (error) {
    console.error(`Error reconciling ${paymentIntentId} (${event.type}):`, error);
    // non-2xx makes stripe retry the event later; reconcile is safe to run again
    return res.status(500).json({ error: "Failed to process webhook" });
  }

  res.json({ received: true });
}
