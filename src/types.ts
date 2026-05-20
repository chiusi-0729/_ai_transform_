/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum TargetLanguage {
  ZH_TW = "繁體中文 (Traditional Chinese)",
  EN = "英文 (English)",
  JA = "日文 (Japanese)",
  KO = "韓文 (Korean)",
  ZH_CN = "簡體中文 (Simplified Chinese)",
  ES = "西班牙文 (Spanish)",
  FR = "法文 (French)",
  DE = "德文 (German)"
}

export enum SummaryStyle {
  EXECUTIVE_TRANSLATION = "專業雙語會議記錄 (主題、與會者、重點、待辦事項、英文對照)",
  COMPREHENSIVE = "完整會議記錄 (含討論內容、決議、行動清單)",
  CONCISE = "精簡要點總結 (快速瀏覽會議核心內容)",
  ACTION_ITEMS = "行動清單優先 (列出待辦事項、負責人與時程)",
  TIMELINE = "時間軸對話流 (按會議推進順序整理)"
}

export enum ResponseTone {
  PROFESSIONAL = "專業嚴謹 (商務與開發報告)",
  FRIENDLY = "溫和親切 (團隊內部溝通與回顧)",
  DIRECT = "直截了當 (簡潔有力，不拖泥帶水)"
}

export interface GeneratorOptions {
  transcript: string;
  targetLanguage: TargetLanguage;
  summaryStyle: SummaryStyle;
  tone: ResponseTone;
  focusKeywords: string;
}

export interface GenerationResult {
  success: boolean;
  text?: string;
  error?: string;
  metadata?: {
    wordCount: number;
    durationEstimate?: string;
  };
}
