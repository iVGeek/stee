import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { initDb } from "./lib/db.js";
import { getUsdToKesRate } from "./lib/rates.js";
import { listTakenSlots, timeSlots } from "./lib/availability.js";
import { seedIfEmpty } from "./lib/seed.js";
import { bookingsRouter } from "./routes/bookings.js";
import { feedbackRouter } from "./routes/feedback.js";
import { contactRouter } from "./routes/contact.js";
import { webhookRouter } from "./routes/webhook.js";
import { slotsRouter } from "./routes/slots.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://js.paystack.co"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://paystack.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.paystack.co", "https://paystack.com"],
        frameSrc: ["'self'", "https://checkout.paystack.com", "https://*.paystack.co", "https://paystack.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    // Paystack opens a cross-origin checkout (popup/iframe), so popups must be allowed.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    // Paystack's inline script injects a stylesheet from paystack.com; CORP: same-origin
    // would block that cross-origin subresource load.
    crossOriginResourcePolicy: false,
  }),
);

// Keep the raw request body available so the Paystack webhook can verify its
// HMAC signature over the exact bytes Paystack sent.
app.use(express.json({ limit: "100kb", verify: (req, _res, buf) => {
  (req as Request & { rawBody?: Buffer }).rawBody = buf;
} }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
const writeLimiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method !== "POST",
    message: { ok: false, message: "Too many requests. Please try again later." },
  });

app.use("/api", globalLimiter);

// Public site configuration (safe values only — never secrets)
app.get("/api/config", async (_req, res) => {
  const [usdToKes, slots] = await Promise.all([getUsdToKesRate(), listTakenSlots()]);
  res.json({
    ok: true,
    site: {
      name: "Kizito Moraa",
      currency: config.currency,
      whatsappNumber: config.whatsappNumber,
      paymentsEnabled: Boolean(config.paystack.publicKey && config.paystack.secretKey),
      usdRate: usdToKes,
      timeSlots,
    },
    pricing: config.pricing,
    slots,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use("/api/bookings", writeLimiter(15), bookingsRouter);
app.use("/api/feedback", writeLimiter(6), feedbackRouter);
app.use("/api/contact", writeLimiter(10), contactRouter);
app.use("/api/slots", slotsRouter);

// Paystack webhook — no write limiter (webhooks are retried and must not 429).
app.use("/api/paystack/webhook", webhookRouter);

app.use(express.static(publicDir, { index: "index.html", maxAge: config.isProd ? "1h" : 0 }));

// Admin moderation page (served explicitly so /admin isn't swallowed by the SPA fallback)
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

// SPA-ish fallback: serve index.html for unknown non-API GET routes
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((req, res) => {
  res.status(404).json({ ok: false, message: `Not found: ${req.method} ${req.path}` });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 500;
  const message = status < 500 ? (err as Error).message : "Something went wrong on our side. Please try again.";
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({ ok: false, message });
});

app.listen(config.port, async () => {
  await initDb();
  await seedIfEmpty();
  console.log(`[kizitomoraa] server running at ${config.publicUrl} (${config.nodeEnv})`);
});
