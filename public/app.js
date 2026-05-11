const baseInput = document.querySelector("#baseInput");
const inspoInput = document.querySelector("#inspoInput");
const baseZone = document.querySelector("[data-zone='base']");
const inspoZone = document.querySelector("[data-zone='inspo']");
const basePreview = document.querySelector("#basePreview");
const inspoPreview = document.querySelector("#inspoPreview");
const promptField = document.querySelector("#prompt");
const countInputs = Array.from(
  document.querySelectorAll("input[name='count']"),
);
const generateBtn = document.querySelector("#generate");
const statusLine = document.querySelector("#status");
const resultsGrid = document.querySelector("#resultsGrid");
const statusDetails = document.querySelector("#statusDetails");

const previewModal = document.querySelector("#previewModal");
const previewImage = document.querySelector("#previewImage");
const refineModal = document.querySelector("#refineModal");
const refineImage = document.querySelector("#refineImage");
const refinePrompt = document.querySelector("#refinePrompt");
const refineGenerate = document.querySelector("#refineGenerate");
const navToggle = document.querySelector("#navToggle");
const navRail = document.querySelector(".nav-rail");
const navDrawer = document.querySelector("#navDrawer");
const projectList = null;
const newProjectBtn = null;
const galleryBtn = null;
const galleryGrid = null;
const galleryEmpty = null;
const galleryLoadMore = null;
const gallerySearch = null;
const gallerySort = null;
const totalImagesEl = null;
const authView = document.querySelector("#authView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginStatus = document.querySelector("#loginStatus");
const logoutBtn = document.querySelector("#logoutBtn");
const userEmail = document.querySelector("#userEmail");
const userRole = document.querySelector("#userRole");
const adminPanel = document.querySelector("#adminPanel");
const adminCreateForm = document.querySelector("#adminCreateForm");
const adminEmail = document.querySelector("#adminEmail");
const adminPassword = document.querySelector("#adminPassword");
const adminRole = document.querySelector("#adminRole");
const adminStatus = document.querySelector("#adminStatus");
const adminUsers = document.querySelector("#adminUsers");
const adminNavGroup = document.querySelector("#adminNavGroup");
const adminUsersNavBtn = document.querySelector("#adminUsersNavBtn");
const adminUsageNavBtn = document.querySelector("#adminUsageNavBtn");
const importFile = document.querySelector("#importFile");
const importFileName = document.querySelector("#importFileName");
const importBtn = document.querySelector("#importBtn");
const importProgress = document.querySelector("#importProgress");
const importProgressFill = document.querySelector("#importProgressFill");
const importProgressText = document.querySelector("#importProgressText");
const importResults = document.querySelector("#importResults");
const forcePasswordModal = document.querySelector("#forcePasswordModal");
const forcePasswordForm = document.querySelector("#forcePasswordForm");
const forceNewPasswordInput = document.querySelector("#forceNewPassword");
const forceConfirmPasswordInput = document.querySelector("#forceConfirmPassword");
const forcePasswordError = document.querySelector("#forcePasswordError");
const adminUserSearch = document.querySelector("#adminUserSearch");
const adminUserCount = document.querySelector("#adminUserCount");
const usagePeriod = document.querySelector("#usagePeriod");
const usageUserFilter = document.querySelector("#usageUserFilter");
const usageRefresh = document.querySelector("#usageRefresh");
const usageTotalCost = document.querySelector("#usageTotalCost");
const usageTotalCalls = document.querySelector("#usageTotalCalls");
const usageTotalImages = document.querySelector("#usageTotalImages");
const usageSuccessRate = document.querySelector("#usageSuccessRate");
const usageAvgDay = document.querySelector("#usageAvgDay");
const usageDailyChart = document.querySelector("#usageDailyChart");
const usageDetailTitle = document.querySelector("#usageDetailTitle");
const usageDetailTable = document.querySelector("#usageDetailTable");
const monthlyCostEl = document.querySelector("#monthlyCost");
const viewButtons = Array.from(document.querySelectorAll("[data-view-target]"));
const appViews = Array.from(document.querySelectorAll(".app-view"));
const deleteProjectModal = null;
const deleteProjectNameEl = null;
const confirmDeleteProjectBtn = null;
const passwordModal = document.querySelector("#passwordModal");
const passwordForm = document.querySelector("#passwordForm");
const newPasswordInput = document.querySelector("#newPassword");
const confirmPasswordInput = document.querySelector("#confirmPassword");
const passwordError = document.querySelector("#passwordError");
const changePasswordBtn = document.querySelector("#changePasswordBtn");
const cancelPasswordBtn = document.querySelector("#cancelPasswordBtn");
const redesignNavBtn = document.querySelector("#redesignNavBtn");
const createNavBtn = document.querySelector("#createNavBtn");
const createPromptField = document.querySelector("#createPrompt");
const createInspoInput = document.querySelector("#createInspoInput");
const createInspoZone = document.querySelector("[data-zone='create-inspo']");
const createInspoPreview = document.querySelector("#createInspoPreview");
const createBaseInput = document.querySelector("#createBaseInput");
const createBaseZone = document.querySelector("[data-zone='create-base']");
const createBasePreview = document.querySelector("#createBasePreview");
const createGenerateBtn = document.querySelector("#createGenerate");
const createResultsGrid = document.querySelector("#createResultsGrid");
const createStatusLine = document.querySelector("#createStatus");
const createStatusDetails = document.querySelector("#createStatusDetails");
const createCountInputs = Array.from(
  document.querySelectorAll("input[name='createCount']"),
);
const createRefToggle = document.querySelector("#createRefToggle");
const createRefContainer = document.querySelector("#createRefContainer");
const createMonthlyCostEl = document.querySelector("#createMonthlyCost");
const quotaRemainingEl = document.querySelector("#quotaRemaining");
const createQuotaRemainingEl = document.querySelector("#createQuotaRemaining");
const settingDailyLimit = document.querySelector("#settingDailyLimit");
const settingMonthlyBudget = document.querySelector("#settingMonthlyBudget");
const saveSettingsBtn = document.querySelector("#saveSettingsBtn");
const settingsStatus = document.querySelector("#settingsStatus");
const budgetBarFill = document.querySelector("#budgetBarFill");
const budgetBarLabel = document.querySelector("#budgetBarLabel");

let baseImage = null;
let inspirationImages = [];
let selectedResult = null;
let supabaseClient = null;
let currentSession = null;
let currentProfile = null;
let activeView = "workspace";
let activeMode = "redesign";
let createBaseImage = null;
let createInspirationImages = [];
let currentMonthlyCostEur = 0;

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
    reader.readAsDataURL(file);
  });

const loadImageDimensions = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () =>
      reject(new Error("Impossible de lire les dimensions de l'image."));
    img.src = dataUrl;
  });

const aspectRatioOptions = [
  { label: "1:1", value: 1 },
  { label: "2:3", value: 2 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:3", value: 4 / 3 },
  { label: "4:5", value: 4 / 5 },
  { label: "5:4", value: 5 / 4 },
  { label: "9:16", value: 9 / 16 },
  { label: "16:9", value: 16 / 9 },
  { label: "21:9", value: 21 / 9 },
];

const pickAspectRatio = (width, height) => {
  if (!width || !height) return null;
  const ratio = width / height;
  let best = aspectRatioOptions[0];
  let minDelta = Math.abs(ratio - best.value);

  aspectRatioOptions.forEach((option) => {
    const delta = Math.abs(ratio - option.value);
    if (delta < minDelta) {
      minDelta = delta;
      best = option;
    }
  });

  return best.label;
};

const setAuthStatus = (message = "", type = "") => {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  loginStatus.className = type ? `auth-status ${type}` : "auth-status";
};

const setViewState = (isAuthenticated) => {
  if (authView) authView.hidden = isAuthenticated;
  if (appView) appView.hidden = !isAuthenticated;
};

const authorizedFetch = async (url, options = {}) => {
  const token = currentSession?.access_token;
  if (!token) {
    throw new Error("Session expirée. Merci de vous reconnecter.");
  }
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return fetch(url, { ...options, headers });
};

/** Parse NDJSON text and extract result + call onProgress for progress events. */
const parseNdjson = (text, onProgress) => {
  let result = null;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed);
      if (event.type === "progress" && onProgress) onProgress(event);
      else if (event.type === "result") result = event;
    } catch (_) {}
  }
  return result;
};

