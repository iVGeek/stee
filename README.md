# Kizito Moraa — Licensed Counseling Psychologist Website

A modern, fast, fully responsive website for a licensed counseling psychologist in Kenya with:

- **Session booking** — a 3-step wizard (your details → session → review & pay)
- **Paystack payments** — secure card/M-Pesa payments (KES) with server-side verification
- **Real client feedback** — public reviews with star ratings, admin moderation, and seeded starter testimonials
- **Email integration** — SMTP notifications for bookings, feedback and contact messages
- **WhatsApp integration** — one-tap chat links and a "pay later on WhatsApp" booking path
- **SEO + performance** — semantic HTML, structured data, security headers, lazy animation, mobile-first CSS

Stack: **Node.js + Express + TypeScript** (server) and **HTML + CSS + TypeScript** (client, bundled with esbuild). Built to deploy on **Render** in one click.

---

## Features at a glance

| Feature | How it works |
|---|---|
| Book a session | 3-step form: details → session (type/date/time) → review. Stored server-side with a booking reference. |
| Pay now | Paystack pop-up charges the exact session fee; the server verifies the transaction and confirms the booking. |
| Pay later | Booking is saved and a prefilled WhatsApp message opens so payment/arrangements happen in chat. |
| Feedback | Clients rate 1–5 stars and leave a review. New reviews go to moderation; approved ones appear in the testimonials carousel. |
| Email | Nodemailer (SMTP) sends a confirmation to the client and a notification to you for bookings, feedback and contact form. |
| WhatsApp | Floating chat button + hero CTA + "pay later" flow, all prefilled from booking data. |
| Moderation | `GET/POST/DELETE /api/feedback/admin` endpoints protected by an admin token. |
| Security | Helmet CSP, per-route rate limiting, input validation (zod), JSON-LD, no secrets client-side. |

---

## Quick start (local development)

```bash
git clone https://github.com/iVGeek/stee.git
cd stee
npm install

# configure environment
cp .env.example .env
#  ...edit .env and add your Paystack keys, SMTP settings and WhatsApp number

npm run dev
```

Open http://localhost:3000. `npm run dev` runs the server (tsx watch) and rebuilds the client bundle (esbuild watch) at the same time.

Other scripts:

```bash
npm run build        # bundle client + compile server to dist/
npm start            # run the compiled server
npm run typecheck    # type-check server and client
npm run preview      # build then start
```

---

## Configuration (`.env`)

Copy `.env.example` to `.env` and fill in your values.

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | Render sets this automatically. Default `3000`. |
| `PUBLIC_URL` | yes (prod) | Your site URL, e.g. `https://your-app.onrender.com`. Used for Paystack callbacks and links. |
| `PAYSTACK_PUBLIC_KEY` | for card payments | From the Paystack dashboard → Settings → Developers → API Keys. `pk_...` |
| `PAYSTACK_SECRET_KEY` | for card payments | `sk_...` — **server only, never exposed**. |
| `SMTP_HOST` | for email | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | no | Default `587`. |
| `SMTP_SECURE` | no | `true` for 465 (SSL), `false` for 587 (STARTTLS). |
| `SMTP_USER` | for email | e.g. your Gmail address (use an app password). |
| `SMTP_PASS` | for email | App password / SMTP password. |
| `MAIL_FROM` | no | Display sender, e.g. `"Kizito Moraa Counselling <you@gmail.com>"`. |
| `ADMIN_EMAIL` | for email | Where booking/feedback/contact notifications are sent. |
| `WA_NUMBER` | yes | Your WhatsApp number in international format, digits only (e.g. `254700096993`). |
| `ADMIN_TOKEN` | yes | Secret for the feedback moderation endpoints. Generate something long/random. |

> **No Paystack keys yet?** The site still works — the "Pay now" button explains payments are unavailable and clients can use the WhatsApp path. Same for email: if SMTP isn't configured, the site logs a warning and continues.

> **Note on Render's free Postgres:** free-tier databases are removed 30 days after creation. For a real practice, upgrade the database to a paid plan (Starter is enough) so bookings and feedback are never lost.

### Fees & pricing

Session types, labels, durations and prices live in `src/config.ts` → `config.pricing` (Kenyan Shillings). The client fetches these from `GET /api/config`, so pricing cards and the booking form update automatically from one place.

### Starter testimonials

When the feedback store is empty, `src/lib/seed.ts` seeds three approved sample testimonials on server start so the reviews carousel is never empty. New reviews still go to moderation. Delete the seeds via the admin API if you prefer to start blank.

---

## Paystack setup

