import { config } from "../config.js";

const GRAPH_URL = "https://graph.facebook.com/v20.0";

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

/** Builds the therapist-side WhatsApp notification for a paid booking. */
export function bookingNotificationWhatsApp(d: {
  name: string;
  phone: string;
  sessionLabel: string;
  date: string;
  time: string;
  bookingCode: string;
}): string {
  return [
    "New paid booking on your website",
    `Client: ${d.name}${d.phone ? ` (${d.phone})` : ""}`,
    `Session: ${d.sessionLabel}`,
    `Date: ${d.date}`,
    `Time: ${d.time}`,
    `Ref: ${d.bookingCode}`,
  ].join("\n");
}