/**
 * Reads an NDJSON stream from a generate response.
 * Falls back to reading the full body as text if streaming is unavailable.
 * Includes a 5-minute timeout to prevent infinite loading.
 */
const readGenerateStream = async (response, onProgress) => {
  const TIMEOUT_MS = 5 * 60 * 1000;

  // Fallback: no streaming support — read entire body as text
  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    return parseNdjson(text, onProgress);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
  );

  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (event.type === "progress" && onProgress) onProgress(event);
          else if (event.type === "result") result = event;
        } catch (_) {}
      }
    }

    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim());
        if (event.type === "result") result = event;
      } catch (_) {}
    }
  } catch (err) {
    try { reader.cancel(); } catch (_) {}
    if (err.message === "timeout") return null;
    throw err;
  }

  return result;
};

const formatProgressMessage = (event) => {
  if (event.event === "variant") {
    return `Génération de la variante ${event.index}/${event.total}...`;
  }
  if (event.event === "retry") {
    const label = event.variantIndex ? `variante ${event.variantIndex}/${event.variantTotal}` : "image";
    return `Erreur API (${event.status}), nouvelle tentative ${event.attempt}/${event.maxAttempts} pour ${label}...`;
  }
  if (event.event === "fallback" || event.event === "model-fallback") {
    return "Modèle principal indisponible, basculement sur le modèle de secours...";
  }
  return "Génération en cours...";
};

const initSupabase = async () => {
  if (supabaseClient) return supabaseClient;
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Configuration Supabase manquante.");
  }
  const data = await response.json();
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("SDK Supabase non chargé.");
  }
  supabaseClient = window.supabase.createClient(
    data.supabaseUrl,
    data.supabaseAnonKey,
  );
  return supabaseClient;
};

const loadProfile = async () => {
  try {
    const response = await authorizedFetch("/api/me");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Profil inaccessible.");
    }
    return data.profile;
  } catch (error) {
    setAuthStatus(error.message || "Accès refusé.", "error");
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    return null;
  }
};

const setStatus = (message, type = "", details = []) => {
  statusLine.textContent = message;
  statusLine.className = type ? `status-${type}` : "";
  statusDetails.innerHTML = "";

  if (!details || details.length === 0) {
    return;
  }

  details.forEach((item) => {
    const card = document.createElement("div");
    card.className = "status-details-card";
    card.textContent = item;
    statusDetails.appendChild(card);
  });
};

const setCreateStatus = (message, type = "", details = []) => {
  if (createStatusLine) {
    createStatusLine.textContent = message;
    createStatusLine.className = type ? `status-${type}` : "";
  }
  if (createStatusDetails) {
    createStatusDetails.innerHTML = "";
    if (details && details.length > 0) {
      details.forEach((item) => {
        const card = document.createElement("div");
        card.className = "status-details-card";
        card.textContent = item;
        createStatusDetails.appendChild(card);
      });
    }
  }
};

const renderCreateBasePreview = () => {
  if (!createBasePreview) return;
  createBasePreview.innerHTML = "";

  if (!createBaseImage) {
    const placeholder = document.createElement("p");
    placeholder.textContent = "Aucune image importée.";
    createBasePreview.appendChild(placeholder);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "preview-single-card";
  const img = document.createElement("img");
  img.src = createBaseImage.dataUrl;
  img.alt = "Image de référence";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    createBaseImage = null;
    renderCreateBasePreview();
  });

  wrapper.appendChild(img);
  wrapper.appendChild(removeBtn);
  createBasePreview.appendChild(wrapper);
};

const renderCreateInspirationPreview = () => {
  if (!createInspoPreview) return;
  createInspoPreview.innerHTML = "";

  if (createInspirationImages.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.textContent = "Aucune inspiration ajoutée.";
    createInspoPreview.appendChild(placeholder);
    return;
  }

  createInspirationImages.forEach((image, index) => {
    const card = document.createElement("div");
    card.className = "preview-card";

    const img = document.createElement("img");
    img.src = image.dataUrl;
    img.alt = `Inspiration ${index + 1}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      createInspirationImages.splice(index, 1);
      renderCreateInspirationPreview();
    });

    card.appendChild(img);
    card.appendChild(removeBtn);
    createInspoPreview.appendChild(card);
  });
};

const handleCreateBaseFiles = async (files) => {
  const [file] = files;
  if (!file) return;

  const dataUrl = await fileToDataUrl(file);
  let aspectRatio = null;

  try {
    const dimensions = await loadImageDimensions(dataUrl);
    aspectRatio = pickAspectRatio(dimensions.width, dimensions.height);
  } catch (error) {
    setCreateStatus(
      "Impossible de déterminer le ratio de l'image.",
      "warn",
    );
  }

  createBaseImage = {
    name: file.name,
    mimeType: file.type || "image/png",
    dataUrl,
    data: dataUrl.split(",")[1],
    aspectRatio,
  };
  renderCreateBasePreview();
};

const handleCreateInspirationFiles = async (files) => {
  const fileList = Array.from(files || []);
  if (fileList.length === 0) return;

  const availableSlots = Math.max(0, 4 - createInspirationImages.length);
  const incomingFiles = fileList.slice(0, availableSlots);

  if (incomingFiles.length < fileList.length) {
    setCreateStatus("Limite de 4 inspirations atteinte.", "error");
  }

  for (const file of incomingFiles) {
    const dataUrl = await fileToDataUrl(file);
    const position = createInspirationImages.length;
    const newImage = {
      name: file.name,
      mimeType: file.type || "image/png",
      dataUrl,
      data: dataUrl.split(",")[1],
      position,
    };

    createInspirationImages.push(newImage);
  }

  renderCreateInspirationPreview();
};

const renderBasePreview = () => {
  basePreview.innerHTML = "";

  if (!baseImage) {
    const placeholder = document.createElement("p");
    placeholder.textContent = "Aucun graphique importé.";
    basePreview.appendChild(placeholder);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "preview-single-card";
  const img = document.createElement("img");
  img.src = baseImage.dataUrl;
  img.alt = "Graphique à modifier";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    baseImage = null;
    renderBasePreview();
  });

  wrapper.appendChild(img);
  wrapper.appendChild(removeBtn);
  basePreview.appendChild(wrapper);
};

const renderInspirationPreview = () => {
  inspoPreview.innerHTML = "";

  if (inspirationImages.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.textContent = "Aucune inspiration ajoutée.";
    inspoPreview.appendChild(placeholder);
    return;
  }

  inspirationImages.forEach((image, index) => {
    const card = document.createElement("div");
    card.className = "preview-card";

    const img = document.createElement("img");
    img.src = image.dataUrl;
    img.alt = `Inspiration ${index + 1}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      inspirationImages.splice(index, 1);
      renderInspirationPreview();
    });

    card.appendChild(img);
    card.appendChild(removeBtn);
    inspoPreview.appendChild(card);
  });
};

const handleBaseFiles = async (files) => {
  const [file] = files;
  if (!file) return;

  const dataUrl = await fileToDataUrl(file);
  let aspectRatio = null;

  try {
    const dimensions = await loadImageDimensions(dataUrl);
    aspectRatio = pickAspectRatio(dimensions.width, dimensions.height);
  } catch (error) {
    setStatus(
      "Impossible de déterminer le ratio du graphique. Utilisation du ratio automatique.",
      "warn",
    );
  }

  baseImage = {
    name: file.name,
    mimeType: file.type || "image/png",
    dataUrl,
    data: dataUrl.split(",")[1],
    aspectRatio,
  };
  renderBasePreview();
};

