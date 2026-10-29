import "./styles.css";
import { DATA } from "./data.js";

/* ===== Helpers ===== */
var $ = function (s) { return document.querySelector (s) };
function el (t, c, h) {
  var e = document.createElement (t);
  if (c) e.className = c;
  if (h != null) e.innerHTML = h;
  return e
}
function esc (s) {
  var d = document.createElement ("div");
  d.textContent = s == null ? "" : String (s);
  return d.innerHTML
}
var NAV = [["home", "Home"], ["about", "About"], ["experience", "Experience"], ["projects", "Projects"], ["certificates", "Certificates"], ["skills", "Skills"], ["contact", "Contact"]];
var menu = $("#menu");
NAV.forEach (function (n) {
  var a = el ("a", null, n[1]);
  a.href = "#" + n[0];
  a.dataset.go = n[0];
  menu.appendChild (a);
})

/* ===== Static render (always available) ===== */
var dlg = $("#dlg"), db = $("#db"), lastFocus = null;
function openDlg (html) {
  lastFocus = document.activeElement;
  db.innerHTML = html;
  dlg.showModal ()
}
$("#dx").addEventListener ("click", function () { dlg.close () });
dlg.addEventListener ("click", function (e) { if (e.target === dlg) dlg.close () });
dlg.addEventListener ("close", function () { if (lastFocus) lastFocus.focus () });

function thumb (img, label, alt) {
  return img
    ? '<img class="thumb" style="object-fit:cover;border-style:solid" src="' + esc (img) + '" alt="' + esc (alt) + '">'
    : '<div class="thumb">' + esc (label) + '</div>'
}

