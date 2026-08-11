/* ==========================================================================
   Kizito Moraa — client app
   ========================================================================== */
export {};

type PriceOption = {
  id: string;
  label: string;
  duration: string;
  price: number;
  description: string;
};

type TakenSlot = {
  date: string;
  time: string;
  kind: "booked" | "blocked";
};

type SiteConfig = {
  ok: boolean;
  site: {
    name: string;
    currency: string;
    whatsappNumber: string;
    paymentsEnabled: boolean;
    usdRate: number;
    schedule: Record<string, string[]>;
  };
  pricing: PriceOption[];
  slots: TakenSlot[];
};

type Booking = {
  id: string;
  code: string;
  status: string;
  sessionLabel: string;
  amount: number;
  preferredDate: string;
  preferredTime: string;
};

type PayIntent = {
  ok: boolean;
  payment: {
    reference: string;
    accessCode: string;
    publicKey: string;
    amount: number;
    currency: string;
    email: string;
  };
};

type Feedback = {
  id: string;
  name: string;
  rating: number;
  sessionType: string;
  message: string;
  createdAt: string;
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => void;
    };
  }
}

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

function $(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

const DEFAULT_SCHEDULE: Record<string, string[]> = {
  "0": [],
  "1": ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"],
  "2": ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"],
  "3": ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"],
  "4": ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"],
  "5": ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"],
  "6": ["9:00 AM", "10:00 AM", "11:00 AM"],
};

function isoDay(offset: number): { iso: string; d: Date } {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { iso, d };
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function currentUsdRate(): number {
  const r = config?.site.usdRate;
  return typeof r === "number" && Number.isFinite(r) && r > 0 ? r : 129;
}

function formatUsd(priceKes: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(priceKes / currentUsdRate());
  } catch {
    return `$${Math.round(priceKes / currentUsdRate())}`;
  }
}

function celebrate(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  const colors = ["#135e4b", "#4cb572", "#a1d8b5", "#d6a45c", "#e9c46a", "#ffffff"];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    w: 6 + Math.random() * 7,
    h: 8 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.25,
    vx: (Math.random() - 0.5) * 2,
    vy: 2 + Math.random() * 3,
  }));
  const start = performance.now();
  const duration = 2600;
  const tick = (now: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const alpha = Math.max(0, 1 - (now - start) / duration);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (now - start < duration) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };
  requestAnimationFrame(tick);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
  if (!res.ok || json.ok === false) {
    throw new Error(json.message || "Something went wrong. Please try again.");
  }
  return json as T;
}

let config: SiteConfig | null = null;

/* --------------------------------------------------------------------------
   Global config + links
   -------------------------------------------------------------------------- */

async function loadConfig(): Promise<void> {
  try {
    const res = await fetch("/api/config");
    config = (await res.json()) as SiteConfig;
  } catch {
    config = null;
  }
  const waNum = config?.site.whatsappNumber ?? "";
  const waBase = waNum ? `https://wa.me/${waNum}` : "";

  const heroText = "Hello! I found your counselling website and I'd like to ask about booking a session.";
  const setWa = (id: string, text: string) => {
    const el = $(id) as HTMLAnchorElement | null;
    if (el && waBase) el.href = `${waBase}?text=${encodeURIComponent(text)}`;
  };
  setWa("#waHero", heroText);
  setWa("#waFloat", heroText);
  setWa("#waContact", heroText);
  setWa("#waFooter", heroText);

  const email = $("a#contactEmail") as HTMLAnchorElement | null;
  if (email && config) {
    email.textContent = "kizitomoraa@gmail.com";
    email.href = "mailto:kizitomoraa@gmail.com";
  }
}

/* --------------------------------------------------------------------------
   Header / nav
   -------------------------------------------------------------------------- */