const handleInspirationFiles = async (files) => {
  const fileList = Array.from(files || []);
  if (fileList.length === 0) return;

  const availableSlots = Math.max(0, 4 - inspirationImages.length);
  const incomingFiles = fileList.slice(0, availableSlots);

  if (incomingFiles.length < fileList.length) {
    setStatus("Limite de 4 inspirations atteinte.", "error");
  }

  for (const file of incomingFiles) {
    const dataUrl = await fileToDataUrl(file);
    const position = inspirationImages.length;
    const newImage = {
      name: file.name,
      mimeType: file.type || "image/png",
      dataUrl,
      data: dataUrl.split(",")[1],
      position,
    };

    inspirationImages.push(newImage);
  }

  renderInspirationPreview();
};

const setupDropzone = (zone, input, handler) => {
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");
    handler(event.dataTransfer.files);
  });
  input.addEventListener("change", (event) => handler(event.target.files));
};

const getImageSrc = (image) => {
  if (image?.url) return image.url;
  if (image?.data && image?.mimeType) {
    return `data:${image.mimeType};base64,${image.data}`;
  }
  if (image?.dataUrl) return image.dataUrl;
  return "";
};

// Password modal functions
const openPasswordModal = () => {
  if (!passwordModal) return;
  passwordModal.classList.add("is-open");
  passwordModal.setAttribute("aria-hidden", "false");
  if (newPasswordInput) newPasswordInput.focus();
};

const closePasswordModal = () => {
  if (!passwordModal) return;
  passwordModal.classList.remove("is-open");
  passwordModal.setAttribute("aria-hidden", "true");
  if (passwordForm) passwordForm.reset();
  if (passwordError) {
    passwordError.hidden = true;
    passwordError.textContent = "";
  }
};

const changePassword = async (newPassword) => {
  if (!supabaseClient || !currentSession) return { error: "Non connecté" };

  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }
  return { success: true };
};

// Force password change modal
const openForcePasswordModal = () => {
  if (!forcePasswordModal) return;
  forcePasswordModal.classList.add("is-open");
  forcePasswordModal.setAttribute("aria-hidden", "false");
  if (forceNewPasswordInput) forceNewPasswordInput.focus();
};

const closeForcePasswordModal = () => {
  if (!forcePasswordModal) return;
  forcePasswordModal.classList.remove("is-open");
  forcePasswordModal.setAttribute("aria-hidden", "true");
  if (forcePasswordForm) forcePasswordForm.reset();
  if (forcePasswordError) {
    forcePasswordError.hidden = true;
    forcePasswordError.textContent = "";
  }
};

// Excel import: parse file and extract emails
const parseExcelEmails = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const emails = [];
        for (const row of rows) {
          if (!row || row.length === 0) continue;
          // Check each cell for email-like values
          for (const cell of row) {
            const val = String(cell || "").trim().toLowerCase();
            if (val && val.includes("@") && val.includes(".")) {
              emails.push(val);
              break; // one email per row
            }
          }
        }
        resolve([...new Set(emails)]); // deduplicate
      } catch (err) {
        reject(new Error("Impossible de lire le fichier Excel."));
      }
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
    reader.readAsArrayBuffer(file);
  });
};

const downloadImage = (image) => {
  if (!image?.data) {
    setStatus("Données image manquantes.", "error");
    return;
  }
  const dataUrl = `data:${image.mimeType || "image/png"};base64,${image.data}`;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `graphique-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const createResultCard = (image, index) => {
  const card = document.createElement("div");
  card.className = "result-card";

  const img = document.createElement("img");
  img.src = getImageSrc(image);
  img.alt = `Proposition ${index + 1}`;
  img.addEventListener("click", () => openPreview(img.src));

  const actions = document.createElement("div");
  actions.className = "result-actions";

  const label = document.createElement("span");
  label.textContent = `Option ${index + 1}`;

  const actionGroup = document.createElement("div");
  actionGroup.className = "action-group";

  const refineBtn = document.createElement("button");
  refineBtn.type = "button";
  refineBtn.className = "btn btn-ghost btn-sm";
  refineBtn.textContent = "Modifier";
  refineBtn.addEventListener("click", () => openRefineModal(image));

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "btn btn-outline btn-sm";
  downloadBtn.textContent = "Télécharger";
  downloadBtn.addEventListener("click", () => downloadImage(image));

  actionGroup.appendChild(refineBtn);
  actionGroup.appendChild(downloadBtn);

  actions.appendChild(label);
  actions.appendChild(actionGroup);

  card.appendChild(img);
  card.appendChild(actions);
  return card;
};

const renderResults = (images) => {
  resultsGrid.innerHTML = "";
  images.forEach((image, index) => {
    resultsGrid.appendChild(createResultCard(image, index));
  });
};

const appendResults = (images) => {
  const current = resultsGrid.querySelectorAll(
    ".result-card:not(.loading)",
  ).length;
  images.forEach((image, index) => {
    resultsGrid.appendChild(createResultCard(image, current + index));
  });
};

const setAdminStatus = (message = "", type = "") => {
  if (!adminStatus) return;
  adminStatus.textContent = message;
  adminStatus.className = type ? `note ${type}` : "note";
};

const updateAdminUser = async (userId, payload) => {
  const response = await authorizedFetch(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Mise à jour impossible.");
  }
};

let allAdminUsers = [];

const deleteAdminUser = async (userId) => {
  const response = await authorizedFetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Suppression impossible.");
  }
};

const renderAdminUsers = (users = [], filter = "") => {
  if (!adminUsers) return;
  allAdminUsers = users;
  adminUsers.innerHTML = "";

  const query = filter.toLowerCase().trim();
  const filtered = query
    ? users.filter((u) => (u.email || "").toLowerCase().includes(query))
    : users;

  if (adminUserCount) {
    adminUserCount.textContent = query
      ? `${filtered.length} résultat(s) sur ${users.length} utilisateur(s)`
      : `${users.length} utilisateur(s)`;
  }

  filtered.forEach((user) => {
    const row = document.createElement("div");
    row.className = "admin-user-row";

    // Email + badges
    const emailCell = document.createElement("div");
    emailCell.className = "admin-user-email";
    const emailText = document.createElement("span");
    emailText.className = "admin-user-email-text";
    emailText.textContent = user.email || "—";
    emailCell.appendChild(emailText);
    if (user.must_change_password) {
      const pwdBadge = document.createElement("span");
      pwdBadge.className = "badge badge-warn badge-xs";
      pwdBadge.textContent = "MDP à changer";
      pwdBadge.title = "L'utilisateur n'a pas encore changé son mot de passe par défaut";
      emailCell.appendChild(pwdBadge);
    }

    // Role selector with icon hint
    const roleCell = document.createElement("div");
    roleCell.className = "admin-role-cell";
    const roleSelect = document.createElement("select");
    roleSelect.className = "admin-role-select";
    roleSelect.title = "Changer le rôle";
    const optMember = document.createElement("option");
    optMember.value = "member";
    optMember.textContent = "Member";
    const optAdmin = document.createElement("option");
    optAdmin.value = "admin";
    optAdmin.textContent = "Admin";
    roleSelect.appendChild(optMember);
    roleSelect.appendChild(optAdmin);
    roleSelect.value = user.role === "admin" ? "admin" : "member";
    roleSelect.addEventListener("change", async () => {
      const newRole = roleSelect.value;
      try {
        roleSelect.disabled = true;
        await updateAdminUser(user.id, { role: newRole });
        user.role = newRole;
        setAdminStatus("Rôle mis à jour.", "ok");
      } catch (error) {
        roleSelect.value = user.role;
        setAdminStatus(error.message || "Erreur.", "error");
      } finally {
        roleSelect.disabled = false;
      }
    });
    roleCell.appendChild(roleSelect);

    // Actions
    const actions = document.createElement("div");
    actions.className = "admin-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-sm btn-ghost btn-danger-hover";
    deleteBtn.title = "Supprimer ce compte";
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Supprimer';
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Supprimer définitivement ${user.email} ? Cette action est irréversible.`)) return;
      try {
        deleteBtn.disabled = true;
        await deleteAdminUser(user.id);
        setAdminStatus(`${user.email} supprimé.`, "ok");
        await loadAdminUsers();
      } catch (error) {
        deleteBtn.disabled = false;
        setAdminStatus(error.message || "Erreur.", "error");
      }
    });

    actions.appendChild(deleteBtn);

    row.appendChild(emailCell);
    row.appendChild(roleCell);
    row.appendChild(actions);
    adminUsers.appendChild(row);
  });
};

