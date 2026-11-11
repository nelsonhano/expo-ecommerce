// One time backfill for spec 0001 (checkout stock reservation).
//
//   npm run backfill:orders
//
// 1. Stops with a list if any PaymentIntent id has more than one order (the unique index would
//    fail to build). Fix those by hand first: keep the oldest order per id, check the extra ones
//    (and any stock they took twice), then delete them and run this again.
// 2. Sets paymentResult.status "succeeded" -> "captured".
// 3. Builds the order indexes (including the unique paymentResult.id index) so they exist before
//    the new webhook code runs its transactions.
//
// Safe to run more than once. Run it before the deploy and once more right after it.
import mongoose from "mongoose";
import { ENV } from "../config/env.js";
import { Order } from "../models/order.model.js";

async function main() {
  await mongoose.connect(ENV.DB_URL);

  const duplicates = await Order.aggregate([
    { $match: { "paymentResult.id": { $type: "string" } } },
    {
      $group: {
        _id: "$paymentResult.id",
        count: { $sum: 1 },
        orders: { $push: { id: "$_id", createdAt: "$createdAt" } },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (duplicates.length > 0) {
    console.error(`Found ${duplicates.length} payment id(s) with more than one order. Fix these first:`);
    for (const dup of duplicates) {
      const ids = dup.orders
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((o) => o.id.toString());
      console.error(`  ${dup._id}: keep ${ids[0]}, check ${ids.slice(1).join(", ")}`);
    }
    process.exitCode = 1;
    return;
  }

  const { modifiedCount } = await Order.updateMany(
    { "paymentResult.status": "succeeded" },
    { $set: { "paymentResult.status": "captured" } }
  );
  console.log(`Backfilled ${modifiedCount} order(s): succeeded -> captured`);

  await Order.syncIndexes();
  console.log("Order indexes are in sync (unique paymentResult.id is live)");
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
