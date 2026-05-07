import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const MODEL = "gpt-image-2";

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

// Frontend imageSize tier → OpenAI quality
const QUALITY_FROM_SIZE = { "1K": "low", "2K": "medium", "4K": "high" };

// Map a "W:H" aspect ratio to one of the three sizes supported by gpt-image-2.
const openaiSizeFromAspectRatio = (aspectRatio) => {
  if (!aspectRatio) return "auto";
  const parts = String(aspectRatio).split(":");
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!w || !h) return "auto";
  const r = w / h;
  if (r > 1.15) return "1536x1024";
  if (r < 0.87) return "1024x1536";
  return "1024x1024";
};

const SYSTEM_INSTRUCTION_TEXT = [
  "You are a professional infographic and data visualization redesigner.",
  "Your absolute priority is DATA FIDELITY: every text, number, label, title, legend, axis, unit, and data point from the source image must appear in your output exactly as written, in the original language, with zero modifications.",
  "You apply visual styles from reference images (color palettes, typography styles, iconography, layout patterns, spacing) to create a fresh, polished design.",
  "You always produce a clean white background, clear visual hierarchy, proper alignments, and readable typography.",
  "You never invent data, never borrow text or numbers from inspiration images, and never omit any information from the source.",
].join(" ");

const CREATE_SYSTEM_INSTRUCTION_TEXT = [
  "You are a professional visual designer and infographic creator.",
  "Your goal is to produce high-quality, polished visuals from the user's textual description.",
  "You encourage creative freedom: interpret the brief with originality while maintaining a professional, clean result.",
  "Always produce a clean white background, clear visual hierarchy, proper alignments, and readable typography.",
  "If a source image is provided, use it as loose inspiration — extract layout ideas or content cues without strict data fidelity.",
  "If style reference images are provided, extract their visual language (color palette, typography, iconography, layout patterns) and apply it creatively.",
  "You may invent placeholder data, icons, or illustrations if they serve the user's described concept.",
  "Prioritize visual impact, clarity, and aesthetic quality above all.",
].join(" ");