const loadAdminUsers = async () => {
  if (!currentProfile || currentProfile.role !== "admin") return;
  try {
    const response = await authorizedFetch("/api/admin/users");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Chargement impossible.");
    }
    renderAdminUsers(data.users || []);
  } catch (error) {
    setAdminStatus(error.message || "Erreur de chargement.", "error");
  }
};

const modeLabels = { base: "Redesign", create: "Créer", refine: "Retouche" };
const fmtCost = (v) => `$${v.toFixed(2)}`;

const loadUsageStats = async () => {
  if (!currentProfile || currentProfile.role !== "admin") return;
  const period = usagePeriod?.value || "month";
  const userId = usageUserFilter?.value || "";
  const params = new URLSearchParams({ period });
  if (userId) params.set("user_id", userId);

  try {
    const response = await authorizedFetch(`/api/admin/usage?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Erreur chargement.");
    const isFiltered = Boolean(data.filterUserId);

    // Populate user filter dropdown (keep current selection)
    if (usageUserFilter && data.allUsers) {
      const prev = usageUserFilter.value;
      usageUserFilter.innerHTML =
        '<option value="">Tous les utilisateurs</option>';
      data.allUsers.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.userId;
        opt.textContent = u.email;
        usageUserFilter.appendChild(opt);
      });
      usageUserFilter.value = prev;
    }

    // KPI cards
    if (usageTotalCost) usageTotalCost.textContent = fmtCost(data.totalCost);
    if (usageTotalImages) usageTotalImages.textContent = data.totalOutputImages || 0;
    if (usageTotalCalls) usageTotalCalls.textContent = data.totalCalls;
    if (usageAvgDay) usageAvgDay.textContent = fmtCost(data.avgCostPerDay || 0);
    if (usageSuccessRate) {
      const rate = data.totalCalls > 0
        ? Math.round((data.successfulCalls / data.totalCalls) * 100)
        : 0;
      usageSuccessRate.textContent = `${rate}%`;
    }

    // Budget bar (always global)
    if (data.budgetStatus) {
      const bs = data.budgetStatus;
      if (budgetBarFill) {
        budgetBarFill.style.width = `${Math.min(bs.percentUsed, 100)}%`;
        budgetBarFill.className =
          "budget-bar-fill" + (bs.percentUsed >= 80 ? " budget-bar--warn" : "");
      }
      if (budgetBarLabel) {
        budgetBarLabel.textContent = `${bs.spentThisMonthUsd.toFixed(2)} $ / ${bs.monthlyBudgetUsd.toFixed(2)} $ (${bs.percentUsed.toFixed(1)}%)`;
      }
    }

    // Mode breakdown
    const modeContainer = document.querySelector("#usageModeBreakdown");
    if (modeContainer && data.perMode) {
      modeContainer.innerHTML = "";
      const totalModeCost = data.perMode.reduce((s, e) => s + e.cost, 0) || 1;
      data.perMode.forEach((entry) => {
        const pct = Math.round((entry.cost / totalModeCost) * 100);
        const item = document.createElement("div");
        item.className = "dash-mode-item";
        item.innerHTML = `
          <div class="dash-mode-header">
            <span class="dash-mode-name">${modeLabels[entry.mode] || entry.mode}</span>
            <span class="dash-mode-stat">${fmtCost(entry.cost)}</span>
          </div>
          <div class="dash-mode-bar-track"><div class="dash-mode-bar-fill" style="width:${pct}%"></div></div>
          <span class="dash-mode-detail">${entry.calls} appels</span>
        `;
        modeContainer.appendChild(item);
      });
    }

    // Daily activity chart (vertical bar chart using CSS)
    if (usageDailyChart) {
      usageDailyChart.innerHTML = "";
      const days = (data.daily || []).slice().reverse().slice(-14); // last 14 days, chronological
      if (days.length === 0) {
        usageDailyChart.innerHTML = '<p class="dash-empty">Aucune activité sur cette période.</p>';
      } else {
        const maxCalls = Math.max(...days.map((d) => d.calls), 1);
        const chart = document.createElement("div");
        chart.className = "dash-bars";
        days.forEach((day) => {
          const barH = Math.max(Math.round((day.calls / maxCalls) * 100), 2);
          const col = document.createElement("div");
          col.className = "dash-bar-col";
          col.innerHTML = `
            <span class="dash-bar-value">${day.calls}</span>
            <div class="dash-bar" style="height:${barH}%"></div>
            <span class="dash-bar-label">${day.date.slice(5)}</span>
          `;
          col.title = `${day.date}\n${day.calls} appels · ${fmtCost(day.cost)}`;
          chart.appendChild(col);
        });
        usageDailyChart.appendChild(chart);
      }
    }

    // Detail table — adapts to filter context
    if (usageDetailTable) {
      usageDetailTable.innerHTML = "";

      if (!isFiltered) {
        // Global view: show per-user table
        if (usageDetailTitle) usageDetailTitle.textContent = "Détail par utilisateur";
        const header = document.createElement("div");
        header.className = "dtable-row dtable-header";
        header.innerHTML = `
          <span>Utilisateur</span>
          <span>Aujourd'hui</span>
          <span>Limite</span>
          <span>Images</span>
          <span>Coût</span>
          <span>Limite perso</span>
        `;
        usageDetailTable.appendChild(header);

        (data.perUser || []).forEach((user) => {
          const pct = user.dailyLimit > 0
            ? Math.round((user.usedToday / user.dailyLimit) * 100) : 0;
          const barClass = pct >= 80 ? "quota-bar--danger" : pct >= 50 ? "quota-bar--warn" : "quota-bar--ok";

          const row = document.createElement("div");
          row.className = "dtable-row";
          row.innerHTML = `
            <span class="dtable-email" title="${user.email}">${user.email}</span>
            <span class="quota-cell">
              <span class="quota-text">${user.usedToday}/${user.dailyLimit}</span>
              <span class="quota-bar-track"><span class="quota-bar-fill ${barClass}" style="width:${Math.min(pct, 100)}%"></span></span>
            </span>
            <span>${user.dailyLimit}/j</span>
            <span>${user.images || user.calls}</span>
            <span>${fmtCost(user.cost)}</span>
            <span class="admin-actions">
              <input type="number" class="limit-input" min="0" max="9999"
                placeholder="Défaut" value="${user.dailyLimitOverride !== null ? user.dailyLimitOverride : ""}"
                data-user-id="${user.userId}" title="Vide = limite par défaut" />
              <button type="button" class="btn btn-outline btn-sm limit-save-btn" data-user-id="${user.userId}">OK</button>
            </span>
          `;
          // Click row to filter by this user
          const emailCell = row.querySelector(".dtable-email");
          emailCell.style.cursor = "pointer";
          emailCell.addEventListener("click", () => {
            if (usageUserFilter) {
              usageUserFilter.value = user.userId;
              loadUsageStats();
            }
          });
          usageDetailTable.appendChild(row);
        });

        // Bind limit save buttons
        usageDetailTable.querySelectorAll(".limit-save-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const uid = btn.dataset.userId;
            const input = usageDetailTable.querySelector(
              `.limit-input[data-user-id="${uid}"]`,
            );
            setUserDailyLimit(uid, input?.value ?? "");
          });
        });
      } else {
        // User-filtered view: show daily breakdown for that user
        const userName = data.perUser?.[0]?.email || "Utilisateur";
        if (usageDetailTitle) usageDetailTitle.textContent = `Historique — ${userName}`;
        const header = document.createElement("div");
        header.className = "dtable-row dtable-header dtable-daily";
        header.innerHTML = `
          <span>Date</span>
          <span>Images</span>
          <span>Appels</span>
          <span>Coût</span>
          <span></span>
        `;
        usageDetailTable.appendChild(header);

        const maxDayCost = Math.max(...(data.daily || []).map((d) => d.cost), 0.001);
        (data.daily || []).forEach((day) => {
          const barPct = Math.round((day.cost / maxDayCost) * 100);
          const row = document.createElement("div");
          row.className = "dtable-row dtable-daily";
          row.innerHTML = `
            <span>${day.date}</span>
            <span>${day.images || 0}</span>
            <span>${day.calls}</span>
            <span>${fmtCost(day.cost)}</span>
            <span class="history-bar-cell"><span class="history-bar" style="width:${barPct}%"></span></span>
          `;
          usageDetailTable.appendChild(row);
        });
      }
    }
  } catch (error) {
    console.error("Usage stats error:", error);
  }
};

const updateMonthlyCostDisplay = (eur) => {
  currentMonthlyCostEur = eur;
  const formatted = `${eur.toFixed(2).replace(".", ",")} \u20AC`;
  if (monthlyCostEl) monthlyCostEl.textContent = formatted;
  if (createMonthlyCostEl) createMonthlyCostEl.textContent = formatted;
};

const loadMonthlyCost = async () => {
  if (!currentSession) return;
  try {
    const response = await authorizedFetch("/api/usage/monthly");
    const data = await response.json();
    if (response.ok) {
      updateMonthlyCostDisplay(data.totalEur || 0);
    }
  } catch (error) {
    console.error("Monthly cost error:", error);
  }
};

const loadQuota = async () => {
  if (!currentSession) return;
  try {
    const response = await authorizedFetch("/api/quota");
    const data = await response.json();
    if (response.ok) {
      const text = `${data.remaining}/${data.dailyLimit} images restantes aujourd'hui`;
      [quotaRemainingEl, createQuotaRemainingEl].forEach((el) => {
        if (!el) return;
        el.textContent = text;
        el.className =
          "pill quota-pill" +
          (data.remaining <= 0
            ? " quota-exhausted"
            : data.remaining <= 3
              ? " quota-low"
              : "");
      });
    }
  } catch (err) {
    console.error("Quota load error:", err);
  }
};

