import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("UI Startup and Clerk Validation Guards", () => {
  describe("Clerk Key Format Validation", () => {
    function isValidClerkPublishableKey(key) {
      return (
        typeof key === "string" &&
        (key.startsWith("pk_test_") || key.startsWith("pk_live_")) &&
        key.length > 10
      );
    }

    it("identifies placeholder and invalid Clerk keys", () => {
      assert.equal(isValidClerkPublishableKey("your_clerk_publishable_key_here"), false);
      assert.equal(isValidClerkPublishableKey("<YOUR_CLERK_PUBLISHABLE_KEY>"), false);
      assert.equal(isValidClerkPublishableKey(""), false);
      assert.equal(isValidClerkPublishableKey(undefined), false);
      assert.equal(isValidClerkPublishableKey(null), false);
    });

    it("accepts valid Clerk test and live keys", () => {
      assert.equal(
        isValidClerkPublishableKey("pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"),
        true
      );
      assert.equal(
        isValidClerkPublishableKey("pk_live_Y2xlcmsuZXhhbXBsZS5jb20k"),
        true
      );
    });
  });

  describe("Sentry DSN URL Validation", () => {
    function isValidSentryDsn(dsn) {
      return typeof dsn === "string" && dsn.startsWith("https://") && dsn.includes("@");
    }

    it("rejects placeholder Sentry DSNs", () => {
      assert.equal(isValidSentryDsn("your_sentry_dsn_here"), false);
      assert.equal(isValidSentryDsn(""), false);
      assert.equal(isValidSentryDsn(undefined), false);
    });

    it("accepts valid Sentry DSN format", () => {
      assert.equal(
        isValidSentryDsn("https://public_key@o0.ingest.sentry.io/0"),
        true
      );
    });
  });

  describe("Mobile Web Stripe Shim", () => {
    it("provides safe fallback methods for web without importing native modules", async () => {
      const { useStripe } = await import("../../mobile/lib/stripe.web.ts");
      const stripe = useStripe();

      assert.equal(typeof stripe.initPaymentSheet, "function");
      assert.equal(typeof stripe.presentPaymentSheet, "function");

      const initResult = await stripe.initPaymentSheet();
      assert.ok(initResult.error);
      assert.match(initResult.error.message, /iOS or Android/);

      const presentResult = await stripe.presentPaymentSheet();
      assert.ok(presentResult.error);
      assert.match(presentResult.error.message, /iOS or Android/);
    });
  });
});