function renderSocials (links) {
  var host = $("#soc");
  if (!host) return;
  var s = links || {};
  var github = s.github || DATA.github;
  var linkedin = s.linkedin || DATA.linkedin;
  var email = s.email || DATA.email;
  host.innerHTML = '<a href="' + esc (github) + '" target="_blank" rel="noopener">GitHub</a>'
    + '<a href="' + esc (linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>'
    + '<a href="mailto:' + esc (email) + '">Email</a>'
}

function renderCV (cvPath) {
  var cv = $("#cv");
  if (!cv) return;
  if (cvPath) {
    cv.href = cvPath;
    cv.setAttribute ("download", "");
    cv.removeAttribute ("aria-disabled");
    cv.removeAttribute ("title");
    cv.textContent = "Download CV";
  } else {
    cv.removeAttribute ("href");
    cv.setAttribute ("aria-disabled", "true");
    cv.title = "CV file not added yet";
    cv.textContent = "Download CV (not added yet)";
  }
}

function renderExperience (items) {
  var host = $("#exp");
  if (!host) return;
  host.innerHTML = "";
  (items || []).forEach (function (x, i) {
    var li = el ("li", "rv");
    li.style.setProperty ("--d", i * .07 + "s");
    li.innerHTML = '<div class="card"><div class="meta"><span class="tag">' + esc (x.type) + '</span>'
      + (x.period ? '<span class="tag n">' + esc (x.period) + '</span>' : '<span class="tag n">Dates to be confirmed</span>')
      + '</div><h3>' + esc (x.title) + '</h3><div class="org">' + esc (x.org) + '</div>'
      + (x.desc ? '<p style="color:var(--mute);margin:8px 0 0">' + esc (x.desc) + '</p>' : '')
      + '<ul>' + (x.points || []).map (function (p) { return "<li>" + esc (p) + "</li>" }).join ("") + '</ul></div>';
    host.appendChild (li)
  })
}

function renderProjects (items) {
  var host = $("#proj");
  if (!host) return;
  host.innerHTML = "";
  (items || []).forEach (function (p, i) {
    var c = el ("article", "card pc rv");
    c.style.setProperty ("--d", i * .08 + "s");
    c.innerHTML = thumb (p.img, "Screenshot placeholder", p.name)
      + '<div class="meta"><span class="tag">' + esc (p.kind) + '</span></div><h3>' + esc (p.name) + '</h3><p>' + esc (p.desc) + '</p>'
      + (p.tech
        ? '<div class="chips">' + p.tech.map (function (t) { return '<span class="chip">' + esc (t) + '</span>' }).join ("") + '</div>'
        : '<div class="chips"><span class="tag n">Tech stack to be confirmed</span></div>')
      + '<button class="btn" type="button">View Details</button>';
    c.querySelector ("button").addEventListener ("click", function () {
      openDlg ('<h3 id="dt">' + esc (p.name) + '</h3><div class="meta"><span class="tag">' + esc (p.kind) + '</span></div><p>' + esc (p.desc) + '</p><p><b style="color:var(--ink)">My role:</b> ' + esc (p.role) + '</p><div class="cta" style="margin:10px 0 0">'
        + (p.live ? '<a class="btn" target="_blank" rel="noopener" href="' + esc (p.live) + '">Live demo</a>' : '')
        + (p.repo ? '<a class="btn" target="_blank" rel="noopener" href="' + esc (p.repo) + '">GitHub</a>' : '')
        + '</div>' + (!p.live && !p.repo ? '<p style="font-size:.88rem">No live demo or repository link has been added yet.</p>' : ''))
    });
    host.appendChild (c)
  })
}

function renderCertificates (items) {
  var host = $("#certs");
  if (!host) return;
  host.innerHTML = "";
  (items || []).forEach (function (c, i) {
    var a = el ("article", "card cert rv");
    a.style.setProperty ("--d", i * .08 + "s");
    var pv = c.image
      ? '<img class="thumb" style="object-fit:cover;border-style:solid;cursor:zoom-in" src="' + esc (c.image) + '" alt="Certificate: ' + esc (c.title) + '" tabindex="0">'
      : '<button type="button" class="thumb" aria-label="Preview placeholder for ' + esc (c.title) + '">Original certificate image not provided yet</button>';
    a.innerHTML = pv + '<h3>' + esc (c.title) + '</h3>'
      + (c.issuer ? '<p>' + esc (c.issuer) + '</p>' : '')
      + (c.date ? '<p>Issued: ' + esc (c.date) + '</p>' : '')
      + (c.listed ? '<p>' + esc (c.listed) + '</p>' : '')
      + '<div class="row"><button class="btn" type="button" data-v>View Certificate</button>'
      + (c.file ? '<a class="btn" href="' + esc (c.file) + '" download>Download Certificate</a>' : '<span class="tag n" style="align-self:center">File not added yet</span>')
      + '</div>';
    var show = function () {
      openDlg ('<h3 id="dt">' + esc (c.title) + '</h3>'
        + (c.image
          ? '<img style="width:100%;border-radius:10px" src="' + esc (c.image) + '" alt="Certificate: ' + esc (c.title) + '">'
          : '<div class="thumb" style="aspect-ratio:4/3">Original certificate image not provided yet.<br>Add the file to public/certificates/ and set its path in the data.</div>')
        + (c.issuer ? '<p>' + esc (c.issuer) + '</p>' : '')
        + (c.listed ? '<p>' + esc (c.listed) + '</p>' : ''))
    };
    a.querySelector ("[data-v]").addEventListener ("click", show);
    a.querySelector (".thumb").addEventListener ("click", show);
    host.appendChild (a)
  })
}

function renderSkills (groups) {
  var host = $("#sk");
  if (!host) return;
  host.innerHTML = "";
  (groups || []).forEach (function (s, i) {
    var c = el ("div", "card rv");
    c.style.setProperty ("--d", i * .06 + "s");
    c.innerHTML = '<h3>' + esc (s.g) + '</h3><div class="chips">' + (s.i || []).map (function (t) { return '<span class="chip">' + esc (t) + '</span>' }).join ("") + '</div>';
    host.appendChild (c)
  })
}

function renderStaticContent () {
  renderSocials ();
  renderCV (DATA.cv);
  renderExperience (DATA.experience);
  renderProjects (DATA.projects);
  renderCertificates (DATA.certificates);
  renderSkills (DATA.skills);
  var yr = $("#yr");
  if (yr) yr.textContent = new Date ().getFullYear ()
}
renderStaticContent ();

/* ===== Supabase (progressive enhancement, static DATA is the fallback) ===== */
var supabaseClient = null;
var supabaseInit = false;

function resolveAsset (path, bucket) {
  if (!path) return null;
  if (/^(?:[a-z]+:)?\/\//i.test (path) || path.charAt (0) === "/" || path.indexOf ("data:") === 0) return path;
  try {
    var client = supabaseClient || window.supabase;
    if (client && client.storage) {
      var res = client.storage.from (bucket || "portfolio-public").getPublicUrl (path);
      if (res && res.data && res.data.publicUrl) return res.data.publicUrl
    }
  } catch (e) {
    console.warn ("[Supabase] Could not resolve asset URL:", path, e);
  }
  return path
}

function formatDate (value) {
  if (!value) return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec (String (value));
  if (m) {
    var d = new Date (Date.UTC (+m[1], +m[2] - 1, +m[3]));
    return d.toLocaleDateString ("en-US", { timeZone: "UTC", month: "long", year: "numeric" })
  }
  return String (value)
}

function normalizeExperiences (rows) {
  return rows.map (function (x) {
    return {
      type: x.type || "Experience",
      title: x.title || "",
      org: x.company || "",
      period: x.period || null,
      desc: x.description || null,
      points: Array.isArray (x.highlights) ? x.highlights : []
    }
  })
}

function normalizeProjects (rows) {
  return rows.map (function (p) {
    return {
      name: p.title || "",
      kind: p.category || "Project",
      desc: p.description || "",
      tech: Array.isArray (p.tech) && p.tech.length ? p.tech : null,
      role: p.role || "Role to be confirmed.",
      img: resolveAsset (p.image_path, "portfolio-public"),
      live: p.demo_url || null,
      repo: p.repo_url || null
    }
  })
}

function normalizeCertificates (rows) {
  return rows.map (function (c) {
    return {
      title: c.title || "",
      issuer: c.issuer || null,
      date: formatDate (c.issued_on),
      listed: c.validity_note || null,
      image: resolveAsset (c.image_path, "portfolio-public"),
      file: resolveAsset (c.file_path, "portfolio-documents")
    }
  })
}

function normalizeSkills (rows) {
  var groups = [], index = {};
  rows.forEach (function (s) {
    var name = s.category || "Skills";
    if (!index[name]) {
      index[name] = { g: name, i: [] };
      groups.push (index[name])
    }
    if (s.name) index[name].i.push (s.name)
  });
  return groups
}

async function loadCollection (client, table, normalize, render) {
  var res = await client
    .from (table)
    .select ("*")
    .eq ("is_public", true)
    .order ("sort_order", { ascending: true })
    .order ("created_at", { ascending: false });
  if (res.error) throw res.error;
  if (!res.data || !res.data.length) return false;
  var items = normalize (res.data);
  if (!items.length) return false;
  render (items);
  return true
}

async function loadSettings (client) {
  var res = await client
    .from ("site_settings")
    .select ("*")
    .eq ("id", 1)
    .maybeSingle ();
  if (res.error) throw res.error;
  var s = res.data;
  if (!s) return false;

  var h1 = document.querySelector ("#home h1");
  var logo = document.querySelector ("header .logo");
  var role = document.querySelector ("#home .role");
  var intro = document.querySelector (".intro");

  if (s.full_name) {
    if (h1) h1.textContent = s.full_name;
    if (logo) logo.textContent = s.full_name
  }
  if (s.headline && role) role.textContent = s.headline;
  if (s.intro && intro) intro.textContent = s.intro;

  if (s.profile_image_path) {
    var photo = document.querySelector (".photo");
    if (photo) {
      var img = document.createElement ("img");
      img.src = resolveAsset (s.profile_image_path, "portfolio-public");
      img.alt = s.profile_image_alt || ("Profile photo: " + (s.full_name || "Profile"));
      photo.innerHTML = "";
      photo.appendChild (img)
    }
  }

  renderSocials ({
    github: s.github_url,
    linkedin: s.linkedin_url,
    email: s.email
  });
  if (s.active_cv_id) {
    var cvResult = await client
      .from ("resumes")
      .select ("storage_path")
      .eq ("id", s.active_cv_id)
      .maybeSingle ();
    if (cvResult.error) throw cvResult.error;
    if (cvResult.data && cvResult.data.storage_path) {
      renderCV (resolveAsset (cvResult.data.storage_path, "portfolio-documents"));
    }
  } else {
    renderCV (null);
  }
  return true
}

async function loadDynamicContent (client) {
  var jobs = [
    ["site settings", loadSettings (client)],
    ["experiences", loadCollection (client, "experiences", normalizeExperiences, renderExperience)],
    ["projects", loadCollection (client, "projects", normalizeProjects, renderProjects)],
    ["certificates", loadCollection (client, "certificates", normalizeCertificates, renderCertificates)],
    ["skills", loadCollection (client, "skills", normalizeSkills, renderSkills)]
  ];
  var results = await Promise.allSettled (jobs.map (function (j) { return j[1] }));
  results.forEach (function (r, i) {
    if (r.status === "rejected") {
      console.warn ("[Supabase] Failed to load " + jobs[i][0] + ". Keeping static content.", r.reason)
    }
  });
  reveal ()
}

async function initSupabase () {
  if (supabaseInit) return;
  supabaseInit = true;
  var url = import.meta.env.VITE_SUPABASE_URL;
  var key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn ("[Supabase] Environment variables not set. Using static DATA fallback.");
    return
  }
  try {
    var mod = await import ("@supabase/supabase-js");
    supabaseClient = mod.createClient (url, key);
    window.supabase = supabaseClient;
    await loadDynamicContent (supabaseClient)
  } catch (err) {
    console.error ("[Supabase] Init error. Using static DATA fallback.", err)
  }
}

/* ===== Theme ===== */
var root = document.documentElement, tb = $("#theme");
function setTheme (t, save) {
  root.dataset.theme = t;
  tb.textContent = t === "dark" ? "☀" : "☾";
  tb.setAttribute ("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
  if (save) try { localStorage.setItem ("theme", t) } catch (e) {}
}
var saved = null;
try { saved = localStorage.getItem ("theme") } catch (e) {}
setTheme (saved === "dark" ? "dark" : "light", false);
tb.addEventListener ("click", function () {
  setTheme (root.dataset.theme === "dark" ? "light" : "dark", true)
})
/* ===== Routing + nav ===== */
var burger = $("#burger");
function setMenu (o) {
  menu.classList.toggle ("open", o);
  burger.setAttribute ("aria-expanded", o);
  burger.setAttribute ("aria-label", o ? "Close menu" : "Open menu")
}
burger.addEventListener ("click", function () { setMenu (!menu.classList.contains ("open")) });
document.addEventListener ("keydown", function (e) { if (e.key === "Escape") setMenu (false) })
function go (id, push) {
  setMenu (false);
  var cert = id === "certificates";
  $("#v-home").hidden = cert;
  $("#v-cert").hidden = !cert;
  if (cert) { window.scrollTo (0, 0); mark ("certificates"); reveal () }
  else {
    var t = document.getElementById (id) || document.getElementById ("home");
    setTimeout (function () { t.scrollIntoView ({ behavior: matchMedia ("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" }) }, 0);
    mark (id); reveal ()
  }
  if (push) try { history.replaceState (null, "", "#" + id) } catch (e) {}
}
document.addEventListener ("click", function (e) {
  var a = e.target.closest ("[data-go]");
  if (!a) return;
  e.preventDefault ();
  go (a.dataset.go, true)
})
function mark (id) {
  menu.querySelectorAll ("a").forEach (function (a) {
    a.classList.toggle ("on", a.dataset.go === id);
    if (a.dataset.go === id) a.setAttribute ("aria-current", "page");
    else a.removeAttribute ("aria-current")
  })
}
window.addEventListener ("hashchange", function () { go (location.hash.slice (1) || "home", false) })
/* active section on scroll */
var secs = ["home", "about", "experience", "projects", "skills", "contact"].map (function (i) { return document.getElementById (i) })
var so = new IntersectionObserver (function (es) {
  es.forEach (function (en) {
    if (en.isIntersecting && !$("#v-home").hidden) mark (en.target.id)
  })
}, { rootMargin: "-45% 0px -50% 0px" })
secs.forEach (function (s) { so.observe (s) })
/* scroll reveal (runs once per element) */
var ro = new IntersectionObserver (function (es) {
  es.forEach (function (en) {
    if (en.isIntersecting) { en.target.classList.add ("in"); ro.unobserve (en.target) }
  })
}, { threshold: .12 })
function reveal () { document.querySelectorAll (".rv:not(.in)").forEach (function (n) { ro.observe (n) }) }
/* ===== Contact form (mailto fallback) ===== */
$("#form").addEventListener ("submit", function (e) {
  e.preventDefault ();
  var n = $("#n").value.trim (), m = $("#e").value.trim (), g = $("#m").value.trim (), ok = true;
  function chk (c, id, msg) { $(id).textContent = c ? "" : msg; if (!c) ok = false }
  chk (n.length > 1, "#en", "Enter your name.");
  chk (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test (m), "#ee", "Enter a valid email address.");
  chk (g.length > 9, "#em", "Write a message of at least 10 characters.");
  if (!ok) { $("#st").textContent = "Fix the highlighted fields and try again."; return }
  $("#st").textContent = "Your email app should open now. If it does not, write to " + DATA.email + " directly.";
  location.href = "mailto:" + DATA.email + "?subject=" + encodeURIComponent ("Portfolio message from " + n) + "&body=" + encodeURIComponent (g + "\n\nFrom: " + n + " (" + m + ")")
})
/* init */
reveal ();
var h = location.hash.slice (1);
if (h && h !== "home") go (h, false); else mark ("home");
// Dynamic data is an enhancement; renderStaticContent() has already run above.
initSupabase ();