const loadAdminSettings = async () => {
  if (!currentProfile || currentProfile.role !== "admin") return;
  try {
    const response = await authorizedFetch("/api/admin/settings");
    const data = await response.json();
    if (response.ok && data.settings) {
      if (settingDailyLimit)
        settingDailyLimit.value = data.settings.default_daily_limit || "20";
      if (settingMonthlyBudget)
        settingMonthlyBudget.value = data.settings.monthly_budget_usd || "500";
    }
  } catch (err) {
    console.error("Admin settings load error:", err);
  }
};

const saveAdminSettings = async () => {
  if (!currentProfile || currentProfile.role !== "admin") return;
  try {
    const payload = {
      default_daily_limit: settingDailyLimit?.value || "20",
      monthly_budget_usd: settingMonthlyBudget?.value || "500",
    };
    const response = await authorizedFetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      if (settingsStatus) {
        settingsStatus.textContent = "Paramètres enregistrés.";
        settingsStatus.className = "note ok";
        setTimeout(() => {
          settingsStatus.textContent = "";
          settingsStatus.className = "note";
        }, 3000);
      }
      loadUsageStats();
    } else {
      const data = await response.json();
      throw new Error(data?.error || "Erreur");
    }
  } catch (err) {
    if (settingsStatus) {
      settingsStatus.textContent = err.message || "Erreur de sauvegarde.";
      settingsStatus.className = "note error";
    }
  }
};

const setUserDailyLimit = async (userId, limit) => {
  try {
    await updateAdminUser(userId, {
      daily_limit_override: limit === "" ? null : parseInt(limit),
    });
    loadUsageStats();
  } catch (err) {
    console.error("Set user limit error:", err);
  }
};

const isAdminView = (view) =>
  view === "admin-users" || view === "admin-usage";

const setActiveView = (view) => {
  const isAdmin = currentProfile?.role === "admin";
  const nextView = isAdminView(view) && !isAdmin ? "workspace" : view;
  activeView = nextView;

  // Update active mode based on view
  if (nextView === "workspace") activeMode = "redesign";
  if (nextView === "create") activeMode = "create";

  appViews.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.view === nextView);
  });
  // Update nav buttons state
  if (adminUsersNavBtn) {
    adminUsersNavBtn.classList.toggle("is-active", nextView === "admin-users");
  }
  if (adminUsageNavBtn) {
    adminUsageNavBtn.classList.toggle("is-active", nextView === "admin-usage");
  }
  if (redesignNavBtn) {
    redesignNavBtn.classList.toggle("is-active", nextView === "workspace");
  }
  if (createNavBtn) {
    createNavBtn.classList.toggle("is-active", nextView === "create");
  }
  if (nextView === "admin-users") {
    loadAdminUsers();
  }
  if (nextView === "admin-usage") {
    loadUsageStats();
    loadAdminSettings();
  }
};

const addLoading = (count) => {
  const placeholders = [];
  resultsGrid.classList.add("loading-grid");
  for (let i = 0; i < count; i += 1) {
    const card = document.createElement("div");
    card.className = "result-card loading";
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    card.appendChild(placeholder);
    resultsGrid.appendChild(card);
    placeholders.push(card);
  }
  return placeholders;
};

const replaceWithLoading = (count) => {
  resultsGrid.innerHTML = "";
  return addLoading(count);
};

const clearLoading = (placeholders = []) => {
  placeholders.forEach((card) => card.remove());
  if (resultsGrid.querySelector(".result-card.loading")) return;
  resultsGrid.classList.remove("loading-grid");
};

// Inject (or refresh) a partial preview image inside a loading card.
const updatePartialImage = (cards, variantIndex, b64, mimeType) => {
  const card = cards?.[variantIndex - 1];
  if (!card || !b64) return;
  const dataUrl = `data:${mimeType || "image/png"};base64,${b64}`;
  let img = card.querySelector("img.partial-preview");
  if (!img) {
    const placeholder = card.querySelector(".placeholder");
    if (placeholder) placeholder.remove();
    img = document.createElement("img");
    img.className = "partial-preview";
    img.alt = "Aperçu en cours";
    card.appendChild(img);
  }
  img.src = dataUrl;
};

const getResultDataUrl = (image) => getImageSrc(image);

const openPreview = (src) => {
  previewImage.src = src;
  previewModal.classList.add("is-open");
  previewModal.setAttribute("aria-hidden", "false");
};

const closePreview = () => {
  previewModal.classList.remove("is-open");
  previewModal.setAttribute("aria-hidden", "true");
  previewImage.src = "";
};

const openRefineModal = async (image) => {
  selectedResult = { ...image };
  refineImage.src = getResultDataUrl(selectedResult);
  refinePrompt.value = "";

  if (!selectedResult.aspectRatio) {
    try {
      const dimensions = await loadImageDimensions(refineImage.src);
      selectedResult.aspectRatio = pickAspectRatio(
        dimensions.width,
        dimensions.height,
      );
    } catch (error) {
      setStatus(
        "Impossible de déterminer le ratio de l'image sélectionnée.",
        "warn",
      );
    }
  }

  refineModal.classList.add("is-open");
  refineModal.setAttribute("aria-hidden", "false");
};

