import mongoose from "mongoose";

export const ORDER_STATUSES = ["pending", "shipped", "delivered", "cancelled"];
export const PAYMENT_STATUSES = ["authorized", "captured", "canceled", "capture_failed"];
export const CANCEL_REASONS = ["sold_out", "capture_failed", "authorization_expired"];

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  image: {
    type: String,
    required: true,
  },
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  streetAddress: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clerkId: {
      type: String,
      required: true,
    },
    orderItems: [orderItemSchema],
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    paymentResult: {
      // stripe PaymentIntent id (one order per payment, see the unique index below)
      id: String,
      status: {
        type: String,
        enum: PAYMENT_STATUSES,
      },
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
    },
    // set only when status is "cancelled" (enforced in the pre validate hook below)
    cancelReason: {
      type: String,
      enum: CANCEL_REASONS,
      default: null,
    },
    deliveredAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// at most one order per PaymentIntent: a second webhook delivery fails on this key and its
// transaction rolls back its own stock changes (spec 0001)
orderSchema.index({ "paymentResult.id": 1 }, { unique: true, sparse: true });

orderSchema.pre("validate", function (next) {
  const isCancelled = this.status === "cancelled";
  if (isCancelled !== Boolean(this.cancelReason)) {
    return next(new Error("cancelReason must be set if and only if the order is cancelled"));
  }
  next();
});

export const Order = mongoose.model("Order", orderSchema);
