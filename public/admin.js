/* Admin moderation page — talks to /api/feedback/admin with the admin token. */
(function () {
  const TOKEN_KEY = "km-admin-token";

  const loginView = document.getElementById("loginView");
  const panelView = document.getElementById("panelView");
  const loginForm = document.getElementById("loginForm");
  const tokenInput = document.getElementById("tokenInput");
  const loginMsg = document.getElementById("loginMsg");
  const panelMsg = document.getElementById("panelMsg");
  const reviewList = document.getElementById("reviewList");
  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  let token = "";

  function show(view) {
    loginView.hidden = view !== "login";
    panelView.hidden = view !== "panel";
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
    loadReviews().catch(() => {});
  });

  refreshBtn.addEventListener("click", loadReviews);

  logoutBtn.addEventListener("click", () => {
    token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    show("login");
    setMsg(loginMsg, "");
  });

  token = sessionStorage.getItem(TOKEN_KEY) || "";
  if (token) {
    show("panel");
    loadReviews().catch(() => {});
  } else {
    show("login");
  }
})();
