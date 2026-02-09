import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.GEMINI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_IMAGE_BUCKET || "graphic-ai";

const supabaseEnabled = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseServiceKey,
);
const supabaseAdmin = supabaseEnabled
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const supabaseAuth = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

app.use(express.json({ limit: "35mb" }));
app.use(express.static("public"));

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1alpha/models/gemini-3-pro-image-preview:generateContent";
const VALID_ASPECT_RATIOS = new Set([
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
]);
const VALID_IMAGE_SIZES = new Set(["1K", "2K", "4K"]);
const SYSTEM_INSTRUCTION = {
  parts: [
    {
      text: [
        "You are a professional infographic and data visualization redesigner.",
        "Your absolute priority is DATA FIDELITY: every text, number, label, title, legend, axis, unit, and data point from the source image must appear in your output exactly as written, in the original language, with zero modifications.",
        "You apply visual styles from reference images (color palettes, typography styles, iconography, layout patterns, spacing) to create a fresh, polished design.",
        "You always produce a clean white background.",
        "You never invent data, never borrow text or numbers from inspiration images, and never omit any information from the source.",
        "LAYOUT RULES: Symmetric and balanced composition. Elements evenly spaced with consistent margins. Text blocks and data groups center-aligned. Related items aligned on a shared grid.",
        "TYPOGRAPHY RULES: Clear typographic hierarchy — titles largest, subtitles medium, data and labels smaller. All text must be fully readable, never truncated, never overlapping. Sufficient contrast between text and background.",
        "SPACING RULES: Never overcrowd — if content is dense, use more vertical space rather than shrinking elements. No decorative clutter.",
      ].join(" "),
    },
  ],
};

const MIME_EXTENSION_MAP = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

const ensureSupabase = (res) => {
  if (supabaseEnabled) return true;
  res
    .status(500)
    .json({
      error: "Supabase non configuré. Vérifie SUPABASE_URL/ANON/SERVICE_KEY.",
    });
  return false;
};

const getAuthToken = (req) => {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
};

const requireAuth = async (req, res, next) => {
  if (!ensureSupabase(res)) return;
  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentification requise." });
  }
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Jeton invalide ou expiré." });
  }
  req.user = data.user;
  return next();
};

const loadProfile = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, is_active")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
};

const requireActiveProfile = async (req, res, next) => {
  if (!ensureSupabase(res)) return;
  try {
    const profile = await loadProfile(req.user.id);
    if (!profile || !profile.is_active) {
      return res.status(403).json({ error: "Compte désactivé." });
    }
    req.profile = profile;
    return next();
  } catch (error) {
    return res.status(403).json({ error: "Profil introuvable." });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.profile || req.profile.role !== "admin") {
    return res.status(403).json({ error: "Accès admin requis." });
  }
  return next();
};

const resolveImageExtension = (mimeType) =>
  MIME_EXTENSION_MAP[mimeType?.toLowerCase?.()] || "png";

const uploadToSupabase = async ({ image, userId }) => {
  const extension = resolveImageExtension(image.mimeType);
  const fileName = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(image.data, "base64");
  const { error } = await supabaseAdmin.storage
    .from(supabaseBucket)
    .upload(fileName, buffer, {
      contentType: image.mimeType || "image/png",
      upsert: false,
    });
  if (error) throw error;
  return fileName;
};

const insertImageRow = async ({
  image,
  storagePath,
  userId,
  mode,
  prompt,
  projectId,
}) => {
  const { data, error } = await supabaseAdmin
    .from("images")
    .insert({
      storage_path: storagePath,
      mime_type: image.mimeType || "image/png",
      created_by: userId,
      mode: mode || "base",
      prompt: prompt || null,
      project_id: projectId || null,
    })
    .select(
      "id, created_at, storage_path, mime_type, created_by, mode, prompt, project_id",
    )
    .single();
  if (error) throw error;
  return data;
};

