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
const projectList = document.querySelector("#projectList");
const newProjectBtn = document.querySelector("#newProjectBtn");
const galleryBtn = document.querySelector(".nav-gallery-btn");
const galleryGrid = document.querySelector("#galleryGrid");
const galleryEmpty = document.querySelector("#galleryEmpty");
const galleryLoadMore = document.querySelector("#galleryLoadMore");
const gallerySearch = document.querySelector("#gallerySearch");
const gallerySort = document.querySelector("#gallerySort");
const totalImagesEl = document.querySelector("#totalImages");
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
const adminNavBtn = document.querySelector("#adminNavBtn");
const usagePanel = document.querySelector("#usagePanel");
const usagePeriod = document.querySelector("#usagePeriod");
const usageRefresh = document.querySelector("#usageRefresh");
const usageTotalCost = document.querySelector("#usageTotalCost");
const usageTotalCalls = document.querySelector("#usageTotalCalls");
const usageTotalImages = document.querySelector("#usageTotalImages");
const usageSuccessRate = document.querySelector("#usageSuccessRate");
const usagePerUser = document.querySelector("#usagePerUser");
const usageDaily = document.querySelector("#usageDaily");
const monthlyCostEl = document.querySelector("#monthlyCost");
const viewButtons = Array.from(document.querySelectorAll("[data-view-target]"));
const appViews = Array.from(document.querySelectorAll(".app-view"));
const deleteProjectModal = document.querySelector("#deleteProjectModal");
const deleteProjectNameEl = document.querySelector("#deleteProjectName");
const confirmDeleteProjectBtn = document.querySelector("#confirmDeleteProject");
const downloadModal = document.querySelector("#downloadModal");
const passwordModal = document.querySelector("#passwordModal");
const passwordForm = document.querySelector("#passwordForm");
const newPasswordInput = document.querySelector("#newPassword");
const confirmPasswordInput = document.querySelector("#confirmPassword");
const passwordError = document.querySelector("#passwordError");
const changePasswordBtn = document.querySelector("#changePasswordBtn");
const cancelPasswordBtn = document.querySelector("#cancelPasswordBtn");

let baseImage = null;
let inspirationImages = [];
let selectedResult = null;
let supabaseClient = null;
let currentSession = null;
let currentProfile = null;
let galleryImages = [];
let galleryCursor = null;
let galleryHasMore = true;
let gallerySearchTerm = "";
let gallerySortOrder = "recent";
let activeView = "workspace";
let projectToDelete = null;
let currentProjectId = null;
let autoSaveTimeout = null;
let currentMonthlyCostEur = 0;
const AUTO_SAVE_DELAY = 2000;

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
    removeBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      // Delete from server if has ID
      if (image.id && currentProjectId) {
        await deleteInspirationFromProject(image.id);
      }
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

  // Upload to project if one is selected
  if (currentProjectId) {
    await uploadBaseImageToProject();
  }
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

    // Upload to project if one is selected
    if (currentProjectId) {
      const savedInsp = await uploadInspirationToProject(newImage, position);
      if (savedInsp) {
        newImage.id = savedInsp.id;
      }
    }

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