const ensureSupabase = (res) => {
  if (supabaseEnabled) return true;
  res.status(500).json({
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
    .select("id, email, role, is_active, daily_limit_override, must_change_password")
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

const checkQuota = async (req, res, next) => {
  if (!supabaseEnabled) return next();
  try {
    const { data: limitRow } = await supabaseAdmin
      .from("usage_limits")
      .select("value")
      .eq("key", "default_daily_limit")
      .single();
    const globalLimit = parseInt(limitRow?.value) || 20;
    const effectiveLimit =
      req.profile.daily_limit_override ?? globalLimit;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("api_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("success", true)
      .gte("created_at", todayStart.toISOString());

    if (count >= effectiveLimit) {
      return res.status(429).json({
        error: `Limite quotidienne atteinte (${effectiveLimit} générations/jour). Réessayez demain ou contactez un administrateur.`,
        quota: {
          dailyLimit: effectiveLimit,
          usedToday: count,
          remaining: 0,
        },
      });
    }

    req.quota = {
      dailyLimit: effectiveLimit,
      usedToday: count,
      remaining: effectiveLimit - count,
    };
    return next();
  } catch (err) {
    console.error("Quota check error:", err?.message);
    return next();
  }
};

const buildPrompt = ({ userPrompt, inspirationCount, hasSourceImage }) => {
  const lines = [
    SYSTEM_INSTRUCTION_TEXT,
    "",
    "TASK: Recreate the source chart with a completely new visual design inspired by the style references.",
    "",
  ];

  if (hasSourceImage && inspirationCount > 0) {
    lines.push(
      `IMAGE ROLES — The first attached image is the SOURCE CHART (extract ALL data, text, numbers, labels, structure). The next ${inspirationCount} image(s) are STYLE REFERENCES (extract ONLY visual language: colors, typography, icons, layout — ignore their data and text).`,
    );
  } else if (hasSourceImage) {
    lines.push(
      "IMAGE ROLE — The attached image is the SOURCE CHART. Extract ALL data, text, numbers, labels, and structure from it.",
    );
  }

  lines.push(
    "",
    "STEP 1 — DATA EXTRACTION: Identify and memorize every single piece of information in the source chart: all titles, subtitles, axis labels, data values, percentages, legends, footnotes, units, and annotations. Nothing may be omitted or altered.",
    "STEP 2 — STYLE ANALYSIS: Study the visual language of the inspiration image(s): color palette, typography choices, icon style, layout structure, spacing rhythm, and overall aesthetic. Do not copy any information or text from the inspiration, only visual design.",
    "STEP 3 — SYNTHESIS: Design a new chart that contains 100% of the source data, presented with the visual style extracted from the inspirations. Prioritize readability, clean alignment, and typographic hierarchy.",
    "",
    "OUTPUT: A single polished chart image on a white background.",
  );

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

const buildRefinePrompt = ({ userPrompt, inspirationCount, hasSourceImage }) => {
  const lines = [
    SYSTEM_INSTRUCTION_TEXT,
    "",
    "TASK: Apply ONLY the requested modifications to the source image. Do not redesign it.",
    "Preserve 100% of existing information, text, numbers, and language.",
    "Keep the current style unless the user explicitly asks to change it.",
    "Output only the modified image.",
  ];

  if (hasSourceImage && inspirationCount > 0) {
    lines.push(
      "",
      `IMAGE ROLES — The first attached image is the SOURCE to refine. The next ${inspirationCount} image(s) are optional STYLE REFERENCES (use only if the requested modifications imply a style change).`,
    );
  }

  if (userPrompt && userPrompt.trim().length > 0) {
    lines.push("", "REQUESTED MODIFICATIONS:", userPrompt.trim());
  } else {
    lines.push(
      "",
      "No modifications specified — reproduce the source exactly as-is.",
    );
  }

  return lines.join("\n");
};

const buildCreatePrompt = ({ userPrompt, inspirationCount, hasSourceImage }) => {
  const lines = [
    CREATE_SYSTEM_INSTRUCTION_TEXT,
    "",
    "TASK: Create a professional visual from the description below.",
    "",
  ];

  if (hasSourceImage && inspirationCount > 0) {
    lines.push(
      `IMAGE ROLES — The first attached image is a loose REFERENCE for layout/content cues (no strict data fidelity). The next ${inspirationCount} image(s) are STYLE REFERENCES — extract ONLY their visual language.`,
    );
  } else if (hasSourceImage) {
    lines.push(
      "IMAGE ROLE — The attached image is a loose REFERENCE for layout/content cues. Reinterpret it creatively; no strict data fidelity required.",
    );
  } else if (inspirationCount > 0) {
    lines.push(
      `IMAGE ROLES — The ${inspirationCount} attached image(s) are STYLE REFERENCES — extract ONLY their visual language.`,
    );
  }

  lines.push(
    "",
    "STEP 1 — UNDERSTAND THE BRIEF: Read the user's description carefully and identify the key message, structure, and visual elements requested.",
    "STEP 2 — STYLE ANALYSIS: " +
      (inspirationCount > 0
        ? `Study the visual language of the ${inspirationCount} style reference(s): color palette, typography, icon style, layout structure, and overall aesthetic. Apply this style creatively.`
        : "Use modern infographic best practices: clean layout, professional color palette, clear typography hierarchy."),
    "",
    "OUTPUT: A single polished visual on a white background. Prioritize clarity, visual impact, and professional quality.",
  );

  if (userPrompt && userPrompt.trim().length > 0) {
    lines.push("", "USER DESCRIPTION:", userPrompt.trim());
  }

  return lines.join("\n");
};

const buildFinalPrompt = ({
  baseImage,
  inspirations,
  prompt,
  variantIndex,
  variantTotal,
  mode,
}) => {
  const isCreate = mode === "create";
  const promptBuilder = isCreate
    ? buildCreatePrompt
    : mode === "refine"
      ? buildRefinePrompt
      : buildPrompt;

  let finalPrompt = promptBuilder({
    userPrompt: prompt,
    inspirationCount: inspirations.length,
    hasSourceImage: Boolean(baseImage),
  });

  if (variantTotal && variantTotal > 1) {
    const variantNote =
      mode === "refine"
        ? `\n\nVARIANT NOTE: This is variant ${variantIndex} of ${variantTotal}. Make small visual differences compared to other variants while keeping the same modifications.`
        : `\n\nVARIANT NOTE: This is variant ${variantIndex} of ${variantTotal}. Use a distinctly different visual interpretation: different color palette, different typography weight, different layout arrangement.${isCreate ? "" : " The data must remain identical across all variants."}`;
    finalPrompt += variantNote;
  }

  return finalPrompt;
};

const extractImages = (data) => {
  const items = Array.isArray(data?.data) ? data.data : [];
  const images = [];
  items.forEach((item) => {
    if (item?.b64_json) {
      images.push({ mimeType: "image/png", data: item.b64_json });
    }
  });
  return images;
};

const buildApiError = (data, status) => {
  const err = data?.error || {};
  return {
    message: err.message || "Erreur lors de l'appel OpenAI.",
    status: status || 500,
    code: err.code || err.type,
    details: [],
  };
};

const USD_TO_EUR = 0.84;
const MONTHLY_BASE_EUR = 18;

// gpt-image-2 per-image USD pricing
const PRICING_TABLE = {
  low: { "1024x1024": 0.006, "1024x1536": 0.005, "1536x1024": 0.005 },
  medium: { "1024x1024": 0.053, "1024x1536": 0.041, "1536x1024": 0.041 },
  high: { "1024x1024": 0.211, "1024x1536": 0.165, "1536x1024": 0.165 },
};

const pricePerImage = (quality, size) => {
  const tier = PRICING_TABLE[quality] || PRICING_TABLE.medium;
  // For "auto" or any unmapped size, fall back to the square price as a safe estimate.
  return tier[size] ?? tier["1024x1024"];
};

const calculateCostUsd = ({ outputImageCount, quality, size }) => {
  const count = outputImageCount || 0;
  if (count <= 0) return 0;
  const cost = count * pricePerImage(quality, size);
  return Math.round(cost * 1_000_000) / 1_000_000;
};

const logApiUsage = async ({
  userId,
  projectId,
  mode,
  imageSize,
  quality,
  size,
  inputImageCount,
  outputImageCount,
  usage,
  success,
}) => {
  if (!supabaseEnabled) return;
  const estimatedCostUsd = calculateCostUsd({
    outputImageCount: outputImageCount || 0,
    quality,
    size,
  });
  try {
    await supabaseAdmin.from("api_usage").insert({
      user_id: userId,
      project_id: projectId || null,
      mode: mode || "base",
      image_size: imageSize || "1K",
      input_image_count: inputImageCount || 1,
      output_image_count: outputImageCount || 0,
      prompt_token_count: usage?.input_tokens ?? null,
      candidates_token_count: usage?.output_tokens ?? null,
      total_token_count: usage?.total_tokens ?? null,
      estimated_cost_usd: estimatedCostUsd,
      is_fallback: false,
      success: success !== false,
    });
  } catch (err) {
    console.error("Failed to log API usage:", err?.message || err);
  }
};

const normalizeImageConfig = (config) => {
  if (!config || typeof config !== "object") {
    return { imageSize: "2K" };
  }

  const imageSizeInput =
    typeof config.imageSize === "string"
      ? config.imageSize.trim().toUpperCase()
      : "";
  const aspectRatioInput =
    typeof config.aspectRatio === "string" ? config.aspectRatio.trim() : "";

  const imageSize = VALID_IMAGE_SIZES.has(imageSizeInput)
    ? imageSizeInput
    : "2K";
  const aspectRatio = VALID_ASPECT_RATIOS.has(aspectRatioInput)
    ? aspectRatioInput
    : null;

  return aspectRatio ? { imageSize, aspectRatio } : { imageSize };
};

const isTransientGenerationError = (error) => {
  const message = (error?.message || "").toLowerCase();
  const code = (error?.code || "").toString().toLowerCase();
  const status = Number(error?.status);
  return (
    [429, 500, 502, 503, 504].includes(status) ||
    code === "rate_limit_exceeded" ||
    code === "server_error" ||
    code === "service_unavailable" ||
    code === "insufficient_quota" ||
    message.includes("rate limit") ||
    message.includes("try again") ||
    message.includes("temporarily unavailable") ||
    message.includes("overloaded")
  );
};

const buildNoImageResponse = (errors) => {
  if (!Array.isArray(errors) || errors.length === 0) {
    return {
      status: 502,
      message: "Aucune image n'a été retournée. Réessaie dans quelques instants.",
    };
  }

  const hasRateLimit = errors.some((e) => {
    const msg = (e?.message || "").toLowerCase();
    return msg.includes("rate limit") || Number(e?.status) === 429;
  });
  const hasTimeout = errors.some((e) => Number(e?.status) === 504);

  if (hasRateLimit) {
    return {
      status: 503,
      message: "Le service de génération (OpenAI) est actuellement surchargé. Réessaie dans quelques minutes.",
    };
  }

  if (hasTimeout) {
    return {
      status: 504,
      message: "La génération a pris trop de temps. Les serveurs OpenAI sont probablement ralentis. Réessaie dans quelques instants.",
    };
  }

  if (errors.some(isTransientGenerationError)) {
    return {
      status: 503,
      message: "Les serveurs OpenAI sont temporairement indisponibles. Réessaie dans quelques instants.",
    };
  }

  const clientError = errors.find(
    (error) => Number(error?.status) >= 400 && Number(error?.status) < 500,
  );
  if (clientError) {
    return {
      status: Number(clientError.status) || 400,
      message: "La génération a échoué. Vérifie le prompt et les paramètres puis réessaie.",
    };
  }

  return {
    status: 502,
    message: "Le service de génération n'a pas pu produire d'image. Réessaie dans quelques instants.",
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Build the request to the OpenAI image API. Uses /images/edits when input
// images are provided, /images/generations otherwise.
const buildOpenAIRequest = ({ model, prompt, baseImage, inspirations, size, quality }) => {
  const hasImages = Boolean(baseImage) || inspirations.length > 0;

  if (!hasImages) {
    return {
      url: `${OPENAI_BASE_URL}/images/generations`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality,
        n: 1,
      }),
      isMultipart: false,
    };
  }

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", quality);
  form.append("n", "1");

  const appendImage = (img, filename) => {
    const buf = Buffer.from(img.data, "base64");
    const blob = new Blob([buf], { type: img.mimeType || "image/png" });
    // OpenAI accepts repeated `image` fields for multi-image input.
    form.append("image", blob, filename);
  };

  if (baseImage) appendImage(baseImage, "source.png");
  inspirations.forEach((img, i) => appendImage(img, `style_${i + 1}.png`));

  return {
    url: `${OPENAI_BASE_URL}/images/edits`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    isMultipart: true,
  };
};

// Call gpt-image-2 with retries + exponential backoff on transient errors.
const callOpenAI = async ({ prompt, baseImage, inspirations, size, quality, maxRetries = 3, onProgress, label = "" }) => {
  const timeoutMs = process.env.VERCEL === "1" ? 55000 : 180000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { url, headers, body } = buildOpenAIRequest({
        model: MODEL, prompt, baseImage, inspirations, size, quality,
      });

      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiError = buildApiError(data, response.status);
        if (attempt < maxRetries && isTransientGenerationError(apiError)) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 15000);
          console.log(`[${label}] OpenAI ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}), retry in ${Math.round(delay)}ms...`);
          if (onProgress) onProgress({ event: "retry", attempt: attempt + 1, maxAttempts: maxRetries + 1, status: response.status, delayMs: Math.round(delay) });
          clearTimeout(timeoutId);
          await sleep(delay);
          continue;
        }
        throw apiError;
      }

      return {
        images: extractImages(data),
        usage: data?.usage || null,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error?.name === "AbortError") {
        const secs = Math.round(timeoutMs / 1000);
        throw {
          message: `Timeout: la generation a depasse ${secs} secondes.`,
          status: 504,
        };
      }
      const wrapped = {
        message: error?.message || "Erreur reseau.",
        status: Number(error?.status) || 502,
        code: error?.code,
        details: Array.isArray(error?.details) ? error.details : [],
      };
      if (attempt < maxRetries && isTransientGenerationError(wrapped)) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 15000);
        console.log(`[${label}] OpenAI error (attempt ${attempt + 1}/${maxRetries + 1}), retry in ${Math.round(delay)}ms...`);
        if (onProgress) onProgress({ event: "retry", attempt: attempt + 1, maxAttempts: maxRetries + 1, status: wrapped.status, delayMs: Math.round(delay) });
        await sleep(delay);
        continue;
      }
      throw wrapped;
    } finally {
      clearTimeout(timeoutId);
    }
  }
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

