import { Router } from "express";
import { z } from "zod";
import { config, formatMoney, getPriceOption } from "../config.js";
import { bookingCode, randomId, asyncHandler } from "../lib/http.js";
import { insert, findById, update } from "../lib/store.js";
import { initializeTransaction, verifyTransaction, isPaystackConfigured } from "../lib/paystack.js";
import { sendMail, bookingConfirmationEmail, newBookingNotificationEmail } from "../lib/mailer.js";

export interface Booking {
  id: string;
  code: string;
  status: "pending" | "unpaid" | "confirmed" | "contact" | "cancelled";
  fullName: string;
  email: string;
  phone: string;
  sessionType: string;
  sessionLabel: string;
  amount: number;
  preferredDate: string;
  preferredTime: string;
  notes: string;
  paystackReference?: string;
  paidAt?: string;
  createdAt: string;
}

const timeSlots = ["Morning (9:00-12:00)", "Afternoon (12:00-15:00)", "Late afternoon (15:00-17:00)"] as const;

const bookingSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(160),
  phone: z.string().trim().min(7, "Please enter a valid phone number").max(30),
  sessionType: z.string().trim().min(1),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid date")
    .refine((d) => {
      const t = new Date(`${d}T00:00:00`);
      if (Number.isNaN(t.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return t.getTime() >= today.getTime();
    }, "Please choose a future date"),
  preferredTime: z.enum(timeSlots),
  notes: z.string().trim().max(2000, "Notes are too long").optional().default(""),
  consent: z.boolean().refine((v) => v === true, "Please accept the consent notice"),
});

export function bookingSummary(b: Booking): { sessionLabel: string; date: string; time: string; amount: string; whatsappNumber: string } {
  return {
    sessionLabel: b.sessionLabel,
    date: b.preferredDate,
    time: b.preferredTime,
    amount: formatMoney(b.amount),
    whatsappNumber: config.whatsappNumber,
  };
}

function publicBooking(b: Booking) {
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    sessionLabel: b.sessionLabel,
    amount: b.amount,
    preferredDate: b.preferredDate,
    preferredTime: b.preferredTime,
  };
}

function whatsappLinkFor(b: Booking): string {
  const num = config.whatsappNumber;
  if (!num) return "";
  const text = [
    "Hello, I would like to book a counselling session.",
    `Name: ${b.fullName}`,
    `Session: ${b.sessionLabel}`,
    `Preferred date: ${b.preferredDate}`,
    `Preferred time: ${b.preferredTime}`,
    `Booking ref: ${b.code}`,
  ].join("\n");
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export const bookingsRouter = Router();

// Create a booking (no payment yet)
bookingsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid booking details" });
      return;
    }
    const data = parsed.data;
    const option = getPriceOption(data.sessionType);
    if (!option) {
      res.status(400).json({ ok: false, message: "Please select a valid session type" });
      return;
    }

    const booking: Booking = {
      id: randomId(),
      code: bookingCode(),
      status: "pending",
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      sessionType: data.sessionType,
      sessionLabel: option.label,
      amount: option.price,
      preferredDate: data.preferredDate,
      preferredTime: data.preferredTime,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };
    await insert("bookings", booking);
    res.status(201).json({ ok: true, booking: publicBooking(booking), whatsappLink: whatsappLinkFor(booking) });
  }),
);

