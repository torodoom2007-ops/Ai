/**
 * ============================================================
 *  AGENT.JS  –  לוגיקת הסוכן המלאה
 * ============================================================
 *  אחריות:
 *  - קבלת הודעה + קבצים מהמשתמש
 *  - תהליך חשיבה / עיבוד
 *  - קריאה ל-API של מודלי בינה מלאכותית
 *  - החזרת התשובה הסופית ל-UI
 *
 *  ----------------------------------------------------------
 *  מקום להוספת שמות קבצים / עמודים נוספים באתר
 *  (לשימוש עתידי בניווט, prefetch, או טעינה דינמית)
 *  ----------------------------------------------------------
 *  const EXTRA_PAGES = [
 *      "about.html",
 *      "settings.html",
 *      "admin.html",
 *      "docs.html"
 *  ];
 *  ----------------------------------------------------------
 */

// ============================================================
//  הגדרות API Keys – לשימוש ב-Render / Environment Variables
//  הוסף את המפתחות כ-Environment Variables ב-Render:
//  OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY וכו'
// ============================================================
const AGENT_CONFIG = {
    // דוגמה – ב-production קח מ-process.env או מ-window.__ENV
    // ב-Render: הוסף ב-Environment → Key = OPENAI_API_KEY
    openaiApiKey: null,          // יוחלף ב-Render: process.env.OPENAI_API_KEY
    anthropicApiKey: null,       // process.env.ANTHROPIC_API_KEY
    googleApiKey: null,          // process.env.GOOGLE_API_KEY
    defaultModel: "gpt-4o-mini", // או claude-3-5-sonnet / gemini-1.5-pro
    maxTokens: 2048,
    temperature: 0.7,

    // כתובת ה-backend שלך ב-Render (אם יש לך endpoint)
    // דוגמה: "https://your-app.onrender.com/api/chat"
    backendUrl: null
};

// ============================================================
//  מחלקת הסוכן הראשית
// ============================================================
class AIAgent {
    constructor(config = AGENT_CONFIG) {
        this.config = { ...AGENT_CONFIG, ...config };
        this.isProcessing = false;
    }

    /**
     * נקודת הכניסה הראשית – נקראת מ-chat.js כשהמשתמש לוחץ "שלח"
     * @param {Object} payload
     * @param {string} payload.text          - טקסט ההודעה
     * @param {Array}  payload.attachments   - מערך של קבצים/תמונות
     * @param {string} payload.module        - מודול נבחר (עתידי)
     * @param {Function} onProgress          - callback לעדכון שלבי חשיבה
     * @returns {Promise<{success: boolean, reply: string, error?: string}>}
     */
    async processMessage(payload, onProgress = () => {}) {
        if (this.isProcessing) {
            return { success: false, error: "הסוכן כבר מעבד בקשה אחרת" };
        }

        this.isProcessing = true;

        try {
            // שלב 1: קליטת הבקשה
            onProgress({ step: "receive", status: "active", label: "מקבל את ההודעה..." });
            await this._delay(400);

            // שלב 2: ניתוח קבצים (אם יש)
            if (payload.attachments && payload.attachments.length > 0) {
                onProgress({ step: "analyze_files", status: "active", label: "מנתח קבצים ותמונות..." });
                await this._analyzeAttachments(payload.attachments);
                onProgress({ step: "analyze_files", status: "done" });
            }

            // שלב 3: בניית ה-prompt
            onProgress({ step: "build_prompt", status: "active", label: "בונה הקשר ו-prompt..." });
            const prompt = this._buildPrompt(payload);
            await this._delay(350);
            onProgress({ step: "build_prompt", status: "done" });

            // שלב 4: קריאה למודל AI
            onProgress({ step: "call_model", status: "active", label: "שולח למודל בינה מלאכותית..." });
            const reply = await this._callAIModel(prompt, payload);
            onProgress({ step: "call_model", status: "done" });

            // שלב 5: עיבוד סופי
            onProgress({ step: "finalize", status: "active", label: "מעבד תשובה סופית..." });
            await this._delay(300);
            onProgress({ step: "finalize", status: "done" });

            return {
                success: true,
                reply: reply
            };

        } catch (err) {
            console.error("[AIAgent] Error:", err);
            return {
                success: false,
                error: err.message || "אירעה שגיאה בעיבוד הבקשה"
            };
        } finally {
            this.isProcessing = false;
        }
    }