const signImageRows = async (rows) => {
  if (!rows || rows.length === 0) return [];
  const paths = rows.map((row) => row.storage_path);
  const { data, error } = await supabaseAdmin.storage
    .from(supabaseBucket)
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const urlMap = new Map(
    (data || [])
      .map((entry) => {
        const url = entry?.signedUrl || entry?.signedURL || entry?.signed_url;
        const path = entry?.path || entry?.file_path;
        return [path, url];
      })
      .filter((entry) => entry[0] && entry[1]),
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    mimeType: row.mime_type,
    mode: row.mode,
    prompt: row.prompt,
    storagePath: row.storage_path,
    url: urlMap.get(row.storage_path) || null,
  }));
};

const buildPrompt = ({ userPrompt, inspirationCount }) => {
  const lines = [
    "TASK: Recreate the source chart with a completely new visual design inspired by the style references.",
    "",
    "STEP 1 — DATA EXTRACTION: Identify and memorize every single piece of information in the source chart: all titles, subtitles, axis labels, data values, percentages, legends, footnotes, units, and annotations. Nothing may be omitted or altered.",
    "STEP 2 — STYLE ANALYSIS: Study the visual language of the inspiration image(s): color palette, typography choices, icon style, layout structure, spacing rhythm, and overall aesthetic.",
    "STEP 3 — SYNTHESIS: Design a new chart that contains 100% of the source data, presented with the visual style extracted from the inspirations. Prioritize readability, clean alignment, and typographic hierarchy.",
    "",
    "OUTPUT: A single polished chart image on a white background.",
  ];

  if (inspirationCount === 0) {
    lines.push(
      "No style reference provided — improve the visual design using modern infographic best practices.",
    );
  }

  if (userPrompt && userPrompt.trim().length > 0) {
    lines.push("", "ADDITIONAL USER INSTRUCTIONS:", userPrompt.trim());
  }

  return lines.join("\n");
};

const buildRefinePrompt = ({ userPrompt, inspirationCount }) => {
  const lines = [
    "TASK: Apply ONLY the requested modifications to the source image. Do not redesign it.",
    "Preserve 100% of existing information, text, numbers, and language.",
    "Keep the current style unless the user explicitly asks to change it.",
    "Output only the modified image.",
  ];

  if (userPrompt && userPrompt.trim().length > 0) {
    lines.push("", "REQUESTED MODIFICATIONS:", userPrompt.trim());
  } else {
    lines.push(
      "",
      "No modifications specified — reproduce the source exactly as-is.",
    );
  }

  if (inspirationCount > 0) {
    lines.push(`Style reference images provided: ${inspirationCount}.`);
  }

  return lines.join("\n");
};

const buildParts = ({
  baseImage,
  inspirations,
  prompt,
  count,
  variantIndex,
  variantTotal,
  mode,
}) => {
  const promptBuilder = mode === "refine" ? buildRefinePrompt : buildPrompt;
  const parts = [];

  // 1. Source image FIRST (context before instructions)
  parts.push({
    text: "SOURCE CHART — Extract ALL data, text, numbers, labels, and structure from this image:",
  });
  parts.push({
    inline_data: {
      mime_type: baseImage.mimeType,
      data: baseImage.data,
    },
    media_resolution: { level: "MEDIA_RESOLUTION_HIGH" },
  });

  // 2. Inspiration images (style only)
  if (inspirations.length > 0) {
    parts.push({
      text: "STYLE REFERENCES — Extract ONLY visual style (colors, typography, icons, layout) from these images. Ignore their data content:",
    });
    inspirations.forEach((image, index) => {
      parts.push({
        text: `Style reference ${index + 1}:`,
      });
      parts.push({
        inline_data: {
          mime_type: image.mimeType,
          data: image.data,
        },
        media_resolution: { level: "MEDIA_RESOLUTION_MEDIUM" },
      });
    });
  }

  // 3. Instructions AFTER context (per Gemini 3 best practice)
  parts.push({
    text: promptBuilder({
      userPrompt: prompt,
      inspirationCount: inspirations.length,
    }),
  });

  // 4. Variant differentiation (only when multiple variants requested)
  if (variantTotal && variantTotal > 1) {
    parts.push({
      text:
        mode === "refine"
          ? `This is variant ${variantIndex} of ${variantTotal}. Make small visual differences compared to other variants while keeping the same modifications.`
          : `This is variant ${variantIndex} of ${variantTotal}. Use a distinctly different visual interpretation: different color palette, different typography weight, different layout arrangement. The data must remain identical across all variants.`,
    });
  }

  return parts;
};

