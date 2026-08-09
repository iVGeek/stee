import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { asyncHandler } from "../lib/http.js";
import { sendMail, contactEmail } from "../lib/mailer.js";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(160),
  phone: z.string().trim().max(30).optional().default(""),
  subject: z.string().trim().max(120).optional().default("General question"),
  message: z.string().trim().min(5, "Please write a short message").max(3000),
});

export const contactRouter = Router();

contactRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid message" });
      return;
    }
    const data = parsed.data;

    let emailed = false;
    if (config.adminEmail) {
      emailed = await sendMail(
        contactEmail({
          name: data.name,
          email: data.email,
          phone: data.phone,
          subject: data.subject,
          message: data.message,
        }),
      );
    }

    res.status(201).json({
      ok: true,
      message: "Thanks! Your message has been sent. I will get back to you within 24 hours.",
      emailed,
    });
  }),
);
