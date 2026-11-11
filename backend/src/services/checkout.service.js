// Checkout reconcile for spec 0001: authorize, then reserve stock, then capture.
//
// Every handled webhook event funnels into reconcilePaymentIntent(). It fetches the LIVE
// PaymentIntent and acts on its current status together with the stored order, never on which
// event arrived (Stripe does not promise event order). It is safe to run any number of times.
//
// Rules this file keeps (spec 0001, key invariants):
// - stock is only decreased by a conditional update (stock >= qty) inside the reserve transaction
// - taking stock + inserting the authorized order is one transaction; putting stock back + moving
//   the order to cancelled is one transaction, guarded by the order still being "authorized"
// - a transaction callback never calls Stripe or changes outside state (Mongoose may run it again)
// - an order is never cancelled while its live PaymentIntent is "succeeded"
import mongoose from "mongoose";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { Cart } from "../models/cart.model.js";

const MAX_RECONCILE_DEPTH = 3;
const TEMPORARY_STRIPE_ERRORS = new Set(["StripeConnectionError", "StripeAPIError", "StripeRateLimitError"]);

// thrown inside the reserve transaction to abort it when an item is short
class ShortStockError extends Error {
  constructor(productId) {
    super(`Not enough stock for product ${productId}`);
    this.productId = productId;
  }
}

const isDuplicateKeyError = (error) => error?.code === 11000;

export const isTemporaryStripeError = (error) =>
  TEMPORARY_STRIPE_ERRORS.has(error?.type) || (error?.statusCode ?? 0) >= 500;

export function parseMetadata(paymentIntent) {
  try {
    const { userId, clerkId, shippingAddress, totalPrice, orderItems } = paymentIntent.metadata || {};
    if (!userId || !clerkId || !shippingAddress || !totalPrice || !orderItems) return null;
    const parsedAddress = JSON.parse(shippingAddress);
    const parsedItems = JSON.parse(orderItems);
    const parsedTotal = parseFloat(totalPrice);
    if (!Array.isArray(parsedItems) || Number.isNaN(parsedTotal) || typeof parsedAddress !== "object" || !parsedAddress) {
      return null;
    }
    return {
      userId,
      clerkId,
      shippingAddress: parsedAddress,
      totalPrice: parsedTotal,
      orderItems: parsedItems,
    };
  } catch {
    return null;
  }
}

export async function reconcilePaymentIntent(stripe, paymentIntentId, depth = 0) {
  if (depth > MAX_RECONCILE_DEPTH) {
    throw new Error(`Reconcile for ${paymentIntentId} did not settle after ${MAX_RECONCILE_DEPTH} retries`);
  }
  const again = () => reconcilePaymentIntent(stripe, paymentIntentId, depth + 1);

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  // intents created before manual capture shipped (AC-13). Remove once drained (migration phase 6).
  if (paymentIntent.capture_method !== "manual") {
    if (paymentIntent.status === "succeeded") await fulfilLegacyPayment(stripe, paymentIntent);
    return;
  }

  const order = await Order.findOne({ "paymentResult.id": paymentIntentId });
  const paymentStatus = order?.paymentResult?.status;

  // Unparseable metadata cannot produce a valid order: cancel permanently instead of retrying forever
  const meta = parseMetadata(paymentIntent);
  if (!meta && !order) {
    console.error(`PaymentIntent ${paymentIntentId} has invalid or missing metadata; cancelling permanently`);
    if (paymentIntent.status === "requires_capture") {
      await cancelPaymentIntent(stripe, paymentIntentId);
    }
    return;
  }

  switch (paymentIntent.status) {
    case "requires_capture": {
      if (!order) {
        const result = await reserve(paymentIntent);
        if (result.duplicate) return again();
        if (result.short) return markSoldOut(stripe, paymentIntent, result, again);
        return capture(stripe, paymentIntentId, again);
      }
      if (paymentStatus === "authorized") return capture(stripe, paymentIntentId, again);
      if (order.status === "cancelled") return cancelPaymentIntent(stripe, paymentIntentId); // an earlier cancel didn't finish
      console.error(`Order ${order._id} is ${paymentStatus} but PaymentIntent ${paymentIntentId} still requires capture`);
      return;
    }

    case "succeeded": {
      if (!order) {
        // should be impossible: capture only ever happens after reserving
        const result = await reserve(paymentIntent);
        if (result.duplicate) return again();
        if (result.short) {
          throw new Error(
            `PaymentIntent ${paymentIntentId} was captured but product ${result.productId} has no stock. Needs manual follow up`
          );
        }
        return markCaptured(paymentIntentId);
      }
      if (paymentStatus === "authorized") return markCaptured(paymentIntentId); // capture worked, DB write didn't
      if (paymentStatus === "captured") return clearPurchasedFromCart(order); // idempotent heal
      throw new Error(`Order ${order._id} is ${order.status}/${paymentStatus} but PaymentIntent ${paymentIntentId} was captured`);
    }

    case "canceled": {
      // no stock is ever taken for a dead PaymentIntent (AC-16)
      if (paymentStatus === "authorized") await release(paymentIntentId, "authorization_expired");
      return;
    }

    default:
      // processing, requires_payment_method, ...: a later event will come
      return;
  }
}