// Initiate a Paystack transaction for an existing booking
bookingsRouter.post(
  "/:id/pay-intent",
  asyncHandler(async (req, res) => {
    const booking = await findById<Booking>("bookings", req.params.id);
    if (!booking) {
      res.status(404).json({ ok: false, message: "Booking not found" });
      return;
    }
    if (!["pending", "unpaid"].includes(booking.status)) {
      res.status(409).json({ ok: false, message: "This booking is no longer awaiting payment" });
      return;
    }
    if (!isPaystackConfigured()) {
      res.status(503).json({ ok: false, message: "Online payments are temporarily unavailable. Please use the WhatsApp option." });
      return;
    }

    const reference = `STC-${booking.code.replace("STC-", "")}-${Date.now()}`;
    const callbackUrl = `${config.publicUrl}/booking?ref=${booking.code}`;
    const init = await initializeTransaction({
      email: booking.email,
      amountKobo: booking.amount * 100,
      reference,
      callbackUrl,
      metadata: { bookingId: booking.id, bookingCode: booking.code, session: booking.sessionLabel },
    });

    await update<Booking>("bookings", booking.id, { paystackReference: reference, status: "unpaid" });

    res.status(201).json({
      ok: true,
      payment: {
        reference,
        accessCode: init.access_code,
        authorizationUrl: init.authorization_url,
        publicKey: config.paystack.publicKey,
        amount: booking.amount,
        currency: config.currency,
        email: booking.email,
      },
    });
  }),
);

// Verify a Paystack transaction and confirm the booking
bookingsRouter.post(
  "/:id/verify",
  asyncHandler(async (req, res) => {
    const booking = await findById<Booking>("bookings", req.params.id);
    if (!booking) {
      res.status(404).json({ ok: false, message: "Booking not found" });
      return;
    }
    const reference = z.string().trim().min(3).safeParse(req.body?.reference);
    if (!reference.success) {
      res.status(400).json({ ok: false, message: "Missing payment reference" });
      return;
    }

    const verification = await verifyTransaction(reference.data);
    if (verification.status !== "success") {
      res.status(400).json({ ok: false, message: "Payment was not successful. Please try again." });
      return;
    }

    // Idempotent: if the Paystack webhook already confirmed this booking,
    // just return it without re-sending emails.
    if (booking.status !== "confirmed") {
      const confirmed = await update<Booking>("bookings", booking.id, {
        status: "confirmed",
        paidAt: new Date().toISOString(),
        paystackReference: reference.data,
      });
      if (!confirmed) {
        res.status(404).json({ ok: false, message: "Booking not found" });
        return;
      }

      const summary = bookingSummary(confirmed);
      const toClient = bookingConfirmationEmail({
        name: confirmed.fullName,
        bookingCode: confirmed.code,
        ...summary,
      });
      const toAdmin = newBookingNotificationEmail({
        name: confirmed.fullName,
        bookingCode: confirmed.code,
        ...summary,
        email: confirmed.email,
        notes: confirmed.notes,
        channel: `Paid online (Paystack) — ${confirmed.paystackReference}`,
      });
      await Promise.all([
        config.adminEmail ? sendMail({ ...toClient, to: confirmed.email }) : Promise.resolve(false),
        config.adminEmail ? sendMail({ ...toAdmin, to: config.adminEmail }) : Promise.resolve(false),
      ]);
    }

    const latest = (await findById<Booking>("bookings", req.params.id)) ?? booking;
    res.json({ ok: true, booking: { ...publicBooking(latest), paidAt: latest.paidAt } });
  }),
);

// Opt into paying/handling later via WhatsApp — returns a prefilled chat link
bookingsRouter.post(
  "/:id/contact",
  asyncHandler(async (req, res) => {
    const booking = await findById<Booking>("bookings", req.params.id);
    if (!booking) {
      res.status(404).json({ ok: false, message: "Booking not found" });
      return;
    }
    const updated = (await update<Booking>("bookings", booking.id, { status: "contact" })) ?? booking;

    // WhatsApp bookings get no Paystack callback, so notify the therapist
    // directly — no booking should ever be silent.
    if (config.adminEmail) {
      const summary = bookingSummary(updated);
      await sendMail(
        newBookingNotificationEmail({
          name: updated.fullName,
          bookingCode: updated.code,
          ...summary,
          email: updated.email,
          notes: updated.notes,
          channel: "WhatsApp (pay/arrange in chat)",
        }),
      );
    }

    res.json({ ok: true, booking: publicBooking(updated), whatsappLink: whatsappLinkFor(updated) });
  }),
);
