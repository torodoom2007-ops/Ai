/**
 * ============================================================
 *  SERVER.JS  –  Backend ל-Render עם תמיכה במספר מפתחות
 * ============================================================
 *
 *  Environment Variables ב-Render:
 *  ----------------------------------------------------------
 *  OPENAI_API_KEY_1   = sk-...     (מפתח ראשון – חובה לפחות אחד)
 *  OPENAI_API_KEY_2   = sk-...     (מפתח שני – אופציונלי)
 *  OPENAI_API_KEY_3   = sk-...     (מפתח שלישי – אופציונלי)
 *
 *  או לחלופין (נוח יותר):
 *  OPENAI_API_KEYS    = sk-key1,sk-key2,sk-key3
 *
 *  OPENAI_MODEL       = gpt-4o-mini   (אופציונלי)
 *  PORT               = 10000         (Render ממלא אוטומטית)
 *  ----------------------------------------------------------
 *
 *  מקום להוספת שמות קבצים / עמודים נוספים:
 *  const EXTRA_PAGES = ["about.html", "settings.html", "admin.html"];
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
});

// ============================================================
//  טעינת מפתחות – תומך ב-3 מפתחות עם Fallback
// ============================================================
function loadApiKeys() {
  const keys = [];

  // אפשרות 1: OPENAI_API_KEYS = key1,key2,key3
  if (process.env.OPENAI_API_KEYS) {
    process.env.OPENAI_API_KEYS.split(",")
      .map(k => k.trim())
      .filter(k => k.length > 10)
      .forEach(k => keys.push(k));
  }

  // אפשרות 2: OPENAI_API_KEY_1 / _2 / _3 + OPENAI_API_KEY רגיל
  ["OPENAI_API_KEY_1", "OPENAI_API_KEY_2", "OPENAI_API_KEY_3", "OPENAI_API_KEY"].forEach(name => {
    const val = process.env[name];
    if (val && val.trim().length > 10 && !keys.includes(val.trim())) {
      keys.push(val.trim());
    }
  });

  return keys;
}

const API_KEYS = loadApiKeys();
console.log(`[Server] Loaded ${API_KEYS.length} OpenAI API key(s)`);

// ============================================================
//  טעינת פרסונה (system prompt)
// ============================================================
function loadPersona() {
  const personaPath = path.join(__dirname, "persona.md");
  try {
    if (fs.existsSync(personaPath)) {
      const raw = fs.readFileSync(personaPath, "utf8");
      // מסירים כותרות markdown כדי שהמודל יקבל טקסט נקי יותר
      return raw
        .replace(/^# =+.*$/gm, "")
        .replace(/^# .*$/gm, "")
        .trim();
    }
  } catch (e) {
    console.warn("[Server] Could not load persona.md:", e.message);
  }
  return "אתה סוכן בינה מלאכותית מקצועי ומדויק. ענה בעברית בצורה ברורה ומועילה.";
}

let PERSONA = loadPersona();
console.log(`[Server] Persona loaded (${PERSONA.length} chars)`);

// אפשר לרענן פרסונה בלי restart
app.post("/api/reload-persona", (req, res) => {
  PERSONA = loadPersona();
  res.json({ ok: true, length: PERSONA.length });
});

// ============================================================
//  קריאה ל-OpenAI עם Fallback בין מפתחות
// ============================================================
async function callOpenAIWithFallback(messages, options = {}) {
  if (API_KEYS.length === 0) {
    throw new Error("NO_KEYS");
  }

  let lastError = null;

  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i];
    const client = new OpenAI({ apiKey: key });

    try {
      console.log(`[OpenAI] Trying key #${i + 1}...`);
      const completion = await client.chat.completions.create({
        model: options.model || process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        max_tokens: options.max_tokens || 2048,
        temperature: options.temperature ?? 0.7
      });

      const reply = completion.choices?.[0]?.message?.content;
      if (reply) {
        console.log(`[OpenAI] Success with key #${i + 1}`);
        return { reply, usedKeyIndex: i + 1 };
      }
    } catch (err) {
      lastError = err;
      const status = err.status || err.response?.status;

      // מפתח לא תקין / ללא קרדיט / rate limit → נסה את הבא
      if (status === 401 || status === 403 || status === 429 || status === 402) {
        console.warn(`[OpenAI] Key #${i + 1} failed (${status}). Trying next...`);
        continue;
      }

      // שגיאה אחרת – זורקים
      console.error(`[OpenAI] Non-recoverable error on key #${i + 1}:`, err.message);
      throw err;
    }
  }

  // כל המפתחות נכשלו
  const status = lastError?.status || lastError?.response?.status;
  if (status === 429) {
    throw new Error("כל המפתחות הגיעו למגבלת הבקשות (429). נסה שוב בעוד כמה דקות.");
  }
  if (status === 401 || status === 403) {
    throw new Error("כל המפתחות לא תקינים או ללא הרשאה. בדוק את ה-API Keys.");
  }
  throw new Error(lastError?.message || "כל המפתחות נכשלו");
}

// ---------- Health ----------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    keysLoaded: API_KEYS.length,
    personaLoaded: PERSONA.length > 50,
    timestamp: new Date().toISOString()
  });
});

// ---------- Chat Endpoint ----------
app.post("/api/chat", upload.any(), async (req, res) => {
  try {
    const { message, system, module } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "חסרה הודעה (message)" });
    }

    // אם אין מפתחות בכלל
    if (API_KEYS.length === 0) {
      return res.json({
        reply:
          "⚠️ לא הוגדרו מפתחות OpenAI.\n\n" +
          "ב-Render Dashboard → Environment הוסף לפחות אחד מהבאים:\n" +
          "• OPENAI_API_KEY_1 = sk-...\n" +
          "• OPENAI_API_KEY_2 = sk-...\n" +
          "• OPENAI_API_KEY_3 = sk-...\n\n" +
          "או: OPENAI_API_KEYS = sk-key1,sk-key2,sk-key3\n\n" +
          `ההודעה שקיבלתי: «${message.slice(0, 100)}»`
      });
    }

    // בניית ה-system prompt: פרסונה + הנחיה נוספת מה-frontend (אם יש)
    let systemContent = PERSONA;
    if (system && typeof system === "string" && system.trim()) {
      systemContent += "\n\n---\nהנחיה נוספת מהמערכת:\n" + system.trim();
    }
    if (module && module !== "general") {
      systemContent += `\n\nהמודול הפעיל כרגע: ${module}.`;
    }

    const messages = [
      { role: "system", content: systemContent },
      { role: "user", content: message }
    ];

    const result = await callOpenAIWithFallback(messages);

    res.json({
      reply: result.reply,
      meta: { usedKey: result.usedKeyIndex }
    });
  } catch (err) {
    console.error("[/api/chat] Error:", err.message);

    if (err.message === "NO_KEYS") {
      return res.status(500).json({ error: "לא הוגדרו מפתחות API" });
    }

    res.status(500).json({
      error: err.message || "שגיאה פנימית בשרת"
    });
  }
});

// ---------- Fallback SPA ----------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "main.html"));
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`✅ AI Agent server running on port ${PORT}`);
  console.log(`   Keys loaded : ${API_KEYS.length}`);
  console.log(`   Persona     : ${PERSONA.length > 50 ? "OK" : "default"}`);
});
