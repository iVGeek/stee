/* Admin moderation page — talks to /api/feedback/admin with the admin token. */
(function () {
  const TOKEN_KEY = "km-admin-token";

  const loginView = document.getElementById("loginView");
  const panelView = document.getElementById("panelView");
  const slotsCard = document.getElementById("slotsCard");
  const loginForm = document.getElementById("loginForm");
  const tokenInput = document.getElementById("tokenInput");
  const loginMsg = document.getElementById("loginMsg");
  const panelMsg = document.getElementById("panelMsg");
  const reviewList = document.getElementById("reviewList");
  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const slotForm = document.getElementById("slotForm");
  const slotDate = document.getElementById("slotDate");
  const slotTime = document.getElementById("slotTime");
  const slotNote = document.getElementById("slotNote");
  const slotMsg = document.getElementById("slotMsg");
  const slotList = document.getElementById("slotList");

  let token = "";

  function show(view) {
    loginView.hidden = view !== "login";
    panelView.hidden = view !== "panel";
    if (slotsCard) slotsCard.hidden = view !== "panel";
  }

  function setMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("ok", kind === "ok");
    el.classList.toggle("err", kind === "err");
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      token = "";
      sessionStorage.removeItem(TOKEN_KEY);
      show("login");
      setMsg(loginMsg, "Session expired — please sign in again.", "err");
      throw new Error("unauthorized");
    }
    if (!res.ok) throw new Error(json.message || "Request failed");
    return json;
  }

  function starRow(rating) {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return iso;
    }
  }

  async function loadReviews() {
    setMsg(panelMsg, "Loading reviews…");
    try {
      const data = await api("/api/feedback/admin");
      const rows = data.feedback || [];
      setMsg(panelMsg, "");
      if (!rows.length) {
        reviewList.innerHTML = '<p class="empty">No reviews yet.</p>';
        return;
      }
      reviewList.innerHTML = "";
      for (const f of rows) {
        const card = document.createElement("article");
        card.className = "review";
        card.innerHTML = `
          <div class="review-head">
            <span class="review-name">${escapeHtml(f.name)}</span>
            <span class="badge ${f.approved ? "badge-approved" : "badge-pending"}">${f.approved ? "Approved" : "Pending"}</span>
          </div>
          <div class="review-head">
            <span class="review-stars">${starRow(f.rating)}</span>
            <span class="review-meta">${escapeHtml(f.sessionType)} · ${escapeHtml(fmtDate(f.createdAt))}</span>
          </div>
          <p class="review-msg">“${escapeHtml(f.message)}”</p>
          <div class="review-actions">
            ${f.approved ? "" : `<button class="btn" data-act="approve" data-id="${escapeHtml(f.id)}" type="button">Approve</button>`}
            <button class="btn btn-danger" data-act="delete" data-id="${escapeHtml(f.id)}" type="button">Delete</button>
          </div>`;
        reviewList.appendChild(card);
      }
      reviewList.querySelectorAll("button[data-act]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const act = btn.dataset.act;
          btn.disabled = true;
          try {
            if (act === "approve") {
              await api(`/api/feedback/admin/${encodeURIComponent(id)}/approve`, { method: "POST" });
            } else {
              await api(`/api/feedback/admin/${encodeURIComponent(id)}`, { method: "DELETE" });
            }
            setMsg(panelMsg, act === "approve" ? "Review approved and now live." : "Review deleted.", "ok");
          } catch (err) {
            setMsg(panelMsg, err.message, "err");
          }
          await loadReviews();
        });
      });
    } catch (err) {
      if (err.message !== "unauthorized") setMsg(panelMsg, err.message, "err");
    }
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  function fmtDay(iso) {
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    } catch {
      return iso;
    }
  }

  async function loadSlots() {
    setMsg(slotMsg, "Loading calendar…");
    try {
      const data = await api("/api/slots/admin");
      setMsg(slotMsg, "");
      const blocked = data.blocked || [];
      const booked = data.booked || [];
      const rows = [];

      for (const s of blocked) {
        const row = document.createElement("div");
        row.className = "slot-row";
        row.innerHTML = `
          <div>
            <span class="slot-date">${escapeHtml(fmtDay(s.date))}</span>
            <span class="slot-time">${escapeHtml(s.time)}</span>
            ${s.note ? `<span class="slot-note">· ${escapeHtml(s.note)}</span>` : ""}
          </div>
          <div class="slot-actions">
            <span class="badge badge-pending">Blocked</span>
            <button class="btn btn-danger" data-unblock="${escapeHtml(s.id)}" type="button">Unblock</button>
          </div>`;
        rows.push(row);
      }

      for (const s of booked) {
        const row = document.createElement("div");
        row.className = "slot-row";
        row.innerHTML = `
          <div>
            <span class="slot-date">${escapeHtml(fmtDay(s.date))}</span>
            <span class="slot-time">${escapeHtml(s.time)}</span>
          </div>
          <div class="slot-actions">
            <span class="badge badge-approved">Booked</span>
          </div>`;
        rows.push(row);
      }

      slotList.innerHTML = "";
      if (!rows.length) {
        slotList.innerHTML = '<p class="empty">No booked or blocked slots.</p>';
      } else {
        rows.forEach((r) => slotList.appendChild(r));
      }

      slotList.querySelectorAll("[data-unblock]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            await api(`/api/slots/admin/${encodeURIComponent(btn.dataset.unblock)}`, { method: "DELETE" });
            setMsg(slotMsg, "Slot unlocked.", "ok");
          } catch (err) {
            setMsg(slotMsg, err.message, "err");
          }
          await loadSlots();
        });
      });
    } catch (err) {
      if (err.message !== "unauthorized") setMsg(slotMsg, err.message, "err");
    }
  }

  slotForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = slotDate.value;
    const time = slotTime.value;
    const note = slotNote.value.trim();
    if (!date || !time) {
      setMsg(slotMsg, "Please choose a date and time.", "err");
      return;
    }
    (async () => {
      try {
        await api("/api/slots/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, time, note }),
        });
        slotForm.reset();
        setMsg(slotMsg, "Slot blocked. It won't appear as bookable.", "ok");
      } catch (err) {
        setMsg(slotMsg, err.message, "err");
      }
      await loadSlots();
    })();
  });

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    token = tokenInput.value.trim();
    if (!token) {
      setMsg(loginMsg, "Please enter your admin token.", "err");
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, token);
    setMsg(loginMsg, "Signing in…");
    show("panel");
    Promise.all([loadReviews(), loadSlots()]).catch(() => {});
  });

  refreshBtn.addEventListener("click", () => {
    loadReviews();
    loadSlots();
  });

  logoutBtn.addEventListener("click", () => {
    token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    show("login");
    setMsg(loginMsg, "");
  });

  token = sessionStorage.getItem(TOKEN_KEY) || "";
  if (token) {
    show("panel");
    Promise.all([loadReviews(), loadSlots()]).catch(() => {});
  } else {
    show("login");
  }
})();