function initNav(): void {
  const toggle = $("#navToggle");
  const links = $("#primaryNav");
  const header = $("#siteHeader");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }),
  );

  const onScroll = () => {
    if (!header) return;
    const scrolled = window.scrollY > 8;
    header.classList.toggle("scrolled", scrolled);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* --------------------------------------------------------------------------
   Reveal on scroll
   -------------------------------------------------------------------------- */

function initReveal(): void {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  els.forEach((el) => io.observe(el));
}

/* --------------------------------------------------------------------------
   Pricing + booking options
   -------------------------------------------------------------------------- */

function initPricing(): void {
  const grid = $("#pricingGrid");
  if (!grid || !config) return;
  const site = config.site;
  grid.innerHTML = config.pricing
    .map((p) => {
      const featured = p.id === "individual-physical";
      return `
        <article class="pricing-card ${featured ? "featured" : ""}">
          ${featured ? '<span class="pricing-badge">Best value</span>' : ""}
          <h3>${escapeHtml(p.label)}</h3>
          <p class="pricing-duration">${escapeHtml(p.duration)}</p>
          <p class="pricing-price">${formatUsd(p.price)}</p>
          <p class="pricing-kes">≈ ${formatMoney(p.price, site.currency)}</p>
          <p class="pricing-desc">${escapeHtml(p.description)}</p>
          <a class="btn ${featured ? "btn-primary" : "btn-outline"}" href="#booking" data-select-package="${p.id}">Book this →</a>
        </article>`;
    })
    .join("");

  grid.querySelectorAll<HTMLAnchorElement>("[data-select-package]").forEach((a) => {
    a.addEventListener("click", () => selectSessionType(a.dataset.selectPackage ?? ""));
  });

  const sessionSelect = $("#bSession") as HTMLSelectElement | null;
  if (sessionSelect && config) {
    sessionSelect.innerHTML = config.pricing
      .map((p) => `<option value="${p.id}">${escapeHtml(p.label)} — ${formatUsd(p.price)} (≈ ${formatMoney(p.price, site.currency)})</option>`)
      .join("");
  }
}

function selectSessionType(id: string): void {
  const sessionSelect = $("#bSession") as HTMLSelectElement | null;
  if (sessionSelect) sessionSelect.value = id;
}

/* --------------------------------------------------------------------------
   Booking wizard
   -------------------------------------------------------------------------- */

let currentBooking: Booking | null = null;
let bookingBusy = false;

function initBooking(): void {
  const form = $("#bookingForm") as HTMLFormElement | null;
  if (!form) return;

  const steps = Array.from(form.querySelectorAll<HTMLElement>(".form-step"));
  const dots = Array.from(form.querySelectorAll<HTMLElement>(".step-dot"));
  const lines = Array.from(form.querySelectorAll<HTMLElement>(".step-line"));
  const indicator = $("#stepsIndicator");
  const success = $("#bookingResult");
  const resultText = $("#resultText");
  const resultCode = $("#resultCode");
  const resultHint = $("#resultHint");
  const msg = $("#bookingMsg");
  const payBtn = $("#payPaystack") as HTMLButtonElement | null;
  const dayPicker = $("#bDayPicker") as HTMLElement | null;
  const timePicker = $("#bTimePicker") as HTMLElement | null;
  const dayHint = $("#bDayHint");
  const timeHint = $("#bTimeHint");
  const bDate = $("#bDate") as HTMLInputElement | null;
  const bTime = $("#bTime") as HTMLInputElement | null;
  const schedule = config?.site.schedule && Object.keys(config.site.schedule).length ? config.site.schedule : DEFAULT_SCHEDULE;
  const unavailable = new Set<string>((config?.slots ?? []).map((s) => `${s.date}|${s.time}`));

  let selectedDate = "";
  let selectedTime = "";
  let stepIndex = 0;

  /* ---- Day / time availability picker ---- */

  function timesFor(dateIso: string): string[] {
    const wd = String(new Date(`${dateIso}T00:00:00`).getDay());
    return schedule[wd] ?? [];
  }

  function availableTimes(dateIso: string): string[] {
    return timesFor(dateIso).filter((t) => !unavailable.has(`${dateIso}|${t}`));
  }

  function dayChipLabel(offset: number): { iso: string; weekday: string; dayNum: string; month: string } {
    const { iso, d } = isoDay(offset);
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    const dayNum = String(d.getDate());
    const month = d.toLocaleDateString(undefined, { month: "short" });
    return { iso, weekday, dayNum, month };
  }

  function buildDayPicker(): void {
    if (!dayPicker) return;
    dayPicker.innerHTML = Array.from({ length: 21 }, (_, i) => {
      const { iso, weekday, dayNum, month } = dayChipLabel(i);
      const total = timesFor(iso).length;
      const open = availableTimes(iso).length;
      const closed = total === 0;
      const full = total > 0 && open === 0;
      const disabled = closed || full;
      const count = closed ? "Closed" : full ? "Full" : open;
      const label = closed
        ? `${weekday} ${dayNum} — closed`
        : full
          ? `${weekday} ${dayNum} — fully booked`
          : `${weekday} ${dayNum} ${month}, ${open} time${open === 1 ? "" : "s"} open`;
      return `
        <button type="button" class="slot-chip ${disabled ? "is-disabled" : ""}" data-day="${iso}" role="option" aria-label="${label}" ${disabled ? "disabled" : ""}>
          <span class="slot-chip-day">${weekday}</span>
          <span class="slot-chip-num">${dayNum}</span>
          <span class="slot-chip-month">${month}</span>
          <span class="slot-chip-count">${count}</span>
        </button>`;
    }).join("");

    dayPicker.querySelectorAll<HTMLButtonElement>("[data-day]").forEach((chip) => {
      chip.addEventListener("click", () => selectDay(chip.dataset.day ?? ""));
    });
  }

  function buildTimePicker(dateIso: string): void {
    if (!timePicker) return;
    selectedDate = dateIso;
    timePicker.innerHTML = availableTimes(dateIso)
      .map((t) => `
        <button type="button" class="slot-chip${t === selectedTime ? " selected" : ""}" data-time="${escapeHtml(t)}" role="option">
          <span class="slot-chip-sub">${escapeHtml(t)}</span>
        </button>`)
      .join("");

    timePicker.querySelectorAll<HTMLButtonElement>("[data-time]").forEach((chip) => {
      chip.addEventListener("click", () => selectTime(chip.dataset.time ?? ""));
    });
  }

  /** Re-pulls live availability so a slot taken by someone else greys out at selection, not at payment. */
  async function refreshAvailability(): Promise<void> {
    const prevDate = selectedDate;
    const prevTime = selectedTime;
    try {
      const res = await fetch("/api/slots");
      const data = (await res.json()) as { ok: boolean; slots: TakenSlot[] };
      unavailable.clear();
      (data.slots ?? []).forEach((s) => unavailable.add(`${s.date}|${s.time}`));
    } catch {
      // Keep last known availability if the refresh fails.
    }
    const lost = prevTime !== "" && selectedTime === prevTime && unavailable.has(`${prevDate}|${prevTime}`);
    if (lost) {
      selectedTime = "";
      if (bDate) bDate.value = "";
      if (bTime) bTime.value = "";
      if (dayHint) dayHint.textContent = `Sorry, ${prevDate} ${prevTime} was just taken — please pick another slot.`;
    }
    buildDayPicker();
    if (selectedDate) buildTimePicker(selectedDate);
    if (timeHint) {
      timeHint.textContent = lost || selectedTime ? "" : "Pick an available time below.";
    }
  }

  function selectDay(iso: string): void {
    dayPicker?.querySelectorAll<HTMLButtonElement>("[data-day]").forEach((c) => c.classList.toggle("selected", c.dataset.day === iso));
    selectedTime = "";
    if (bDate) bDate.value = "";
    if (bTime) bTime.value = "";
    if (dayHint) dayHint.textContent = "Now pick an available time.";
    if (timeHint) timeHint.textContent = "Loading the latest availability…";
    buildTimePicker(iso);
    void refreshAvailability();
  }

  function selectTime(time: string): void {
    selectedTime = time;
    timePicker?.querySelectorAll<HTMLButtonElement>("[data-time]").forEach((c) => c.classList.toggle("selected", c.dataset.time === time));
    if (bDate) bDate.value = selectedDate;
    if (bTime) bTime.value = time;
    if (dayHint) dayHint.textContent = "";
    if (timeHint) timeHint.textContent = "";
    void refreshAvailability();
  }

  buildDayPicker();

  function showStep(index: number): void {
    stepIndex = index;
    steps.forEach((s, i) => s.classList.toggle("active", i === index));
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === index);
      d.classList.toggle("done", i < index);
    });
    lines.forEach((l, i) => l.classList.toggle("done", i < index));
    form!.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function isValidPhone(value: string): boolean {
    const cleaned = value.replace(/[^+\d]/g, "");
    return /^\+?\d+$/.test(cleaned) && cleaned.length >= 7 && cleaned.length <= 15;
  }

  const phoneInput = $("#bPhone") as HTMLInputElement | null;
  function setPhoneValidity(): void {
    if (!phoneInput) return;
    const valid = !phoneInput.value.trim() || isValidPhone(phoneInput.value);
    phoneInput.setCustomValidity(valid ? "" : "Please enter a valid phone number");
  }
  phoneInput?.addEventListener("input", setPhoneValidity);
  phoneInput?.addEventListener("blur", () => {
    setPhoneValidity();
    if (phoneInput!.value.trim() && !isValidPhone(phoneInput!.value)) {
      phoneInput!.reportValidity();
    }
  });

  function stepValid(index: number): boolean {
    const fieldset = steps[index];
    const fields = Array.from(fieldset.querySelectorAll<HTMLInputElement>("input, select, textarea")).filter(
      (f) => !(f instanceof HTMLInputElement && f.type === "checkbox") || f.id === "bConsent",
    );
    for (const f of fields) {
      if (f.id === "bConsent") continue;
      if (f.id === "bPhone") setPhoneValidity();
      if (!f.checkValidity()) {
        f.reportValidity();
        return false;
      }
    }
    if (index === 1) {
      if (!bDate?.value || !bTime?.value) {
        setMsg("Please pick a day and an available time.", false);
        return false;
      }
    }
    return true;
  }

  form.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.matches("[data-next]")) {
      if (!stepValid(stepIndex)) return;
      if (stepIndex === steps.length - 1) return;
      if (stepIndex === 1) renderReview();
      showStep(stepIndex + 1);
    } else if (target.matches("[data-back]")) {
      showStep(Math.max(0, stepIndex - 1));
    }
  });

  const sessionSelect = $("#bSession") as HTMLSelectElement | null;
  sessionSelect?.addEventListener("change", renderReview);

  function renderReview(): void {
    const box = $("#reviewSummary");
    if (!box || !config) return;
    const option = config.pricing.find((p) => p.id === sessionSelect?.value);
    if (!option) return;
    const name = ($("#bName") as HTMLInputElement)?.value.trim() || "—";
    const date = bDate?.value || "—";
    const time = bTime?.value || "—";
    box.innerHTML = `
      <div class="review-row"><span>Name</span><span>${escapeHtml(name)}</span></div>
      <div class="review-row"><span>Session</span><span>${escapeHtml(option.label)}</span></div>
      <div class="review-row"><span>Date</span><span>${escapeHtml(date)}</span></div>
      <div class="review-row"><span>Time</span><span>${escapeHtml(time)}</span></div>
      <div class="review-row total"><span>Total</span><span>${formatUsd(option.price)}</span></div>
      <div class="review-row"><span>Billed as</span><span>${formatMoney(option.price, config.site.currency)}</span></div>`;
  }

  function bookingPayload(): Record<string, unknown> {
    return {
      fullName: ($("#bName") as HTMLInputElement).value.trim(),
      email: ($("#bEmail") as HTMLInputElement).value.trim(),
      phone: ($("#bPhone") as HTMLInputElement).value.trim(),
      sessionType: ($("#bSession") as HTMLSelectElement).value,
      preferredDate: bDate?.value ?? "",
      preferredTime: bTime?.value ?? "",
      notes: ($("#bNotes") as HTMLTextAreaElement).value.trim(),
      consent: true,
    };
  }

  function setMsg(text: string, ok: boolean): void {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.toggle("ok", ok);
    msg.classList.toggle("err", !ok);
  }

  function showSuccess(title: string, text: string, hint: string): void {
    if (indicator) indicator.hidden = true;
    steps.forEach((s) => s.classList.remove("active"));
    if (success) success.hidden = false;
    const t = $("#resultTitle");
    if (t) t.textContent = title;
    if (resultText) resultText.textContent = text;
    if (resultCode) resultCode.textContent = currentBooking?.code ?? "";
    if (resultHint) resultHint.textContent = hint;
    form!.scrollIntoView({ behavior: "smooth", block: "center" });
    celebrate();
  }

  async function createBooking(): Promise<{ booking: Booking }> {
    const res = await postJson<{ ok: boolean; booking: Booking }>("/api/bookings", bookingPayload());
    currentBooking = res.booking;
    return { booking: res.booking };
  }

  payBtn?.addEventListener("click", async () => {
    if (bookingBusy) return;
    if (!stepValid(stepIndex)) return;
    const consent = ($("#bConsent") as HTMLInputElement).checked;
    if (!consent) {
      setMsg("Please accept the consent notice to continue.", false);
      return;
    }
    if (!config?.site.paymentsEnabled) {
      setMsg("Online payments are temporarily unavailable. Please try again shortly.", false);
      return;
    }

    bookingBusy = true;
    setMsg("Creating your booking…", true);
    payBtn.disabled = true;
    try {
      const { booking } = await createBooking();
      setMsg("Preparing secure payment…", true);
      const intent = await postJson<PayIntent>(`/api/bookings/${booking.id}/pay-intent`, {});
      await loadPaystack();
      openPaystack(intent.payment);
    } catch (err) {
      setMsg((err as Error).message, false);
      bookingBusy = false;
      payBtn.disabled = false;
    }
  });

  // Paystack's CDN can be flaky on slow connections; retry loading the inline
  // script (with a timeout) before giving up on the payment popup.
  function loadPaystack(attempt = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) { resolve(); return; }
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        if (attempt < 3) {
          void loadPaystack(attempt + 1).then(resolve, reject);
        } else {
          reject(new Error("Payment provider failed to load. Please check your connection and try again."));
        }
      };
      const ok = () => {
        if (settled) return;
        if (window.PaystackPop) { settled = true; resolve(); }
        else fail();
      };
      const timer = setTimeout(fail, 12000);
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => { clearTimeout(timer); ok(); };
      script.onerror = () => { clearTimeout(timer); fail(); };
      document.head.appendChild(script);
    });
  }

  function openPaystack(payment: PayIntent["payment"]): void {
    const pop = window.PaystackPop;
    if (!pop) {
      setMsg("Payment provider failed to load. Please try again.", false);
      bookingBusy = false;
      payBtn!.disabled = false;
      return;
    }
    pop.setup({
      key: payment.publicKey,
      email: payment.email,
      amount: payment.amount * 100,
      currency: payment.currency,
      ref: payment.reference,
      metadata: { bookingId: currentBooking?.id },
      // Note: Paystack's v1 inline script rejects async functions for callback,
      // so wrap the async verification in a sync handler.
      callback: (response) => {
        void (async () => {
          setMsg("Verifying payment…", true);
          try {
            await postJson(`/api/bookings/${currentBooking?.id}/verify`, { reference: response.reference });
            bookingBusy = false;
            payBtn!.disabled = false;
            showSuccess(
              "Payment received — you're booked!",
              "Your session is confirmed. A confirmation email is on its way to your inbox, and Kizito has been notified.",
              "You'll receive your private session link or call details ahead of the appointment.",
            );
          } catch (err) {
            setMsg((err as Error).message, false);
            bookingBusy = false;
            payBtn!.disabled = false;
          }
        })();
      },
      onClose: () => {
        setMsg("Payment window closed. You can retry whenever you're ready.", false);
        bookingBusy = false;
        payBtn!.disabled = false;
      },
    });
  }
}

