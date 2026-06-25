import { NextFunction, Request, Response } from "express";

export const errorMiddleware = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error(error);

  res.status(500).json({
    error: "Internal server error",
    message: error.message,
  });
};