const extractImages = (data) => {
  const images = [];
  const thoughtImages = [];
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];

  candidates.forEach((candidate) => {
    const parts = candidate?.content?.parts || [];
    parts.forEach((part) => {
      const inlineData = part?.inlineData || part?.inline_data;
      if (inlineData?.data) {
        const entry = {
          mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
          data: inlineData.data,
        };
        if (part?.thought) {
          thoughtImages.push(entry);
        } else {
          images.push(entry);
        }
      }
    });
  });

  return images.length > 0 ? images : thoughtImages;
};

const buildApiError = (data, status) => ({
  message: data?.error?.message || "Erreur lors de l'appel Gemini.",
  status: status || data?.error?.code || 500,
  code: data?.error?.status,
  details: data?.error?.details || [],
});

const normalizeImageConfig = (config) => {
  if (!config || typeof config !== "object") {
    return { imageSize: "4K" };
  }

  const imageSizeInput =
    typeof config.imageSize === "string"
      ? config.imageSize.trim().toUpperCase()
      : "";
  const aspectRatioInput =
    typeof config.aspectRatio === "string" ? config.aspectRatio.trim() : "";

  const imageSize = VALID_IMAGE_SIZES.has(imageSizeInput)
    ? imageSizeInput
    : "4K";
  const aspectRatio = VALID_ASPECT_RATIOS.has(aspectRatioInput)
    ? aspectRatioInput
    : null;

  return aspectRatio ? { imageSize, aspectRatio } : { imageSize };
};

const buildGenerationConfig = (imageConfig) => {
  const generationConfig = {
    responseModalities: ["TEXT", "IMAGE"],
    temperature: 1.0,
  };

  if (imageConfig) {
    generationConfig.imageConfig = imageConfig;
  }

  return generationConfig;
};

const isImageConfigError = (error) => {
  const message = (error?.message || "").toLowerCase();
  return (
    error?.status === 400 &&
    (message.includes("imageconfig") ||
      message.includes("image_config") ||
      message.includes("imagesize") ||
      message.includes("image_size") ||
      message.includes("aspectratio") ||
      message.includes("aspect ratio"))
  );
};

const callGeminiRaw = async ({ parts, generationConfig }) => {
  const body = {
    system_instruction: SYSTEM_INSTRUCTION,
    contents: [
      {
        parts,
      },
    ],
    generationConfig,
  };

  const controller = new AbortController();
  const timeoutMs = process.env.VERCEL === "1" ? 55000 : 120000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      throw buildApiError(data, response.status);
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      const secs = Math.round(timeoutMs / 1000);
      throw {
        message: `Timeout: la generation a depasse ${secs} secondes.`,
        status: 504,
      };
    }
    throw { message: error?.message || "Erreur reseau.", status: 502 };
  } finally {
    clearTimeout(timeoutId);
  }
};

const callGemini = async ({ parts, generationConfig }) => {
  const data = await callGeminiRaw({ parts, generationConfig });
  return { images: extractImages(data) };
};

app.get("/api/config", (req, res) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Supabase non configuré." });
  }
  return res.json({
    supabaseUrl,
    supabaseAnonKey,
  });
});

app.get("/api/me", requireAuth, requireActiveProfile, (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
    },
    profile: req.profile,
  });
});

