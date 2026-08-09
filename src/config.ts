import "dotenv/config";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export interface PriceOption {
  id: string;
  label: string;
  duration: string;
  price: number; // in main currency units (e.g. KES)
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
  currency: "KES",
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
      id: "individual-physical",
      label: "Individual Therapy (In-person)",
      duration: "45 min – 1 hour",
      price: 2500,
      description: "One-on-one support for depression, anxiety, trauma, grief and life transitions.",
    },
    {
      id: "individual-online",
      label: "Individual Therapy (Online)",
      duration: "45 min – 1 hour",
      price: 2000,
      description: "Secure video or phone sessions for clients who prefer online therapy.",
    },
    {
      id: "couples",
      label: "Couples Therapy",
      duration: "45 min – 1 hour",
      price: 4500,
      description: "Improve communication, resolve conflict and rebuild trust together.",
    },
    {
      id: "consultation",
      label: "Consultation",
      duration: "30 min – 1 hour",
      price: 1000,
      description: "A focused first conversation to understand your needs and plan your care.",
    },
  ] as PriceOption[],
} as const;

export function getPriceOption(id: string): PriceOption | undefined {
  return config.pricing.find((p) => p.id === id);
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: config.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
