/* =====================================================
   Admin Dashboard JavaScript
   Vite Module + ES6 Features
   Integrasi Supabase + RLS
   ===================================================== */

import { initSupabase, checkAdminStatus } from "./src/lib/supabase-client.js";

// --- Global state ---
let adminLoggedIn = false;
let editMode = false;
let editId = null;
let currentSection = "homeSettings";
let supabaseAdmin = null;

// --- Helpers ---
function uuidv4() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function resetFields(ids) {
  ids.forEach((id) => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });
}

// --- DOM Elements ---
const authPage = document.getElementById("authPage");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const authNotice = document.getElementById("authNotice");
const toastEl = document.getElementById("toast");
const sections = document.querySelectorAll(".section");
const navLinks = document.querySelectorAll(".nav-link");

function showAuthNotice(message, type = "info") {
  if (!authNotice) return;
  authNotice.textContent = message;
  authNotice.className = "auth-notice" + (type === "error" ? " error" : "");
  authNotice.hidden = !message;
}

// --- Toast helper ---
function showToast(message, type = "success") {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = `toast ${type} show`;
  setTimeout(() => {
    toastEl.className = toastEl.className.replace("show", "");
  }, 5000);
}

// --- Section status (loading / empty / error) ---
function setSectionStatus(sectionId, message, isError = false) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  let el = section.querySelector(".section-status");
  if (!message) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("p");
    el.className = "section-status";
    const heading = section.querySelector("h1");
    if (heading) heading.insertAdjacentElement("afterend", el);
    else section.prepend(el);
  }
  el.textContent = message;
  el.classList.toggle("error", isError);
}

// --- Auth helpers ---
async function loginAdmin(email, password) {
  if (!supabaseAdmin) {
    showAuthNotice("Login admin belum tersedia karena Supabase belum dikonfigurasi. Hubungi pemilik situs.", "info");
    return false;
  }
  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    adminLoggedIn = true;
    showAuthNotice("");
    updateAuthUI();
    loadInitialData();
    return true;
  } catch (err) {
    console.warn("Login failed:", err?.message || err);
    showToast("Login gagal: " + (err?.message || "Email/password salah"), "error");
    return false;
  }
}

async function logoutAdmin(showMessage = true) {
  try {
    if (supabaseAdmin) {
      console.info("[Auth diagnostic] signOut called", { source: "admin.js: logoutAdmin" });
      await supabaseAdmin.auth.signOut();
    }
  } catch (err) {
    console.warn("Logout error:", err?.message || err);
  }
  adminLoggedIn = false;
  updateAuthUI();
  if (showMessage) showToast("Berhasil logout");
}

function updateAuthUI() {
  showAuthNotice("");
  loginForm.style.visibility = "";
  if (adminLoggedIn) {
    authPage.style.display = "none";
    dashboard.style.display = "block";
    // Set username if available
    const userNameEl = document.getElementById("userName");
    if (userNameEl) userNameEl.textContent = "Admin";
  } else {
    authPage.style.display = "flex";
    dashboard.style.display = "none";
  }
}

// --- Section navigation ---
function showSection(sectionId) {
  // Update nav links
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.section === sectionId);
  });

  // Show/hide sections
  sections.forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  currentSection = sectionId;

  // Load data for the section
  loadSectionData(sectionId);
}

// --- Data loading ---
async function loadInitialData() {
  // Load all data on login
  await loadSectionData("homeSettings");
  // Also load others so they're ready
  for (const sec of ["cv", "experience", "projects", "certificates", "skills"]) {
    await loadSectionData(sec);
  }
}

async function loadSectionData(sectionId) {
  if (!adminLoggedIn) return;
  setSectionStatus(sectionId, "Memuat data...");
  try {
    let keepStatus = false;
    switch (sectionId) {
      case "homeSettings":
        keepStatus = await loadHomeSettings();
        break;
      case "cv":
        await loadCV();
        break;
      case "experience":
        await loadExperiences();
        break;
      case "projects":
        await loadProjects();
        break;
      case "certificates":
        await loadCertificates();
        break;
      case "skills":
        await loadSkills();
        break;
    }
    if (!keepStatus) setSectionStatus(sectionId, "");
  } catch (err) {
    const message = err?.message || "Terjadi kesalahan yang tidak diketahui";
    console.error(`Gagal load section ${sectionId}:`, err);
    setSectionStatus(sectionId, `Gagal memuat data: ${message}`, true);
    showToast(`Gagal memuat data: ${message}`, "error");
  }
}