app.get("/api/library", requireAuth, requireActiveProfile, async (req, res) => {
  const limit = clamp(Number.parseInt(req.query.limit, 10) || 24, 1, 60);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  let query = supabaseAdmin
    .from("images")
    .select("id, created_at, storage_path, mime_type, created_by, mode, prompt")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) {
    return res
      .status(500)
      .json({ error: "Impossible de charger la bibliothèque." });
  }

  let signed = [];
  try {
    signed = await signImageRows(data || []);
  } catch (signError) {
    return res.status(500).json({ error: "Impossible de signer les images." });
  }
  const nextCursor =
    data && data.length === limit
      ? data[data.length - 1]?.created_at || null
      : null;

  return res.json({ items: signed, nextCursor });
});

app.get(
  "/api/images/:id",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const imageId = req.params.id;
    if (!imageId) {
      return res.status(400).json({ error: "Image invalide." });
    }

    const { data, error } = await supabaseAdmin
      .from("images")
      .select("storage_path, mime_type")
      .eq("id", imageId)
      .single();

    if (error || !data?.storage_path) {
      return res.status(404).json({ error: "Image introuvable." });
    }

    let signedUrl = null;
    try {
      const signed = await signImageRows([
        {
          id: imageId,
          created_at: null,
          storage_path: data.storage_path,
          mime_type: data.mime_type,
          created_by: null,
          mode: null,
          prompt: null,
        },
      ]);
      signedUrl = signed[0]?.url || null;
    } catch (signError) {
      signedUrl = null;
    }

    if (!signedUrl) {
      return res
        .status(500)
        .json({ error: "Impossible de générer le lien sécurisé." });
    }

    try {
      const fileResponse = await fetch(signedUrl);
      if (!fileResponse.ok) {
        return res
          .status(502)
          .json({ error: "Impossible de récupérer l'image." });
      }
      const arrayBuffer = await fileResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return res.json({
        data: base64,
        mimeType: data.mime_type || "image/png",
      });
    } catch (fetchError) {
      return res.status(502).json({ error: "Téléchargement échoué." });
    }
  },
);

// DELETE /api/images/:id - Supprimer une image générée
app.delete(
  "/api/images/:id",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const imageId = req.params.id;
    if (!imageId) {
      return res.status(400).json({ error: "Image invalide." });
    }

    // Récupérer l'image et vérifier la propriété
    const { data, error } = await supabaseAdmin
      .from("images")
      .select("id, storage_path, created_by")
      .eq("id", imageId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Image introuvable." });
    }

    // Vérifier que l'utilisateur est propriétaire
    if (data.created_by !== req.user.id) {
      return res.status(403).json({ error: "Accès non autorisé." });
    }

    // Supprimer du storage
    if (data.storage_path) {
      try {
        await supabaseAdmin.storage
          .from(supabaseBucket)
          .remove([data.storage_path]);
      } catch (e) {
        // Ignorer les erreurs de suppression storage
      }
    }

    // Supprimer de la base de données
    const { error: deleteError } = await supabaseAdmin
      .from("images")
      .delete()
      .eq("id", imageId);

    if (deleteError) {
      return res.status(500).json({ error: "Suppression impossible." });
    }

    return res.json({ success: true });
  },
);

app.get(
  "/api/admin/users",
  requireAuth,
  requireActiveProfile,
  requireAdmin,
  async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return res
        .status(500)
        .json({ error: "Impossible de charger les utilisateurs." });
    }

    return res.json({ users: data || [] });
  },
);

