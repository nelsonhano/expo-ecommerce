import Stripe from "stripe";
import { ENV } from "./env.js";

const apiKey =
  ENV.STRIPE_SECRET_KEY && !ENV.STRIPE_SECRET_KEY.startsWith("<")
    ? ENV.STRIPE_SECRET_KEY
    : "sk_test_placeholder";

// one shared client for the payment controller, the order lookup, and the checkout service
export const stripe = new Stripe(apiKey);