app.get(
  "/api/admin/users",
  requireAuth,
  requireActiveProfile,
  requireAdmin,
  async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, is_active, created_at, must_change_password")
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
        must_change_password: true,
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
        must_change_password: true,
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
    const { role, is_active: isActive, password, daily_limit_override: dailyLimitOverride } = req.body || {};
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

    if (dailyLimitOverride !== undefined) {
      updates.daily_limit_override =
        dailyLimitOverride === null ? null : parseInt(dailyLimitOverride);
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

// Delete user
app.delete(
  "/api/admin/users/:id",
  requireAuth,
  requireActiveProfile,
  requireAdmin,
  async (req, res) => {
    const userId = req.params.id;

    if (userId === req.user.id) {
      return res
        .status(400)
        .json({ error: "Impossible de supprimer votre propre compte." });
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      return res.status(500).json({ error: "Suppression du profil impossible." });
    }

    const { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      return res
        .status(500)
        .json({ error: "Profil supprimé mais compte auth non supprimé." });
    }

    return res.json({ ok: true });
  },
);

// Bulk import users from email list
app.post(
  "/api/admin/users/import",
  requireAuth,
  requireActiveProfile,
  requireAdmin,
  async (req, res) => {
    const { emails } = req.body || {};
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "Liste d'emails requise." });
    }

    if (emails.length > 500) {
      return res.status(400).json({ error: "Maximum 500 utilisateurs par import." });
    }

    const defaultPassword = "Colombus138!";
    const results = { created: [], skipped: [], errors: [] };

    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("email");
    const existingEmails = new Set(
      (existingProfiles || []).map((p) => p.email.toLowerCase()),
    );

    for (const rawEmail of emails) {
      const email =
        typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

      if (!email || !email.includes("@")) {
        results.errors.push({ email: rawEmail, reason: "Email invalide." });
        continue;
      }

      if (existingEmails.has(email)) {
        results.skipped.push({ email, reason: "Utilisateur déjà existant." });
        continue;
      }

      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: defaultPassword,
          email_confirm: true,
        });

        if (error || !data?.user) {
          results.errors.push({
            email,
            reason: error?.message || "Création impossible.",
          });
          continue;
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: data.user.id,
            email,
            role: "member",
            is_active: true,
            must_change_password: true,
          });

        if (profileError) {
          results.errors.push({
            email,
            reason: "Compte auth créé mais profil manquant.",
          });
          continue;
        }

        existingEmails.add(email);
        results.created.push({ email });
      } catch (err) {
        results.errors.push({
          email,
          reason: err.message || "Erreur inattendue.",
        });
      }
    }

    return res.json({ results });
  },
);