// --- Home Settings ---
async function loadHomeSettings() {
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    setSectionStatus("homeSettings", "Belum ada pengaturan situs di database. Form di bawah masih kosong.");
    return true;
  }

  // Populate form fields
  document.getElementById("siteFullName").value = data.full_name || "";
  document.getElementById("siteHeadline").value = data.headline || "";
  document.getElementById("siteIntro").value = data.intro || "";
  document.getElementById("siteLocation").value = data.location || "";
  document.getElementById("siteEmail").value = data.email || "";
  document.getElementById("siteGitHub").value = data.github_url || "";
  document.getElementById("siteLinkedIn").value = data.linkedin_url || "";

  // Handle profile image
  if (data.profile_image_path) {
    const imgEl = document.getElementById("profileImagePreviewContent");
    imgEl.src = supabaseAdmin.storage.from("portfolio-public").getPublicUrl(data.profile_image_path).data.publicUrl;
    document.getElementById("profileImagePreviewBox").style.display = "block";
    document.getElementById("profileImageFileName").textContent = "Foto sudah ada";
  } else {
    document.getElementById("profileImagePreviewContent").src = "";
    document.getElementById("profileImagePreviewBox").style.display = "none";
    document.getElementById("profileImageFileName").textContent = "Belum ada foto";
  }
}

