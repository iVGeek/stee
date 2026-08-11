import { config } from "../config.js";

const GRAPH_URL = "https://graph.facebook.com/v20.0";

/** Converts a phone into E.164 (WhatsApp requires it): "0700 123 456" → "254700123456". */
export function toE164(phone: string): string {
  let p = (phone || "").replace(/[^\d]/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  else if (p.startsWith("+")) p = p.slice(1);
  return p;
}

/**
 * Sends a WhatsApp text message via the WhatsApp Cloud API (Meta).
 * Requires WA_TOKEN + WA_PHONE_ID in the environment. Never throws —
 * logs and returns false so the site keeps working without WhatsApp.
 */
export async function sendWhatsAppText(to: string, text: string): Promise<boolean> {
  if (!config.waToken || !config.waPhoneId) {
    console.warn(`[whatsapp] WhatsApp Cloud API not configured — skipping message to "${to}"`);
    return false;
  }
  try {
    const res = await fetch(`${GRAPH_URL}/${config.waPhoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.waToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[whatsapp] failed to send message: ${res.status} ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] failed to send message:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Builds the client-side WhatsApp invoice for a paid booking. */
export function bookingInvoiceWhatsApp(d: {
  name: string;
  sessionLabel: string;
  date: string;
  time: string;
  amount: string;
  bookingCode: string;
  reference: string;
  meetingLink?: string;
}): string {
  return [
    `INVOICE — Kizito Moraa Counselling`,
    `Invoice #${d.bookingCode}  ·  PAID`,
    ``,
    `Bill to: ${d.name}`,
    `Session: ${d.sessionLabel}`,
    `Date: ${d.date} at ${d.time}`,
    `Session fee: ${d.amount}`,
    `Payment ref: ${d.reference}`,
    ...(d.meetingLink ? [``, `Your online session link:`, d.meetingLink] : []),
    ``,
    `Thank you for booking. Reply here if you have any questions.`,
  ].join("\n");
}

/** Builds the therapist-side WhatsApp notification for a paid booking. */
export function bookingNotificationWhatsApp(d: {
  name: string;
  phone: string;
  sessionLabel: string;
  date: string;
  time: string;
  bookingCode: string;
  meetingLink?: string;
}): string {
  return [
    "New paid booking on your website",
    `Client: ${d.name}${d.phone ? ` (${d.phone})` : ""}`,
    `Session: ${d.sessionLabel}`,
    `Date: ${d.date}`,
    `Time: ${d.time}`,
    `Ref: ${d.bookingCode}`,
    ...(d.meetingLink ? [``, `Join this room at session time:`, d.meetingLink] : []),
  ].join("\n");
}