// Clear must_change_password flag after password change
app.post(
  "/api/me/password-changed",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", req.user.id);

    if (error) {
      return res.status(500).json({ error: "Mise à jour impossible." });
    }
    return res.json({ ok: true });
  },
);

app.get("/api/quota", requireAuth, requireActiveProfile, async (req, res) => {
  if (!ensureSupabase(res)) return;
  try {
    const { data: limitRow } = await supabaseAdmin
      .from("usage_limits")
      .select("value")
      .eq("key", "default_daily_limit")
      .single();
    const globalLimit = parseInt(limitRow?.value) || 20;
    const effectiveLimit =
      req.profile.daily_limit_override ?? globalLimit;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("api_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("success", true)
      .gte("created_at", todayStart.toISOString());

    return res.json({
      dailyLimit: effectiveLimit,
      usedToday: count || 0,
      remaining: Math.max(0, effectiveLimit - (count || 0)),
    });
  } catch (err) {
    return res.json({ dailyLimit: 20, usedToday: 0, remaining: 20 });
  }
});

app.get(
  "/api/usage/monthly",
  requireAuth,
  requireActiveProfile,
  async (req, res) => {
    if (!ensureSupabase(res)) return;
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    try {
      const { data: rows, error } = await supabaseAdmin
        .from("api_usage")
        .select("estimated_cost_usd")
        .gte("created_at", startOfMonth);
      if (error) throw error;
      let totalUsd = 0;
      (rows || []).forEach((row) => {
        totalUsd += Number(row.estimated_cost_usd) || 0;
      });
      const totalEur = MONTHLY_BASE_EUR + totalUsd * USD_TO_EUR;
      return res.json({
        totalEur: Math.round(totalEur * 100) / 100,
        totalUsd: Math.round(totalUsd * 1_000_000) / 1_000_000,
        baseEur: MONTHLY_BASE_EUR,
      });
    } catch (err) {
      return res.json({
        totalEur: MONTHLY_BASE_EUR,
        totalUsd: 0,
        baseEur: MONTHLY_BASE_EUR,
      });
    }
  },
);

app.get(
  "/api/admin/settings",
  requireAuth,
  requireActiveProfile,
  requireAdmin,
  async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { data: rows, error } = await supabaseAdmin
        .from("usage_limits")
        .select("key, value");
      if (error) throw error;
      const settings = {};
      (rows || []).forEach((r) => {
        settings[r.key] = r.value;
      });
      return res.json({ settings });
    } catch (err) {
      return res.status(500).json({ error: "Impossible de charger les paramètres." });
    }
  },
);