const closeRefineModal = () => {
  refineModal.classList.remove("is-open");
  refineModal.setAttribute("aria-hidden", "true");
  refineImage.src = "";
  refinePrompt.value = "";
};

previewModal.addEventListener("click", (event) => {
  const target = event.target;
  if (target && target.hasAttribute("data-modal-close")) {
    closePreview();
  }
});

refineModal.addEventListener("click", (event) => {
  const target = event.target;
  if (target && target.hasAttribute("data-refine-close")) {
    closeRefineModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (previewModal.classList.contains("is-open")) {
    closePreview();
  }
  if (refineModal.classList.contains("is-open")) {
    closeRefineModal();
  }
});

const generateImages = async () => {
  if (!baseImage) {
    setStatus("Ajoute un graphique principal avant de générer.", "error");
    return;
  }

  const selectedCount = Number.parseInt(
    countInputs.find((input) => input.checked)?.value || "2",
    10,
  );

  setStatus("Génération en cours...", "");
  const loadingCards = addLoading(selectedCount || 1);
  generateBtn.disabled = true;
  generateBtn.textContent = "Génération...";

  try {
    const response = await authorizedFetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        baseImage: {
          data: baseImage.data,
          mimeType: baseImage.mimeType,
        },
        inspirationImages: inspirationImages.map((image) => ({
          data: image.data,
          mimeType: image.mimeType,
        })),
        prompt: promptField.value,
        numImages: selectedCount,
        imageConfig: {
          imageSize: "2K",
          aspectRatio: baseImage?.aspectRatio || undefined,
        },
        mode: "base",
      }),
    });

    if (response.status === 429) {
      const data = await response.json();
      clearLoading(loadingCards);
      loadQuota();
      setStatus(data?.error || "Limite quotidienne atteinte.", "quota");
      return;
    }

    if (response.status !== 200) {
      const data = await response.json().catch(() => ({}));
      const details = [];
      if (Array.isArray(data?.errors)) {
        data.errors.forEach((error) => {
          const parts = [];
          if (error?.message) parts.push(error.message);
          if (error?.status) parts.push(`status ${error.status}`);
          if (error?.code) parts.push(error.code);
          if (parts.length > 0) details.push(parts.join(" · "));
        });
      }
      setStatus(data?.error || "Erreur lors de la génération.", "error", details);
      clearLoading(loadingCards);
      return;
    }

    const data = await readGenerateStream(response, (event) => {
      if (event.event === "partial-image") {
        updatePartialImage(loadingCards, event.variantIndex, event.data, event.mimeType);
        return;
      }
      setStatus(formatProgressMessage(event), "");
    });

    if (!data) {
      setStatus("Erreur : aucune réponse du serveur.", "error");
      clearLoading(loadingCards);
      return;
    }

    if (!data.ok || !data.images || data.images.length === 0) {
      const details = Array.isArray(data?.errors)
        ? data.errors
            .map((error) => {
              const parts = [];
              if (error?.message) parts.push(error.message);
              if (error?.status) parts.push(`status ${error.status}`);
              if (error?.code) parts.push(error.code);
              return parts.join(" · ");
            })
            .filter(Boolean)
        : [];
      setStatus(
        data?.error || "Aucune image n'a été retournée par le modèle. Réessaie dans quelques instants.",
        "error",
        details,
      );
      clearLoading(loadingCards);
      return;
    }

    clearLoading(loadingCards);
    appendResults(data.images);
    if (data.estimatedCostEur) {
      updateMonthlyCostDisplay(currentMonthlyCostEur + data.estimatedCostEur);
    }
    loadQuota();
    const message = `Génération terminée avec ${data.images.length} image(s).`;
    const warnings = Array.isArray(data?.warnings) ? [...data.warnings] : [];
    if (Array.isArray(data?.errors)) {
      data.errors.forEach((error) => {
        const parts = [];
        if (error?.message) parts.push(error.message);
        if (error?.status) parts.push(`status ${error.status}`);
        if (error?.code) parts.push(error.code);
        if (parts.length > 0) warnings.push(parts.join(" · "));
      });
    }
    const type = warnings.length > 0 ? "warn" : "ok";
    setStatus(message, type, warnings);
  } catch (error) {
    clearLoading(loadingCards);
    setStatus("Erreur réseau pendant la génération.", "error", [
      error?.message || "Réseau indisponible.",
    ]);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Générer";
  }
};

const generateRefine = async () => {
  if (!selectedResult) {
    setStatus("Sélectionne une génération avant de la modifier.", "error");
    return;
  }

  const prompt = refinePrompt.value.trim();

  setStatus("Modification en cours...", "");
  const loadingCards = addLoading(1);
  generateBtn.disabled = true;
  refineGenerate.disabled = true;
  refineGenerate.textContent = "Modification...";
  closeRefineModal();

  try {
    const response = await authorizedFetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        baseImage: {
          data: selectedResult.data,
          mimeType: selectedResult.mimeType,
        },
        inspirationImages: [],
        prompt,
        numImages: 1,
        imageConfig: {
          imageSize: "2K",
          aspectRatio: selectedResult.aspectRatio || undefined,
        },
        mode: "refine",
      }),
    });

    if (response.status === 429) {
      const data = await response.json();
      clearLoading(loadingCards);
      loadQuota();
      setStatus(data?.error || "Limite quotidienne atteinte.", "quota");
      return;
    }

    if (response.status !== 200) {
      const data = await response.json().catch(() => ({}));
      const details = [];
      if (Array.isArray(data?.errors)) {
        data.errors.forEach((error) => {
          const parts = [];
          if (error?.message) parts.push(error.message);
          if (error?.status) parts.push(`status ${error.status}`);
          if (error?.code) parts.push(error.code);
          if (parts.length > 0) details.push(parts.join(" · "));
        });
      }
      setStatus(data?.error || "Erreur lors de la modification.", "error", details);
      clearLoading(loadingCards);
      return;
    }

    const data = await readGenerateStream(response, (event) => {
      if (event.event === "partial-image") {
        updatePartialImage(loadingCards, event.variantIndex, event.data, event.mimeType);
        return;
      }
      setStatus(formatProgressMessage(event), "");
    });

    if (!data || !data.ok || !data.images || data.images.length === 0) {
      const details = Array.isArray(data?.errors)
        ? data.errors
            .map((error) => {
              const parts = [];
              if (error?.message) parts.push(error.message);
              if (error?.status) parts.push(`status ${error.status}`);
              if (error?.code) parts.push(error.code);
              return parts.join(" · ");
            })
            .filter(Boolean)
        : [];
      setStatus(
        data?.error || "Aucune image n'a été retournée par le modèle. Réessaie dans quelques instants.",
        "error",
        details,
      );
      clearLoading(loadingCards);
      return;
    }

    clearLoading(loadingCards);
    appendResults(data.images);
    if (data.estimatedCostEur) {
      updateMonthlyCostDisplay(currentMonthlyCostEur + data.estimatedCostEur);
    }
    loadQuota();
    const message = "Modification terminée.";
    const warnings = Array.isArray(data?.warnings) ? [...data.warnings] : [];

    if (Array.isArray(data?.errors)) {
      data.errors.forEach((error) => {
        const parts = [];
        if (error?.message) parts.push(error.message);
        if (error?.status) parts.push(`status ${error.status}`);
        if (error?.code) parts.push(error.code);
        if (parts.length > 0) warnings.push(parts.join(" · "));
      });
    }
    const type = warnings.length > 0 ? "warn" : "ok";
    setStatus(message, type, warnings);
  } catch (error) {
    clearLoading(loadingCards);
    setStatus("Erreur réseau pendant la modification.", "error", [
      error?.message || "Réseau indisponible.",
    ]);
  } finally {
    generateBtn.disabled = false;
    refineGenerate.disabled = false;
    refineGenerate.textContent = "Appliquer les modifications";
  }
};

