"use strict";

/* ════════════════════════════════════════════════════════════════
   BOLauth.js — the single auth helper for BOL.html

   1. Supabase client            (unchanged — BOL.html's inline scripts
                                  and module script use this global)
   2. Page user-info injection   (unchanged behaviour, but a logged-out
                                  visitor is now allowed to stay)
   3. Login / signup MODAL       (new — window.BOLAuth)

   BOL.html is public. Logging in is optional and happens in a modal
   on top of the current page — no redirect, no reload. The navbar is
   updated by the existing onAuthStateChange listener in BOL.html.
════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://muifdxmbtrpbqglyuudx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vD-_br5ry0EDmwkTgPVCHg_a9Bazjcv";

if (!window.supabaseClient && window.supabase) {
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
}
var supabaseClient = window.supabaseClient;

/* ════════════════════════════════════════════════════════════════
   2. PAGE USER-INFO INJECTION
   Previously this block ALSO redirected logged-out users to
   index.html. That redirect has been removed: BOL.html must open
   normally for visitors who are not logged in.
════════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", async () => {
  let user = null;
  try {
    const { data } = await supabaseClient.auth.getUser();
    user = data?.user || null;
  } catch (err) {
    console.warn("[BOL] getUser failed (network?):", err && err.message);
  }

  // Logged out → nothing to inject. Stay on the page.
  if (!user) return;

  // Inject Email
  const emailEl = document.getElementById("userEmail");
  if (emailEl) {
    emailEl.textContent = user.email;
  }

  // Inject Name (from metadata)
  const nameEl = document.getElementById("userNameDisplay");
  if (nameEl) {
    const fullName = user.user_metadata?.full_name;
    nameEl.textContent = fullName ? `Hey, ${fullName}` : "Welcome";
  }
});

// Optional generic logout button (#logoutBtn). BOL.html's navbar uses
// #navLogoutBtn, which is handled by BOL.html's inline nav script.
// Behaviour change: signing out no longer redirects — the user stays
// on the current page.
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });
}

/* ════════════════════════════════════════════════════════════════
   3. LOGIN / SIGNUP MODAL  →  window.BOLAuth

   Public API
     BOLAuth.openLoginModal()   open on the "Log in" view
     BOLAuth.openSignupModal()  open on the "Create account" view
     BOLAuth.closeLoginModal()
     BOLAuth.isModalOpen()

   Triggers wired automatically
     #navLoginBtn (the navbar "Log in" link)
     any element with  data-bol-auth-open  (="signup" for signup view)

   Auth calls are the same ones login.js makes (signInWithPassword,
   signUp → signInWithPassword) and go through the ONE client above.
   Markup/CSS reuse login.js / login.css: see auth-modal.css.
════════════════════════════════════════════════════════════════ */