app.patch(
  "/api/admin/settings",
  requireAuth,
  requireActiveProfile,
  requireAdmin,
  async (req, res) => {
    if (!ensureSupabase(res)) return;
    const updates = req.body || {};
    const allowedKeys = ["default_daily_limit", "monthly_budget_usd"];
    try {
      for (const [key, value] of Object.entries(updates)) {
        if (!allowedKeys.includes(key)) continue;
        const { error } = await supabaseAdmin
          .from("usage_limits")
          .upsert(
            {
              key,
              value: String(value),
              updated_at: new Date().toISOString(),
              updated_by: req.user.id,
            },
            { onConflict: "key" },
          );
        if (error) throw error;
      }
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "Impossible de sauvegarder les paramètres." });
    }
  },
);

app.get(
  "/api/admin/usage",
  requireAuth,
  requireActiveProfile,
  requireAdmin,
  async (req, res) => {
    if (!ensureSupabase(res)) return;
    const { period, user_id: filterUserId } = req.query;

    let startDate = null;
    const now = new Date();
    if (period === "day") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (period === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString();
    } else if (period === "30days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString();
    } else if (period === "all") {
      startDate = null;
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }

    try {
      const { data: allProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, daily_limit_override, is_active")
        .order("email");
      const allUsers = (allProfiles || []).map((p) => ({
        userId: p.id,
        email: p.email,
        dailyLimitOverride: p.daily_limit_override,
        isActive: p.is_active,
      }));

      let query = supabaseAdmin
        .from("api_usage")
        .select(
          "user_id, mode, estimated_cost_usd, prompt_token_count, candidates_token_count, output_image_count, success, created_at",
        );
      if (startDate) query = query.gte("created_at", startDate);
      if (filterUserId) query = query.eq("user_id", filterUserId);

      const { data: rows, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;

      let totalCost = 0;
      let totalCalls = 0;
      let successfulCalls = 0;
      let totalOutputImages = 0;
      const dailyMap = {};
      const userMap = {};
      const modeMap = {};

      (rows || []).forEach((row) => {
        totalCalls += 1;
        if (row.success) successfulCalls += 1;
        totalCost += Number(row.estimated_cost_usd) || 0;
        totalOutputImages += row.output_image_count || 0;

        const day = row.created_at?.slice(0, 10) || "unknown";
        if (!dailyMap[day]) dailyMap[day] = { cost: 0, calls: 0, images: 0 };
        dailyMap[day].cost += Number(row.estimated_cost_usd) || 0;
        dailyMap[day].calls += 1;
        dailyMap[day].images += row.output_image_count || 0;

        const uid = row.user_id;
        if (!userMap[uid])
          userMap[uid] = { cost: 0, calls: 0, images: 0 };
        userMap[uid].cost += Number(row.estimated_cost_usd) || 0;
        userMap[uid].calls += 1;
        userMap[uid].images += row.output_image_count || 0;

        const rowMode = row.mode || "base";
        if (!modeMap[rowMode]) modeMap[rowMode] = { cost: 0, calls: 0 };
        modeMap[rowMode].cost += Number(row.estimated_cost_usd) || 0;
        modeMap[rowMode].calls += 1;
      });

      const profilesMap = {};
      (allProfiles || []).forEach((p) => {
        profilesMap[p.id] = p;
      });

      const { data: limitRow } = await supabaseAdmin
        .from("usage_limits")
        .select("value")
        .eq("key", "default_daily_limit")
        .single();
      const globalDailyLimit = parseInt(limitRow?.value) || 20;

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayStr = todayStart.toISOString();
      const todayCountMap = {};
      (rows || []).forEach((row) => {
        if (row.success && row.created_at >= todayStr) {
          todayCountMap[row.user_id] = (todayCountMap[row.user_id] || 0) + 1;
        }
      });

      const perUser = Object.entries(userMap)
        .map(([uid, stats]) => {
          const profile = profilesMap[uid] || {};
          const effectiveLimit =
            profile.daily_limit_override ?? globalDailyLimit;
          return {
            userId: uid,
            email: profile.email || "unknown",
            calls: stats.calls,
            images: stats.images,
            cost: Math.round(stats.cost * 1_000_000) / 1_000_000,
            usedToday: todayCountMap[uid] || 0,
            dailyLimit: effectiveLimit,
            dailyLimitOverride: profile.daily_limit_override ?? null,
          };
        })
        .sort((a, b) => b.cost - a.cost);

      const daily = Object.entries(dailyMap)
        .map(([date, stats]) => ({
          date,
          cost: Math.round(stats.cost * 1_000_000) / 1_000_000,
          calls: stats.calls,
          images: stats.images,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      const perMode = Object.entries(modeMap)
        .map(([m, stats]) => ({
          mode: m,
          calls: stats.calls,
          cost: Math.round(stats.cost * 1_000_000) / 1_000_000,
        }))
        .sort((a, b) => b.cost - a.cost);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      let spentThisMonthUsd = 0;
      if (filterUserId) {
        const { data: monthRows } = await supabaseAdmin
          .from("api_usage")
          .select("estimated_cost_usd")
          .gte("created_at", monthStart);
        (monthRows || []).forEach((r) => {
          spentThisMonthUsd += Number(r.estimated_cost_usd) || 0;
        });
      } else {
        (rows || []).forEach((row) => {
          if (row.created_at >= monthStart) {
            spentThisMonthUsd += Number(row.estimated_cost_usd) || 0;
          }
        });
      }
      const { data: budgetRow } = await supabaseAdmin
        .from("usage_limits")
        .select("value")
        .eq("key", "monthly_budget_usd")
        .single();
      const monthlyBudgetUsd = parseFloat(budgetRow?.value) || 500;
      const percentUsed =
        monthlyBudgetUsd > 0
          ? Math.round((spentThisMonthUsd / monthlyBudgetUsd) * 10000) / 100
          : 0;

      const dayCount = Object.keys(dailyMap).length || 1;
      const avgCostPerDay = totalCost / dayCount;

      return res.json({
        period: period || "month",
        filterUserId: filterUserId || null,
        totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
        totalCalls,
        successfulCalls,
        totalOutputImages,
        avgCostPerDay: Math.round(avgCostPerDay * 1_000_000) / 1_000_000,
        daily,
        perUser,
        perMode,
        allUsers,
        globalDailyLimit,
        budgetStatus: {
          monthlyBudgetUsd,
          spentThisMonthUsd:
            Math.round(spentThisMonthUsd * 1_000_000) / 1_000_000,
          percentUsed,
        },
      });
    } catch (err) {
      return res.status(500).json({
        error: "Impossible de charger les statistiques d'utilisation.",
      });
    }
  },
);

app.post(
  "/api/generate",
  requireAuth,
  requireActiveProfile,
  checkQuota,
  async (req, res) => {
    if (!ensureSupabase(res)) return;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "OPENAI_API_KEY manquante dans l'environnement." });
    }

    const {
      baseImage,
      inspirationImages,
      prompt,
      numImages,
      imageConfig,
      mode,
    } = req.body || {};

    const reqId = Math.random().toString(36).slice(2, 8);
    console.log(`[generate:${reqId}] mode=${mode} numImages=${numImages} user=${req.user?.email}`);

    const isCreateMode = mode === "create";

    if (!isCreateMode && (!baseImage?.data || !baseImage?.mimeType)) {
      return res.status(400).json({ error: "Image principale manquante." });
    }

    if (isCreateMode && (!prompt || !prompt.trim())) {
      return res
        .status(400)
        .json({ error: "Le prompt est obligatoire en mode Créer." });
    }

    const safeCount = clamp(Number.parseInt(numImages, 10) || 1, 1, 4);
    const inspirations = Array.isArray(inspirationImages)
      ? inspirationImages
          .filter((image) => image?.data && image?.mimeType)
          .slice(0, 4)
      : [];

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const errors = [];
      const warnings = [];

      const normalizedImageConfig = normalizeImageConfig(imageConfig);
      const imageSizeTier = normalizedImageConfig.imageSize;
      const quality = QUALITY_FROM_SIZE[imageSizeTier] || "medium";
      const size = openaiSizeFromAspectRatio(normalizedImageConfig.aspectRatio);

      const safeBaseImage =
        baseImage?.data && baseImage?.mimeType ? baseImage : null;
      const inputImageCount = (safeBaseImage ? 1 : 0) + inspirations.length;

      const STAGGER_DELAY_MS = 2000;

      const onProgress = (evt) => {
        try { res.write(JSON.stringify({ type: "progress", ...evt }) + "\n"); } catch (_) {}
      };

      const runBatch = async (count, offset) => {
        const safeOffset = Number.isInteger(offset) ? offset : 0;
        const batchImages = [];
        const batchErrors = [];
        let batchCostUsd = 0;

        for (let index = 0; index < count; index++) {
          if (index > 0) await sleep(STAGGER_DELAY_MS);

          const variantNum = safeOffset + index + 1;
          onProgress({ event: "variant", index: variantNum, total: safeCount });
          console.log(`[${reqId}] variant ${variantNum}/${safeCount} start`);

          const variantPrompt = buildFinalPrompt({
            baseImage: safeBaseImage,
            inspirations,
            prompt,
            variantIndex: variantNum,
            variantTotal: safeCount,
            mode,
          });

          try {
            const result = await callOpenAI({
              prompt: variantPrompt,
              baseImage: safeBaseImage,
              inspirations,
              size,
              quality,
              onProgress: (evt) => onProgress({ ...evt, variantIndex: variantNum, variantTotal: safeCount }),
              label: `${reqId}:v${variantNum}`,
            });
            const imgs = result.images;
            console.log(`[${reqId}] variant ${variantNum}/${safeCount} ok, ${imgs.length} image(s)`);
            batchImages.push(...imgs);
            const cost = calculateCostUsd({
              outputImageCount: imgs.length,
              quality,
              size,
            });
            if (cost) batchCostUsd += cost;
            logApiUsage({
              userId: req.user.id,
              mode,
              imageSize: imageSizeTier,
              quality,
              size,
              inputImageCount,
              outputImageCount: imgs.length,
              usage: result.usage,
              success: true,
            });
          } catch (err) {
            console.log(`[${reqId}] variant ${variantNum}/${safeCount} error: ${err?.status} ${err?.message}`);
            batchErrors.push(err);
            logApiUsage({
              userId: req.user.id,
              mode,
              imageSize: imageSizeTier,
              quality,
              size,
              inputImageCount,
              outputImageCount: 0,
              usage: null,
              success: false,
            });
          }
        }

        return { batchImages, batchErrors, batchCostUsd };
      };

      let images = [];
      let generationCostUsd = 0;
      const batch = await runBatch(safeCount, 0);
      images = images.concat(batch.batchImages);
      errors.push(...batch.batchErrors);
      generationCostUsd += batch.batchCostUsd || 0;

      images = images.slice(0, safeCount);

      if (images.length === 0) {
        console.log(`[${reqId}] done: 0 images, ${errors.length} errors`);
        const noImageResponse = buildNoImageResponse(errors);
        const userErrors = errors.every(isTransientGenerationError) ? [] : errors;
        res.write(JSON.stringify({ type: "result", ok: false, status: noImageResponse.status, error: noImageResponse.message, errors: userErrors }) + "\n");
        return res.end();
      }

      if (images.length < safeCount) {
        const hasTransient = errors.some(isTransientGenerationError);
        if (hasTransient) {
          warnings.push(
            `${images.length} image(s) sur ${safeCount} générée(s). Les serveurs OpenAI sont ralentis, réessaie pour les images manquantes.`,
          );
        } else {
          warnings.push(
            `Le modèle a retourné ${images.length} image(s) sur ${safeCount}.`,
          );
        }
      }

      const generationCostEur =
        Math.round(generationCostUsd * USD_TO_EUR * 100) / 100;

      console.log(`[${reqId}] done: ${images.length} images, ${errors.length} errors, ${generationCostEur}€`);
      const userErrors = errors.filter((e) => !isTransientGenerationError(e));
      res.write(JSON.stringify({
        type: "result",
        ok: true,
        images,
        requested: safeCount,
        received: images.length,
        warnings,
        errors: userErrors,
        estimatedCostEur: generationCostEur,
      }) + "\n");
      return res.end();
    } catch (error) {
      res.write(JSON.stringify({ type: "result", ok: false, status: 500, error: "Erreur serveur pendant la génération.", details: error?.message ? [error.message] : [] }) + "\n");
      return res.end();
    }
  },
);

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Graphic AI prêt sur http://localhost:${port}`);
  });
}

export default app;