app.post(
  "/api/admin/users",
  requireAuth,
  requireActiveProfile,
  requireAdmin,
  async (req, res) => {
    const { email, password, role } = req.body || {};
    const safeEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const safePassword = typeof password === "string" ? password.trim() : "";
    const safeRole = role === "admin" ? "admin" : "member";

    if (!safeEmail || !safePassword) {
      return res.status(400).json({ error: "Email et mot de passe requis." });
    }
    if (safePassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Mot de passe trop court (6 caractères min)." });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: safeEmail,
      password: safePassword,
      email_confirm: true,
    });

    if (error || !data?.user) {
      return res
        .status(400)
        .json({ error: error?.message || "Création impossible." });
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: data.user.id,
        email: safeEmail,
        role: safeRole,
        is_active: true,
      });

    if (profileError) {
      return res
        .status(500)
        .json({ error: "Utilisateur créé mais profil manquant." });
    }

    return res.json({
      user: {
        id: data.user.id,
        email: safeEmail,
        role: safeRole,
        is_active: true,
      },
    });
  },
);

app.patch(
  "/api/admin/users/:id",
  requireAuth,
  requireActiveProfile,
  requireAdmin,
  async (req, res) => {
    const userId = req.params.id;
    const { role, is_active: isActive, password } = req.body || {};
    const updates = {};

    if (role) {
      updates.role = role === "admin" ? "admin" : "member";
    }

    if (typeof isActive === "boolean") {
      if (userId === req.user.id && isActive === false) {
        return res
          .status(400)
          .json({ error: "Impossible de désactiver votre propre compte." });
      }
      updates.is_active = isActive;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (error) {
        return res.status(500).json({ error: "Mise à jour impossible." });
      }
    }

    if (password) {
      const safePassword = String(password).trim();
      if (safePassword.length < 6) {
        return res.status(400).json({ error: "Mot de passe trop court." });
      }
      const { error: passwordError } =
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: safePassword,
        });
      if (passwordError) {
        return res
          .status(500)
          .json({ error: "Mise à jour du mot de passe impossible." });
      }
    }

    return res.json({ ok: true });
  },
);

app.post(
  "/api/generate",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    if (!ensureSupabase(res)) return;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY manquante dans l'environnement." });
    }

    const {
      baseImage,
      inspirationImages,
      prompt,
      numImages,
      imageConfig,
      mode,
      projectId,
    } = req.body || {};

    if (!baseImage?.data || !baseImage?.mimeType) {
      return res.status(400).json({ error: "Image principale manquante." });
    }

    const safeCount = clamp(Number.parseInt(numImages, 10) || 1, 1, 4);
    const inspirations = Array.isArray(inspirationImages)
      ? inspirationImages
          .filter((image) => image?.data && image?.mimeType)
          .slice(0, 4)
      : [];

    try {
      const errors = [];
      const warnings = [];

      const normalizedImageConfig = normalizeImageConfig(imageConfig);
      const generationConfig = buildGenerationConfig(normalizedImageConfig);

      const runBatch = async (count, config, offset) => {
        const safeOffset = Number.isInteger(offset) ? offset : 0;
        const tasks = Array.from({ length: count }, (_, index) =>
          callGemini({
            parts: buildParts({
              baseImage,
              inspirations,
              prompt,
              count: safeCount,
              variantIndex: safeOffset + index + 1,
              variantTotal: safeCount,
              mode,
            }),
            generationConfig: config,
          }),
        );
        const results = await Promise.allSettled(tasks);
        const batchImages = [];
        const batchErrors = [];

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            batchImages.push(...result.value.images);
          } else {
            batchErrors.push(result.reason);
          }
        });

        return { batchImages, batchErrors };
      };

      let images = [];
      let batch = await runBatch(safeCount, generationConfig, 0);
      images = images.concat(batch.batchImages);
      errors.push(...batch.batchErrors);

      const missingAfterPrimary = safeCount - images.length;
      if (
        missingAfterPrimary > 0 &&
        batch.batchErrors.some(isImageConfigError)
      ) {
        warnings.push("imageConfig refusee, fallback en 1K sans aspect ratio.");
        const fallbackConfig = buildGenerationConfig({ imageSize: "1K" });
        const offset = safeCount - missingAfterPrimary;
        batch = await runBatch(missingAfterPrimary, fallbackConfig, offset);
        images = images.concat(batch.batchImages);
        errors.push(...batch.batchErrors);
      }

      images = images.slice(0, safeCount);

      if (images.length === 0) {
        return res.status(502).json({
          error: "Aucune image générée. Réessaie avec un prompt plus précis.",
          errors,
        });
      }

      const storedImages = [];
      const storageErrors = [];
      const storageTasks = images.map(async (image) => {
        const storagePath = await uploadToSupabase({
          image,
          userId: req.user.id,
        });
        return insertImageRow({
          image,
          storagePath,
          userId: req.user.id,
          mode,
          prompt,
          projectId,
        });
      });

      const storageResults = await Promise.allSettled(storageTasks);
      const storedRows = [];
      storageResults.forEach((result) => {
        if (result.status === "fulfilled") {
          storedRows.push(result.value);
        } else {
          storageErrors.push(result.reason?.message || "Stockage échoué.");
        }
      });

      if (storedRows.length > 0) {
        try {
          storedImages.push(...(await signImageRows(storedRows)));
        } catch (signError) {
          storageErrors.push("Signature des liens impossible.");
        }
      }

      if (images.length < safeCount) {
        warnings.push(
          `Le modele a retourne ${images.length} image(s) sur ${safeCount}.`,
        );
      }
      if (errors.length > 0) {
        warnings.push("Certaines tentatives ont echoue, consulte les details.");
      }
      if (storageErrors.length > 0) {
        warnings.push("Certaines images n'ont pas pu être sauvegardées.");
      }

      return res.json({
        images,
        stored: storedImages,
        requested: safeCount,
        received: images.length,
        warnings,
        errors,
        storageErrors,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Erreur serveur pendant la génération.",
        details: error?.message ? [error.message] : [],
      });
    }
  },
);

