import { config } from "../config.js";
import { readAll, update } from "./store.js";
import type { Booking } from "../routes/bookings.js";
import type { BlockedSlot } from "../routes/slots.js";

/**
 * Weekly schedule: weekday (0 = Sunday … 6 = Saturday) → bookable times.
 * Sessions run roughly hourly with breaks, so a single booking only locks
 * its own slot instead of a whole morning/afternoon block.
 */
export const SCHEDULE: Record<number, readonly string[]> = {
  0: [], // Sunday — closed
  1: ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"], // Monday
  2: ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"], // Tuesday
  3: ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"], // Wednesday
  4: ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"], // Thursday
  5: ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"], // Friday
  6: ["9:00 AM", "10:00 AM", "11:00 AM"], // Saturday
};

/** Bookable times for a given YYYY-MM-DD date. */
export function timeSlotsFor(dateIso: string): readonly string[] {
  const d = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return [];
  return SCHEDULE[d.getDay()] ?? [];
}

/** Serialisable schedule map (weekday number as string key) for /api/config. */
export function schedulePayload(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (let wd = 0; wd <= 6; wd++) out[String(wd)] = [...SCHEDULE[wd]];
  return out;
}

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

/** A slot is bookable only if the time exists in the weekly schedule AND is still free. */
export async function isValidSlot(date: string, time: string): Promise<boolean> {
  if (!timeSlotsFor(date).includes(time)) return false;
  return isSlotAvailable(date, time);
}
