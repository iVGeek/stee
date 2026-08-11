import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "../config.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!config.mail.host || !config.mail.user) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: {
      user: config.mail.user,
      pass: config.mail.pass,
    },
  });
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
}

/** Sends an email. Returns true on success. Never throws — logs and falls back silently so the site keeps working without SMTP. */
export async function sendMail(input: MailInput): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP not configured — skipping email to "${input.to}" (${input.subject})`);
    return false;
  }
  try {
    await t.sendMail({
      from: config.mail.from || `"Kizito Moraa Counselling" <${config.mail.user}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return true;
  } catch (err) {
    console.error("[mailer] failed to send email:", err instanceof Error ? err.message : err);
    return false;
  }
}

function shell(title: string, bodyHtml: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e7e2d9;border-radius:12px;overflow:hidden">
    <div style="background:#3b5f48;padding:20px 28px">
      <span style="color:#fbf9f4;font-size:18px;font-weight:700">Kizito Moraa Counselling</span>
    </div>
    <div style="padding:28px">
      <h2 style="color:#22312b;margin:0 0 12px;font-size:20px">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="background:#f4f1ea;padding:16px 28px;color:#6a756f;font-size:12px">
      Automated message from the Kizito Moraa website.
    </div>
  </div>`;
}

function kvTable(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6a756f;white-space:nowrap;padding-right:16px">${k}</td><td style="padding:6px 0;color:#22312b">${v}</td></tr>`,
    )
    .join("")}</table>`;
}

export interface BookingMailDetails {
  name: string;
  bookingCode: string;
  sessionLabel: string;
  date: string;
  time: string;
  amount: string;
  whatsappNumber: string;
  channel?: string;
}

export function bookingConfirmationEmail(d: BookingMailDetails): MailInput {
  return {
    to: d.name,
    subject: `Your booking is confirmed — ${d.bookingCode}`,
    html: shell(
      "Booking confirmed",
      `<p>Hi ${d.name},</p>
       <p>Your session has been confirmed and payment received. Here are your details:</p>
       ${kvTable([
         ["Booking reference", `<b>${d.bookingCode}</b>`],
         ["Session", d.sessionLabel],
         ["Preferred date", d.date],
         ["Preferred time", d.time],
         ["Session fee", d.amount],
       ])}
       <p>You will receive your private session link / call details ahead of the session. For changes or rescheduling, reply on WhatsApp: <b>${d.whatsappNumber}</b></p>
       <p>We look forward to seeing you.</p>`,
    ),
  };
}

/**
 * Themed invoice email sent to the client once a booking is paid.
 * Colors mirror the website theme (styles.css :root): primary #135e4b,
 * surface #f6faf5, surface-alt #d8e9e1, ink #0e241c, muted #44605a,
 * accent #4cb572, border #b3ccc6, success #2f7a4a.
 */
export function bookingInvoiceEmail(d: BookingMailDetails & { email: string; phone: string; paidAt: string; reference: string }): MailInput {
  const rows: [string, string][] = [
    ["Billed to", `<b>${d.name}</b>`],
    ["Email", d.email],
    ["Phone", d.phone],
    ["Session", d.sessionLabel],
    ["Date", d.date],
    ["Time", d.time],
    ["Booking reference", `<b>${d.bookingCode}</b>`],
  ];
  return {
    to: d.email,
    subject: `Invoice ${d.bookingCode} — ${d.amount} paid`,
    html: `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #b3ccc6;border-radius:12px;overflow:hidden">
      <div style="background:#135e4b;padding:22px 28px;border-bottom:4px solid #4cb572">
        <div style="color:#f6faf5;font-size:18px;font-weight:700">Kizito Moraa Counselling</div>
        <div style="color:#a1d8b5;font-size:13px;margin-top:2px">Invoice · ${d.bookingCode}</div>
      </div>
      <div style="background:#f6faf5;padding:28px;color:#0e241c">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="width:70%">
              <div style="display:inline-block;background:#e3f4ea;color:#2f7a4a;font-weight:700;font-size:12px;padding:4px 12px;border-radius:999px;letter-spacing:0.5px">PAID</div>
              <h2 style="margin:14px 0 4px;color:#0e241c;font-size:20px">Thanks, ${d.name}!</h2>
              <p style="margin:0;color:#44605a;font-size:14px">Your payment has been received. Receipt for your session:</p>
            </td>
            <td style="text-align:right;vertical-align:top">
              <div style="color:#44605a;font-size:12px">Amount paid</div>
              <div style="color:#135e4b;font-size:26px;font-weight:700">${d.amount}</div>
              <div style="color:#44605a;font-size:12px">on ${d.paidAt}</div>
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin:18px 0;background:#d8e9e1;border-radius:12px">
          <tr><td style="padding:14px 18px">
            <table style="width:100%;border-collapse:collapse">${rows
              .map(
                ([k, v]) =>
                  `<tr><td style="padding:4px 0;color:#44605a;white-space:nowrap;padding-right:16px">${k}</td><td style="padding:4px 0;color:#0e241c">${v}</td></tr>`,
              )
              .join("")}</table>
          </td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:10px 0;border-top:1px solid #b3ccc6;color:#44605a">Session fee</td>
            <td style="padding:10px 0;border-top:1px solid #b3ccc6;color:#0e241c;text-align:right">${d.amount}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-top:2px solid #135e4b;color:#0e241c;font-weight:700">Total paid</td>
            <td style="padding:10px 0;border-top:2px solid #135e4b;color:#135e4b;font-weight:700;text-align:right">${d.amount}</td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:#44605a;font-size:13px">Payment reference: <b>${d.reference}</b> · Received on ${d.paidAt}</p>
        <p style="margin:8px 0 0;color:#44605a;font-size:13px">Questions about this invoice? WhatsApp <b>${d.whatsappNumber}</b>.</p>
      </div>
      <div style="background:#0e4a3a;padding:14px 28px;color:#a1d8b5;font-size:12px;text-align:center">
        Kizito Moraa Counselling · Nairobi, Kenya · Thank you for your trust.
      </div>
    </div>`,
  };
}

export function newBookingNotificationEmail(d: BookingMailDetails & { email: string; notes?: string }): MailInput {
  return {
    to: d.email,
    subject: `New booking ${d.bookingCode} (${d.sessionLabel})`,
    html: shell(
      "New session booked",
      kvTable([
        ["Booking reference", `<b>${d.bookingCode}</b>`],
        ["Client", `${d.name} (${d.email})`],
        ["Session", d.sessionLabel],
        ["Preferred date", d.date],
        ["Preferred time", d.time],
        ["Fee", d.amount],
        ...(d.channel ? ([["Payment", d.channel]] as [string, string][]) : []),
        ...(d.notes ? ([["Notes", d.notes]] as [string, string][]) : []),
      ]),
    ),
  };
}

export function feedbackNotificationEmail(f: {
  name: string;
  rating: number;
  message: string;
  sessionType: string;
  feedbackId: string;
}): MailInput {
  return {
    to: config.adminEmail,
    subject: `New client feedback awaiting approval (${f.rating}/5)`,
    html: shell(
      "New client feedback",
      `<p>A client left feedback on the website. It will only appear publicly once you approve it via the moderation list.</p>
       ${kvTable([
         ["From", f.name],
         ["Rating", `${f.rating} / 5`],
         ["Session type", f.sessionType],
         ["Message", `<span style="font-style:italic">${f.message.replace(/</g, "&lt;")}</span>`],
       ])}`,
    ),
  };
}

export function contactEmail(c: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}): MailInput {
  return {
    to: c.email,
    subject: `New website enquiry — ${c.subject || "General question"}`,
    html: shell(
      "New contact message",
      kvTable([
        ["Name", c.name],
        ["Email", c.email],
        ...(c.phone ? ([["Phone", c.phone]] as [string, string][]) : []),
        ["Message", `<span style="font-style:italic">${c.message.replace(/</g, "&lt;")}</span>`],
      ]),
    ),
  };
}