    // --------------------------------------------------------
    //  בניית ה-prompt
    // --------------------------------------------------------
    _buildPrompt(payload) {
        let system = "אתה סוכן בינה מלאכותית מקצועי ומדויק. ענה בעברית בצורה ברורה, מפורטת ומועילה.";
        let userContent = payload.text || "";

        if (payload.attachments?.length) {
            const names = payload.attachments.map(a => a.name).join(", ");
            userContent += `\n\n[קבצים מצורפים: ${names}]`;
        }

        if (payload.module && payload.module !== "general") {
            system += ` המודול הפעיל הוא: ${payload.module}.`;
        }

        return {
            system,
            user: userContent,
            module: payload.module || "general"
        };
    }

    // --------------------------------------------------------
    //  ניתוח קבצים (placeholder – הרחב לפי הצורך)
    // --------------------------------------------------------
    async _analyzeAttachments(attachments) {
        // כאן אפשר להוסיף OCR, חילוץ טקסט מ-PDF, תיאור תמונות וכו'
        // כרגע רק מדמה עיבוד
        for (const att of attachments) {
            console.log(`[Agent] Analyzing: ${att.name} (${att.type})`);
            await this._delay(200);
        }
    }

    // --------------------------------------------------------
    //  קריאה למודל AI
    //  כאן מחברים ל-OpenAI / Anthropic / Google / Backend שלך
    // --------------------------------------------------------
    async _callAIModel(prompt, payload) {
        // ========== אפשרות 1: Backend ב-Render ==========
        if (this.config.backendUrl) {
            const response = await fetch(this.config.backendUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                    // Authorization יתווסף ב-backend עם המפתחות
                },
                body: JSON.stringify({
                    message: prompt.user,
                    system: prompt.system,
                    module: prompt.module,
                    attachmentsMeta: (payload.attachments || []).map(a => ({
                        name: a.name,
                        type: a.type,
                        size: a.size
                    }))
                })
            });

            if (!response.ok) {
                throw new Error(`שגיאת שרת: ${response.status}`);
            }

            const data = await response.json();
            return data.reply || data.content || "לא התקבלה תשובה מהשרת";
        }

        // ========== אפשרות 2: קריאה ישירה ל-OpenAI (רק אם המפתח זמין ב-frontend – לא מומלץ ל-production) ==========
        if (this.config.openaiApiKey) {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: this.config.defaultModel,
                    messages: [
                        { role: "system", content: prompt.system },
                        { role: "user", content: prompt.user }
                    ],
                    max_tokens: this.config.maxTokens,
                    temperature: this.config.temperature
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `OpenAI error ${response.status}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "לא התקבלה תשובה";
        }

        // ========== מצב Demo (בלי מפתחות) – מחזיר תשובה מדומה ==========
        await this._delay(800 + Math.random() * 600);
        return this._generateDemoReply(prompt, payload);
    }

    // --------------------------------------------------------
    //  תשובת דמו כשאין מפתחות / backend
    // --------------------------------------------------------
    _generateDemoReply(prompt, payload) {
        const hasFiles = payload.attachments?.length > 0;
        const text = prompt.user.slice(0, 80);

        let reply = `שלום! קיבלתי את ההודעה שלך`;

        if (hasFiles) {
            const names = payload.attachments.map(a => `«${a.name}»`).join(", ");
            reply += ` יחד עם הקבצים: ${names}.\n\n`;
            reply += `ביצעתי ניתוח ראשוני של הקבצים. `;
        } else {
            reply += `.\n\n`;
        }

        reply += `הנה תשובה לדוגמה על בסיס מה שכתבת:\n\n`;
        reply += `«${text}${text.length >= 80 ? "..." : ""}»\n\n`;
        reply += `---\n`;
        reply += `כדי לקבל תשובות אמיתיות ממודל AI, חבר את ה-agent ל-backend ב-Render והוסף את מפתחות ה-API כ-Environment Variables.\n`;
        reply += `ראה את ההערות בראש הקובץ agent.js.`;

        return reply;
    }

    // --------------------------------------------------------
    //  עזר
    // --------------------------------------------------------
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// יצירת מופע גלובלי לשימוש מ-chat.js
window.AIAgentInstance = new AIAgent();
