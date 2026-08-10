import crypto from "node:crypto";
import { Router, type Request } from "express";
import { config } from "../config.js";
import { asyncHandler } from "../lib/http.js";
import { readAll, update } from "../lib/store.js";
import { sendMail, bookingConfirmationEmail, newBookingNotificationEmail } from "../lib/mailer.js";
import { bookingSummary } from "./bookings.js";
import type { Booking } from "./bookings.js";

export const webhookRouter = Router();

function validSignature(req: Request): boolean {
  const signature = req.get("x-paystack-signature") ?? "";
  const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
  const expected = crypto.createHmac("sha512", config.paystack.secretKey).update(raw).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Paystack webhook — reliably confirms bookings even if the client closes the
// checkout popup before the in-browser verify callback fires.
webhookRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!validSignature(req)) {
      res.status(400).json({ ok: false, message: "Invalid signature" });
      return;
    }

    const body = req.body as { event?: string; data?: { reference?: string } };
    if (body.event !== "charge.success" || !body.data?.reference) {
      res.json({ ok: true });
      return;
    }

    const reference = body.data.reference;
    const booking = (await readAll<Booking>("bookings")).find(
      (b) => b.paystackReference === reference,
    );
    // Unknown reference or already confirmed (e.g. via the in-browser verify):
    // acknowledge without side effects so Paystack stops retrying.
    if (!booking || booking.status === "confirmed") {
      res.json({ ok: true });
      return;
    }

    const confirmed = await update<Booking>("bookings", booking.id, {
      status: "confirmed",
      paidAt: new Date().toISOString(),
      paystackReference: reference,
    });
    if (!confirmed) {
      res.json({ ok: true });
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
      channel: `Paid online (Paystack webhook) — ${reference}`,
    });
    await Promise.all([
      config.adminEmail ? sendMail({ ...toClient, to: confirmed.email }) : Promise.resolve(false),
      config.adminEmail ? sendMail({ ...toAdmin, to: config.adminEmail }) : Promise.resolve(false),
    ]);

    res.json({ ok: true });
  }),
);
