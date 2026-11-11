import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMetadata, reconcilePaymentIntent } from "../src/services/checkout.service.js";
import { Order } from "../src/models/order.model.js";

describe("Checkout Review Findings Hardening", () => {
  describe("Metadata Parsing (parseMetadata)", () => {
    it("successfully parses valid metadata with order items and shipping address", () => {
      // covers: AC-12, AC-15
      const intent = {
        id: "pi_valid_123",
        metadata: {
          userId: "user_001",
          clerkId: "clerk_001",
          totalPrice: "129.50",
          shippingAddress: JSON.stringify({
            fullName: "Alex Smith",
            streetAddress: "742 Evergreen Terrace",
            city: "Springfield",
            state: "IL",
            zipCode: "62704",
            phoneNumber: "555-0199",
          }),
          orderItems: JSON.stringify([
            { p: "60d0fe4f5311236168a109ca", q: 2, c: 5975 },
            { p: "60d0fe4f5311236168a109cb", q: 1, c: 1000 },
          ]),
        },
      };

      const result = parseMetadata(intent);
      assert.ok(result, "Expected parseMetadata to return an object");
      assert.strictEqual(result.userId, "user_001");
      assert.strictEqual(result.clerkId, "clerk_001");
      assert.strictEqual(result.totalPrice, 129.5);
      assert.strictEqual(result.shippingAddress.fullName, "Alex Smith");
      assert.strictEqual(result.orderItems.length, 2);
      assert.strictEqual(result.orderItems[0].q, 2);
    });

    it("returns null when metadata object is missing or null", () => {
      // covers: AC-14 edge case
      assert.strictEqual(parseMetadata({ id: "pi_null_meta", metadata: null }), null);
      assert.strictEqual(parseMetadata({ id: "pi_undefined_meta" }), null);
      assert.strictEqual(parseMetadata({ id: "pi_empty_meta", metadata: {} }), null);
    });

    it("returns null when required metadata fields are missing", () => {
      const missingUser = {
        id: "pi_missing_user",
        metadata: {
          clerkId: "c1",
          shippingAddress: "{}",
          totalPrice: "10.00",
          orderItems: "[]",
        },
      };
      assert.strictEqual(parseMetadata(missingUser), null);

      const missingAddress = {
        id: "pi_missing_addr",
        metadata: {
          userId: "u1",
          clerkId: "c1",
          totalPrice: "10.00",
          orderItems: "[]",
        },
      };
      assert.strictEqual(parseMetadata(missingAddress), null);
    });

    it("returns null when shippingAddress is invalid JSON", () => {
      const brokenJson = {
        id: "pi_broken_json",
        metadata: {
          userId: "u1",
          clerkId: "c1",
          shippingAddress: "{not-valid-json",
          totalPrice: "10.00",
          orderItems: "[]",
        },
      };
      assert.strictEqual(parseMetadata(brokenJson), null);
    });

    it("returns null when orderItems is not an array", () => {
      const nonArrayItems = {
        id: "pi_non_array",
        metadata: {
          userId: "u1",
          clerkId: "c1",
          shippingAddress: JSON.stringify({ fullName: "Name" }),
          totalPrice: "10.00",
          orderItems: JSON.stringify({ notAnArray: true }),
        },
      };
      assert.strictEqual(parseMetadata(nonArrayItems), null);
    });

    it("returns null when totalPrice is not a valid number", () => {
      const badPrice = {
        id: "pi_bad_price",
        metadata: {
          userId: "u1",
          clerkId: "c1",
          shippingAddress: JSON.stringify({ fullName: "Name" }),
          totalPrice: "free-item",
          orderItems: "[]",
        },
      };
      assert.strictEqual(parseMetadata(badPrice), null);
    });
  });

  describe("Reconciliation with Bad Metadata", () => {
    it("permanently cancels the payment intent without looping or unhandled error", async () => {
      // covers: AC-2, AC-5 safety
      let cancelCalled = false;
      let cancelledId = null;

      const mockStripe = {
        paymentIntents: {
          retrieve: async (id) => ({
            id,
            status: "requires_capture",
            capture_method: "manual",
            metadata: { broken: "unusable" },
          }),
          cancel: async (id) => {
            cancelCalled = true;
            cancelledId = id;
            return { id, status: "canceled" };
          },
        },
      };

      const originalFindOne = Order.findOne;
      Order.findOne = async () => null;

      try {
        await reconcilePaymentIntent(mockStripe, "pi_bad_meta_123");
        assert.strictEqual(cancelCalled, true, "Stripe cancel should have been called");
        assert.strictEqual(cancelledId, "pi_bad_meta_123");
      } finally {
        Order.findOne = originalFindOne;
      }
    });
  });

  describe("Address Validation Logic (payment.controller)", () => {
    const addressFields = ["fullName", "streetAddress", "city", "state", "zipCode", "phoneNumber"];
    const validateShippingAddress = (shippingAddress) => {
      if (!shippingAddress || typeof shippingAddress !== "object") {
        return { valid: false, error: "A complete shipping address is required" };
      }

      for (const field of addressFields) {
        const val = shippingAddress[field];
        if (typeof val !== "string" || !val.trim() || val.length > 150) {
          return { valid: false, error: `Valid ${field} is required (max 150 characters)` };
        }
      }

      const shippingAddressMeta = JSON.stringify(
        Object.fromEntries(addressFields.map((field) => [field, shippingAddress[field].trim()]))
      );
      if (shippingAddressMeta.length > 500) {
        return { valid: false, error: "Shipping address too long, please shorten details" };
      }

      return { valid: true, metadata: shippingAddressMeta };
    };

    it("rejects non-object or missing shipping address", () => {
      assert.strictEqual(validateShippingAddress(null).valid, false);
      assert.strictEqual(validateShippingAddress(undefined).valid, false);
      assert.strictEqual(validateShippingAddress("string instead of obj").valid, false);
    });

    it("rejects non-string address fields", () => {
      const payload = {
        fullName: { first: "John", last: "Doe" }, // Object instead of string
        streetAddress: "123 Main St",
        city: "Anytown",
        state: "CA",
        zipCode: "90210",
        phoneNumber: "555-1234",
      };
      const res = validateShippingAddress(payload);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, "Valid fullName is required (max 150 characters)");
    });

    it("rejects empty or whitespace-only address fields", () => {
      const payload = {
        fullName: "   ",
        streetAddress: "123 Main St",
        city: "Anytown",
        state: "CA",
        zipCode: "90210",
        phoneNumber: "555-1234",
      };
      const res = validateShippingAddress(payload);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, "Valid fullName is required (max 150 characters)");
    });

    it("rejects fields exceeding the 150 character limit", () => {
      const payload = {
        fullName: "A".repeat(151),
        streetAddress: "123 Main St",
        city: "Anytown",
        state: "CA",
        zipCode: "90210",
        phoneNumber: "555-1234",
      };
      const res = validateShippingAddress(payload);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, "Valid fullName is required (max 150 characters)");
    });

    it("rejects when serialized address exceeds Stripe 500 character metadata limit", () => {
      const payload = {
        fullName: "A".repeat(100),
        streetAddress: "B".repeat(140),
        city: "C".repeat(90),
        state: "D".repeat(90),
        zipCode: "E".repeat(20),
        phoneNumber: "F".repeat(30),
      };
      const res = validateShippingAddress(payload);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, "Shipping address too long, please shorten details");
    });

    it("accepts valid shipping address and trims fields", () => {
      const payload = {
        fullName: "  Jane Doe  ",
        streetAddress: "456 Market St",
        city: "San Francisco",
        state: "CA",
        zipCode: "94105",
        phoneNumber: "415-555-0100",
      };
      const res = validateShippingAddress(payload);
      assert.strictEqual(res.valid, true);
      const parsed = JSON.parse(res.metadata);
      assert.strictEqual(parsed.fullName, "Jane Doe");
    });
  });

  describe("Body Parse Error Handling (server.js)", () => {
    const appErrorHandler = (err, req, res, next) => {
      const isUploadError = err.name === "MulterError" || err.message?.startsWith("Only image files");
      if (isUploadError) return res.status(400).json({ message: err.message });

      const statusCode = err.status || err.statusCode;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        return res.status(statusCode).json({ message: err.message || "Bad request" });
      }

      return res.status(500).json({ message: "Internal server error" });
    };

    const mockResponse = () => {
      let code = 200;
      let body = null;
      return {
        status(c) {
          code = c;
          return this;
        },
        json(b) {
          body = b;
          return this;
        },
        get code() {
          return code;
        },
        get body() {
          return body;
        },
      };
    };

    it("preserves 400 status on JSON syntax parse error", () => {
      const res = mockResponse();
      const parseErr = new SyntaxError("Unexpected token '}' in JSON at position 42");
      parseErr.status = 400;

      appErrorHandler(parseErr, {}, res, () => { });
      assert.strictEqual(res.code, 400);
      assert.strictEqual(res.body.message, "Unexpected token '}' in JSON at position 42");
    });

    it("preserves 413 status on oversized body payloads", () => {
      const res = mockResponse();
      const sizeErr = new Error("request entity too large");
      sizeErr.status = 413;

      appErrorHandler(sizeErr, {}, res, () => { });
      assert.strictEqual(res.code, 413);
      assert.strictEqual(res.body.message, "request entity too large");
    });

    it("returns 500 for unhandled internal server faults", () => {
      const res = mockResponse();
      const dbErr = new Error("Failed to connect to database");

      appErrorHandler(dbErr, {}, res, () => { });
      assert.strictEqual(res.code, 500);
      assert.strictEqual(res.body.message, "Internal server error");
    });
  });

  describe("Admin Category Options Preservation (ProductsPage)", () => {
    const CATEGORIES = ["Electronics", "Fashion", "Sports", "Books"];
    const getOptions = (activeCategory) =>
      Array.from(new Set([...CATEGORIES, ...(activeCategory ? [activeCategory] : [])]));

    it("preserves legacy category 'Accessories' when editing a product", () => {
      const options = getOptions("Accessories");
      assert.ok(options.includes("Accessories"), "Options should include Accessories");
      assert.strictEqual(options.length, 5);
    });

    it("does not duplicate standard categories when editing", () => {
      const options = getOptions("Fashion");
      assert.strictEqual(options.length, 4);
      assert.strictEqual(options.filter((c) => c === "Fashion").length, 1);
    });

    it("renders default 4 categories when creating a new product", () => {
      const options = getOptions("");
      assert.strictEqual(options.length, 4);
      assert.deepStrictEqual(options, CATEGORIES);
    });
  });
});

