import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy loaded Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("找不到 GEMINI_API_KEY 密鑰。請在 Settings > Secrets 中為此應用程式設定。");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION = `你是一位專業的會議記錄秘書與多國語言翻譯官。你的任務是將使用者提供的「會議原始逐字稿」或「重點筆記」進行深度剖析、結構化整理，並翻譯成指定的目標語言。

請遵守以下輸出規範：
1. 輸出必須完全符合 Markdown 語法，排版美觀、層次分明、條理清晰。可多善用 bold、列表、表格和區塊引用使排版更精緻。
2. 輸出的語言必須是使用者指定的「目標翻譯語言」；若是「專業雙語會議記錄」，請遵照第 5 點翻譯。
3. 語氣與文字風格必須符合使用者選擇的「文字風格」。
4. 結構必須根據使用者指定的「會議記錄格式」生成。
5. 所有繁體中文的部分必須使用**繁體中文（台灣繁體/Traditional Chinese）**回覆，不要包含任何額外的問候語或結語。

詳細的格式要求：
- 若格式為「專業雙語會議記錄 (主題、與會者、重點、待辦事項、英文對照)」（此為預設首選格式），請務必嚴格遵守以下輸出格式與序號標題（精準對應 1~5）：
  1. **會議主題與時間**：擷取會議的主題與時間。若原逐字稿未明確提及，請根據脈絡合理推導。
  2. **與會者**：列出參與會議的人員。
  3. **會議重點總結**：用 3 到 5 個重點總結會議內容。
  4. **Action Items (待辦事項)**：明確列出接下來的待辦事項與負責人。
  5. **英文翻譯版**：將上述 1~4 點的內容完整翻譯成專業的英文。

- 若格式為「完整會議記錄 (含討論內容、決議、行動清單)」，必須包含：
  - 📌 **會議核心主旨**：概括本會議的核心目的。
  - 📋 **會議基本資訊**（日期、重要出席人員與分工，若原逐字稿未明確提及，請根據脈絡合理推導並用斜體或星號標註）。
  - 💬 **重要討論議題**：詳細整理各個討論議題的來龍去脈、與會者的不同觀點與論述。
  - 🎯 **重要決議事項**：明確條列會議達成的最大共識或最終決定。
  - ⚡ **行動清單（Action Items）**：以 Markdown 表格呈現，列出 待辦事項、建議負責人、優先順序 與 預計截止時間（若逐字稿未提供，請提供專業推估並加星號）。
- 若格式為「精簡要點總結 (快速瀏覽會議核心內容)」，請提取精華整理：
  - 🔍 **會議大意**
  - 💡 **核心三大要點說明**（請重點提煉，不遺漏重大決議）
  - 🚀 **後續追蹤大計**
- 若格式為「行動清單優先 (列出待辦事項、負責人與時程)」：
  - 📊 **待辦事項分工矩陣** (表格呈現：項目、建議指派負責人、關鍵交付物、急迫度、預估時程)
  - ⚠️ **專案前置阻礙與潛在風險提示**
- 若格式為「時間軸對話流 (按會議推進順序整理)」：
  - 按會議對話的發展階段，依序做區間總結。例如：[01: 開場與目的]、[02: 方案辨析與意見碰撞]、[03: 結論與定調]、[04: 後續指派]，並附帶總結。

特殊規則：
- 如果使用者指定了「焦點關鍵字」，請在整理與總結時，特別加強標註、分析或著重呈現與這些關鍵字相關的討論細節。
- 絕不捏造與會議主題完全不相關的内容。如果提供的原始文字非常少、殘缺或語義不清，請在其餘部分以適當的專業提示引導使用者補充更多細節，並就現有文字極限整理出大意，展現極高專業度。`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large transcript payloads
  app.use(express.json({ limit: "15mb" }));

  // API Route
  app.post("/api/generate", async (req: any, res: any) => {
    try {
      const { transcript, targetLanguage, summaryStyle, tone, focusKeywords } = req.body;

      if (!transcript || !transcript.trim()) {
        return res.status(400).json({ success: false, error: "輸入內容不能為空" });
      }

      const client = getGeminiClient();

      const userPrompt = `
【會議資料與設定】:
- 目標翻譯與輸出語言: ${targetLanguage}
- 會議記錄格式: ${summaryStyle}
- 輸出語氣風格: ${tone}
- 針對關注的焦點關鍵字: ${focusKeywords ? focusKeywords : "無（請通盤重要整理）"}

【使用者貼上的會議逐字稿/筆記】:
${transcript}

請為我仔細分析、統整，並依照以上的格式與風格要求，高保真度地产出精緻的會議摘要和記錄。
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.25,
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("模型產生的輸出內容為空。請確認輸入逐字稿的有效性並重新嘗試。");
      }

      return res.json({ success: true, text });
    } catch (err: any) {
      console.error("Gemini request failed:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "處理會議記錄時發生未知錯誤，請稍後重試。"
      });
    }
  });

  // Hot Module Replacement configuration fallback & dynamic serving middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Server running on http://localhost:${PORT}`);
  });
}

startServer();
