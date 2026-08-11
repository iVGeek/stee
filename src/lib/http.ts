import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Throws 401 unless the request carries the admin bearer token. */
export function requireAdmin(req: Request): void {
  const auth = req.get("authorization") ?? "";
  if (auth !== `Bearer ${config.adminToken}`) {
    throw new ApiError(401, "Unauthorized");
  }
}

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

/** Wraps async route handlers so rejected promises reach the error middleware. */
export function asyncHandler(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Generates a short, human-friendly booking reference like STC-4F7K9Q. */
export function bookingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `STC-${out}`;
}

export function randomId(): string {
  return crypto.randomUUID();
}
