import "dotenv/config";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export interface PriceOption {
  id: string;
  label: string;
  duration: string;
  price: number; // in kobo? No — in main currency units (e.g. NGN)
  description: string;
}

export const config = {
  port: num(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: (process.env.NODE_ENV ?? "development") === "production",
  publicUrl: (process.env.PUBLIC_URL ?? `http://localhost:${num(process.env.PORT, 3000)}`).replace(/\/$/, ""),
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminToken: process.env.ADMIN_TOKEN ?? "change-me-admin-token",
  whatsappNumber: process.env.WA_NUMBER ?? "",
  currency: "NGN",
  paystack: {
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
    baseUrl: "https://api.paystack.co",
  },
  mail: {
    host: process.env.SMTP_HOST ?? "",
    port: num(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM ?? "",
  },
  pricing: [
    {
      id: "single",
      label: "Single Session",
      duration: "60 minutes",
      price: 25000,
      description: "One focused one-on-one session for personal, anxiety, stress or relational concerns.",
    },
    {
      id: "couples",
      label: "Couples Session",
      duration: "90 minutes",
      price: 35000,
      description: "A joint session to improve communication, rebuild trust and strengthen connection.",
    },
    {
      id: "online",
      label: "Online Session",
      duration: "60 minutes · video/phone",
      price: 20000,
      description: "The same care, from the comfort of your home. Available worldwide via video or phone.",
    },
    {
      id: "package4",
      label: "Package of 4 Sessions",
      duration: "4 × 60 minutes",
      price: 90000,
      description: "A structured series for lasting progress. Save compared to four single sessions.",
    },
  ] as PriceOption[],
} as const;

export function getPriceOption(id: string): PriceOption | undefined {
  return config.pricing.find((p) => p.id === id);
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: config.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