// ============================================
// PROJECTS API
// ============================================

// GET /api/projects - Liste des projets de l'utilisateur
app.get(
  "/api/projects",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select(
        "id, name, prompt, base_image_storage_path, base_image_mime_type, created_at, updated_at",
      )
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return res
        .status(500)
        .json({ error: "Impossible de charger les projets." });
    }

    // Signer les URLs des images de base
    const projectsWithUrls = await Promise.all(
      (data || []).map(async (project) => {
        let baseImageUrl = null;
        if (project.base_image_storage_path) {
          try {
            const { data: signedData } = await supabaseAdmin.storage
              .from(supabaseBucket)
              .createSignedUrl(project.base_image_storage_path, 60 * 60);
            baseImageUrl = signedData?.signedUrl || null;
          } catch (e) {
            baseImageUrl = null;
          }
        }
        return {
          id: project.id,
          name: project.name,
          prompt: project.prompt,
          baseImageUrl,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        };
      }),
    );

    return res.json({ projects: projectsWithUrls });
  },
);

// GET /api/projects/:id - Charger un projet complet
app.get(
  "/api/projects/:id",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const projectId = req.params.id;

    // Récupérer le projet
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    // Récupérer les inspirations
    const { data: inspirations } = await supabaseAdmin
      .from("project_inspirations")
      .select("id, storage_path, mime_type, position")
      .eq("project_id", projectId)
      .order("position", { ascending: true });

    // Récupérer les images générées
    const { data: generatedImages } = await supabaseAdmin
      .from("images")
      .select("id, created_at, storage_path, mime_type, mode, prompt")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    // Signer l'URL de l'image de base
    let baseImageUrl = null;
    if (project.base_image_storage_path) {
      try {
        const { data: signedData } = await supabaseAdmin.storage
          .from(supabaseBucket)
          .createSignedUrl(project.base_image_storage_path, 60 * 60);
        baseImageUrl = signedData?.signedUrl || null;
      } catch (e) {
        baseImageUrl = null;
      }
    }

    // Signer les URLs des inspirations
    let signedInspirations = [];
    if (inspirations && inspirations.length > 0) {
      try {
        const paths = inspirations.map((i) => i.storage_path);
        const { data: signedData } = await supabaseAdmin.storage
          .from(supabaseBucket)
          .createSignedUrls(paths, 60 * 60);
        const urlMap = new Map(
          (signedData || []).map((entry) => [entry.path, entry.signedUrl]),
        );
        signedInspirations = inspirations.map((i) => ({
          id: i.id,
          position: i.position,
          mimeType: i.mime_type,
          url: urlMap.get(i.storage_path) || null,
        }));
      } catch (e) {
        signedInspirations = inspirations.map((i) => ({
          id: i.id,
          position: i.position,
          mimeType: i.mime_type,
          url: null,
        }));
      }
    }

    // Signer les URLs des images générées
    let signedGeneratedImages = [];
    try {
      signedGeneratedImages = await signImageRows(generatedImages || []);
    } catch (e) {
      signedGeneratedImages = [];
    }

    return res.json({
      project: {
        id: project.id,
        name: project.name,
        prompt: project.prompt,
        baseImageUrl,
        baseMimeType: project.base_image_mime_type,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      },
      inspirations: signedInspirations,
      generatedImages: signedGeneratedImages,
    });
  },
);