(function () {
  // Resolve asset URLs next to this script (must be read synchronously).
  const SCRIPT_SRC = document.currentScript && document.currentScript.src;
  const CSS_HREF = SCRIPT_SRC
    ? new URL("auth-modal.css", SCRIPT_SRC).href
    : "auth-modal.css";
  const FONT_HREF =
    "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap";

  let overlay = null; // built lazily on first open
  let assetsPromise = null;
  let lastFocus = null;
  let view = "login";
  let epoch = 0; // bumped on close → ignores stale async UI updates

  /* ── assets (CSS + font), loaded on first hover/focus/click ── */

  function ensureAssets() {
    if (assetsPromise) return assetsPromise;

    if (!document.querySelector("link[data-bol-auth-font]")) {
      const font = document.createElement("link");
      font.rel = "stylesheet";
      font.href = FONT_HREF;
      font.setAttribute("data-bol-auth-font", "");
      document.head.appendChild(font);
    }

    assetsPromise = new Promise((resolve) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = CSS_HREF;
      css.setAttribute("data-bol-auth-css", "");
      css.onload = css.onerror = () => resolve();
      document.head.appendChild(css);
      setTimeout(resolve, 2000); // never hang the click
    });
    return assetsPromise;
  }

  /* ── markup (same structure/classes as index.html's login card + signup modal) ── */

  const ICON_MAIL =
    '<svg class="form-field__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
  const ICON_LOCK =
    '<svg class="form-field__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  const ICON_USER =
    '<svg class="form-field__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const ICON_SHIELD =
    '<svg class="form-field__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  const ICON_ALERT =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

  function field(
    group,
    id,
    label,
    icon,
    type,
    placeholder,
    autocomplete,
    extra,
  ) {
    return `
      <div class="form-field" id="${group}">
        <label class="form-field__label" for="${id}">${label}</label>
        <div class="form-field__wrap">
          ${icon}
          <input class="form-field__input${extra ? " form-field__input--has-toggle" : ""}" type="${type}" id="${id}"
                 placeholder="${placeholder}" autocomplete="${autocomplete}" spellcheck="false" />
          ${extra || ""}
        </div>
        <span class="form-field__error" id="${id}Error" aria-live="polite"></span>
      </div>`;
  }

  const PW_TOGGLE = `
    <button type="button" class="form-field__toggle-pw" id="bolAuthTogglePw" aria-label="Show password">
      <svg class="icon-eye-show" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      <svg class="icon-eye-hide" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    </button>`;

  const TEMPLATE = `
    <div class="login-card" id="bolAuthLoginCard">
      <div class="login-card__aurora" aria-hidden="true"></div>
      <button type="button" class="signup-close" data-bol-auth-close aria-label="Close login">✕</button>

      <div class="login-card__header">
        <div class="login-card__logo-ring">B</div>
        <div class="login-card__header-text">
          <h2 class="login-card__title" id="bolAuthLoginTitle">Welcome Back</h2>
          <p class="login-card__subtitle" id="bolAuthLoginSubtitle">Continue your confidence journey.</p>
        </div>
      </div>

      <form class="login-form" id="bolAuthLoginForm" novalidate>
        ${field("bolAuthLiEmailGroup", "bolAuthLiEmail", "Email address", ICON_MAIL, "email", "you@example.com", "email")}
        <div class="form-field" id="bolAuthLiPasswordGroup">
          <div class="form-field__label-row">
            <label class="form-field__label" for="bolAuthLiPassword">Password</label>
            <a href="#" class="form-field__forgot">Forgot?</a>
          </div>
          <div class="form-field__wrap">
            ${ICON_LOCK}
            <input class="form-field__input form-field__input--has-toggle" type="password" id="bolAuthLiPassword"
                   placeholder="Min. 6 characters" autocomplete="current-password" />
            ${PW_TOGGLE}
          </div>
          <span class="form-field__error" id="bolAuthLiPasswordError" aria-live="polite"></span>
        </div>

        <div class="form-alert" id="bolAuthLiAlert" style="display:none" role="alert" aria-live="assertive">
          ${ICON_ALERT}<span id="bolAuthLiAlertMsg"></span>
        </div>

        <button type="submit" class="login-btn" id="bolAuthLoginBtn">
          <span class="login-btn__label">Sign In</span>
          <span class="login-btn__spinner" aria-hidden="true"></span>
        </button>

        <button type="button" class="bol-auth-maybe-later" data-bol-auth-close>Maybe Later</button>
      </form>

      <p class="login-card__footer-note">
        New here? <a href="#" class="login-card__create-link" data-bol-auth-view="signup">Create account</a>
      </p>
    </div>

    <div class="signup-card" id="bolAuthSignupCard">
      <div class="signup-card__aurora" aria-hidden="true"></div>
      <button type="button" class="signup-close" data-bol-auth-close aria-label="Close signup">✕</button>

      <div class="signup-card__header">
        <div class="signup-card__logo-ring">B</div>
        <div>
          <h2 class="signup-card__title" id="bolAuthSignupTitle">Create Account</h2>
          <p class="signup-card__subtitle" id="bolAuthSignupSubtitle">Start your confidence journey today.</p>
        </div>
      </div>

      <form class="signup-form" id="bolAuthSignupForm" novalidate>
        ${field("bolAuthSuNameGroup", "bolAuthSuName", "Full name", ICON_USER, "text", "Your name", "name")}
        ${field("bolAuthSuEmailGroup", "bolAuthSuEmail", "Email address", ICON_MAIL, "email", "you@example.com", "email")}
        ${field("bolAuthSuPasswordGroup", "bolAuthSuPassword", "Password", ICON_LOCK, "password", "Min. 6 characters", "new-password")}
        ${field("bolAuthSuConfirmGroup", "bolAuthSuConfirm", "Confirm password", ICON_SHIELD, "password", "Re-enter password", "new-password")}

        <div class="form-alert" id="bolAuthSuAlert" style="display:none" role="alert" aria-live="assertive">
          ${ICON_ALERT}<span id="bolAuthSuAlertMsg"></span>
        </div>

        <button type="submit" class="signup-btn" id="bolAuthSignupBtn">
          <span class="signup-btn__label">Create Account</span>
          <span class="signup-btn__spinner" aria-hidden="true"></span>
        </button>

        <button type="button" class="bol-auth-maybe-later" data-bol-auth-close>Maybe Later</button>
      </form>

      <p class="signup-card__footer-note">
        Already have an account?
        <a href="#" class="signup-card__signin-link" data-bol-auth-view="login">Sign in</a>
      </p>
    </div>`;

  /* ── tiny DOM helpers ── */

  const $id = (id) => document.getElementById(id);

  function isEmailValid(email) {
    // same rule as login.js
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  // Error ids follow the pattern  <inputId>Error ; group ids are explicit.
  function showError(groupId, inputId, msg) {
    const group = $id(groupId);
    const span = $id(inputId + "Error");
    if (group) group.classList.add("has-error");
    if (span) {
      span.textContent = msg;
      requestAnimationFrame(() => span.classList.add("visible"));
    }
  }

  function clearError(groupId, inputId) {
    const group = $id(groupId);
    const span = $id(inputId + "Error");
    if (group) group.classList.remove("has-error");
    if (span) {
      span.classList.remove("visible");
      setTimeout(() => {
        if (!span.classList.contains("visible")) span.textContent = "";
      }, 200);
    }
  }

  function showAlert(alertId, msgId, msg) {
    const box = $id(alertId),
      span = $id(msgId);
    if (!box || !span) return;
    span.textContent = msg;
    box.style.display = "flex";
  }
  function hideAlert(alertId) {
    const box = $id(alertId);
    if (box) box.style.display = "none";
  }

  function setLoading(btn, on) {
    if (!btn) return;
    btn.classList.toggle("loading", on);
    btn.disabled = on;
  }

  function resetBtn(btn, labelSel, text) {
    if (!btn) return;
    btn.disabled = false;
    btn.style.background = "";
    btn.style.boxShadow = "";
    btn.classList.remove("loading");
    const label = btn.querySelector(labelSel);
    if (label) label.textContent = text;
  }

  function markSuccess(btn, labelSel, text) {
    if (!btn) return;
    const label = btn.querySelector(labelSel);
    if (label) label.textContent = text;
    btn.style.background = "linear-gradient(90deg, #22c55e, #16a34a)";
    btn.style.boxShadow = "0 12px 32px rgba(34,197,94,0.3)";
  }

  /* ── field groups (login) ── */
  const LI = {
    emailG: "bolAuthLiEmailGroup",
    email: "bolAuthLiEmail",
    passG: "bolAuthLiPasswordGroup",
    pass: "bolAuthLiPassword",
  };
  /* ── field groups (signup) ── */
  const SU = {
    nameG: "bolAuthSuNameGroup",
    name: "bolAuthSuName",
    emailG: "bolAuthSuEmailGroup",
    email: "bolAuthSuEmail",
    passG: "bolAuthSuPasswordGroup",
    pass: "bolAuthSuPassword",
    confG: "bolAuthSuConfirmGroup",
    conf: "bolAuthSuConfirm",
  };

  function resetLoginErrors() {
    clearError(LI.emailG, LI.email);
    clearError(LI.passG, LI.pass);
    hideAlert("bolAuthLiAlert");
  }
  function resetSignupErrors() {
    clearError(SU.nameG, SU.name);
    clearError(SU.emailG, SU.email);
    clearError(SU.passG, SU.pass);
    clearError(SU.confG, SU.conf);
    hideAlert("bolAuthSuAlert");
  }

  function resetForms() {
    resetLoginErrors();
    resetSignupErrors();
    [LI.email, LI.pass, SU.name, SU.email, SU.pass, SU.conf].forEach((id) => {
      const el = $id(id);
      if (el) el.value = "";
    });
    resetBtn($id("bolAuthLoginBtn"), ".login-btn__label", "Sign In");
    resetBtn($id("bolAuthSignupBtn"), ".signup-btn__label", "Create Account");
    // back to hidden-password state
    const pw = $id(LI.pass),
      tg = $id("bolAuthTogglePw");
    if (pw) pw.type = "password";
    if (tg) {
      const show = tg.querySelector(".icon-eye-show"),
        hide = tg.querySelector(".icon-eye-hide");
      if (show) show.style.display = "block";
      if (hide) hide.style.display = "none";
      tg.setAttribute("aria-label", "Show password");
    }
  }

  /* ── validation (same rules + messages as login.js) ── */

  function validateLogin(email, password) {
    let ok = true;
    if (!email) {
      showError(LI.emailG, LI.email, "Email address is required.");
      ok = false;
    } else if (!isEmailValid(email)) {
      showError(LI.emailG, LI.email, "Please enter a valid email address.");
      ok = false;
    }

    if (!password) {
      showError(LI.passG, LI.pass, "Password is required.");
      ok = false;
    } else if (password.length < 6) {
      showError(LI.passG, LI.pass, "Password must be at least 6 characters.");
      ok = false;
    }
    return ok;
  }

  function validateSignup(name, email, password, confirm) {
    let ok = true;
    if (!name) {
      showError(SU.nameG, SU.name, "Name is required.");
      ok = false;
    }

    if (!email) {
      showError(SU.emailG, SU.email, "Email address is required.");
      ok = false;
    } else if (!isEmailValid(email)) {
      showError(SU.emailG, SU.email, "Please enter a valid email address.");
      ok = false;
    }

    if (!password) {
      showError(SU.passG, SU.pass, "Password is required.");
      ok = false;
    } else if (password.length < 6) {
      showError(SU.passG, SU.pass, "Password must be at least 6 characters.");
      ok = false;
    }

    if (!confirm) {
      showError(SU.confG, SU.conf, "Please confirm your password.");
      ok = false;
    } else if (password && confirm !== password) {
      showError(SU.confG, SU.conf, "Passwords do not match.");
      ok = false;
    }
    return ok;
  }

  /* ── submit handlers (auth calls identical to login.js) ── */

  async function onLoginSubmit(e) {
    e.preventDefault();
    resetLoginErrors();

    const email = $id(LI.email).value.trim();
    const password = $id(LI.pass).value;
    if (!validateLogin(email, password)) return;

    const btn = $id("bolAuthLoginBtn");
    const my = epoch;
    let success = false;
    setLoading(btn, true);

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error(error.message);

      if (data?.user) {
        success = true;
        if (my === epoch) {
          markSuccess(btn, ".login-btn__label", "✓ Signed in");
          // Modal closes; the page stays put. The navbar flips to the
          // logged-in state via onAuthStateChange in BOL.html.
          setTimeout(() => {
            if (my === epoch) close();
          }, 450);
        }
      }
    } catch (err) {
      if (my === epoch)
        showAlert(
          "bolAuthLiAlert",
          "bolAuthLiAlertMsg",
          err.message || "Something went wrong. Please try again.",
        );
    } finally {
      if (my === epoch) {
        setLoading(btn, false);
        if (success) btn.disabled = true; // no double-submit while closing
      }
    }
  }

  async function onSignupSubmit(e) {
    e.preventDefault();
    resetSignupErrors();

    const name = $id(SU.name).value.trim();
    const email = $id(SU.email).value.trim();
    const password = $id(SU.pass).value;
    const confirm = $id(SU.conf).value;
    if (!validateSignup(name, email, password, confirm)) return;

    const btn = $id("bolAuthSignupBtn");
    const my = epoch;
    let success = false;
    setLoading(btn, true);

    try {
      // Step 1: create the account
      const { error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (signUpError) throw new Error(signUpError.message);

      // Step 2: sign in immediately (email confirmation is disabled)
      const { data: loginData, error: loginError } =
        await supabaseClient.auth.signInWithPassword({ email, password });
      if (loginError) throw new Error(loginError.message);

      if (loginData?.user) {
        success = true;
        if (my === epoch) {
          markSuccess(btn, ".signup-btn__label", "✓ Account created");
          setTimeout(() => {
            if (my === epoch) close();
          }, 600);
        }
      }
    } catch (err) {
      if (my === epoch)
        showAlert(
          "bolAuthSuAlert",
          "bolAuthSuAlertMsg",
          err.message || "Something went wrong. Please try again.",
        );
    } finally {
      if (my === epoch) {
        setLoading(btn, false);
        if (success) btn.disabled = true;
      }
    }
  }

  /* ── build / open / close ── */

  function setView(next, options) {
    view = next === "signup" ? "signup" : "login";
    overlay.setAttribute("data-view", view);
    overlay.setAttribute(
      "aria-labelledby",
      view === "signup" ? "bolAuthSignupTitle" : "bolAuthLoginTitle",
    );
    resetLoginErrors();
    resetSignupErrors();

    const loginTitleEl = $id("bolAuthLoginTitle");
    const loginSubEl = $id("bolAuthLoginSubtitle");
    if (loginTitleEl) {
      loginTitleEl.textContent = options?.title || "Welcome Back";
    }
    if (loginSubEl) {
      loginSubEl.textContent = options?.subtitle || "Continue your confidence journey.";
    }

    const signupTitleEl = $id("bolAuthSignupTitle");
    const signupSubEl = $id("bolAuthSignupSubtitle");
    if (signupTitleEl) {
      signupTitleEl.textContent = options?.signupTitle || "Create Account";
    }
    if (signupSubEl) {
      signupSubEl.textContent = options?.signupSubtitle || "Start your confidence journey today.";
    }

    setTimeout(() => {
      const first = $id(view === "signup" ? SU.name : LI.email);
      if (first && overlay.classList.contains("open")) first.focus();
    }, 120);
  }

  function build() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "bol-auth-overlay";
    overlay.id = "bolAuthOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("data-view", "login");
    overlay.innerHTML = TEMPLATE;
    document.body.appendChild(overlay);

    // backdrop click, close buttons, view switch, dead "#" links
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        close();
        return;
      }
      if (e.target.closest("[data-bol-auth-close]")) {
        close();
        return;
      }

      const sw = e.target.closest("[data-bol-auth-view]");
      if (sw) {
        e.preventDefault();
        setView(sw.getAttribute("data-bol-auth-view"));
        return;
      }

      if (e.target.closest('a[href="#"]')) e.preventDefault(); // e.g. "Forgot?"
    });

    // clear inline errors while typing
    [
      [LI.email, LI.emailG, "bolAuthLiAlert"],
      [LI.pass, LI.passG, "bolAuthLiAlert"],
      [SU.name, SU.nameG, "bolAuthSuAlert"],
      [SU.email, SU.emailG, "bolAuthSuAlert"],
      [SU.pass, SU.passG, "bolAuthSuAlert"],
      [SU.conf, SU.confG, "bolAuthSuAlert"],
    ].forEach(([inputId, groupId, alertId]) => {
      $id(inputId).addEventListener("input", () => {
        clearError(groupId, inputId);
        hideAlert(alertId);
      });
    });

    // password show/hide (same behaviour as login.js)
    const tg = $id("bolAuthTogglePw"),
      pw = $id(LI.pass);
    tg.addEventListener("click", () => {
      const isPassword = pw.type === "password";
      pw.type = isPassword ? "text" : "password";
      tg.querySelector(".icon-eye-show").style.display = isPassword
        ? "none"
        : "block";
      tg.querySelector(".icon-eye-hide").style.display = isPassword
        ? "block"
        : "none";
      tg.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password",
      );
      pw.focus();
    });

    $id("bolAuthLoginForm").addEventListener("submit", onLoginSubmit);
    $id("bolAuthSignupForm").addEventListener("submit", onSignupSubmit);
  }

  async function open(nextView, options) {
    // Already signed in → nothing to log into (navbar updates itself).
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (data && data.session) return;
    } catch (err) {
      /* fall through and show the modal */
    }

    await ensureAssets();
    build();

    if (!overlay.classList.contains("open")) lastFocus = document.activeElement;
    setView(nextView, options);
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
  }

  function close() {
    if (!overlay || !overlay.classList.contains("open")) return;
    epoch++;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    resetForms();
    const loginTitleEl = $id("bolAuthLoginTitle");
    const loginSubEl = $id("bolAuthLoginSubtitle");
    if (loginTitleEl) loginTitleEl.textContent = "Welcome Back";
    if (loginSubEl) loginSubEl.textContent = "Continue your confidence journey.";
    const signupTitleEl = $id("bolAuthSignupTitle");
    const signupSubEl = $id("bolAuthSignupSubtitle");
    if (signupTitleEl) signupTitleEl.textContent = "Create Account";
    if (signupSubEl) signupSubEl.textContent = "Start your confidence journey today.";
    if (lastFocus && typeof lastFocus.focus === "function")
      lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  /* ── global wiring ── */

  // Open from the navbar "Log in" link (or any [data-bol-auth-open]).
  // The link keeps href="index.html" as a no-JS fallback; with JS it never navigates.
  document.addEventListener("click", (e) => {
    const trigger =
      e.target.closest &&
      e.target.closest("#navLoginBtn, [data-bol-auth-open]");
    if (!trigger) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return; // let "open in new tab" work
    e.preventDefault();
    open(
      trigger.getAttribute("data-bol-auth-open") === "signup"
        ? "signup"
        : "login",
    );
  });

  // Warm up CSS/font as soon as the user shows intent.
  ["pointerover", "focusin", "touchstart"].forEach((type) => {
    document.addEventListener(
      type,
      (e) => {
        if (
          e.target.closest &&
          e.target.closest("#navLoginBtn, [data-bol-auth-open]")
        )
          ensureAssets();
      },
      { passive: true },
    );
  });

  document.addEventListener("keydown", (e) => {
    if (!overlay || !overlay.classList.contains("open")) return;

    if (e.key === "Escape") {
      close();
      return;
    }

    if (e.key === "Tab") {
      // keep focus inside the dialog
      const card = overlay.querySelector(
        view === "signup" ? ".signup-card" : ".login-card",
      );
      const items = Array.from(
        card.querySelectorAll(
          "a[href], button:not([disabled]), input:not([disabled])",
        ),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !card.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !card.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.BOLAuth = {
    open: (view, opts) => open(view || "login", opts),
    openLoginModal: (opts) => open("login", opts),
    openSignupModal: (opts) => open("signup", opts),
    openSaveProgressPrompt: () =>
      open("login", {
        title: "Save Your Progress",
        subtitle:
          "Log in to save your speaking sessions, track your improvement, and build your confidence over time.",
      }),
    closeLoginModal: close,
    isModalOpen: () => !!(overlay && overlay.classList.contains("open")),
  };
})();
