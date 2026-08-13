import type { ErrorHandler } from "hono";
import { ZodError } from "zod";

export const errorHandler: ErrorHandler = (error, context) => {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return context.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Request did not match the expected schema.",
        },
      },
      400,
    );
  }

  return context.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "AI gateway request failed.",
      },
    },
    500,
  );
};