// Delete image via API (defined early for use in result cards)
const deleteImageAPI = async (imageId) => {
  if (!currentSession || !imageId) return false;
  try {
    const response = await authorizedFetch(`/api/images/${imageId}`, {
      method: "DELETE",
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to delete image:", error);
    return false;
  }
};

// Download modal functions
const openDownloadModal = () => {
  if (!downloadModal) return;
  downloadModal.classList.add("is-open");
  downloadModal.setAttribute("aria-hidden", "false");
};

const closeDownloadModal = () => {
  if (!downloadModal) return;
  downloadModal.classList.remove("is-open");
  downloadModal.setAttribute("aria-hidden", "true");
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

// Generate high quality version and download
const downloadHighQuality = async (image) => {
  if (!currentSession) return;

  // Need to hydrate image data first if not available
  let imageData = image;
  if (!imageData.data && imageData.id) {
    try {
      imageData = await hydrateImageData(image);
    } catch (error) {
      setStatus("Impossible de charger l'image.", "error");
      return;
    }
  }

  if (!imageData.data) {
    setStatus("Données image manquantes.", "error");
    return;
  }

  openDownloadModal();

  try {
    const response = await authorizedFetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: currentProjectId,
        baseImage: {
          data: imageData.data,
          mimeType: imageData.mimeType || "image/png",
        },
        inspirationImages: [],
        prompt:
          "Reproduis cette image exactement à l'identique, sans aucune modification. Qualité maximale pour impression.",
        numImages: 1,
        imageConfig: {
          imageSize: "4K",
          aspectRatio: imageData.aspectRatio || undefined,
        },
        mode: "refine",
      }),
    });

    const data = await response.json();
    closeDownloadModal();

    if (!response.ok || !data.images || data.images.length === 0) {
      setStatus("Erreur lors de la génération haute qualité.", "error");
      return;
    }

    if (data.estimatedCostEur) {
      updateMonthlyCostDisplay(currentMonthlyCostEur + data.estimatedCostEur);
    }

    // Download the generated image
    const hqImage = data.images[0];
    const dataUrl = `data:${hqImage.mimeType || "image/png"};base64,${hqImage.data}`;

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `graphique-4K-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setStatus("Image haute qualité téléchargée.", "ok");
  } catch (error) {
    closeDownloadModal();
    setStatus("Erreur lors du téléchargement.", "error");
  }
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
  downloadBtn.addEventListener("click", () => downloadHighQuality(image));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-danger btn-sm";
  deleteBtn.textContent = "Supprimer";
  deleteBtn.addEventListener("click", async () => {
    if (!image.id) {
      // Image not yet saved, just remove from UI
      card.remove();
      return;
    }
    const success = await deleteImageAPI(image.id);
    if (success) {
      card.remove();
    }
  });

  actionGroup.appendChild(refineBtn);
  actionGroup.appendChild(downloadBtn);
  actionGroup.appendChild(deleteBtn);

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

const renderAdminUsers = (users = []) => {
  if (!adminUsers) return;
  adminUsers.innerHTML = "";
  users.forEach((user) => {
    const row = document.createElement("div");
    row.className = "admin-user-row";

    const email = document.createElement("span");
    email.textContent = user.email || "—";

    const roleSelect = document.createElement("select");
    const optionMember = document.createElement("option");
    optionMember.value = "member";
    optionMember.textContent = "Member";
    const optionAdmin = document.createElement("option");
    optionAdmin.value = "admin";
    optionAdmin.textContent = "Admin";
    roleSelect.appendChild(optionMember);
    roleSelect.appendChild(optionAdmin);
    roleSelect.value = user.role === "admin" ? "admin" : "member";

    const status = document.createElement("span");
    status.textContent = user.is_active ? "Actif" : "Désactivé";

    const actions = document.createElement("div");
    actions.className = "admin-actions";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-outline btn-sm";
    saveBtn.textContent = "Mettre à jour";
    saveBtn.addEventListener("click", async () => {
      try {
        setAdminStatus("Mise à jour en cours...");
        await updateAdminUser(user.id, { role: roleSelect.value });
        setAdminStatus("Rôle mis à jour.", "ok");
      } catch (error) {
        setAdminStatus(error.message || "Erreur de mise à jour.", "error");
      }
    });

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn btn-ghost btn-sm";
    toggleBtn.textContent = user.is_active ? "Désactiver" : "Réactiver";
    toggleBtn.addEventListener("click", async () => {
      try {
        setAdminStatus("Mise à jour en cours...");
        await updateAdminUser(user.id, { is_active: !user.is_active });
        user.is_active = !user.is_active;
        status.textContent = user.is_active ? "Actif" : "Désactivé";
        toggleBtn.textContent = user.is_active ? "Désactiver" : "Réactiver";
        setAdminStatus("Statut mis à jour.", "ok");
      } catch (error) {
        setAdminStatus(error.message || "Erreur de mise à jour.", "error");
      }
    });

    actions.appendChild(saveBtn);
    actions.appendChild(toggleBtn);

    row.appendChild(email);
    row.appendChild(roleSelect);
    row.appendChild(status);
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

const loadUsageStats = async () => {
  if (!currentProfile || currentProfile.role !== "admin") return;
  const period = usagePeriod?.value || "month";
  try {
    const response = await authorizedFetch(`/api/admin/usage?period=${period}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Erreur chargement.");

    if (usageTotalCost)
      usageTotalCost.textContent = `$${data.totalCost.toFixed(4)}`;
    if (usageTotalCalls) usageTotalCalls.textContent = data.totalCalls;
    if (usageTotalImages)
      usageTotalImages.textContent = data.totalOutputImages || 0;
    if (usageSuccessRate) {
      const rate =
        data.totalCalls > 0
          ? Math.round((data.successfulCalls / data.totalCalls) * 100)
          : 0;
      usageSuccessRate.textContent = `${rate}%`;
    }

    if (usagePerUser) {
      usagePerUser.innerHTML = "";
      (data.perUser || []).forEach((user) => {
        const row = document.createElement("div");
        row.className = "admin-user-row usage-user-row";
        row.innerHTML = `
          <span>${user.email}</span>
          <span>${user.calls}</span>
          <span>$${user.cost.toFixed(4)}</span>
        `;
        usagePerUser.appendChild(row);
      });
    }

    if (usageDaily) {
      usageDaily.innerHTML = "";
      (data.daily || []).forEach((day) => {
        const row = document.createElement("div");
        row.className = "admin-user-row usage-daily-row";
        row.innerHTML = `
          <span>${day.date}</span>
          <span>${day.calls}</span>
          <span>$${day.cost.toFixed(4)}</span>
        `;
        usageDaily.appendChild(row);
      });
    }
  } catch (error) {
    console.error("Usage stats error:", error);
  }
};

