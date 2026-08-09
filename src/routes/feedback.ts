import { Router, type Request } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { randomId, asyncHandler, ApiError } from "../lib/http.js";
import { insert, readAll, update, remove } from "../lib/store.js";
import { sendMail, feedbackNotificationEmail } from "../lib/mailer.js";

export interface Feedback {
  id: string;
  name: string;
  rating: number;
  sessionType: string;
  message: string;
  approved: boolean;
  createdAt: string;
}

const feedbackSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  rating: z.number().int().min(1, "Please add a rating").max(5),
  sessionType: z.string().trim().max(60).optional().default("Individual session"),
  message: z.string().trim().min(5, "Please write at least a few words").max(1500, "Message is too long"),
});

export const feedbackRouter = Router();

// Public: approved testimonials only
feedbackRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = readAll<Feedback>("feedback")
      .filter((f) => f.approved)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 24)
      .map((f) => ({
        id: f.id,
        name: f.name,
        rating: f.rating,
        sessionType: f.sessionType,
        message: f.message,
        createdAt: f.createdAt,
      }));
    res.json({ ok: true, feedback: rows });
  }),
);

// Public: submit feedback (goes to moderation)
feedbackRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid feedback" });
      return;
    }
    const row: Feedback = {
      id: randomId(),
      name: parsed.data.name,
      rating: parsed.data.rating,
      sessionType: parsed.data.sessionType,
      message: parsed.data.message,
      approved: false,
      createdAt: new Date().toISOString(),
    };
    insert("feedback", row);

    if (config.adminEmail) {
      await sendMail(
        feedbackNotificationEmail({
          name: row.name,
          rating: row.rating,
          message: row.message,
          sessionType: row.sessionType,
          feedbackId: row.id,
        }),
      );
    }

    res.status(201).json({ ok: true, message: "Thank you! Your feedback will appear after review." });
  }),
);

function requireAdmin(req: Request): void {
  const auth = req.get("authorization") ?? "";
  if (auth !== `Bearer ${config.adminToken}`) {
    throw new ApiError(401, "Unauthorized");
  }
}

// Admin: moderate feedback (list with pending status)
feedbackRouter.get(
  "/admin",
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const rows = readAll<Feedback>("feedback").sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    res.json({ ok: true, feedback: rows });
  }),
);

// Admin: approve feedback
feedbackRouter.post(
  "/admin/:id/approve",
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const updated = update<Feedback>("feedback", req.params.id, { approved: true });
    if (!updated) throw new ApiError(404, "Feedback not found");
    res.json({ ok: true, feedback: updated });
  }),
);

// Admin: delete feedback
feedbackRouter.delete(
  "/admin/:id",
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    if (!remove("feedback", req.params.id)) throw new ApiError(404, "Feedback not found");
    res.json({ ok: true });
  }),
);
