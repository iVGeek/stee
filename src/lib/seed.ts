import { readAll, insert } from "./store.js";
import type { Feedback } from "../routes/feedback.js";

const seedFeedback: Feedback[] = [
  {
    id: "seed-sarah",
    name: "Sarah M.",
    rating: 5,
    sessionType: "Individual Therapy",
    message:
      "Kizito created such a safe space for me to heal. Her warmth and professionalism helped me through my darkest moments.",
    approved: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-john-mary",
    name: "John & Mary K.",
    rating: 5,
    sessionType: "Couples Therapy",
    message:
      "The couples therapy sessions transformed our relationship. We learned to communicate better and understand each other deeply.",
    approved: true,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-david",
    name: "David L.",
    rating: 5,
    sessionType: "Individual Therapy",
    message:
      "Professional, compassionate, and truly understanding. Kizito helped me develop coping strategies that changed my life.",
    approved: true,
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

/** Seeds sample approved testimonials only when the feedback store is empty. */
export async function seedIfEmpty(): Promise<void> {
  if ((await readAll<Feedback>("feedback")).length === 0) {
    for (const f of seedFeedback) {
      await insert("feedback", f);
    }
  }
}