// --- CV / Resume ---
async function loadCV() {
  const { data, error } = await supabaseAdmin
    .from("resumes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const { data: settings } = await supabaseAdmin
    .from("site_settings")
    .select("active_cv_id")
    .eq("id", 1)
    .maybeSingle();

  const activeCvId = settings?.active_cv_id || null;
  const activeCvSelect = document.getElementById("activeCvSelect");
  activeCvSelect.innerHTML = '<option value="">-- Pilih CV Aktif --</option>';

  const cvList = document.getElementById("cvList");
  cvList.innerHTML = "";

  if (data && data.length > 0) {
    data.forEach((cv, i) => {
      const isActive = cv.id === activeCvId;
      const opt = document.createElement("option");
      opt.value = cv.id;
      opt.dataset.path = cv.storage_path;
      opt.textContent = cv.original_file_name || `CV ${i + 1}`;
      if (isActive) opt.selected = true;
      activeCvSelect.appendChild(opt);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${cv.original_file_name || "Tanpa nama"}</td>
        <td>${new Date(cv.created_at).toLocaleDateString()}</td>
        <td>${isActive ? "<strong>Aktif</strong>" : "Tidak Aktif"}</td>
        <td>
          <button class="admin-action-btn" data-cv-path="${cv.storage_path}" data-action="download">Buka</button>
          <button class="admin-action-btn delete" data-cv-id="${cv.id}" data-cv-path="${cv.storage_path}">Hapus</button>
        </td>
      `;
      cvList.appendChild(tr);
    });
  } else {
    cvList.innerHTML = `<tr><td colspan="4" class="admin-empty">Belum ada CV tersimpan. Unggah CV pertama.</td></tr>`;
  }

  // Store for later use
  window.activeCvId = activeCvId;
}

// --- Experience ---
async function loadExperiences() {
  const { data, error } = await supabaseAdmin
    .from("experiences")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const tbody = document.getElementById("expList");
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Belum ada data pengalaman. Tambah pengalaman pertama.</td></tr>`;
    return;
  }

  data.forEach((exp, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${exp.title || "-"}</td>
      <td>${exp.company || "-"}</td>
      <td>${exp.type || "-"}</td>
      <td>${exp.period || "Tidak diketahui"}</td>
      <td>${exp.is_public ? "Publik" : "Draft"}</td>
      <td>
        <button class="admin-action-btn" data-exp-id="${exp.id}" data-action="edit">Edit</button>
        <button class="admin-action-btn delete" data-exp-id="${exp.id}" style="margin-left:8px">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Projects ---
async function loadProjects() {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const tbody = document.getElementById("projList");
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">Belum ada proyek. Tambah proyek pertama.</td></tr>`;
    return;
  }

  data.forEach((proj) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${proj.title || "-"}</td>
      <td>${(proj.tech || []).join(", ") || "-"}</td>
      <td><a target="_blank" href="${proj.demo_url || "#"}">Demo</a></td>
      <td>${proj.is_public ? "Publik" : "Draft"}</td>
      <td>
        <button class="admin-action-btn" data-proj-id="${proj.id}" data-action="edit">Edit</button>
        <button class="admin-action-btn delete" data-proj-id="${proj.id}" style="margin-left:8px">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Certificates ---
async function loadCertificates() {
  const { data, error } = await supabaseAdmin
    .from("certificates")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const tbody = document.getElementById("certList");
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">Belum ada sertifikat. Tambah sertifikat pertama.</td></tr>`;
    return;
  }

  data.forEach((cert) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cert.title || "-"}</td>
      <td>${cert.issuer || "-"}</td>
      <td>${cert.issued_on ? new Date(cert.issued_on).toLocaleDateString() : "Tidak ada"}</td>
      <td><a target="_blank" href="${cert.verification_url || "#"}">Verify</a></td>
      <td>
        <button class="admin-action-btn" data-cert-id="${cert.id}" data-action="edit">Edit</button>
        <button class="admin-action-btn delete" data-cert-id="${cert.id}" style="margin-left:8px">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Skills ---
async function loadSkills() {
  const { data, error } = await supabaseAdmin
    .from("skills")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const tbody = document.getElementById("skillList");
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">Belum ada skill. Tambah skill pertama.</td></tr>`;
    return;
  }

  data.forEach((skill) => {
    const tr = document.createElement("tr");
    let iconHtml = "-";
    if (skill.icon_path && supabaseAdmin && supabaseAdmin.storage) {
      const publicUrl = supabaseAdmin.storage
        .from("portfolio-public")
        .getPublicUrl(skill.icon_path).data.publicUrl;
      iconHtml = `<img src="${publicUrl}" alt="${skill.name}" style="width:32px;height:32px;border-radius:4px;">`;
    }
    tr.innerHTML = `
      <td>${skill.name || "-"}</td>
      <td>${skill.category || "-"}</td>
      <td>${iconHtml}</td>
      <td>${skill.sort_order || 0}</td>
      <td>
        <button class="admin-action-btn" data-skill-id="${skill.id}" data-action="edit">Edit</button>
        <button class="admin-action-btn delete" data-skill-id="${skill.id}" style="margin-left:8px">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Form submission handlers ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  await loginAdmin(email, password);
});

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const section = link.dataset.section;
    showSection(section);
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  logoutAdmin();
});

function validOptionalUrl(value, label) {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return true;
  } catch {
    showToast(`${label} harus berupa URL http:// atau https:// yang valid`, "error");
    return false;
  }
}

async function withButtonLoading(button, action) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Menyimpan...";
  try {
    await action();
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

// Home Settings form
document.getElementById("saveHomeBtn").addEventListener("click", async () => {
  const button = document.getElementById("saveHomeBtn");
  const fullName = document.getElementById("siteFullName").value.trim();
  const email = document.getElementById("siteEmail").value.trim();
  const github = document.getElementById("siteGitHub").value.trim() || document.getElementById("socialGitHub").value.trim();
  const linkedin = document.getElementById("siteLinkedIn").value.trim() || document.getElementById("socialLinkedIn").value.trim();

  if (!fullName) {
    showToast("Nama lengkap wajib diisi", "error");
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Email tidak valid", "error");
    return;
  }
  if (!validOptionalUrl(github, "URL GitHub") || !validOptionalUrl(linkedin, "URL LinkedIn")) return;

  await withButtonLoading(button, async () => {
    const payload = {
      id: 1,
      full_name: fullName,
      headline: document.getElementById("siteHeadline").value.trim() || null,
      intro: document.getElementById("siteIntro").value.trim() || null,
      location: document.getElementById("siteLocation").value.trim() || null,
      email: email || null,
      github_url: github || null,
      linkedin_url: linkedin || null,
    };
    const { error } = await supabaseAdmin.from("site_settings").upsert(payload, { onConflict: "id" });
    if (error) throw error;
    document.getElementById("socialGitHub").value = github;
    document.getElementById("socialLinkedIn").value = linkedin;
    showToast("Home Settings berhasil disimpan");
    await loadHomeSettings();
  }).catch((err) => {
    showToast("Gagal menyimpan Home Settings: " + (err?.message || err), "error");
  });
});

// Handle profile image upload
document.getElementById("profileImageInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!supabaseAdmin) {
    showToast("Supabase belum dikonfigurasi", "error");
    return;
  }

  const path = "profiles/" + uuidv4();
  const { error } = await supabaseAdmin.storage
    .from("portfolio-public")
    .upload(path, file, { upsert: true });

  if (error) {
    showToast("Gagal mengunggah foto: " + error.message, "error");
    return;
  }

  // Update site_settings with new image path
  const { error: updateError } = await supabaseAdmin
    .from("site_settings")
    .update({ profile_image_path: path, profile_image_alt: file.name })
    .eq("id", 1);

  if (updateError) {
    showToast("Foto terunggah, tetapi profil gagal diperbarui: " + updateError.message, "error");
    return;
  }

  showToast("Foto profil berhasil diunggah");
  loadHomeSettings();
});

// Handle CV upload
document.getElementById("cvFileInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!supabaseAdmin) {
    showToast("Supabase belum dikonfigurasi", "error");
    return;
  }

  // Validate PDF
  if (!file.type || file.type !== "application/pdf") {
    showToast("Hanya file PDF yang diizinkan", "error");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast("Ukuran file terlalu besar (max 10MB)", "error");
    return;
  }

  const storagePath = "cv/" + uuidv4();
  const { error } = await supabaseAdmin.storage
    .from("portfolio-documents")
    .upload(storagePath, file, { upsert: true });

  if (error) {
    showToast("Gagal mengunggah CV: " + error.message, "error");
    return;
  }

  // Save to resumes table
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("resumes")
    .insert({
      storage_path: storagePath,
      original_file_name: file.name,
      mime_type: "application/pdf",
      size_bytes: file.size,
    })
    .select("id")
    .single();

  if (insertError) {
    showToast("CV terunggah, tetapi data gagal disimpan: " + insertError.message, "error");
    return;
  }

  // Set as active if this is the first one
  const { data: existing } = await supabaseAdmin
    .from("site_settings")
    .select("active_cv_id")
    .eq("id", 1)
    .maybeSingle();

  if (!existing?.active_cv_id) {
    await supabaseAdmin
      .from("site_settings")
      .update({ active_cv_id: inserted.id })
      .eq("id", 1);
  }

  showToast("CV berhasil diunggah dan aktif");
  loadCV();
});

// Handle active CV change
document.getElementById("activeCvSelect").addEventListener("change", async (e) => {
  const cvId = e.target.value;
  if (!cvId) return;

  await supabaseAdmin
    .from("site_settings")
    .update({ active_cv_id: cvId })
    .eq("id", 1);

  showToast("CV aktif diperbarui");
  loadCV();
});

// Handle delete CV (delegated for rows + global active delete)
document.getElementById("cvList").addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest(".admin-action-btn.delete");
  if (!deleteBtn) return;

  if (!confirm("Yakin menghapus CV ini?")) return;

  const cvId = deleteBtn.dataset.cvId;
  const cvPath = deleteBtn.dataset.cvPath;

  // Remove from storage
  await supabaseAdmin.storage
    .from("portfolio-documents")
    .remove([cvPath]);

  // Remove from DB
  await supabaseAdmin.from("resumes").delete().eq("id", cvId);

  // Update if it was active
  await supabaseAdmin.from("site_settings").update({ active_cv_id: null }).eq("active_cv_id", cvId);

  showToast("CV berhasil dihapus");
  loadCV();
});

// Experience form
document.getElementById("addExperienceBtn").addEventListener("click", async () => {
  const button = document.getElementById("addExperienceBtn");
  const editId = button.dataset.editId;

  const type = document.getElementById("expType").value;
  const title = document.getElementById("expTitle").value.trim();
  const company = document.getElementById("expCompany").value.trim();
  const periodStart = document.getElementById("expPeriodStart").value.trim();
  const periodEnd = document.getElementById("expPeriodEnd").value.trim();
  const period = periodStart ? (periodEnd ? `${periodStart} – ${periodEnd}` : periodStart) : null;
  const description = document.getElementById("expDescription").value.trim();
  const isPublic = document.getElementById("expIsPublic").value === "true";
  const sortOrder = parseInt(document.getElementById("expSortOrder").value) || 0;

  if (!title || !company) {
    showToast("Jabatan dan perusahaan wajib diisi", "error");
    return;
  }

  await withButtonLoading(button, async () => {
    const payload = { type, title, company, period, description, highlights: [], sort_order: sortOrder, is_public: isPublic };

    if (editId) {
      const { data: existing } = await supabaseAdmin.from("experiences").select("highlights").eq("id", editId).single();
      payload.highlights = existing?.highlights || [];
      const { error } = await supabaseAdmin.from("experiences").update(payload).eq("id", editId);
      if (error) throw error;
      showToast("Pengalaman berhasil diperbarui");
      delete button.dataset.editId;
      button.textContent = "Simpan Pengalaman";
    } else {
      const { error } = await supabaseAdmin.from("experiences").insert(payload);
      if (error) throw error;
      showToast("Pengalaman berhasil disimpan");
    }

    resetFields(["expTitle", "expCompany", "expPeriodStart", "expPeriodEnd", "expDescription", "expSortOrder"]);
    loadExperiences();
  }).catch(err => {
    showToast("Gagal menyimpan: " + (err?.message || err), "error");
  });
});

async function uploadFile(file, folder, bucket = "portfolio-public") {
  if (!supabaseAdmin) throw new Error("Supabase client belum siap");
  const ext = file.name.split('.').pop();
  const path = `${folder}/${uuidv4()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

// --- Image upload state ---
let pendingProjectImage = null;
let pendingCertImage = null;
let pendingSkillIcon = null;

document.getElementById("projImageInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!supabaseAdmin) { showToast("Supabase belum dikonfigurasi", "error"); return; }
  if (!file.type.startsWith("image/")) { showToast("Hanya file gambar yang diizinkan", "error"); return; }
  try {
    pendingProjectImage = await uploadFile(file, "projects");
    showToast("Gambar proyek siap disimpan");
    document.getElementById("projImageFileName").textContent = file.name;
  } catch (err) {
    showToast("Gagal mengunggah gambar: " + (err?.message || err), "error");
  }
});

document.getElementById("certImageInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!supabaseAdmin) { showToast("Supabase belum dikonfigurasi", "error"); return; }
  if (!file.type.startsWith("image/")) { showToast("Hanya file gambar yang diizinkan", "error"); return; }
  try {
    pendingCertImage = await uploadFile(file, "certificates");
    showToast("Gambar sertifikat siap disimpan");
    document.getElementById("certImageFileName").textContent = file.name;
  } catch (err) {
    showToast("Gagal mengunggah gambar: " + (err?.message || err), "error");
  }
});

document.getElementById("skillIconInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!supabaseAdmin) { showToast("Supabase belum dikonfigurasi", "error"); return; }
  if (!file.type.startsWith("image/")) { showToast("Hanya file gambar yang diizinkan", "error"); return; }
  try {
    pendingSkillIcon = await uploadFile(file, "skills");
    showToast("Ikon skill siap disimpan");
    document.getElementById("skillIconPreview").src = URL.createObjectURL(file);
  } catch (err) {
    showToast("Gagal mengunggah ikon: " + (err?.message || err), "error");
  }
});

// Project form
document.getElementById("addProjectBtn").addEventListener("click", async () => {
  const button = document.getElementById("addProjectBtn");
  const editId = button.dataset.editId;

  const title = document.getElementById("projTitle").value.trim();
  const desc = document.getElementById("projDesc").value.trim();
  const tech = document.getElementById("projTech").value.trim();
  const demo = document.getElementById("projDemo").value.trim();
  const repo = document.getElementById("projRepo").value.trim();
  const role = document.getElementById("projRole").value.trim();
  const sortOrder = parseInt(document.getElementById("projSortOrder").value) || 0;
  const isPublic = true;

  if (!title) {
    showToast("Judul proyek wajib diisi", "error");
    return;
  }

  if (!validOptionalUrl(demo, "URL Demo") || !validOptionalUrl(repo, "URL Repository")) return;

  const techArray = tech ? tech.split(",").map((t) => t.trim()).filter((t) => t) : [];

  await withButtonLoading(button, async () => {
    const payload = { title, description: desc, category: null, role, image_path: pendingProjectImage, tech: techArray, demo_url: demo || null, repo_url: repo || null, sort_order: sortOrder, is_public: isPublic };

    if (editId) {
      // On edit, keep existing image if no new one
      if (!pendingProjectImage) {
        const { data: existing } = await supabaseAdmin.from("projects").select("image_path").eq("id", editId).single();
        payload.image_path = existing?.image_path || null;
      }
      const { error } = await supabaseAdmin.from("projects").update(payload).eq("id", editId);
      if (error) throw error;
      showToast("Proyek berhasil diperbarui");
      delete button.dataset.editId;
      button.textContent = "Simpan Proyek";
    } else {
      const { error } = await supabaseAdmin.from("projects").insert(payload);
      if (error) throw error;
      showToast("Proyek berhasil disimpan");
    }

    pendingProjectImage = null;
    resetFields(["projTitle", "projDesc", "projTech", "projDemo", "projRepo", "projRole", "projSortOrder"]);
    document.getElementById("projImageFileName").textContent = "Belum ada gambar";
    document.getElementById("projImagePreviewContent").src = "";
    document.getElementById("projImagePreviewBox").style.display = "none";
    loadProjects();
  }).catch(err => {
    showToast("Gagal menyimpan: " + (err?.message || err), "error");
  });
});

// Certificate form
document.getElementById("addCertificateBtn").addEventListener("click", async () => {
  const button = document.getElementById("addCertificateBtn");
  const editId = button.dataset.editId;

  const title = document.getElementById("certTitle").value.trim();
  const issuer = document.getElementById("certIssuer").value.trim();
  const date = document.getElementById("certDate").value.trim();
  const verification = document.getElementById("certVerification").value.trim();
  const sortOrder = parseInt(document.getElementById("certSortOrder").value) || 0;
  const isPublic = true;

  if (!title) {
    showToast("Nama sertifikat wajib diisi", "error");
    return;
  }

  if (!validOptionalUrl(verification, "URL Verifikasi")) return;

  await withButtonLoading(button, async () => {
    const payload = { title, issuer, issued_on: date ? new Date(date) : null, validity_note: null, image_path: pendingCertImage, file_path: null, verification_url: verification || null, sort_order: sortOrder, is_public: isPublic };

    if (editId) {
      if (!pendingCertImage) {
        const { data: existing } = await supabaseAdmin.from("certificates").select("image_path").eq("id", editId).single();
        payload.image_path = existing?.image_path || null;
      }
      const { error } = await supabaseAdmin.from("certificates").update(payload).eq("id", editId);
      if (error) throw error;
      showToast("Sertifikat berhasil diperbarui");
      delete button.dataset.editId;
      button.textContent = "Simpan Sertifikat";
    } else {
      const { error } = await supabaseAdmin.from("certificates").insert(payload);
      if (error) throw error;
      showToast("Sertifikat berhasil disimpan");
    }

    pendingCertImage = null;
    resetFields(["certTitle", "certIssuer", "certDate", "certVerification", "certSortOrder"]);
    document.getElementById("certImageFileName").textContent = "Belum ada gambar";
    document.getElementById("certImagePreviewContent").src = "";
    document.getElementById("certImagePreviewBox").style.display = "none";
    loadCertificates();
  }).catch(err => {
    showToast("Gagal menyimpan: " + (err?.message || err), "error");
  });
});

// Skill form
document.getElementById("addSkillBtn").addEventListener("click", async () => {
  const button = document.getElementById("addSkillBtn");
  const editId = button.dataset.editId;

  const name = document.getElementById("skillName").value.trim();
  const category = document.getElementById("skillCategory").value.trim();
  const sortOrder = parseInt(document.getElementById("skillSortOrder").value) || 0;

  if (!name || !category) {
    showToast("Nama skill dan kategori wajib diisi", "error");
    return;
  }

  await withButtonLoading(button, async () => {
    const payload = { name, category, icon_path: pendingSkillIcon, sort_order: sortOrder, is_public: true };

    if (editId) {
      if (!pendingSkillIcon) {
        const { data: existing } = await supabaseAdmin.from("skills").select("icon_path").eq("id", editId).single();
        payload.icon_path = existing?.icon_path || null;
      }
      const { error } = await supabaseAdmin.from("skills").update(payload).eq("id", editId);
      if (error) throw error;
      showToast("Skill berhasil diperbarui");
      delete button.dataset.editId;
      button.textContent = "Simpan Skill";
    } else {
      const { error } = await supabaseAdmin.from("skills").insert(payload);
      if (error) throw error;
      showToast("Skill berhasil disimpan");
    }

    pendingSkillIcon = null;
    resetFields(["skillName", "skillCategory", "skillSortOrder"]);
    document.getElementById("skillIconPreview").src = "";
    loadSkills();
  }).catch(err => {
    showToast("Gagal menyimpan: " + (err?.message || err), "error");
  });
});

// Delete and edit handlers (delegated)
document.getElementById("expList").addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".admin-action-btn[data-action='edit']");
  if (editBtn) {
    const expId = editBtn.dataset.expId;
    const { data, error } = await supabaseAdmin.from("experiences").select("*").eq("id", expId).single();
    if (error) { showToast("Gagal memuat data: " + error.message, "error"); return; }

    // Populate form with existing data
    document.getElementById("expTitle").value = data.title || "";
    document.getElementById("expCompany").value = data.company || "";
    document.getElementById("expType").value = data.type || "Employment";
    document.getElementById("expIsPublic").value = data.is_public ? "true" : "false";
    document.getElementById("expDescription").value = data.description || "";
    document.getElementById("expSortOrder").value = data.sort_order || 0;

    // Parse period into start/end
    if (data.period) {
      const parts = data.period.split(/[–—-]/).map(p => p.trim());
      document.getElementById("expPeriodStart").value = parts[0] || "";
      document.getElementById("expPeriodEnd").value = parts.slice(1).join(" – ") || "";
    }

    // Scroll to form
    document.getElementById("addExperienceBtn").scrollIntoView({ behavior: "smooth" });
    document.getElementById("addExperienceBtn").textContent = "Perbarui Pengalaman";
    document.getElementById("addExperienceBtn").dataset.editId = expId;
    return;
  }

  const deleteBtn = e.target.closest(".admin-action-btn.delete");
  if (!deleteBtn) return;

  const expId = deleteBtn.dataset.expId;
  if (!confirm("Yakin menghapus pengalaman ini?")) return;

  await supabaseAdmin.from("experiences").delete().eq("id", expId);
  showToast("Pengalaman dihapus");
  loadExperiences();
});

document.getElementById("projList").addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".admin-action-btn[data-action='edit']");
  if (editBtn) {
    const projId = editBtn.dataset.projId;
    const { data, error } = await supabaseAdmin.from("projects").select("*").eq("id", projId).single();
    if (error) { showToast("Gagal memuat data: " + error.message, "error"); return; }

    document.getElementById("projTitle").value = data.title || "";
    document.getElementById("projDesc").value = data.description || "";
    document.getElementById("projTech").value = Array.isArray(data.tech) ? data.tech.join(", ") : "";
    document.getElementById("projDemo").value = data.demo_url || "";
    document.getElementById("projRepo").value = data.repo_url || "";
    document.getElementById("projRole").value = data.role || "";
    document.getElementById("projSortOrder").value = data.sort_order || 0;
    if (data.image_path) {
      const url = supabaseAdmin.storage.from("portfolio-public").getPublicUrl(data.image_path).data.publicUrl;
      document.getElementById("projImagePreviewContent").src = url;
      document.getElementById("projImagePreviewBox").style.display = "block";
      document.getElementById("projImageFileName").textContent = "Gambar sudah ada";
    }

    document.getElementById("addProjectBtn").scrollIntoView({ behavior: "smooth" });
    document.getElementById("addProjectBtn").textContent = "Perbarui Proyek";
    document.getElementById("addProjectBtn").dataset.editId = projId;
    return;
  }

  const deleteBtn = e.target.closest(".admin-action-btn.delete");
  if (!deleteBtn) return;

  const projId = deleteBtn.dataset.projId;
  if (!confirm("Yakin menghapus proyek ini?")) return;

  await supabaseAdmin.from("projects").delete().eq("id", projId);
  showToast("Proyek dihapus");
  loadProjects();
});

document.getElementById("certList").addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".admin-action-btn[data-action='edit']");
  if (editBtn) {
    const certId = editBtn.dataset.certId;
    const { data, error } = await supabaseAdmin.from("certificates").select("*").eq("id", certId).single();
    if (error) { showToast("Gagal memuat data: " + error.message, "error"); return; }

    document.getElementById("certTitle").value = data.title || "";
    document.getElementById("certIssuer").value = data.issuer || "";
    document.getElementById("certDate").value = data.issued_on || "";
    document.getElementById("certVerification").value = data.verification_url || "";
    document.getElementById("certSortOrder").value = data.sort_order || 0;
    if (data.image_path) {
      const url = supabaseAdmin.storage.from("portfolio-public").getPublicUrl(data.image_path).data.publicUrl;
      document.getElementById("certImagePreviewContent").src = url;
      document.getElementById("certImagePreviewBox").style.display = "block";
      document.getElementById("certImageFileName").textContent = "Gambar sudah ada";
    }

    document.getElementById("addCertificateBtn").scrollIntoView({ behavior: "smooth" });
    document.getElementById("addCertificateBtn").textContent = "Perbarui Sertifikat";
    document.getElementById("addCertificateBtn").dataset.editId = certId;
    return;
  }

  const deleteBtn = e.target.closest(".admin-action-btn.delete");
  if (!deleteBtn) return;

  const certId = deleteBtn.dataset.certId;
  if (!confirm("Yakin menghapus sertifikat ini?")) return;

  await supabaseAdmin.from("certificates").delete().eq("id", certId);
  showToast("Sertifikat dihapus");
  loadCertificates();
});

document.getElementById("skillList").addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".admin-action-btn[data-action='edit']");
  if (editBtn) {
    const skillId = editBtn.dataset.skillId;
    const { data, error } = await supabaseAdmin.from("skills").select("*").eq("id", skillId).single();
    if (error) { showToast("Gagal memuat data: " + error.message, "error"); return; }

    document.getElementById("skillName").value = data.name || "";
    document.getElementById("skillCategory").value = data.category || "";
    document.getElementById("skillSortOrder").value = data.sort_order || 0;
    if (data.icon_path) {
      const url = supabaseAdmin.storage.from("portfolio-public").getPublicUrl(data.icon_path).data.publicUrl;
      document.getElementById("skillIconPreview").src = url;
    }

    document.getElementById("addSkillBtn").scrollIntoView({ behavior: "smooth" });
    document.getElementById("addSkillBtn").textContent = "Perbarui Skill";
    document.getElementById("addSkillBtn").dataset.editId = skillId;
    return;
  }

  const deleteBtn = e.target.closest(".admin-action-btn.delete");
  if (!deleteBtn) return;

  const skillId = deleteBtn.dataset.skillId;
  if (!confirm("Yakin menghapus skill ini?")) return;

  await supabaseAdmin.from("skills").delete().eq("id", skillId);
  showToast("Skill dihapus");
  loadSkills();
});

// Initialize on load
async function initAuth() {
  console.info("[Auth diagnostic] initAuth started", {
    url: window.location.href,
    localStorageKeys: Object.keys(localStorage).filter(k => k.includes("auth") || k.includes("sb")),
  });

  // Jangan tampilkan form login sebelum pemeriksaan sesi selesai.
  loginForm.style.visibility = "hidden";
  authPage.style.display = "flex";
  dashboard.style.display = "none";
  showAuthNotice("Memeriksa sesi login...", "info");

  // Initialize Supabase client
  try {
    supabaseAdmin = await initSupabase();
  } catch (err) {
    console.warn("Supabase init error:", err?.message || err);
    supabaseAdmin = null;
  }

  if (!supabaseAdmin) {
    updateAuthUI();
    showAuthNotice("Login admin belum tersedia karena Supabase belum dikonfigurasi. Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY saat build, lalu buka halaman ini kembali.", "info");
    return;
  }

  try {
    // Pulihkan sesi tersimpan lalu validasi akses admin.
    const status = await checkAdminStatus(supabaseAdmin);
    console.info("[Auth diagnostic] initAuth status result", status);

    if (status.isAdmin) {
      adminLoggedIn = true;
      updateAuthUI();
      loadInitialData();
      return;
    }

    if (status.isAuthenticated) {
      if (status.error) {
        // Sesi masih ada tetapi status admin gagal diverifikasi.
        // Jangan hapus sesi yang valid; beri pesan agar pengguna bisa mencoba lagi.
        updateAuthUI();
        showAuthNotice(
          `Sesi login masih tersimpan, tetapi status admin tidak dapat diverifikasi: ${status.error.message || status.error}. Muat ulang halaman untuk mencoba lagi.`,
          "error"
        );
        return;
      }

      // Terautentikasi tetapi query berhasil dan UID tidak ditemukan.
      // Jangan hapus sesi; tetap tolak akses dashboard dan tampilkan pesan.
      updateAuthUI();
      showAuthNotice("Akun ini tidak terdaftar sebagai admin", "error");
      return;
    }

    // Tidak ada sesi tersimpan.
    updateAuthUI();
    if (status.error) {
      showAuthNotice(`Gagal memeriksa sesi login: ${status.error.message || status.error}. Muat ulang halaman untuk mencoba lagi.`, "error");
    }
  } catch (err) {
    updateAuthUI();
    showAuthNotice(`Gagal memeriksa sesi login: ${err?.message || err}. Muat ulang halaman untuk mencoba lagi.`, "error");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuth);
} else {
  initAuth();
}