1. Create a [Paystack](https://paystack.com) account (test mode is fine to start).
2. Dashboard → **Settings → Developers → API Keys** — copy the public and secret keys into `.env`.
3. Optionally set the payment page domain under **Settings → Developers → Webhooks/Payment pages**.
4. For local testing use `pk_test_...` / `sk_test_...` and a test card from the Paystack docs (e.g. `4084 0840 8408 4081`).

Payment flow (all server-verified, nothing trusts the browser):

1. Client submits the booking form → `POST /api/bookings`.
2. `POST /api/bookings/:id/pay-intent` initializes a Paystack transaction with the exact server-side price and a unique reference.
3. The Paystack pop-up charges the client.
4. The in-browser `POST /api/bookings/:id/verify` verifies the reference against Paystack before marking the booking **confirmed** and sending emails.
5. A Paystack **webhook** (`POST /api/paystack/webhook`) also confirms the booking, so payment is captured even if the client closes the pop-up before the in-browser verify runs. The webhook is signature-verified (HMAC-SHA512 with your secret key) and idempotent.

### Webhook setup

In the Paystack dashboard → **Settings → Developers → Webhooks**, set the webhook URL to:

```
https://your-app.onrender.com/api/paystack/webhook
```

and add events: **Charge success**. No separate secret is needed — Paystack signs requests with your secret key. Send a test webhook from the Paystack dashboard after your first test payment to confirm end-to-end.

---

## Email setup (Gmail example)

- Use a dedicated Gmail (or enable 2-step verification on your own) and create an **App Password**: Google Account → Security → 2-Step Verification → App passwords.
- In `.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<app-password>`, `ADMIN_EMAIL=you@gmail.com`.

For testing locally without a real inbox, services like **Mailtrap** work with the same SMTP fields.

---

## WhatsApp integration

The floating button, hero CTA and "Pay later on WhatsApp" flow all build `https://wa.me/<WA_NUMBER>?text=<message>` links. The booking path prefills the chat with the client's session details and booking reference. When a client chooses "pay later on WhatsApp", the therapist gets an email notification so no booking goes unnoticed. The WhatsApp pop-up is opened through a same-origin redirect hop (`/wa-redirect`) so browsers never block it.

---

## Feedback moderation

New reviews are stored as pending and are **not** shown publicly until approved. Approve or delete them with:

```bash
# list all (including pending)
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://your-app.onrender.com/api/feedback/admin

# approve
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://your-app.onrender.com/api/feedback/admin/<id>/approve

# delete
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://your-app.onrender.com/api/feedback/admin/<id>
```

---

## Deploy to Render

The repo includes a `render.yaml` blueprint, so the easiest path is **Blueprint**:

1. Push this repo to GitHub (see below).
2. On [Render](https://render.com), choose **New → Blueprint** and connect the repo.
3. Render reads `render.yaml`, creates the web service **and a Postgres database**, runs `npm install && npm run build`, and starts `npm start`. `DATABASE_URL` is wired to the database automatically.
4. Add the environment variables from `.env.example` in the service → **Environment** panel (`ADMIN_TOKEN` is auto-generated by the blueprint).

Manual option: New → **Web Service** → connect repo → Runtime: Node → Build Command `npm install && npm run build` → Start Command `npm start`. Set the same env vars.

> **Note on data storage:** bookings and feedback are stored in Postgres when a `DATABASE_URL` is set (production). The Render blueprint provisions a Postgres database automatically and wires `DATABASE_URL`. Without a `DATABASE_URL` the app falls back to local JSON files (`data/`) so local development needs no database. Storage is isolated in `src/lib/store.ts` — the routes never talk to storage directly.

---

## Customize the site content

All page copy is in `public/index.html` (search for the highlighted placeholders):

| What | Where |
|---|---|
| Therapist name & bio | `public/index.html` — hero, `#about` section |
| Practice name / footer brand | `public/index.html` |
| Logo | inline SVG in the header (`brand-mark`) |
| Colors & fonts | CSS variables at the top of `public/assets/styles.css` |
| Session types & prices (KES) | `src/config.ts` → `config.pricing` |
| Email address shown in footer | `public/app.ts` (`loadConfig`) and `.env` → `ADMIN_EMAIL` |
| WhatsApp number | `.env` → `WA_NUMBER` |
| Starter testimonials | `src/lib/seed.ts` |
| FAQ / services / hero copy | `public/index.html` |

---

## Project structure

```
stee/
├── render.yaml              # Render blueprint
├── public/                  # Frontend (served statically)
│   ├── index.html
│   ├── app.ts               # client logic (bundled → assets/app.js)
│   └── assets/styles.css
└── src/                     # Backend
    ├── server.ts            # Express app, security headers, rate limits, seed on boot
    ├── config.ts            # env config + pricing
    ├── lib/
    │   ├── db.ts           # Postgres pool + table init (used when DATABASE_URL is set)
    │   ├── store.ts        # storage API: Postgres in prod, JSON files in dev
    │   ├── seed.ts          # starter testimonials (seeded when feedback store is empty)
    │   ├── paystack.ts      # Paystack initialize/verify client
    │   ├── mailer.ts        # Nodemailer templates
    │   └── http.ts          # helpers, async wrapper, booking codes
    └── routes/
        ├── bookings.ts      # create / pay-intent / verify / contact
        ├── feedback.ts      # public list + submit + admin moderation
        ├── contact.ts       # contact form → email
        └── webhook.ts       # Paystack webhook (signature-verified, idempotent)
```

---

## API summary

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/config` | Public site config + pricing (drives the frontend) |
| `POST` | `/api/bookings` | Create a booking |
| `POST` | `/api/bookings/:id/pay-intent` | Start a Paystack transaction |
| `POST` | `/api/bookings/:id/verify` | Verify payment → confirm booking + email |
| `POST` | `/api/bookings/:id/contact` | Save booking, notify the therapist, and return a prefilled WhatsApp link |
| `POST` | `/api/paystack/webhook` | Paystack webhook — confirms payments (signature-verified, idempotent) |
| `GET` | `/api/feedback` | Approved testimonials |
| `POST` | `/api/feedback` | Submit a review (goes to moderation) |
| `GET/POST/DELETE` | `/api/feedback/admin` | Moderation (Bearer `ADMIN_TOKEN`) |
| `POST` | `/api/contact` | Contact form → email |

---

## Important legal note

This is not a crisis service. The site footer and FAQ include a notice directing people in crisis to their local emergency services — keep it accurate for your location.
