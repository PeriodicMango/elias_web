// ---------------------------------------------------------------------------
// Validate middleware tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validate } from "../../src/middleware/validate.js";

// Minimal Express mock
function mockReq(body: unknown) {
  return { body } as any;
}

function mockRes() {
  const res: any = {};
  res.status = (code: number) => {
    res._statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res._json = data;
    return res;
  };
  return res;
}

function mockNext() {
  const next: any = () => {
    next._called = true;
  };
  next._called = false;
  return next;
}

const TestSchema = z.object({
  name: z.string().min(1, "name is required"),
  age: z.number().min(0, "age must be non-negative"),
});

describe("validate middleware", () => {
  it("calls next() when body is valid", () => {
    const middleware = validate(TestSchema);
    const req = mockReq({ name: "Alice", age: 30 });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(next._called).toBe(true);
    expect(req.body).toEqual({ name: "Alice", age: 30 });
  });

  it("returns 400 with Zod error messages for invalid body", () => {
    const middleware = validate(TestSchema);
    const req = mockReq({ name: "", age: -5 });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(res._statusCode).toBe(400);
    expect(next._called).toBe(false);
    expect(res._json.error).toBeDefined();
    expect(res._json.error).toContain("name is required");
    expect(res._json.error).toContain("age must be non-negative");
  });

  it("strips unknown fields via Zod parse", () => {
    const middleware = validate(TestSchema);
    const req = mockReq({ name: "Bob", age: 25, extra: "should-be-stripped" });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(next._called).toBe(true);
    expect(req.body).toEqual({ name: "Bob", age: 25 });
    expect(req.body.extra).toBeUndefined();
  });

  it("returns 400 for completely missing fields", () => {
    const middleware = validate(TestSchema);
    const req = mockReq({});
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(res._statusCode).toBe(400);
    expect(next._called).toBe(false);
  });
});