// POST /api/projects - Créer un nouveau projet
app.post(
  "/api/projects",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const { name } = req.body || {};
    const safeName = String(name || "Nouveau projet")
      .trim()
      .slice(0, 100);

    const { data, error } = await supabaseAdmin
      .from("projects")
      .insert({
        user_id: req.user.id,
        name: safeName,
      })
      .select("id, name, created_at, updated_at")
      .single();

    if (error) {
      return res.status(500).json({ error: "Impossible de créer le projet." });
    }

    return res.json({ project: data });
  },
);

// PATCH /api/projects/:id - Mettre à jour un projet
app.patch(
  "/api/projects/:id",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const projectId = req.params.id;
    const { name, prompt, baseImage } = req.body || {};

    // Vérifier la propriété
    const { data: existing } = await supabaseAdmin
      .from("projects")
      .select("id, base_image_storage_path")
      .eq("id", projectId)
      .eq("user_id", req.user.id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim().slice(0, 100);
    if (prompt !== undefined) updates.prompt = String(prompt).slice(0, 10000);

    // Gérer l'upload de l'image de base
    if (baseImage && baseImage.data) {
      // Supprimer l'ancienne image si elle existe
      if (existing.base_image_storage_path) {
        try {
          await supabaseAdmin.storage
            .from(supabaseBucket)
            .remove([existing.base_image_storage_path]);
        } catch (e) {
          // Ignorer les erreurs de suppression
        }
      }

      // Uploader la nouvelle image
      const extension = resolveImageExtension(baseImage.mimeType);
      const storagePath = `${req.user.id}/projects/${projectId}/base.${extension}`;
      const buffer = Buffer.from(baseImage.data, "base64");

      const { error: uploadError } = await supabaseAdmin.storage
        .from(supabaseBucket)
        .upload(storagePath, buffer, {
          contentType: baseImage.mimeType || "image/png",
          upsert: true,
        });

      if (uploadError) {
        return res
          .status(500)
          .json({ error: "Impossible d'uploader l'image." });
      }

      updates.base_image_storage_path = storagePath;
      updates.base_image_mime_type = baseImage.mimeType || "image/png";
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin
        .from("projects")
        .update(updates)
        .eq("id", projectId);

      if (error) {
        return res.status(500).json({ error: "Mise à jour impossible." });
      }
    }

    return res.json({ success: true });
  },
);

