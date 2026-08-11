import { Router } from "express";
import { z } from "zod";
import { randomId, asyncHandler, ApiError, requireAdmin } from "../lib/http.js";
import { insert, readAll, remove } from "../lib/store.js";
import { listTakenSlots, isSlotAvailable, timeSlotsFor } from "../lib/availability.js";

export interface BlockedSlot {
  id: string;
  date: string;
  time: string;
  note?: string;
  createdAt: string;
}

const blockSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid date")
    .refine((d) => {
      const t = new Date(`${d}T00:00:00`);
      return !Number.isNaN(t.getTime());
    }, "Please choose a valid date"),
  time: z.string().trim().min(1, "Please choose a time"),
  note: z.string().trim().max(120).optional().default(""),
});

export const slotsRouter = Router();

// Public: every slot currently unavailable (paid bookings + therapist blocks)
slotsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, slots: await listTakenSlots() });
  }),
);

// Admin: blocked slots (Kizito's locked-out days/times) plus booked slots for visibility
slotsRouter.get(
  "/admin",
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const [taken, blocked] = await Promise.all([listTakenSlots(), readAll<BlockedSlot>("slots")]);
    res.json({
      ok: true,
      booked: taken.filter((s) => s.kind === "booked"),
      blocked: blocked.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    });
  }),
);

// Admin: lock a slot in the calendar
slotsRouter.post(
  "/admin",
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const parsed = blockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid slot" });
      return;
    }
    const { date, time, note } = parsed.data;

    if (!timeSlotsFor(date).includes(time)) {
      res.status(400).json({ ok: false, message: "That time isn't in the weekly schedule for this day." });
      return;
    }

    const existing = (await readAll<BlockedSlot>("slots")).find((s) => s.date === date && s.time === time);
    if (existing) {
      res.status(409).json({ ok: false, message: "That slot is already blocked." });
      return;
    }
    if (!(await isSlotAvailable(date, time))) {
      res.status(409).json({ ok: false, message: "That slot is already booked." });
      return;
    }

    const slot: BlockedSlot = {
      id: randomId(),
      date,
      time,
      note: note || undefined,
      createdAt: new Date().toISOString(),
    };
    await insert("slots", slot);
    res.status(201).json({ ok: true, slot });
  }),
);

// Admin: unlock a blocked slot
slotsRouter.delete(
  "/admin/:id",
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    if (!(await remove("slots", req.params.id))) throw new ApiError(404, "Blocked slot not found");
    res.json({ ok: true });
  }),
);