/* --------------------------------------------------------------------------
   Feedback
   -------------------------------------------------------------------------- */

function initFeedback(): void {
  const track = $("#testimonialsTrack");
  const form = $("#feedbackForm") as HTMLFormElement | null;
  const msg = $("#feedbackMsg");
  let rating = 0;

  async function loadFeedback(): Promise<void> {
    if (!track) return;
    try {
      const res = await fetch("/api/feedback");
      const data = (await res.json()) as { ok: boolean; feedback: Feedback[] };
      const list = data.feedback;
      if (!list.length) {
        track.innerHTML = `
          <article class="t-card">
            <p class="t-message">No reviews yet — be the first to share how your session went.</p>
          </article>`;
        return;
      }
      track.innerHTML = list
        .map(
          (f) => `
          <article class="t-card">
            <span class="t-stars" aria-label="${f.rating} out of 5 stars">${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)}</span>
            <p class="t-message">“${escapeHtml(f.message)}”</p>
            <p class="t-meta"><strong>${escapeHtml(f.name)}</strong> · ${escapeHtml(f.sessionType)}</p>
          </article>`,
        )
        .join("");
    } catch {
      track.innerHTML = `<article class="t-card"><p class="t-message">Reviews are currently unavailable.</p></article>`;
    }
  }

  function setStars(value: number): void {
    rating = value;
    form?.querySelectorAll<HTMLButtonElement>(".star").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.value) <= value);
    });
  }

  $("#starInput")?.addEventListener("click", (e) => {
    const star = (e.target as HTMLElement).closest<HTMLButtonElement>(".star");
    if (star?.dataset.value) setStars(Number(star.dataset.value));
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";
    if (rating < 1) {
      if (msg) {
        msg.textContent = "Please choose a star rating.";
        msg.classList.add("err");
      }
      return;
    }
    const payload = {
      name: ($("#fName") as HTMLInputElement).value.trim() || "Anonymous",
      rating,
      sessionType: ($("#fSession") as HTMLSelectElement).value,
      message: ($("#fMessage") as HTMLTextAreaElement).value.trim(),
    };
    try {
      await postJson("/api/feedback", payload);
      if (msg) {
        msg.textContent = "Thank you! Your review will appear once approved.";
        msg.classList.add("ok");
        msg.classList.remove("err");
      }
      form.reset();
      setStars(0);
    } catch (err) {
      if (msg) {
        msg.textContent = (err as Error).message;
        msg.classList.add("err");
        msg.classList.remove("ok");
      }
    }
  });

  const prev = $("#tPrev");
  const next = $("#tNext");
  if (prev && next && track) {
    prev.addEventListener("click", () => track.scrollBy({ left: -360, behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: 360, behavior: "smooth" }));
  }

  void loadFeedback();
}

/* --------------------------------------------------------------------------
   Contact form
   -------------------------------------------------------------------------- */

function initContact(): void {
  const form = $("#contactForm") as HTMLFormElement | null;
  const msg = $("#contactMsg");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";
    const payload = {
      name: ($("#cName") as HTMLInputElement).value.trim(),
      email: ($("#cEmail") as HTMLInputElement).value.trim(),
      phone: ($("#cPhone") as HTMLInputElement).value.trim(),
      subject: ($("#cSubject") as HTMLInputElement).value.trim(),
      message: ($("#cMessage") as HTMLTextAreaElement).value.trim(),
    };
    try {
      const res = await postJson<{ ok: boolean; message: string }>("/api/contact", payload);
      if (msg) {
        msg.textContent = res.message;
        msg.classList.add("ok");
        msg.classList.remove("err");
      }
      form.reset();
      celebrate();
    } catch (err) {
      if (msg) {
        msg.textContent = (err as Error).message;
        msg.classList.add("err");
        msg.classList.remove("ok");
      }
    }
  });
}

/* --------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- */

async function init(): Promise<void> {
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  initNav();
  initReveal();

  await loadConfig();
  initPricing();
  initBooking();
  initFeedback();
  initContact();
}

void init();