// DELETE /api/projects/:id - Supprimer un projet
app.delete(
  "/api/projects/:id",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const projectId = req.params.id;

    // Vérifier la propriété et récupérer les chemins pour nettoyage
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, base_image_storage_path")
      .eq("id", projectId)
      .eq("user_id", req.user.id)
      .single();

    if (!project) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    // Récupérer les chemins des inspirations
    const { data: inspirations } = await supabaseAdmin
      .from("project_inspirations")
      .select("storage_path")
      .eq("project_id", projectId);

    // Supprimer les fichiers du storage
    const pathsToDelete = [];
    if (project.base_image_storage_path) {
      pathsToDelete.push(project.base_image_storage_path);
    }
    (inspirations || []).forEach((insp) => {
      if (insp.storage_path) pathsToDelete.push(insp.storage_path);
    });

    if (pathsToDelete.length > 0) {
      try {
        await supabaseAdmin.storage.from(supabaseBucket).remove(pathsToDelete);
      } catch (e) {
        // Ignorer les erreurs de suppression storage
      }
    }

    // Supprimer le projet (cascade vers inspirations, nullify images.project_id)
    const { error } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      return res.status(500).json({ error: "Suppression impossible." });
    }

    return res.json({ success: true });
  },
);

// POST /api/projects/:id/inspirations - Ajouter une inspiration
app.post(
  "/api/projects/:id/inspirations",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const projectId = req.params.id;
    const { image, position } = req.body || {};

    if (!image || !image.data) {
      return res.status(400).json({ error: "Image requise." });
    }

    // Vérifier la propriété
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", req.user.id)
      .single();

    if (!project) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    // Vérifier le nombre d'inspirations existantes
    const { data: existing } = await supabaseAdmin
      .from("project_inspirations")
      .select("id")
      .eq("project_id", projectId);

    if ((existing || []).length >= 4) {
      return res
        .status(400)
        .json({ error: "Maximum 4 inspirations par projet." });
    }

    // Uploader vers le storage
    const safePosition = Math.min(Math.max(0, Number(position) || 0), 3);
    const extension = resolveImageExtension(image.mimeType);
    const storagePath = `${req.user.id}/projects/${projectId}/inspiration-${safePosition}-${Date.now()}.${extension}`;
    const buffer = Buffer.from(image.data, "base64");

    const { error: uploadError } = await supabaseAdmin.storage
      .from(supabaseBucket)
      .upload(storagePath, buffer, {
        contentType: image.mimeType || "image/png",
        upsert: false,
      });

    if (uploadError) {
      return res
        .status(500)
        .json({ error: "Impossible d'uploader l'inspiration." });
    }

    // Insérer l'enregistrement
    const { data, error } = await supabaseAdmin
      .from("project_inspirations")
      .insert({
        project_id: projectId,
        storage_path: storagePath,
        mime_type: image.mimeType || "image/png",
        position: safePosition,
      })
      .select("id, storage_path, mime_type, position")
      .single();

    if (error) {
      return res
        .status(500)
        .json({ error: "Impossible d'ajouter l'inspiration." });
    }

    return res.json({ inspiration: data });
  },
);

// DELETE /api/projects/:projectId/inspirations/:inspirationId - Supprimer une inspiration
app.delete(
  "/api/projects/:projectId/inspirations/:inspirationId",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const { projectId, inspirationId } = req.params;

    // Récupérer l'inspiration
    const { data: inspiration } = await supabaseAdmin
      .from("project_inspirations")
      .select("id, storage_path, project_id")
      .eq("id", inspirationId)
      .single();

    if (!inspiration) {
      return res.status(404).json({ error: "Inspiration introuvable." });
    }

    // Vérifier la propriété via le projet
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", inspiration.project_id)
      .eq("user_id", req.user.id)
      .single();

    if (!project) {
      return res.status(403).json({ error: "Accès non autorisé." });
    }

    // Supprimer du storage
    if (inspiration.storage_path) {
      try {
        await supabaseAdmin.storage
          .from(supabaseBucket)
          .remove([inspiration.storage_path]);
      } catch (e) {
        // Ignorer les erreurs
      }
    }

    // Supprimer l'enregistrement
    await supabaseAdmin
      .from("project_inspirations")
      .delete()
      .eq("id", inspirationId);

    return res.json({ success: true });
  },
);

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Graphic AI prêt sur http://localhost:${port}`);
  });
}

export default app;
