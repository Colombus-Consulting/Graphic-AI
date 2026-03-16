import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.GEMINI_API_KEY;
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
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";
const GEMINI_CREATE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";
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
        "You always produce a clean white background, clear visual hierarchy, proper alignments, and readable typography.",
        "You never invent data, never borrow text or numbers from inspiration images, and never omit any information from the source.",
      ].join(" "),
    },
  ],
};

const CREATE_SYSTEM_INSTRUCTION = {
  parts: [
    {
      text: [
        "You are a professional visual designer and infographic creator.",
        "Your goal is to produce high-quality, polished visuals from the user's textual description.",
        "You encourage creative freedom: interpret the brief with originality while maintaining a professional, clean result.",
        "Always produce a clean white background, clear visual hierarchy, proper alignments, and readable typography.",
        "If a source image is provided, use it as loose inspiration — extract layout ideas or content cues without strict data fidelity.",
        "If style reference images are provided, extract their visual language (color palette, typography, iconography, layout patterns) and apply it creatively.",
        "You may invent placeholder data, icons, or illustrations if they serve the user's described concept.",
        "Prioritize visual impact, clarity, and aesthetic quality above all.",
      ].join(" "),
    },
  ],
};

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
    .select("id, email, role, is_active, daily_limit_override")
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

const buildPrompt = ({ userPrompt, inspirationCount }) => {
  const lines = [
    "TASK: Recreate the source chart with a completely new visual design inspired by the style references.",
    "",
    "STEP 1 — DATA EXTRACTION: Identify and memorize every single piece of information in the source chart: all titles, subtitles, axis labels, data values, percentages, legends, footnotes, units, and annotations. Nothing may be omitted or altered.",
    "STEP 2 — STYLE ANALYSIS: Study the visual language of the inspiration image(s): color palette, typography choices, icon style, layout structure, spacing rhythm, and overall aesthetic. Do not copy any information or text from the inspiration, only visual design.",
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

const buildCreatePrompt = ({ userPrompt, inspirationCount, hasSourceImage }) => {
  const lines = [
    "TASK: Create a professional visual from the description below.",
    "",
    "STEP 1 — UNDERSTAND THE BRIEF: Read the user's description carefully and identify the key message, structure, and visual elements requested.",
    "STEP 2 — STYLE ANALYSIS: " +
      (inspirationCount > 0
        ? `Study the visual language of the ${inspirationCount} style reference(s): color palette, typography, icon style, layout structure, and overall aesthetic. Apply this style creatively.`
        : "Use modern infographic best practices: clean layout, professional color palette, clear typography hierarchy."),
  ];

  if (hasSourceImage) {
    lines.push(
      "STEP 3 — REFERENCE IMAGE: A source image is provided as loose inspiration. Draw layout ideas or content cues from it, but you are free to reinterpret creatively. No strict data fidelity required.",
    );
  }

  lines.push(
    "",
    "OUTPUT: A single polished visual on a white background. Prioritize clarity, visual impact, and professional quality.",
  );

  if (userPrompt && userPrompt.trim().length > 0) {
    lines.push("", "USER DESCRIPTION:", userPrompt.trim());
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
  const isCreate = mode === "create";
  const promptBuilder = isCreate
    ? buildCreatePrompt
    : mode === "refine"
      ? buildRefinePrompt
      : buildPrompt;
  const parts = [];

  // 1. Source image (required for redesign/refine, optional for create)
  if (baseImage) {
    const label = isCreate
      ? "REFERENCE IMAGE — Use this as loose inspiration for layout and content cues:"
      : "SOURCE CHART — Extract ALL data, text, numbers, labels, and structure from this image:";
    parts.push({ text: label });
    parts.push({
      inline_data: {
        mime_type: baseImage.mimeType,
        data: baseImage.data,
      },
    });
  }

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
      });
    });
  }

  // 3. Instructions AFTER context (per Gemini 3 best practice)
  parts.push({
    text: isCreate
      ? promptBuilder({
          userPrompt: prompt,
          inspirationCount: inspirations.length,
          hasSourceImage: Boolean(baseImage),
        })
      : promptBuilder({
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
          : `This is variant ${variantIndex} of ${variantTotal}. Use a distinctly different visual interpretation: different color palette, different typography weight, different layout arrangement.${isCreate ? "" : " The data must remain identical across all variants."}`,
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

const USD_TO_EUR = 0.84;
const MONTHLY_BASE_EUR = 18;

const PRICING = {
  inputPerToken: 2.0 / 1_000_000,
  outputTextPerToken: 12.0 / 1_000_000,
  outputImagePerToken: 120.0 / 1_000_000,
  outputImageTokens: { "1K": 1120, "2K": 1120, "4K": 2000 },
};

const calculateCostUsd = ({
  promptTokenCount,
  candidatesTokenCount,
  outputImageCount,
  imageSize,
}) => {
  if (!promptTokenCount && !candidatesTokenCount) return null;
  const inputCost = (promptTokenCount || 0) * PRICING.inputPerToken;
  const imgCount = outputImageCount || 0;
  const imgTokensPer = PRICING.outputImageTokens[imageSize] || 1120;
  const totalImageTokens = imgCount * imgTokensPer;
  const textTokens = Math.max(
    0,
    (candidatesTokenCount || 0) - totalImageTokens,
  );
  const outputTextCost = textTokens * PRICING.outputTextPerToken;
  const outputImageCost = totalImageTokens * PRICING.outputImagePerToken;
  return (
    Math.round((inputCost + outputTextCost + outputImageCost) * 1_000_000) /
    1_000_000
  );
};

const logApiUsage = async ({
  userId,
  projectId,
  mode,
  imageSize,
  inputImageCount,
  outputImageCount,
  usage,
  isFallback,
  success,
}) => {
  if (!supabaseEnabled) return;
  const estimatedCostUsd = calculateCostUsd({
    promptTokenCount: usage?.promptTokenCount,
    candidatesTokenCount: usage?.candidatesTokenCount,
    outputImageCount: outputImageCount || 0,
    imageSize: imageSize || "1K",
  });
  try {
    await supabaseAdmin.from("api_usage").insert({
      user_id: userId,
      project_id: projectId || null,
      mode: mode || "base",
      image_size: imageSize || "1K",
      input_image_count: inputImageCount || 1,
      output_image_count: outputImageCount || 0,
      prompt_token_count: usage?.promptTokenCount ?? null,
      candidates_token_count: usage?.candidatesTokenCount ?? null,
      total_token_count: usage?.totalTokenCount ?? null,
      estimated_cost_usd: estimatedCostUsd,
      is_fallback: isFallback || false,
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

const isTransientGenerationError = (error) => {
  const message = (error?.message || "").toLowerCase();
  const code = (error?.code || "").toString().toUpperCase();
  const status = Number(error?.status);
  return (
    [429, 500, 502, 503, 504].includes(status) ||
    code === "UNAVAILABLE" ||
    code === "RESOURCE_EXHAUSTED" ||
    message.includes("high demand") ||
    message.includes("try again later") ||
    message.includes("temporarily unavailable")
  );
};

const buildNoImageResponse = (errors) => {
  if (!Array.isArray(errors) || errors.length === 0) {
    return {
      status: 502,
      message:
        "Aucune image n'a été retournée par le modèle. Réessaie dans quelques instants.",
    };
  }

  if (errors.some(isTransientGenerationError)) {
    return {
      status: 503,
      message:
        "Le modèle est temporairement indisponible (forte demande). Réessaie dans quelques instants.",
    };
  }

  const clientError = errors.find(
    (error) => Number(error?.status) >= 400 && Number(error?.status) < 500,
  );
  if (clientError) {
    return {
      status: Number(clientError.status) || 400,
      message:
        "La génération a échoué côté modèle. Vérifie le prompt et les paramètres puis réessaie.",
    };
  }

  return {
    status: 502,
    message:
      "Le service de génération n'a pas pu produire d'image. Réessaie dans quelques instants.",
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callGeminiRaw = async ({ parts, generationConfig, systemInstruction, endpoint, maxRetries = 3, onProgress, label = "" }) => {
  const body = {
    system_instruction: systemInstruction || SYSTEM_INSTRUCTION,
    contents: [
      {
        parts,
      },
    ],
    generationConfig,
  };

  const timeoutMs = process.env.VERCEL === "1" ? 55000 : 60000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint || GEMINI_ENDPOINT, {
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
        const apiError = buildApiError(data, response.status);
        if (attempt < maxRetries && isTransientGenerationError(apiError)) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 8000);
          console.log(`[${label}] Gemini ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}), retry in ${Math.round(delay)}ms...`);
          if (onProgress) onProgress({ event: "retry", attempt: attempt + 1, maxAttempts: maxRetries + 1, status: response.status, delayMs: Math.round(delay) });
          clearTimeout(timeoutId);
          await sleep(delay);
          continue;
        }
        throw apiError;
      }

      return data;
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
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 8000);
        console.log(`[${label}] Gemini error (attempt ${attempt + 1}/${maxRetries + 1}), retry in ${Math.round(delay)}ms...`);
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

const callGemini = async ({ parts, generationConfig, systemInstruction, endpoint, onProgress, label }) => {
  const data = await callGeminiRaw({ parts, generationConfig, systemInstruction, endpoint, onProgress, label });
  const meta = data?.usageMetadata || data?.usage_metadata || null;
  return {
    images: extractImages(data),
    usage: meta
      ? {
          promptTokenCount:
            meta.promptTokenCount ?? meta.prompt_token_count ?? null,
          candidatesTokenCount:
            meta.candidatesTokenCount ?? meta.candidates_token_count ?? null,
          totalTokenCount:
            meta.totalTokenCount ?? meta.total_token_count ?? null,
        }
      : null,
  };
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
      // Always fetch all profiles for the user filter dropdown
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

      // Build usage query with optional user filter
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

      // Profile lookup for users in the data
      const profilesMap = {};
      (allProfiles || []).forEach((p) => {
        profilesMap[p.id] = p;
      });

      // Get global daily limit
      const { data: limitRow } = await supabaseAdmin
        .from("usage_limits")
        .select("value")
        .eq("key", "default_daily_limit")
        .single();
      const globalDailyLimit = parseInt(limitRow?.value) || 20;

      // Count today's successful generations per user
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

      // Budget status (always monthly, always global)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      let spentThisMonthUsd = 0;
      // Need global monthly spend (not filtered by user)
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

      // Average cost per day (for the filtered period)
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
        .json({ error: "GEMINI_API_KEY manquante dans l'environnement." });
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
      const generationConfig = buildGenerationConfig(normalizedImageConfig);

      const safeBaseImage =
        baseImage?.data && baseImage?.mimeType ? baseImage : null;
      const inputImageCount = (safeBaseImage ? 1 : 0) + inspirations.length;
      const activeSystemInstruction = isCreateMode
        ? CREATE_SYSTEM_INSTRUCTION
        : SYSTEM_INSTRUCTION;

      const STAGGER_DELAY_MS = 2000; // delay between sequential calls to let API recover

      const onProgress = (evt) => {
        try { res.write(JSON.stringify({ type: "progress", ...evt }) + "\n"); } catch (_) {}
      };

      const runBatch = async (count, config, offset, isFallback = false, endpointOverride = null) => {
        const safeOffset = Number.isInteger(offset) ? offset : 0;
        const batchImageSize =
          config?.imageConfig?.imageSize ||
          normalizedImageConfig?.imageSize ||
          "1K";
        const batchImages = [];
        const batchErrors = [];
        let batchCostUsd = 0;

        for (let index = 0; index < count; index++) {
          if (index > 0) await sleep(STAGGER_DELAY_MS);

          const variantNum = safeOffset + index + 1;
          onProgress({ event: "variant", index: variantNum, total: safeCount });
          console.log(`[${reqId}] variant ${variantNum}/${safeCount} start`);

          try {
            const result = await callGemini({
              parts: buildParts({
                baseImage: safeBaseImage,
                inspirations,
                prompt,
                count: safeCount,
                variantIndex: variantNum,
                variantTotal: safeCount,
                mode,
              }),
              generationConfig: config,
              systemInstruction: activeSystemInstruction,
              endpoint: endpointOverride || (isCreateMode ? GEMINI_CREATE_ENDPOINT : GEMINI_ENDPOINT),
              onProgress: (evt) => onProgress({ ...evt, variantIndex: variantNum, variantTotal: safeCount }),
              label: `${reqId}:v${variantNum}${isFallback ? ":fb" : ""}`,
            });
            const imgs = result.images;
            console.log(`[${reqId}] variant ${variantNum}/${safeCount} ok, ${imgs.length} image(s)`);
            batchImages.push(...imgs);
            const cost = calculateCostUsd({
              promptTokenCount: result.usage?.promptTokenCount,
              candidatesTokenCount: result.usage?.candidatesTokenCount,
              outputImageCount: imgs.length,
              imageSize: batchImageSize,
            });
            if (cost) batchCostUsd += cost;
            logApiUsage({
              userId: req.user.id,
              mode,
              imageSize: batchImageSize,
              inputImageCount,
              outputImageCount: imgs.length,
              usage: result.usage,
              isFallback,
              success: true,
            });
          } catch (err) {
            console.log(`[${reqId}] variant ${variantNum}/${safeCount} error: ${err?.status} ${err?.message}`);
            batchErrors.push(err);
            logApiUsage({
              userId: req.user.id,
              mode,
              imageSize: batchImageSize,
              inputImageCount,
              outputImageCount: 0,
              usage: null,
              isFallback,
              success: false,
            });
          }
        }

        return { batchImages, batchErrors, batchCostUsd };
      };

      let images = [];
      let generationCostUsd = 0;
      let batch = await runBatch(safeCount, generationConfig, 0);
      images = images.concat(batch.batchImages);
      errors.push(...batch.batchErrors);
      generationCostUsd += batch.batchCostUsd || 0;

      let missingAfterPrimary = safeCount - images.length;

      // Fallback 1: imageConfig error → retry without imageConfig
      if (
        missingAfterPrimary > 0 &&
        batch.batchErrors.some(isImageConfigError)
      ) {
        warnings.push("imageConfig refusee, fallback en 1K sans aspect ratio.");
        const fallbackConfig = buildGenerationConfig({ imageSize: "1K" });
        const offset = safeCount - missingAfterPrimary;
        batch = await runBatch(
          missingAfterPrimary,
          fallbackConfig,
          offset,
          true,
        );
        images = images.concat(batch.batchImages);
        errors.push(...batch.batchErrors);
        generationCostUsd += batch.batchCostUsd || 0;
        missingAfterPrimary = safeCount - images.length;
      }


      images = images.slice(0, safeCount);

      if (images.length === 0) {
        console.log(`[${reqId}] done: 0 images, ${errors.length} errors`);
        const noImageResponse = buildNoImageResponse(errors);
        res.write(JSON.stringify({ type: "result", ok: false, status: noImageResponse.status, error: noImageResponse.message, errors }) + "\n");
        return res.end();
      }

      if (images.length < safeCount) {
        warnings.push(
          `Le modele a retourne ${images.length} image(s) sur ${safeCount}.`,
        );
      }
      if (errors.length > 0) {
        warnings.push("Certaines tentatives ont echoue, consulte les details.");
      }

      const generationCostEur =
        Math.round(generationCostUsd * USD_TO_EUR * 100) / 100;

      console.log(`[${reqId}] done: ${images.length} images, ${errors.length} errors, ${generationCostEur}€`);
      res.write(JSON.stringify({
        type: "result",
        ok: true,
        images,
        requested: safeCount,
        received: images.length,
        warnings,
        errors,
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