const generateCreate = async () => {
  const promptText = createPromptField?.value?.trim() || "";
  if (!promptText) {
    setCreateStatus(
      "Le prompt est obligatoire pour créer un visuel.",
      "error",
    );
    return;
  }

  const selectedCount = Number.parseInt(
    createCountInputs.find((input) => input.checked)?.value || "2",
    10,
  );

  setCreateStatus("Génération en cours...", "");
  if (createResultsGrid) createResultsGrid.classList.add("loading-grid");
  const loadingCards = [];
  if (createResultsGrid) {
    createResultsGrid.classList.add("loading-grid");
    for (let i = 0; i < (selectedCount || 1); i += 1) {
      const card = document.createElement("div");
      card.className = "result-card loading";
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder";
      card.appendChild(placeholder);
      createResultsGrid.appendChild(card);
      loadingCards.push(card);
    }
  }
  if (createGenerateBtn) {
    createGenerateBtn.disabled = true;
    createGenerateBtn.textContent = "Génération...";
  }

  try {
    const body = {
      inspirationImages: createInspirationImages.map((image) => ({
        data: image.data,
        mimeType: image.mimeType,
      })),
      prompt: promptText,
      numImages: selectedCount,
      imageConfig: {
        imageSize: "2K",
      },
      mode: "create",
    };

    if (createBaseImage) {
      body.baseImage = {
        data: createBaseImage.data,
        mimeType: createBaseImage.mimeType,
      };
      if (createBaseImage.aspectRatio) {
        body.imageConfig.aspectRatio = createBaseImage.aspectRatio;
      }
    }

    const response = await authorizedFetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 429) {
      const data = await response.json();
      loadingCards.forEach((c) => c.remove());
      if (createResultsGrid && !createResultsGrid.querySelector(".result-card:not(.loading)")) createResultsGrid.classList.remove("loading-grid");
      loadQuota();
      setCreateStatus(data?.error || "Limite quotidienne atteinte.", "quota");
      return;
    }

    if (response.status !== 200) {
      const data = await response.json().catch(() => ({}));
      const details = [];
      if (Array.isArray(data?.errors)) {
        data.errors.forEach((error) => {
          const parts = [];
          if (error?.message) parts.push(error.message);
          if (error?.status) parts.push(`status ${error.status}`);
          if (error?.code) parts.push(error.code);
          if (parts.length > 0) details.push(parts.join(" · "));
        });
      }
      setCreateStatus(data?.error || "Erreur lors de la génération.", "error", details);
      loadingCards.forEach((c) => c.remove());
      if (createResultsGrid && !createResultsGrid.querySelector(".result-card:not(.loading)")) createResultsGrid.classList.remove("loading-grid");
      return;
    }

    const data = await readGenerateStream(response, (event) => {
      if (event.event === "partial-image") {
        updatePartialImage(loadingCards, event.variantIndex, event.data, event.mimeType);
        return;
      }
      setCreateStatus(formatProgressMessage(event), "");
    });

    if (!data || !data.ok || !data.images || data.images.length === 0) {
      const details = Array.isArray(data?.errors)
        ? data.errors
            .map((error) => {
              const parts = [];
              if (error?.message) parts.push(error.message);
              if (error?.status) parts.push(`status ${error.status}`);
              if (error?.code) parts.push(error.code);
              return parts.join(" · ");
            })
            .filter(Boolean)
        : [];
      setCreateStatus(
        data?.error || "Aucune image n'a été retournée par le modèle. Réessaie dans quelques instants.",
        "error",
        details,
      );
      loadingCards.forEach((c) => c.remove());
      if (createResultsGrid && !createResultsGrid.querySelector(".result-card:not(.loading)")) createResultsGrid.classList.remove("loading-grid");
      return;
    }

    loadingCards.forEach((c) => c.remove());
    if (createResultsGrid) {
      createResultsGrid.classList.remove("loading-grid");
      const currentCount = createResultsGrid.querySelectorAll(".result-card:not(.loading)").length;
      data.images.forEach((image, index) => {
        createResultsGrid.appendChild(createResultCard(image, currentCount + index));
      });
    }
    if (data.estimatedCostEur) {
      updateMonthlyCostDisplay(currentMonthlyCostEur + data.estimatedCostEur);
    }
    loadQuota();
    const message = `Génération terminée avec ${data.images.length} image(s).`;
    const warnings = Array.isArray(data?.warnings) ? [...data.warnings] : [];

    if (Array.isArray(data?.errors)) {
      data.errors.forEach((error) => {
        const parts = [];
        if (error?.message) parts.push(error.message);
        if (error?.status) parts.push(`status ${error.status}`);
        if (error?.code) parts.push(error.code);
        if (parts.length > 0) warnings.push(parts.join(" · "));
      });
    }
    const type = warnings.length > 0 ? "warn" : "ok";
    setCreateStatus(message, type, warnings);
  } catch (error) {
    loadingCards.forEach((c) => c.remove());
    if (createResultsGrid && !createResultsGrid.querySelector(".result-card:not(.loading)")) createResultsGrid.classList.remove("loading-grid");
    setCreateStatus("Erreur réseau pendant la génération.", "error", [
      error?.message || "Réseau indisponible.",
    ]);
  } finally {
    if (createGenerateBtn) {
      createGenerateBtn.disabled = false;
      createGenerateBtn.textContent = "Générer";
    }
  }
};

setupDropzone(baseZone, baseInput, handleBaseFiles);
setupDropzone(inspoZone, inspoInput, handleInspirationFiles);

// Create mode dropzones
if (createInspoZone && createInspoInput) {
  setupDropzone(createInspoZone, createInspoInput, handleCreateInspirationFiles);
}
if (createBaseZone && createBaseInput) {
  setupDropzone(createBaseZone, createBaseInput, handleCreateBaseFiles);
}

generateBtn.addEventListener("click", generateImages);
refineGenerate.addEventListener("click", generateRefine);
if (createGenerateBtn) {
  createGenerateBtn.addEventListener("click", generateCreate);
}

renderBasePreview();
renderInspirationPreview();
renderCreateBasePreview();
renderCreateInspirationPreview();

if (navToggle && navRail && navDrawer) {
  navToggle.addEventListener("click", () => {
    const isOpen = navRail.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navDrawer.setAttribute("aria-hidden", String(!isOpen));
  });
}

// Mode nav buttons
if (redesignNavBtn) {
  redesignNavBtn.addEventListener("click", () => {
    setActiveView("workspace");
  });
}

if (createNavBtn) {
  createNavBtn.addEventListener("click", () => {
    setActiveView("create");
  });
}

// Admin buttons
if (adminUsersNavBtn) {
  adminUsersNavBtn.addEventListener("click", () => {
    setActiveView("admin-users");
  });
}
if (adminUsageNavBtn) {
  adminUsageNavBtn.addEventListener("click", () => {
    setActiveView("admin-usage");
  });
}

if (adminUserSearch) {
  adminUserSearch.addEventListener("input", () => {
    renderAdminUsers(allAdminUsers, adminUserSearch.value);
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthStatus("Connexion en cours...");
    try {
      await initSupabase();
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail.value.trim(),
        password: loginPassword.value,
      });
      if (error) {
        setAuthStatus(error.message || "Connexion impossible.", "error");
      } else {
        setAuthStatus("Connexion réussie.", "ok");
        loginPassword.value = "";
      }
    } catch (err) {
      setAuthStatus(err.message || "Connexion impossible.", "error");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  });
}

// Password change handlers
if (changePasswordBtn) {
  changePasswordBtn.addEventListener("click", openPasswordModal);
}

if (cancelPasswordBtn) {
  cancelPasswordBtn.addEventListener("click", closePasswordModal);
}