// Builds the item list from metadata { p, q, c }. Quantities of a repeated product are added up.
// Returns { items } or { short, productId } when a product is unknown or deleted (AC-14).
async function buildOrderItems(paymentIntent) {
  const meta = parseMetadata(paymentIntent);
  if (!meta) return { short: true, productId: "invalid_metadata", items: [] };

  const wanted = new Map();
  for (const { p, q, c } of meta.orderItems) {
    const existing = wanted.get(p);
    if (existing) existing.quantity += q;
    else wanted.set(p, { quantity: q, unitCents: c });
  }

  const ids = [...wanted.keys()];
  const invalidId = ids.find((id) => !mongoose.isValidObjectId(id));
  if (invalidId) return { short: true, productId: invalidId, items: [] };

  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  const items = [];
  let missingId = null;
  for (const [id, { quantity, unitCents }] of wanted) {
    const product = byId.get(id);
    if (!product) {
      missingId ??= id;
      continue;
    }
    items.push({
      product: product._id,
      name: product.name,
      // the price the customer was charged, saved at intent time (AC-15)
      price: Number.isInteger(unitCents) ? unitCents / 100 : product.price,
      quantity,
      image: product.images[0],
    });
  }

  if (missingId) return { short: true, productId: missingId, items };
  return { items };
}

function baseOrder(paymentIntent, items) {
  const meta = parseMetadata(paymentIntent);
  if (!meta) {
    throw new Error(`Cannot build base order: invalid metadata on PaymentIntent ${paymentIntent.id}`);
  }
  return {
    user: meta.userId,
    clerkId: meta.clerkId,
    orderItems: items,
    shippingAddress: meta.shippingAddress,
    totalPrice: meta.totalPrice,
  };
}

// Takes stock for every item and inserts the order in one transaction.
// Returns { ok }, { short, productId, items }, or { duplicate } (another delivery won).
async function reserve(paymentIntent) {
  const built = await buildOrderItems(paymentIntent);
  if (built.short) return built;

  try {
    await mongoose.connection.transaction(async (session) => {
      for (const item of built.items) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.product, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session }
        );
        if (!updated) throw new ShortStockError(item.product.toString());
      }
      await Order.create(
        [
          {
            ...baseOrder(paymentIntent, built.items),
            status: "pending",
            paymentResult: { id: paymentIntent.id, status: "authorized" },
          },
        ],
        { session }
      );
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ShortStockError) return { short: true, productId: error.productId, items: built.items };
    if (isDuplicateKeyError(error)) return { duplicate: true };
    throw error;
  }
}

// Lost the race: record the cancelled order first, and only then release the authorization.
async function markSoldOut(stripe, paymentIntent, { productId, items }, again) {
  let order;
  try {
    order = await Order.create({
      ...baseOrder(paymentIntent, items),
      status: "cancelled",
      cancelReason: "sold_out",
      paymentResult: { id: paymentIntent.id, status: "canceled" },
    });
  } catch (error) {
    // a concurrent delivery may hold a valid authorized order: never cancel at Stripe here
    if (isDuplicateKeyError(error)) return again();
    throw error;
  }

  await cancelPaymentIntent(stripe, paymentIntent.id);
  console.warn(`Order ${order._id} cancelled as sold out (product ${productId}), PaymentIntent ${paymentIntent.id} released`);
}

