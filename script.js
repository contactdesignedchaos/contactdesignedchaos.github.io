(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("primaryNav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    var setLabel = function () {
      var isLight = document.documentElement.getAttribute("data-theme") === "light";
      themeToggle.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
    };
    setLabel();
    themeToggle.addEventListener("click", function () {
      var isLight = document.documentElement.getAttribute("data-theme") === "light";
      if (isLight) {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
      }
      try {
        localStorage.setItem("theme", isLight ? "dark" : "light");
      } catch (e) {}
      setLabel();
    });
  }

  var hero = document.querySelector(".hero");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (hero && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      var mx = ((e.clientX - rect.left) / rect.width) * 100;
      var my = ((e.clientY - rect.top) / rect.height) * 100;
      hero.style.setProperty("--mx", mx + "%");
      hero.style.setProperty("--my", my + "%");
    });
  }

  document.querySelectorAll(".gallery-item").forEach(function (item) {
    item.addEventListener("click", function () {
      if (item.classList.contains("is-revealed")) return;
      var img = document.createElement("img");
      img.src = item.getAttribute("data-src");
      img.alt = item.getAttribute("data-alt") || "";
      item.appendChild(img);
      item.classList.add("is-revealed");
    });
  });

  // ---------- Utility interest counter ----------
  // Backed by the same Firebase project easyTransfer's internet transport
  // uses for signaling (Firestore REST + anonymous auth, no SDK — see
  // easyTransfer/docs/FIREBASE_SETUP.md, "siteInterest" collection). Fill
  // these in once that project exists; until then the buttons stay
  // interactive but the count stays hidden rather than showing a broken
  // zero.
  var FIREBASE_PROJECT_ID = "YOUR_FIREBASE_PROJECT_ID";
  var FIREBASE_API_KEY = "YOUR_FIREBASE_WEB_API_KEY";
  var firebaseConfigured =
    FIREBASE_PROJECT_ID !== "YOUR_FIREBASE_PROJECT_ID" &&
    FIREBASE_API_KEY !== "YOUR_FIREBASE_WEB_API_KEY";

  var FIRESTORE_RESOURCE_BASE = "projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents";
  var FIRESTORE_URL_BASE = "https://firestore.googleapis.com/v1/" + FIRESTORE_RESOURCE_BASE;
  var LOCAL_INTEREST_PREFIX = "et_interest_v1_";

  var cachedIdToken = null;
  function signInAnonymously() {
    if (cachedIdToken) return Promise.resolve(cachedIdToken);
    return fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + FIREBASE_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      }
    )
      .then(function (res) { return res.json(); })
      .then(function (data) {
        cachedIdToken = data.idToken;
        return cachedIdToken;
      });
  }

  function fetchInterestCount(utilityId) {
    return fetch(FIRESTORE_URL_BASE + "/siteInterest/" + utilityId)
      .then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Firestore read failed");
        return res.json();
      })
      .then(function (doc) {
        if (!doc || !doc.fields || !doc.fields.count) return 0;
        return parseInt(doc.fields.count.integerValue, 10) || 0;
      });
  }

  function registerInterest(utilityId) {
    return signInAnonymously().then(function (idToken) {
      return fetch(FIRESTORE_URL_BASE + ":commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify({
          writes: [
            {
              transform: {
                document: FIRESTORE_RESOURCE_BASE + "/siteInterest/" + utilityId,
                fieldTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }],
              },
            },
          ],
        }),
      });
    });
  }

  document.querySelectorAll(".interest-btn").forEach(function (btn) {
    var utilityId = btn.getAttribute("data-utility");
    var countEl = document.querySelector('.interest-count[data-utility="' + utilityId + '"]');
    var label = btn.querySelector(".interest-label");
    var liveCount = null;

    function renderCount(n) {
      if (!countEl) return;
      countEl.textContent = n === 1 ? "1 person interested" : n + " people interested";
    }

    var alreadyInterested = false;
    try {
      alreadyInterested = localStorage.getItem(LOCAL_INTEREST_PREFIX + utilityId) === "1";
    } catch (e) {}
    if (alreadyInterested) {
      btn.setAttribute("aria-pressed", "true");
      if (label) label.textContent = "Thanks!";
    }

    if (firebaseConfigured) {
      fetchInterestCount(utilityId)
        .then(function (n) {
          liveCount = n;
          renderCount(n);
        })
        .catch(function () {});
    }

    btn.addEventListener("click", function () {
      if (btn.getAttribute("aria-pressed") === "true") return;
      btn.setAttribute("aria-pressed", "true");
      if (label) label.textContent = "Thanks!";
      try {
        localStorage.setItem(LOCAL_INTEREST_PREFIX + utilityId, "1");
      } catch (e) {}

      if (liveCount !== null) renderCount(liveCount + 1);

      if (firebaseConfigured) {
        registerInterest(utilityId).catch(function () {
          // Best-effort — the button's local state already reflects the
          // click either way, so a failed network write is silent.
        });
      }
    });
  });

  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }
})();