const updateMonthlyCostDisplay = (eur) => {
  currentMonthlyCostEur = eur;
  if (monthlyCostEl) {
    monthlyCostEl.textContent = `${eur.toFixed(2).replace(".", ",")} \u20AC`;
  }
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

// ============================================
// PROJECT MANAGEMENT
// ============================================

// Helper to fetch image URL and convert to base64/dataUrl
const fetchImageAsBase64 = async (url, mimeType) => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        resolve({
          dataUrl,
          data: dataUrl.split(",")[1],
          mimeType: mimeType || blob.type || "image/png",
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
};

// Render projects in sidebar
const renderProjectList = (projects) => {
  if (!projectList) return;
  projectList.innerHTML = "";
  projects.forEach((project, index) => {
    const item = createProjectItem(project.id, project.name, index === 0);
    projectList.appendChild(item);
  });
};

// Load all projects for current user
const loadProjects = async () => {
  if (!currentSession) return;
  try {
    const response = await authorizedFetch("/api/projects");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Impossible de charger les projets.");
    }
    const projects = data.projects || [];
    renderProjectList(projects);

    if (projects.length > 0) {
      await loadProject(projects[0].id);
    } else {
      await createNewProjectAPI();
    }
  } catch (error) {
    setStatus("Erreur lors du chargement des projets.", "error");
  }
};

// Load a single project with all its data
const loadProject = async (projectId) => {
  if (!currentSession || !projectId) return;
  try {
    const response = await authorizedFetch(`/api/projects/${projectId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Impossible de charger le projet.");
    }

    currentProjectId = projectId;

    // Restore base image
    if (data.project.baseImageUrl) {
      const imageData = await fetchImageAsBase64(
        data.project.baseImageUrl,
        data.project.baseMimeType,
      );
      if (imageData) {
        try {
          const dimensions = await loadImageDimensions(imageData.dataUrl);
          imageData.aspectRatio = pickAspectRatio(
            dimensions.width,
            dimensions.height,
          );
        } catch (e) {
          imageData.aspectRatio = null;
        }
        baseImage = imageData;
      } else {
        baseImage = null;
      }
    } else {
      baseImage = null;
    }

    // Restore inspiration images
    inspirationImages = [];
    if (data.inspirations && data.inspirations.length > 0) {
      for (const insp of data.inspirations) {
        if (insp.url) {
          const imageData = await fetchImageAsBase64(insp.url, insp.mimeType);
          if (imageData) {
            inspirationImages.push({
              id: insp.id,
              position: insp.position,
              ...imageData,
            });
          }
        }
      }
    }

    // Restore prompt
    promptField.value = data.project.prompt || "";

    // Restore generated images
    if (data.generatedImages && data.generatedImages.length > 0) {
      renderResults(data.generatedImages);
    } else {
      resultsGrid.innerHTML = "";
    }

    // Update UI
    renderBasePreview();
    renderInspirationPreview();

    // Update sidebar selection
    if (projectList) {
      const items = projectList.querySelectorAll(".project-item");
      items.forEach((item) => {
        item.classList.toggle(
          "is-active",
          item.dataset.projectId === projectId,
        );
      });
    }

    setStatus("Projet chargé.", "ok");
  } catch (error) {
    setStatus("Erreur lors du chargement du projet.", "error");
  }
};

// Save current project state
const saveCurrentProject = async () => {
  if (!currentProjectId || !currentSession) return;
  try {
    const updates = {
      prompt: promptField.value,
    };

    await authorizedFetch(`/api/projects/${currentProjectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  } catch (error) {
    console.error("Auto-save failed:", error);
  }
};

// Schedule auto-save with debounce
const scheduleAutoSave = () => {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(saveCurrentProject, AUTO_SAVE_DELAY);
};

// Create a new project via API
const createNewProjectAPI = async () => {
  if (!currentSession) return null;
  try {
    const response = await authorizedFetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nouveau projet" }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Impossible de créer le projet.");
    }
    return data.project;
  } catch (error) {
    setStatus("Impossible de créer le projet.", "error");
    return null;
  }
};

// Upload base image to current project
const uploadBaseImageToProject = async () => {
  if (!currentProjectId || !baseImage || !currentSession) return;
  try {
    await authorizedFetch(`/api/projects/${currentProjectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseImage: {
          data: baseImage.data,
          mimeType: baseImage.mimeType,
        },
      }),
    });
  } catch (error) {
    console.error("Failed to upload base image:", error);
  }
};

// Upload inspiration to current project
const uploadInspirationToProject = async (imageData, position) => {
  if (!currentProjectId || !currentSession) return null;
  try {
    const response = await authorizedFetch(
      `/api/projects/${currentProjectId}/inspirations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: {
            data: imageData.data,
            mimeType: imageData.mimeType,
          },
          position,
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Impossible d'ajouter l'inspiration.");
    }
    return data.inspiration;
  } catch (error) {
    console.error("Failed to upload inspiration:", error);
    return null;
  }
};

// Delete inspiration from project
const deleteInspirationFromProject = async (inspirationId) => {
  if (!currentProjectId || !currentSession || !inspirationId) return;
  try {
    await authorizedFetch(
      `/api/projects/${currentProjectId}/inspirations/${inspirationId}`,
      {
        method: "DELETE",
      },
    );
  } catch (error) {
    console.error("Failed to delete inspiration:", error);
  }
};

// Delete project via API
const deleteProjectAPI = async (projectId) => {
  if (!currentSession || !projectId) return false;
  try {
    const response = await authorizedFetch(`/api/projects/${projectId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data?.error || "Impossible de supprimer le projet.");
    }
    return true;
  } catch (error) {
    setStatus("Impossible de supprimer le projet.", "error");
    return false;
  }
};

// Rename project via API
const renameProjectAPI = async (projectId, newName) => {
  if (!currentSession || !projectId) return false;
  try {
    const response = await authorizedFetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to rename project:", error);
    return false;
  }
};

const setActiveView = (view) => {
  const isAdmin = currentProfile?.role === "admin";
  const nextView = view === "admin" && !isAdmin ? "workspace" : view;
  activeView = nextView;
  appViews.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.view === nextView);
  });
  // Update nav buttons state
  if (galleryBtn) {
    galleryBtn.classList.toggle("is-active", nextView === "gallery");
  }
  if (adminNavBtn) {
    adminNavBtn.classList.toggle("is-active", nextView === "admin");
  }
  // Update project items - active only when in workspace
  if (projectList) {
    const items = projectList.querySelectorAll(".project-item");
    items.forEach((item) => {
      if (nextView !== "workspace") {
        item.classList.remove("is-active");
      }
    });
  }
  // Load gallery data when switching to gallery view
  if (nextView === "gallery" && galleryImages.length === 0) {
    loadGallery({ reset: true });
  }
  if (nextView === "admin") {
    loadAdminUsers();
    loadUsageStats();
  }
};

// Gallery functions
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const createGalleryCard = (image) => {
  const card = document.createElement("div");
  card.className = "gallery-card";

  const imageWrapper = document.createElement("div");
  imageWrapper.className = "gallery-card-image";

  const img = document.createElement("img");
  img.src = getImageSrc(image);
  img.alt = image.prompt || "Image générée";
  img.loading = "lazy";

  const overlay = document.createElement("div");
  overlay.className = "gallery-card-overlay";

  // Click on image wrapper opens preview (unless clicking on buttons)
  imageWrapper.addEventListener("click", (e) => {
    if (e.target.closest(".btn")) return;
    openPreview(img.src);
  });

  const actions = document.createElement("div");
  actions.className = "gallery-card-actions";

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "btn";
  downloadBtn.textContent = "Télécharger";
  downloadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    downloadHighQuality(image);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-danger";
  deleteBtn.textContent = "Supprimer";
  deleteBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!image.id) return;
    const success = await deleteImageAPI(image.id);
    if (success) {
      // Remove from galleryImages array
      const index = galleryImages.findIndex((img) => img.id === image.id);
      if (index !== -1) {
        galleryImages.splice(index, 1);
      }
      card.remove();
      updateGalleryStats();
    }
  });

  actions.appendChild(downloadBtn);
  actions.appendChild(deleteBtn);
  overlay.appendChild(actions);
  imageWrapper.appendChild(img);
  imageWrapper.appendChild(overlay);

  const info = document.createElement("div");
  info.className = "gallery-card-info";

  const meta = document.createElement("div");
  meta.className = "gallery-card-meta";

  const dateSpan = document.createElement("span");
  dateSpan.className = "gallery-card-date";
  dateSpan.textContent = formatDate(image.created_at);

  const modeSpan = document.createElement("span");
  modeSpan.className = "gallery-card-mode";
  modeSpan.textContent = image.mode === "refine" ? "Retouche" : "Génération";

  meta.appendChild(dateSpan);
  meta.appendChild(modeSpan);
  info.appendChild(meta);

  if (image.prompt) {
    const promptP = document.createElement("p");
    promptP.className = "gallery-card-prompt";
    promptP.textContent = image.prompt;
    promptP.title = image.prompt;
    info.appendChild(promptP);
  }

  card.appendChild(imageWrapper);
  card.appendChild(info);
  return card;
};

const updateGalleryStats = () => {
  if (totalImagesEl) {
    totalImagesEl.textContent = galleryImages.length;
  }
};

const renderGallery = () => {
  if (!galleryGrid) return;
  galleryGrid.innerHTML = "";

  let filteredImages = [...galleryImages];

  // Filter by search term
  if (gallerySearchTerm) {
    const term = gallerySearchTerm.toLowerCase();
    filteredImages = filteredImages.filter(
      (img) =>
        (img.prompt && img.prompt.toLowerCase().includes(term)) ||
        (img.mode && img.mode.toLowerCase().includes(term)),
    );
  }

  // Sort images
  filteredImages.sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return gallerySortOrder === "recent" ? dateB - dateA : dateA - dateB;
  });

  if (filteredImages.length === 0) {
    if (galleryEmpty) galleryEmpty.style.display = "flex";
    if (galleryLoadMore) galleryLoadMore.hidden = true;
    updateGalleryStats();
    return;
  }

  if (galleryEmpty) galleryEmpty.style.display = "none";

  filteredImages.forEach((image) => {
    galleryGrid.appendChild(createGalleryCard(image));
  });

  if (galleryLoadMore) {
    galleryLoadMore.hidden = !galleryHasMore;
  }

  updateGalleryStats();
};

const loadGallery = async ({ reset = false } = {}) => {
  if (!currentSession) return;
  if (reset) {
    galleryImages = [];
    galleryCursor = null;
    galleryHasMore = true;
  }
  if (!galleryHasMore) return;
  if (galleryLoadMore) galleryLoadMore.disabled = true;

  try {
    const params = new URLSearchParams({ limit: "24" });
    if (galleryCursor) params.append("cursor", galleryCursor);
    const response = await authorizedFetch(`/api/library?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Chargement impossible.");
    }
    const items = Array.isArray(data?.items) ? data.items : [];
    galleryImages = reset ? items : [...galleryImages, ...items];
    galleryCursor = data?.nextCursor || null;
    galleryHasMore = Boolean(data?.nextCursor);
    renderGallery();
  } catch (error) {
    console.error("Erreur chargement galerie:", error);
  } finally {
    if (galleryLoadMore) galleryLoadMore.disabled = false;
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

const hydrateImageData = async (image) => {
  if (image?.data && image?.mimeType) return image;
  if (!image?.id) return image;
  try {
    setStatus("Chargement de l'image...", "");
    const response = await authorizedFetch(`/api/images/${image.id}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Impossible de charger l'image.");
    }
    return {
      ...image,
      data: data.data,
      mimeType: data.mimeType || "image/png",
    };
  } catch (error) {
    setStatus(error.message || "Impossible de charger l'image.", "error");
    throw error;
  }
};

const openRefineModal = async (image) => {
  try {
    selectedResult = await hydrateImageData({ ...image });
  } catch (error) {
    return;
  }
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
  if (deleteProjectModal && deleteProjectModal.classList.contains("is-open")) {
    closeDeleteModal();
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
  const loadingCards = replaceWithLoading(selectedCount || 1);
  generateBtn.disabled = true;
  generateBtn.textContent = "Génération...";

  try {
    const response = await authorizedFetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: currentProjectId,
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
          imageSize: "1K",
          aspectRatio: baseImage?.aspectRatio || undefined,
        },
        mode: "base",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
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
      if (Array.isArray(data?.details)) {
        data.details.forEach((detail) => details.push(detail));
      }
      setStatus(
        data?.error || "Erreur lors de la génération.",
        "error",
        details,
      );
      clearLoading(loadingCards);
      resultsGrid.innerHTML = "";
      return;
    }

    if (!data.images || data.images.length === 0) {
      setStatus("Aucune image générée.", "error");
      clearLoading(loadingCards);
      resultsGrid.innerHTML = "";
      return;
    }

    clearLoading(loadingCards);
    renderResults(data.images);
    if (data.estimatedCostEur) {
      updateMonthlyCostDisplay(currentMonthlyCostEur + data.estimatedCostEur);
    }
    const message = `Génération terminée avec ${data.images.length} image(s).`;
    const warnings = Array.isArray(data?.warnings) ? [...data.warnings] : [];
    if (Array.isArray(data?.storageErrors)) {
      data.storageErrors.forEach((detail) => warnings.push(detail));
    }
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
    resultsGrid.innerHTML = "";
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
        projectId: currentProjectId,
        baseImage: {
          data: selectedResult.data,
          mimeType: selectedResult.mimeType,
        },
        inspirationImages: [],
        prompt,
        numImages: 1,
        imageConfig: {
          imageSize: "1K",
          aspectRatio: selectedResult.aspectRatio || undefined,
        },
        mode: "refine",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
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
      if (Array.isArray(data?.details)) {
        data.details.forEach((detail) => details.push(detail));
      }
      setStatus(
        data?.error || "Erreur lors de la modification.",
        "error",
        details,
      );
      clearLoading(loadingCards);
      return;
    }

    if (!data.images || data.images.length === 0) {
      setStatus("Aucune image générée.", "error");
      clearLoading(loadingCards);
      return;
    }

    clearLoading(loadingCards);
    appendResults(data.images);
    if (data.estimatedCostEur) {
      updateMonthlyCostDisplay(currentMonthlyCostEur + data.estimatedCostEur);
    }
    const message = "Modification terminée.";
    const warnings = Array.isArray(data?.warnings) ? [...data.warnings] : [];
    if (Array.isArray(data?.storageErrors)) {
      data.storageErrors.forEach((detail) => warnings.push(detail));
    }
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

setupDropzone(baseZone, baseInput, handleBaseFiles);
setupDropzone(inspoZone, inspoInput, handleInspirationFiles);

generateBtn.addEventListener("click", generateImages);
refineGenerate.addEventListener("click", generateRefine);

// Auto-save prompt on input
promptField.addEventListener("input", scheduleAutoSave);

renderBasePreview();
renderInspirationPreview();

if (navToggle && navRail && navDrawer) {
  navToggle.addEventListener("click", () => {
    const isOpen = navRail.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navDrawer.setAttribute("aria-hidden", String(!isOpen));
  });
}

// Project list management
const selectProject = async (projectItem) => {
  if (!projectList) return;
  const projectId = projectItem.dataset.projectId;
  if (!projectId) return;

  // Save current project first
  await saveCurrentProject();

  // Update UI immediately
  const allItems = projectList.querySelectorAll(".project-item");
  allItems.forEach((item) => item.classList.remove("is-active"));
  projectItem.classList.add("is-active");

  // Load the project data
  await loadProject(projectId);

  // Switch to workspace view
  setActiveView("workspace");
};

const startRenameProject = (projectItem) => {
  const nameSpan = projectItem.querySelector(".project-name");
  if (!nameSpan) return;

  const projectId = projectItem.dataset.projectId;
  const currentName = nameSpan.textContent;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "project-name-input";
  input.value = currentName;

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const finishRename = async () => {
    const newName = input.value.trim() || currentName;
    const newSpan = document.createElement("span");
    newSpan.className = "project-name";
    newSpan.textContent = newName;
    input.replaceWith(newSpan);

    // Save to API if name changed
    if (newName !== currentName && projectId) {
      await renameProjectAPI(projectId, newName);
    }
  };

  input.addEventListener("blur", finishRename);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
    if (event.key === "Escape") {
      input.value = currentName;
      input.blur();
    }
  });
};

const createProjectItem = (id, name, isActive = false) => {
  const item = document.createElement("div");
  item.className = `project-item${isActive ? " is-active" : ""}`;
  item.dataset.projectId = id;

  item.innerHTML = `
    <svg class="project-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
    <span class="project-name">${name}</span>
    <div class="project-actions">
      <button class="project-edit-btn" type="button" title="Renommer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
        </svg>
      </button>
      <button class="project-delete-btn" type="button" title="Supprimer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      </button>
    </div>
  `;

  return item;
};

// Delete project modal functions
const openDeleteModal = (projectItem) => {
  if (!deleteProjectModal) return;
  projectToDelete = projectItem;
  const projectName =
    projectItem.querySelector(".project-name")?.textContent || "Ce projet";
  if (deleteProjectNameEl) {
    deleteProjectNameEl.textContent = projectName;
  }
  deleteProjectModal.classList.add("is-open");
  deleteProjectModal.setAttribute("aria-hidden", "false");
};

const closeDeleteModal = () => {
  if (!deleteProjectModal) return;
  deleteProjectModal.classList.remove("is-open");
  deleteProjectModal.setAttribute("aria-hidden", "true");
  projectToDelete = null;
};

const deleteProject = async () => {
  if (!projectToDelete) return;

  const projectId = projectToDelete.dataset.projectId;
  const wasActive = projectToDelete.classList.contains("is-active");

  // Delete from API
  const success = await deleteProjectAPI(projectId);
  if (!success) {
    closeDeleteModal();
    return;
  }

  projectToDelete.remove();

  // If the deleted project was active, select another one or create new
  if (wasActive && projectList) {
    const remainingProjects = projectList.querySelectorAll(".project-item");
    if (remainingProjects.length > 0) {
      await selectProject(remainingProjects[0]);
    } else {
      // Create a new project
      const newProject = await createNewProjectAPI();
      if (newProject) {
        const newItem = createProjectItem(newProject.id, newProject.name, true);
        projectList.appendChild(newItem);
        currentProjectId = newProject.id;
        baseImage = null;
        inspirationImages = [];
        promptField.value = "";
        resultsGrid.innerHTML = "";
        renderBasePreview();
        renderInspirationPreview();
        setActiveView("workspace");
      } else {
        setActiveView("gallery");
      }
    }
  }

  closeDeleteModal();
};

// Setup project list event delegation
if (projectList) {
  projectList.addEventListener("click", (event) => {
    const editBtn = event.target.closest(".project-edit-btn");
    const deleteBtn = event.target.closest(".project-delete-btn");
    const projectItem = event.target.closest(".project-item");

    if (deleteBtn && projectItem) {
      event.stopPropagation();
      openDeleteModal(projectItem);
      return;
    }

    if (editBtn && projectItem) {
      event.stopPropagation();
      startRenameProject(projectItem);
      return;
    }

    if (projectItem) {
      selectProject(projectItem);
    }
  });
}

// New project button
if (newProjectBtn && projectList) {
  newProjectBtn.addEventListener("click", async () => {
    // Save current project first
    await saveCurrentProject();

    // Create new project via API
    const newProject = await createNewProjectAPI();
    if (!newProject) return;

    // Deselect all others
    const existingItems = projectList.querySelectorAll(".project-item");
    existingItems.forEach((item) => item.classList.remove("is-active"));

    // Add new project to sidebar
    const newItem = createProjectItem(newProject.id, newProject.name, true);
    projectList.appendChild(newItem);

    // Reset workspace state
    currentProjectId = newProject.id;
    baseImage = null;
    inspirationImages = [];
    promptField.value = "";
    resultsGrid.innerHTML = "";

    renderBasePreview();
    renderInspirationPreview();
    setActiveView("workspace");

    // Start rename immediately
    setTimeout(() => startRenameProject(newItem), 50);
  });
}

// Gallery button
if (galleryBtn) {
  galleryBtn.addEventListener("click", () => {
    setActiveView("gallery");
  });
}

// Admin button
if (adminNavBtn) {
  adminNavBtn.addEventListener("click", () => {
    setActiveView("admin");
  });
}

// Gallery event listeners
if (galleryLoadMore) {
  galleryLoadMore.addEventListener("click", () => loadGallery());
}

if (gallerySearch) {
  let searchTimeout;
  gallerySearch.addEventListener("input", (event) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      gallerySearchTerm = event.target.value;
      renderGallery();
    }, 300);
  });
}

if (gallerySort) {
  gallerySort.addEventListener("change", (event) => {
    gallerySortOrder = event.target.value;
    renderGallery();
  });
}

// Delete modal event listeners
if (deleteProjectModal) {
  deleteProjectModal.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-delete-close")) {
      closeDeleteModal();
    }
  });
}

if (confirmDeleteProjectBtn) {
  confirmDeleteProjectBtn.addEventListener("click", deleteProject);
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

    // Success
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

if (usagePeriod) {
  usagePeriod.addEventListener("change", loadUsageStats);
}
if (usageRefresh) {
  usageRefresh.addEventListener("click", loadUsageStats);
}

const handleSession = async (session) => {
  currentSession = session;
  if (!session) {
    currentProfile = null;
    currentProjectId = null;
    baseImage = null;
    inspirationImages = [];
    if (resultsGrid) {
      resultsGrid.innerHTML = "";
    }
    if (projectList) {
      projectList.innerHTML = "";
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
  if (userEmail) {
    userEmail.textContent = session.user?.email || "—";
  }
  if (userRole) {
    userRole.textContent = currentProfile.role === "admin" ? "Admin" : "Member";
  }
  if (adminPanel) {
    adminPanel.hidden = currentProfile.role !== "admin";
  }
  if (usagePanel) {
    usagePanel.hidden = currentProfile.role !== "admin";
  }
  if (adminNavBtn) {
    adminNavBtn.hidden = currentProfile.role !== "admin";
  }
  setActiveView(activeView);
  await loadProjects();
  await loadAdminUsers();
  await loadUsageStats();
  await loadMonthlyCost();
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
