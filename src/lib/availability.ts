import { config } from "../config.js";
import { readAll, update } from "./store.js";
import type { Booking } from "../routes/bookings.js";
import type { BlockedSlot } from "../routes/slots.js";

export const timeSlots = [
  "Morning (9:00-12:00)",
  "Afternoon (12:00-15:00)",
  "Late afternoon (15:00-17:00)",
] as const;

export interface TakenSlot {
  date: string;
  time: string;
  kind: "booked" | "blocked";
}

/**
 * Releases slots reserved by bookings that were created but never paid.
 * Abandoned checkouts shouldn't permanently lock a time.
 */
export async function expireStaleBookings(): Promise<void> {
  const holdMs = (config.bookingHoldMinutes ?? 120) * 60_000;
  const bookings = await readAll<Booking>("bookings");
  for (const b of bookings) {
    if ((b.status === "pending" || b.status === "unpaid") && Date.now() - new Date(b.createdAt).getTime() > holdMs) {
      await update<Booking>("bookings", b.id, { status: "cancelled" });
    }
  }
}

/** Every slot that can't be booked right now: paid/tentative bookings + therapist blocks. */
export async function listTakenSlots(): Promise<TakenSlot[]> {
  await expireStaleBookings();
  const [bookings, blocked] = await Promise.all([readAll<Booking>("bookings"), readAll<BlockedSlot>("slots")]);
  const taken: TakenSlot[] = [];
  for (const b of bookings) {
    if (b.status !== "cancelled") {
      taken.push({ date: b.preferredDate, time: b.preferredTime, kind: "booked" });
    }
  }
  for (const s of blocked) {
    taken.push({ date: s.date, time: s.time, kind: "blocked" });
  }
  return taken;
}

export async function isSlotAvailable(date: string, time: string): Promise<boolean> {
  const taken = await listTakenSlots();
  return !taken.some((s) => s.date === date && s.time === time);
}
