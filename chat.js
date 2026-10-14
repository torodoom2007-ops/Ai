/**
 * ============================================================
 *  CHAT.JS  –  לוגיקת ממשק הצ'אט
 * ============================================================
 *  אחריות:
 *  - הוספת תמונות וקבצים
 *  - כתיבת טקסט + auto-resize
 *  - כפתור שלח
 *  - אנימציות חשיבה / טעינה / תשובה
 *  - תצוגת הודעות
 *  - (עתידי) בחירת מודולים
 *
 *  ----------------------------------------------------------
 *  מקום להוספת שמות קבצים / עמודים נוספים באתר
 *  ----------------------------------------------------------
 *  const SITE_PAGES = [
 *      { name: "אודות",     file: "about.html" },
 *      { name: "הגדרות",    file: "settings.html" },
 *      { name: "תיעוד",     file: "docs.html" },
 *      { name: "ניהול",     file: "admin.html" }
 *  ];
 *  ----------------------------------------------------------
 */

(function () {
    "use strict";

    // ========================================================
    //  אלמנטים
    // ========================================================
    const chatArea          = document.getElementById("chat-area");
    const welcomeContainer  = document.getElementById("welcome-container");
    const chatInput         = document.getElementById("chat-input");
    const btnSend           = document.getElementById("btn-send");
    const btnAttachFile     = document.getElementById("btn-attach-file");
    const btnAttachImage    = document.getElementById("btn-attach-image");
    const fileInput         = document.getElementById("file-input");
    const imageInput        = document.getElementById("image-input");
    const attachmentsPreview = document.getElementById("attachments-preview");
    const btnNewChat        = document.getElementById("btn-new-chat");
    const moduleSelect      = document.getElementById("module-select");

    // ========================================================
    //  מצב
    // ========================================================
    let attachments = [];   // { id, file, name, type, size, previewUrl? }
    let isSending   = false;
    let messageCount = 0;

    // ========================================================
    //  אתחול
    // ========================================================
    function init() {
        // כפתורים
        btnAttachFile.addEventListener("click", () => fileInput.click());
        btnAttachImage.addEventListener("click", () => imageInput.click());
        fileInput.addEventListener("change", handleFileSelect);
        imageInput.addEventListener("change", handleImageSelect);
        btnSend.addEventListener("click", handleSend);
        btnNewChat.addEventListener("click", resetChat);

        // Enter לשליחה (Shift+Enter = שורה חדשה)
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // auto-resize + הפעלת כפתור שלח
        chatInput.addEventListener("input", () => {
            autoResizeTextarea();
            updateSendButtonState();
        });

        // גרירה ושחרור (drag & drop)
        chatArea.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        });
        chatArea.addEventListener("drop", handleDrop);

        updateSendButtonState();
        console.log("[Chat] Initialized successfully");
    }

    // ========================================================
    //  טיפול בקבצים ותמונות
    // ========================================================
    function handleFileSelect(e) {
        const files = Array.from(e.target.files || []);
        addAttachments(files);
        fileInput.value = "";
    }

    function handleImageSelect(e) {
        const files = Array.from(e.target.files || []);
        addAttachments(files);
        imageInput.value = "";
    }

    function handleDrop(e) {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) addAttachments(files);
    }

    function addAttachments(files) {
        for (const file of files) {
            if (attachments.length >= 8) {
                alert("ניתן לצרף עד 8 קבצים בלבד");
                break;
            }

            const id = Date.now() + Math.random().toString(36).slice(2, 7);
            const item = {
                id,
                file,
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size
            };

            // תצוגה מקדימה לתמונות
            if (file.type.startsWith("image/")) {
                item.previewUrl = URL.createObjectURL(file);
            }

            attachments.push(item);
        }
        renderAttachmentsPreview();
        updateSendButtonState();
    }

    function removeAttachment(id) {
        const idx = attachments.findIndex(a => a.id === id);
        if (idx === -1) return;

        if (attachments[idx].previewUrl) {
            URL.revokeObjectURL(attachments[idx].previewUrl);
        }
        attachments.splice(idx, 1);
        renderAttachmentsPreview();
        updateSendButtonState();
    }

    function renderAttachmentsPreview() {
        attachmentsPreview.innerHTML = "";
        if (attachments.length === 0) {
            attachmentsPreview.classList.remove("has-items");
            return;
        }
        attachmentsPreview.classList.add("has-items");

        attachments.forEach(att => {
            const chip = document.createElement("div");
            chip.className = "attachment-chip";

            if (att.previewUrl) {
                const img = document.createElement("img");
                img.src = att.previewUrl;
                img.alt = att.name;
                chip.appendChild(img);
            } else {
                const icon = document.createElement("i");
                icon.className = "fa-solid fa-file";
                chip.appendChild(icon);
            }

            const nameSpan = document.createElement("span");
            nameSpan.className = "name";
            nameSpan.textContent = att.name;
            nameSpan.title = att.name;
            chip.appendChild(nameSpan);

            const removeBtn = document.createElement("button");
            removeBtn.className = "remove";
            removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            removeBtn.title = "הסר";
            removeBtn.addEventListener("click", () => removeAttachment(att.id));
            chip.appendChild(removeBtn);

            attachmentsPreview.appendChild(chip);
        });
    }

    // ========================================================
    //  שליחת הודעה
    // ========================================================
    async function handleSend() {
        if (isSending) return;

        const text = chatInput.value.trim();
        if (!text && attachments.length === 0) return;

        isSending = true;
        setSendingUI(true);

        // הסתרת מסך הפתיחה
        if (welcomeContainer) {
            welcomeContainer.style.display = "none";
        }

        // הוספת הודעת משתמש
        const userPayload = {
            text,
            attachments: [...attachments],
            module: moduleSelect ? moduleSelect.value : "general"
        };
        appendUserMessage(userPayload);

        // ניקוי קלט
        chatInput.value = "";
        autoResizeTextarea();
        const currentAttachments = [...attachments];
        attachments = [];
        renderAttachmentsPreview();

        // הצגת אנימציית חשיבה
        const thinkingId = showThinkingAnimation();

        // קריאה לסוכן
        const agent = window.AIAgentInstance;
        if (!agent) {
            hideThinking(thinkingId);
            appendBotMessage("שגיאה: הסוכן לא נטען. ודא ש-agent.js נטען לפני chat.js.");
            setSendingUI(false);
            isSending = false;
            return;
        }

        const result = await agent.processMessage(userPayload, (progress) => {
            updateThinkingStep(thinkingId, progress);
        });

        // הסרת אנימציית חשיבה
        hideThinking(thinkingId);

        // הצגת תשובה
        if (result.success) {
            appendBotMessage(result.reply);
        } else {
            appendBotMessage(`⚠️ ${result.error || "אירעה שגיאה"}`);
        }

        setSendingUI(false);
        isSending = false;
        chatInput.focus();
    }

    // ========================================================
    //  הוספת הודעות ל-UI
    // ========================================================
    function appendUserMessage(payload) {
        messageCount++;
        const msg = document.createElement("div");
        msg.className = "message user";
        msg.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="message-bubble"></div>
        `;
        const bubble = msg.querySelector(".message-bubble");

        if (payload.text) {
            const p = document.createElement("div");
            p.textContent = payload.text;
            bubble.appendChild(p);
        }

        // קבצים
        (payload.attachments || []).forEach(att => {
            if (att.previewUrl) {
                const img = document.createElement("img");
                img.className = "preview";
                img.src = att.previewUrl;
                img.alt = att.name;
                bubble.appendChild(img);
            } else {
                const chip = document.createElement("div");
                chip.className = "file-chip";
                chip.innerHTML = `<i class="fa-solid fa-file"></i> <span>${escapeHtml(att.name)}</span>`;
                bubble.appendChild(chip);
            }
        });

        chatArea.appendChild(msg);
        scrollToBottom();
    }

    function appendBotMessage(text) {
        messageCount++;
        const msg = document.createElement("div");
        msg.className = "message bot";
        msg.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-bubble"></div>
        `;
        const bubble = msg.querySelector(".message-bubble");
        // תומך ב-newline פשוט
        bubble.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
        chatArea.appendChild(msg);
        scrollToBottom();
    }

    // ========================================================
    //  אנימציית חשיבה
    // ========================================================
    function showThinkingAnimation() {
        const id = "thinking-" + Date.now();
        const container = document.createElement("div");
        container.className = "thinking-container";
        container.id = id;
        container.innerHTML = `
            <div class="message-avatar" style="background:linear-gradient(145deg,#112240,#0d1b33);border:1px solid rgba(100,255,218,0.3);color:#64ffda;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="thinking-bubble">
                <div class="thinking-header">
                    <span>הסוכן חושב</span>
                    <div class="thinking-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
                <div class="thinking-steps" id="${id}-steps">
                    <div class="thinking-step" data-step="receive">
                        <i class="fa-regular fa-circle"></i>
                        <span>מקבל את ההודעה...</span>
                    </div>
                    <div class="thinking-step" data-step="analyze_files">
                        <i class="fa-regular fa-circle"></i>
                        <span>מנתח קבצים ותמונות...</span>
                    </div>
                    <div class="thinking-step" data-step="build_prompt">
                        <i class="fa-regular fa-circle"></i>
                        <span>בונה הקשר ו-prompt...</span>
                    </div>
                    <div class="thinking-step" data-step="call_model">
                        <i class="fa-regular fa-circle"></i>
                        <span>שולח למודל בינה מלאכותית...</span>
                    </div>
                    <div class="thinking-step" data-step="finalize">
                        <i class="fa-regular fa-circle"></i>
                        <span>מעבד תשובה סופית...</span>
                    </div>
                </div>
            </div>
        `;
        chatArea.appendChild(container);
        scrollToBottom();
        return id;
    }

    function updateThinkingStep(thinkingId, progress) {
        const stepsEl = document.getElementById(`${thinkingId}-steps`);
        if (!stepsEl) return;

        const stepEl = stepsEl.querySelector(`[data-step="${progress.step}"]`);
        if (!stepEl) return;

        // איפוס קודמים
        stepsEl.querySelectorAll(".thinking-step").forEach(el => {
            if (el.dataset.step === progress.step) return;
            // אם כבר עברנו אותו – סמן כ-done
        });

        if (progress.status === "active") {
            stepEl.classList.add("active");
            stepEl.classList.remove("done");
            stepEl.querySelector("i").className = "fa-solid fa-spinner fa-spin";
            if (progress.label) {
                stepEl.querySelector("span").textContent = progress.label;
            }
        } else if (progress.status === "done") {
            stepEl.classList.remove("active");
            stepEl.classList.add("done");
            stepEl.querySelector("i").className = "fa-solid fa-check";
        }
    }

    function hideThinking(thinkingId) {
        const el = document.getElementById(thinkingId);
        if (el) {
            el.style.transition = "opacity 0.25s";
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 260);
        }
    }

    // ========================================================
    //  עזרים
    // ========================================================
    function autoResizeTextarea() {
        chatInput.style.height = "auto";
        chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + "px";
    }

    function updateSendButtonState() {
        const hasText = chatInput.value.trim().length > 0;
        const hasFiles = attachments.length > 0;
        btnSend.disabled = isSending || (!hasText && !hasFiles);
    }

    function setSendingUI(sending) {
        btnSend.disabled = sending || (chatInput.value.trim() === "" && attachments.length === 0);
        btnSend.classList.toggle("loading", sending);
        const icon = btnSend.querySelector("i");
        if (sending) {
            icon.className = "fa-solid fa-spinner";
        } else {
            icon.className = "fa-solid fa-arrow-up";
        }

        btnAttachFile.disabled = sending;
        btnAttachImage.disabled = sending;
        chatInput.disabled = sending;
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
        });
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function resetChat() {
        // ניקוי הודעות (שומר על welcome)
        const messages = chatArea.querySelectorAll(".message, .thinking-container");
        messages.forEach(m => m.remove());

        if (welcomeContainer) {
            welcomeContainer.style.display = "";
        }

        // ניקוי קבצים
        attachments.forEach(a => {
            if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        });
        attachments = [];
        renderAttachmentsPreview();

        chatInput.value = "";
        autoResizeTextarea();
        updateSendButtonState();
        messageCount = 0;
        chatInput.focus();
    }

    // ========================================================
    //  הפעלה
    // ========================================================
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