async function capture(stripe, paymentIntentId, again) {
  try {
    // no idempotency key needed: we only get here when the live status is requires_capture
    await stripe.paymentIntents.capture(paymentIntentId);
  } catch (error) {
    if (isTemporaryStripeError(error)) throw error; // 500 -> Stripe retries the event

    const fresh = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (fresh.status !== "requires_capture") return again(); // e.g. it was captured after all

    console.error(`Capture failed for good for ${paymentIntentId} (${error.type}/${error.code}), cancelling`);
    await release(paymentIntentId, "capture_failed");
    await cancelPaymentIntent(stripe, paymentIntentId);
    return;
  }
  return markCaptured(paymentIntentId);
}

async function markCaptured(paymentIntentId) {
  await Order.updateOne(
    { "paymentResult.id": paymentIntentId, "paymentResult.status": "authorized" },
    { $set: { "paymentResult.status": "captured" } }
  );
  const order = await Order.findOne({ "paymentResult.id": paymentIntentId });
  await clearPurchasedFromCart(order);
  console.log(`Order ${order._id} captured for PaymentIntent ${paymentIntentId}`);
}

// Puts the stock back and cancels the order, at most once (guarded on "authorized").
async function release(paymentIntentId, reason) {
  await mongoose.connection.transaction(async (session) => {
    const order = await Order.findOneAndUpdate(
      { "paymentResult.id": paymentIntentId, "paymentResult.status": "authorized" },
      {
        $set: {
          status: "cancelled",
          cancelReason: reason,
          "paymentResult.status": reason === "capture_failed" ? "capture_failed" : "canceled",
        },
      },
      { session, new: true }
    );
    if (!order) return;
    for (const item of order.orderItems) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }, { session });
    }
  });
}

// Cancels the authorization. An intent that is already canceled counts as success.
async function cancelPaymentIntent(stripe, paymentIntentId) {
  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch (error) {
    if (error?.code === "payment_intent_unexpected_state") {
      const fresh = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (fresh.status === "canceled") return;
    }
    throw error;
  }
}

function clearPurchasedFromCart(order) {
  return Cart.updateOne(
    { clerkId: order.clerkId },
    { $pull: { items: { product: { $in: order.orderItems.map((item) => item.product) } } } }
  );
}

// Legacy path: automatic capture intents created before this shipped. The card is already
// charged, so a sold out item can only be refunded (the interim fix). Delete once drained.
async function fulfilLegacyPayment(stripe, paymentIntent) {
  const existing = await Order.findOne({ "paymentResult.id": paymentIntent.id });
  if (existing) return;

  const built = await buildOrderItems(paymentIntent);
  if (built.short) {
    await stripe.refunds.create(
      { payment_intent: paymentIntent.id },
      { idempotencyKey: `legacy-short-refund-${paymentIntent.id}` }
    );
    console.warn(
      `Refunded legacy PaymentIntent ${paymentIntent.id}: product ${built.productId} missing or sold out`
    );
    return;
  }

  const items = built.items;

  const reserved = [];
  const releaseStock = () =>
    Promise.all(reserved.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })));

  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } }
    );
    if (!updated) {
      await releaseStock();
      await stripe.refunds.create(
        { payment_intent: paymentIntent.id },
        { idempotencyKey: `oversold-refund-${paymentIntent.id}` }
      );
      console.warn(`Refunded ${paymentIntent.id}: ${item.name} sold out before payment completed`);
      return;
    }
    reserved.push(item);
  }

  let order;
  try {
    order = await Order.create({
      ...baseOrder(paymentIntent, items),
      paymentResult: { id: paymentIntent.id, status: "captured" },
    });
  } catch (error) {
    await releaseStock(); // so the retry (or the delivery that won) doesn't take stock twice
    if (isDuplicateKeyError(error)) return;
    throw error;
  }

  await clearPurchasedFromCart(order);
  console.log("Legacy order created:", order._id);
}
