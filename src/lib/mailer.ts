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
      from: config.mail.from || `"Stee Counselling" <${config.mail.user}>`,
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
      <span style="color:#fbf9f4;font-size:18px;font-weight:700">Stee Counselling</span>
    </div>
    <div style="padding:28px">
      <h2 style="color:#22312b;margin:0 0 12px;font-size:20px">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="background:#f4f1ea;padding:16px 28px;color:#6a756f;font-size:12px">
      Automated message from the Stee Counselling website.
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
    to: f.name,
    subject: `New client feedback (${f.rating}/5)`,
    html: shell(
      "New client feedback",
      `<p>A client left new feedback on the website. Review it in the moderation list.</p>
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