if (passwordModal) {
  passwordModal
    .querySelector(".modal-backdrop")
    ?.addEventListener("click", closePasswordModal);
}

if (passwordForm) {
  passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newPass = newPasswordInput?.value || "";
    const confirmPass = confirmPasswordInput?.value || "";

    // Validation
    if (newPass.length < 6) {
      passwordError.textContent =
        "Le mot de passe doit contenir au moins 6 caractères.";
      passwordError.hidden = false;
      return;
    }

    if (newPass !== confirmPass) {
      passwordError.textContent = "Les mots de passe ne correspondent pas.";
      passwordError.hidden = false;
      return;
    }

    // Update password
    const submitBtn = document.querySelector("#submitPasswordBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enregistrement...";
    }

    const result = await changePassword(newPass);

    if (result.error) {
      passwordError.textContent = result.error;
      passwordError.hidden = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enregistrer";
      }
      return;
    }

    // Success — also clear force flag if applicable
    if (currentProfile?.must_change_password) {
      try {
        await authorizedFetch("/api/me/password-changed", { method: "POST" });
        currentProfile.must_change_password = false;
        closeForcePasswordModal();
      } catch (_) {}
    }
    closePasswordModal();
    setStatus("Mot de passe modifié avec succès.", "ok");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enregistrer";
    }
  });
}

if (adminCreateForm) {
  adminCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      setAdminStatus("Création en cours...");
      const payload = {
        email: adminEmail.value.trim(),
        password: adminPassword.value,
        role: adminRole.value,
      };
      const response = await authorizedFetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Création impossible.");
      }
      setAdminStatus("Utilisateur créé.", "ok");
      adminEmail.value = "";
      adminPassword.value = "";
      adminRole.value = "member";
      await loadAdminUsers();
    } catch (error) {
      setAdminStatus(error.message || "Erreur de création.", "error");
    }
  });
}

// Excel import handlers
if (importFile) {
  importFile.addEventListener("change", () => {
    const file = importFile.files[0];
    if (file) {
      if (importFileName) importFileName.textContent = file.name;
      if (importBtn) importBtn.disabled = false;
    } else {
      if (importFileName) importFileName.textContent = "Aucun fichier sélectionné";
      if (importBtn) importBtn.disabled = true;
    }
    if (importResults) importResults.hidden = true;
  });
}

if (importBtn) {
  importBtn.addEventListener("click", async () => {
    const file = importFile?.files[0];
    if (!file) return;

    importBtn.disabled = true;
    importBtn.textContent = "Import en cours...";
    if (importProgress) importProgress.hidden = false;
    if (importResults) importResults.hidden = true;
    if (importProgressFill) importProgressFill.style.width = "10%";
    if (importProgressText) importProgressText.textContent = "Lecture du fichier...";

    try {
      const emails = await parseExcelEmails(file);

      if (emails.length === 0) {
        throw new Error("Aucun email trouvé dans le fichier.");
      }

      if (importProgressFill) importProgressFill.style.width = "30%";
      if (importProgressText)
        importProgressText.textContent = `${emails.length} email(s) trouvé(s). Création des comptes...`;

      const response = await authorizedFetch("/api/admin/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Import impossible.");
      }

      if (importProgressFill) importProgressFill.style.width = "100%";

      const r = data.results;
      let html = '<div class="import-results-summary">';
      html += `<div class="import-stat import-stat-ok"><strong>${r.created.length}</strong> créé(s)</div>`;
      html += `<div class="import-stat import-stat-skip"><strong>${r.skipped.length}</strong> ignoré(s)</div>`;
      html += `<div class="import-stat import-stat-err"><strong>${r.errors.length}</strong> erreur(s)</div>`;
      html += "</div>";

      if (r.skipped.length > 0) {
        html += '<details class="import-details"><summary>Ignorés (déjà existants)</summary><ul>';
        r.skipped.forEach((s) => {
          html += `<li>${s.email}</li>`;
        });
        html += "</ul></details>";
      }
      if (r.errors.length > 0) {
        html += '<details class="import-details" open><summary>Erreurs</summary><ul>';
        r.errors.forEach((e) => {
          html += `<li><strong>${e.email || "?"}</strong> — ${e.reason}</li>`;
        });
        html += "</ul></details>";
      }

      if (importResults) {
        importResults.innerHTML = html;
        importResults.hidden = false;
      }

      await loadAdminUsers();
    } catch (err) {
      if (importResults) {
        importResults.innerHTML = `<p class="import-error">${err.message || "Erreur d'import."}</p>`;
        importResults.hidden = false;
      }
    } finally {
      importBtn.disabled = false;
      importBtn.textContent = "Importer";
      if (importProgress) importProgress.hidden = true;
      if (importFile) importFile.value = "";
      if (importFileName) importFileName.textContent = "Aucun fichier sélectionné";
    }
  });
}

// Force password change form handler
if (forcePasswordForm) {
  forcePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newPass = forceNewPasswordInput?.value || "";
    const confirmPass = forceConfirmPasswordInput?.value || "";

    if (newPass.length < 6) {
      if (forcePasswordError) {
        forcePasswordError.textContent =
          "Le mot de passe doit contenir au moins 6 caractères.";
        forcePasswordError.hidden = false;
      }
      return;
    }

    if (newPass !== confirmPass) {
      if (forcePasswordError) {
        forcePasswordError.textContent =
          "Les mots de passe ne correspondent pas.";
        forcePasswordError.hidden = false;
      }
      return;
    }

    const submitBtn = document.querySelector("#forceSubmitPasswordBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enregistrement...";
    }

    const result = await changePassword(newPass);

    if (result.error) {
      if (forcePasswordError) {
        forcePasswordError.textContent = result.error;
        forcePasswordError.hidden = false;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enregistrer et continuer";
      }
      return;
    }

    // Notify server to clear the flag
    try {
      await authorizedFetch("/api/me/password-changed", { method: "POST" });
    } catch (_) {}

    // Update local profile
    if (currentProfile) currentProfile.must_change_password = false;

    closeForcePasswordModal();
    setStatus("Mot de passe modifié avec succès. Bienvenue !", "ok");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enregistrer et continuer";
    }
  });
}

if (usagePeriod) {
  usagePeriod.addEventListener("change", loadUsageStats);
}
if (usageUserFilter) {
  usageUserFilter.addEventListener("change", loadUsageStats);
}
if (usageRefresh) {
  usageRefresh.addEventListener("click", loadUsageStats);
}
if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener("click", () => {
    saveAdminSettings();
  });
}

const handleSession = async (session) => {
  currentSession = session;
  if (!session) {
    currentProfile = null;
    baseImage = null;
    inspirationImages = [];
    if (resultsGrid) {
      resultsGrid.innerHTML = "";
    }
    setActiveView("workspace");
    setViewState(false);
    return;
  }
  setViewState(true);
  currentProfile = await loadProfile();
  if (!currentProfile) {
    setViewState(false);
    return;
  }

  // Force password change on first login
  if (currentProfile.must_change_password) {
    openForcePasswordModal();
  }

  if (userEmail) {
    userEmail.textContent = session.user?.email || "—";
  }
  if (userRole) {
    userRole.textContent = currentProfile.role === "admin" ? "Admin" : "Member";
  }
  if (adminNavGroup) {
    adminNavGroup.hidden = currentProfile.role !== "admin";
  }
  // If currently on an admin view but no longer admin, redirect
  if (isAdminView(activeView) && currentProfile.role !== "admin") {
    activeView = "workspace";
  }
  setActiveView(activeView);
  await loadMonthlyCost();
  await loadQuota();
};

const bootstrap = async () => {
  try {
    await initSupabase();
    const { data } = await supabaseClient.auth.getSession();
    await handleSession(data?.session || null);
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });
  } catch (error) {
    setAuthStatus(error.message || "Configuration manquante.", "error");
  }
};

bootstrap();
