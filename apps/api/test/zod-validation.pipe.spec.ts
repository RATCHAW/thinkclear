import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { ZodValidationPipe } from "../src/common/zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(
    z.object({ title: z.string().trim().min(1) }),
  );

  it("returns normalized data from the schema", () => {
    expect(pipe.transform({ title: "  Roadmap  " })).toEqual({
      title: "Roadmap",
    });
  });

  it("turns schema failures into the API validation response", () => {
    try {
      pipe.transform({ title: "   " });
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: "Validation failed",
        issues: [expect.objectContaining({ path: ["title"] })],
      });
    }
  });
});
