import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { clerkClient } from "@clerk/express";
import { protectRoute } from "../src/middleware/auth.middleware.js";
import { User } from "../src/models/user.model.js";

const CLERK_ID = "user_test123";

const clerkUser = (status = "verified") => ({
  id: CLERK_ID,
  firstName: "Ada",
  lastName: "Lovelace",
  imageUrl: "https://img.example/ada.png",
  primaryEmailAddressId: "email_1",
  emailAddresses: [
    { id: "email_0", emailAddress: "other@example.com", verification: { status: "verified" } },
    { id: "email_1", emailAddress: "Ada@Example.com", verification: { status } },
  ],
});

const run = async (userId = CLERK_ID) => {
  const req = { auth: () => ({ userId }) };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const next = mock.fn();
  await protectRoute(req, res, next);
  return { req, res, next };
};

describe("protectRoute", () => {
  let users;

  beforeEach(() => {
    users = clerkClient.users;
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("uses the existing mongo user without calling clerk", async () => {
    const existing = { _id: "1", clerkId: CLERK_ID };
    mock.method(User, "findOne", async () => existing);
    const getUser = mock.method(users, "getUser", async () => clerkUser());

    const { req, next } = await run();

    assert.equal(req.user, existing);
    assert.equal(next.mock.callCount(), 1);
    assert.equal(getUser.mock.callCount(), 0);
  });

  it("creates the user from clerk when missing, using the primary verified email", async () => {
    mock.method(User, "findOne", async () => null);
    mock.method(users, "getUser", async () => clerkUser());
    const create = mock.method(User, "create", async (doc) => ({ _id: "2", ...doc }));

    const { req, next } = await run();

    const doc = create.mock.calls[0].arguments[0];
    assert.equal(doc.clerkId, CLERK_ID);
    assert.equal(doc.email, "ada@example.com");
    assert.equal(doc.name, "Ada Lovelace");
    assert.equal(req.user.email, "ada@example.com");
    assert.equal(next.mock.callCount(), 1);
  });

  it("rejects with 401 when the primary email is not verified", async () => {
    mock.method(User, "findOne", async () => null);
    mock.method(users, "getUser", async () => clerkUser("unverified"));
    const create = mock.method(User, "create", async () => ({}));

    const { res, next } = await run();

    assert.equal(res.statusCode, 401);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(next.mock.callCount(), 0);
  });

  it("falls back to the existing record when a concurrent sync wins the insert", async () => {
    const synced = { _id: "3", clerkId: CLERK_ID };
    let lookups = 0;
    mock.method(User, "findOne", async () => (lookups++ === 0 ? null : synced));
    mock.method(users, "getUser", async () => clerkUser());
    mock.method(User, "create", async () => {
      throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    });

    const { req, next } = await run();

    assert.equal(req.user, synced);
    assert.equal(next.mock.callCount(), 1);
  });

  it("answers 401 without a clerk session", async () => {
    const { res, next } = await run(null);
    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
  });
});
