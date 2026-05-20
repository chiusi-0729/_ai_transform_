/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  Languages, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  BookOpen, 
  Upload, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Settings, 
  Search, 
  CheckSquare, 
  ChevronRight,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { 
  TargetLanguage, 
  SummaryStyle, 
  ResponseTone, 
  GeneratorOptions 
} from "./types";
import { SAMPLES } from "./samples";

export default function App() {
  // Option Selectors / Input States
  const [transcript, setTranscript] = useState("");
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>(TargetLanguage.ZH_TW);
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>(SummaryStyle.EXECUTIVE_TRANSLATION);
  const [tone, setTone] = useState<ResponseTone>(ResponseTone.PROFESSIONAL);
  const [focusKeywords, setFocusKeywords] = useState("");

  // UI Interactive States
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultText, setResultText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Audio Speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Characters Counter
  const transcriptCharCount = transcript.trim().length;
  const transcriptWordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  // Handle Loading a Sample
  const handleLoadSample = (sampleText: string) => {
    setTranscript(sampleText);
    setErrorMsg("");
  };

  // Handle Drag & Drop uploading txt/md file
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileRead(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileRead(files[0]);
    }
  };

  const handleFileRead = (file: File) => {
    if (file.type !== "text/plain" && !file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      setErrorMsg("只支援上傳純文字檔 (.txt) 或是 Markdown 檔 (.md)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === "string") {
        setTranscript(event.target.result);
        setErrorMsg("");
      }
    };
    reader.onerror = () => {
      setErrorMsg("檔案讀取失敗，請手動複製貼上。");
    };
    reader.readAsText(file);
  };

  // Trigger Gemini API Summary
  const handleGenerate = async () => {
    if (!transcript.trim()) {
      setErrorMsg("請先輸入會議逐字稿、重點筆記或上傳文字檔案。");
      return;
    }

    setIsGenerating(true);
    setErrorMsg("");
    setResultText("");
    
    // Cancel any ongoing speaking
    if (synthRef.current && isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          transcript,
          targetLanguage,
          summaryStyle,
          tone,
          focusKeywords
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "生成失敗，請確認後台 API 回應並重試。");
      }

      setResultText(data.text);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "連線至 AI 伺服器時發生異常，請檢查網路狀態。");
    } finally {
      setIsGenerating(false);
    }
  };

  // One-click copy
  const handleCopy = () => {
    if (!resultText) return;
    navigator.clipboard.writeText(resultText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Download outcome as .md document
  const handleDownloadFile = () => {
    if (!resultText) return;
    const blob = new Blob([resultText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // Pre-populate clean file name
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    link.href = url;
    link.download = `會議紀錄整理_${timestamp}.md`;
    document.body.appendChild(link);
    link.click();
    
    // Clean-up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Clear Editor
  const handleClear = () => {
    setTranscript("");
    setErrorMsg("");
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
  };

  // TTS Read aloud output
  const handleToggleSpeak = () => {
    if (!synthRef.current || !resultText) return;

    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }

    // Clean text from markdown notations for speech synthesis
    const speechText = resultText
      .replace(/[#*`_~\[\]]/g, "") // remove simple md tokens
      .replace(/\|/g, " ") // table separators
      .slice(0, 1500); // Limit speech length to protect browser resources

    const utterance = new SpeechSynthesisUtterance(speechText);
    
    // Detect voice language depending on selected target format
    if (targetLanguage.includes("English") || targetLanguage.includes("EN")) {
      utterance.lang = "en-US";
    } else if (targetLanguage.includes("Japanese") || targetLanguage.includes("JA")) {
      utterance.lang = "ja-JP";
    } else if (targetLanguage.includes("Korean") || targetLanguage.includes("KO")) {
      utterance.lang = "ko-KR";
    } else if (targetLanguage.includes("Spanish") || targetLanguage.includes("ES")) {
      utterance.lang = "es-ES";
    } else {
      utterance.lang = "zh-TW";
    }

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    synthRef.current.speak(utterance);
  };

  return (
    <div id="app-root" className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans transition-colors duration-200 relative overflow-x-hidden selection:bg-indigo-500/30 selection:text-white">
      
      {/* Background Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/30 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Crisp executive-grade Header banner */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/5 border-b border-white/10 px-6 py-4 shadow-lg shadow-black/10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 flex items-center gap-2">
                AI 會議記錄生成與翻譯工具
              </h1>
              <p className="text-xs text-slate-400 font-medium my-0.5">
                基於 Google Gemini 智慧引擎・一鍵產出結構化繁中會議記錄與多國翻譯
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full font-mono">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              服務就緒 | 本地代理
            </div>
            {/* Design theme premium avatar decoration */}
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center cursor-pointer overflow-hidden hover:bg-white/20 transition-all shadow-md">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" referrerPolicy="no-referrer" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start z-10 relative">
        
        {/* Left column: Operations Panel (Input & Configs) */}
        <div className="lg:col-span-5 flex flex-col gap-5 h-full">
          
          {/* Section: Text input and file drag-and-drop */}
          <div id="input-card" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex flex-col shadow-xl shadow-black/10">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-indigo-400" />
                第一步：貼上會議逐字稿或重點筆記
              </span>
              <button
                id="clear-btn"
                onClick={handleClear}
                disabled={!transcript}
                className="text-xs flex items-center gap-1 text-slate-500 hover:text-rose-400 disabled:opacity-35 disabled:hover:text-slate-500 transition-colors cursor-pointer"
                title="清空輸入框"
              >
                <Trash2 className="w-4 h-4" />
                清空
              </button>
            </div>

            {/* Drag and drop / text box area */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl transition-all duration-200 ${
                isDragOver ? "border-indigo-500 bg-indigo-500/10 scale-[0.99]" : "border-white/10 hover:border-white/20 bg-slate-950/20"
              }`}
            >
              <textarea
                id="meeting-transcript-input"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="在此貼上您錄下的會議逐字稿、團隊亂記的筆記，或將 .txt 或 .md 檔案拖曳進來本區塊..."
                className="w-full h-80 max-h-[40vh] p-4 text-sm text-slate-200 bg-transparent resize-y focus:outline-none placeholder:text-slate-600 leading-relaxed font-sans"
              />
              
              {/* Overlay display when empty */}
              {!transcript && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none select-none">
                  <Upload className="w-10 h-10 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">拖曳檔案至此，或點擊下方按鈕上傳</p>
                </div>
              )}
            </div>

            {/* File upload action and Stats */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
              <label 
                id="upload-file-label"
                className="cursor-pointer text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 px-3 py-2 rounded-xl font-medium inline-flex items-center gap-1.5 transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                上傳會議檔案 (.txt / .md)
                <input 
                  type="file" 
                  accept=".txt,.md" 
                  onChange={handleFileSelect} 
                  className="hidden" 
                />
              </label>

              {/* Character Metrics */}
              {transcriptCharCount > 0 && (
                <span className="text-xs font-mono text-slate-500">
                  字數：<strong className="text-slate-300">{transcriptCharCount}</strong> 字 | 約 
                  <strong className="text-slate-300"> {transcriptWordCount}</strong> 詞
                </span>
              )}
            </div>
            
            {/* Quick Loading Sample Panel */}
            <div className="mt-4 bg-white/5 rounded-2xl p-3.5 border border-white/10">
              <p className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                一鍵載入測試範例體驗：
              </p>
              <div className="flex flex-col gap-1.5">
                {SAMPLES.map((sample, idx) => (
                  <button
                    key={idx}
                    id={`sample-load-btn-${idx}`}
                    type="button"
                    onClick={() => handleLoadSample(sample.transcript)}
                    className="w-full text-left text-xs text-indigo-300 hover:text-indigo-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 p-2.5 rounded-xl font-medium transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate mr-4 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />
                      {sample.title}
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-200 px-1.5 py-0.5 rounded shrink-0 font-sans">
                      {sample.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Section: Output style configuration options */}
          <div id="config-card" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex flex-col gap-4 shadow-xl shadow-black/10">
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-white/5 pb-2">
              <Settings className="w-4.5 h-4.5 text-indigo-400" />
              第二步：自訂生成條件
            </span>

            {/* Style template Dropdown */}
            <div>
              <label id="summary-style-label" className="block text-xs font-semibold text-slate-400 mb-1.5">
                會議記錄格式範本
              </label>
              <select
                id="summary-style-select"
                value={summaryStyle}
                onChange={(e) => setSummaryStyle(e.target.value as SummaryStyle)}
                className="w-full text-xs text-slate-200 bg-slate-950/40 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors select-none [&>option]:text-slate-900 cursor-pointer"
              >
                {Object.values(SummaryStyle).map((styleOpt) => (
                  <option key={styleOpt} value={styleOpt}>
                    {styleOpt}
                  </option>
                ))}
              </select>
            </div>

            {/* Split layout: Language and Mode tone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Target Language selector */}
              <div>
                <label id="target-lang-label" className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Languages className="w-3.5 h-3.5 text-slate-400" />
                  目標輸出語言
                </label>
                <select
                  id="target-lang-select"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value as TargetLanguage)}
                  className="w-full text-xs text-slate-200 bg-slate-950/40 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors select-none [&>option]:text-slate-900 cursor-pointer"
                >
                  {Object.values(TargetLanguage).map((langOpt) => (
                    <option key={langOpt} value={langOpt}>
                      {langOpt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tone style helper */}
              <div>
                <label id="response-tone-label" className="block text-xs font-semibold text-slate-400 mb-1.5">
                  文字語氣風格
                </label>
                <select
                  id="response-tone-select"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as ResponseTone)}
                  className="w-full text-xs text-slate-200 bg-slate-950/40 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors select-none [&>option]:text-slate-900 cursor-pointer"
                >
                  {Object.values(ResponseTone).map((toneOpt) => (
                    <option key={toneOpt} value={toneOpt}>
                      {toneOpt}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Optional Focus keywords */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label id="focus-keywords-label" className="block text-xs font-semibold text-slate-400">
                  焦點關注關鍵字 (選填)
                </label>
                <span className="text-[10px] text-slate-500">各詞以逗號隔開</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="focus-keywords-input"
                  type="text"
                  value={focusKeywords}
                  onChange={(e) => setFocusKeywords(e.target.value)}
                  placeholder="例如：時程, 預算, Alex, 2.0版本"
                  className="w-full text-xs text-slate-200 bg-slate-950/40 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Robust core operational process button */}
            <button
              id="generate-summit-btn"
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !transcript.trim()}
              className="group relative w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-2xl font-bold text-white shadow-xl shadow-indigo-500/15 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 overflow-hidden cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  智能會議秘書正在整理與翻譯中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-indigo-200 animate-pulse" />
                  生成會議總結與翻譯
                </>
              )}
            </button>
            
          </div>

        </div>

        {/* Right column: Formatted Output Screen */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <div id="output-card" className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl min-h-[500px] lg:min-h-[700px] flex flex-col overflow-hidden relative shadow-2xl shadow-black/25">
            
            {/* Header section with utilities */}
            <div className="border-b border-white/10 px-5 py-4 bg-white/5 flex flex-wrap justify-between items-center gap-3">
              <span className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                <CheckSquare className="w-4.5 h-4.5 text-purple-400" />
                生成結果預覽區
              </span>

              {/* Functional Utilities for quick action */}
              {resultText && (
                <div className="flex items-center gap-2">
                  {/* Speech synthesis tool */}
                  <button
                    id="speech-toggle-btn"
                    onClick={handleToggleSpeak}
                    className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSpeaking 
                        ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30" 
                        : "bg-white/10 border-white/10 text-slate-300 hover:bg-white/20"
                    }`}
                    title={isSpeaking ? "停止播放語音" : "朗讀生成摘要 (限1500字)"}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-4 h-4" />
                        停止朗讀
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4" />
                        語音朗讀
                      </>
                    )}
                  </button>

                  {/* Copy button */}
                  <button
                    id="copy-result-btn"
                    onClick={handleCopy}
                    className="bg-white/10 hover:bg-white/20 border border-white/10 text-slate-100 p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        已複製
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        一鍵複製
                      </>
                    )}
                  </button>

                  {/* Download markdown doc */}
                  <button
                    id="download-result-btn"
                    onClick={handleDownloadFile}
                    className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    導出 .md
                  </button>
                </div>
              )}
            </div>

            {/* Display screen states */}
            <div className="flex-1 p-5 md:p-6 overflow-y-auto max-h-[75vh]">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  /* Loading Active state */
                  <motion.div
                    key="generating-loader"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8"
                  >
                    <div className="relative mb-6">
                      <div className="w-16 h-16 border-4 border-white/10 border-t-indigo-600 rounded-full animate-spin"></div>
                      <Sparkles className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    
                    <h3 className="text-base font-bold text-slate-100 mb-2">正在分析會議脈絡與彙整...</h3>
                    <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
                      這可能需要 15 到 30 秒，AI 正在重塑組織、篩選關鍵決議、擬定工作項目表格並翻譯成指定語系。
                    </p>

                    {/* Progress feedback hint */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 max-w-xs text-left shadow-lg">
                      <div className="text-[11px] font-bold text-indigo-300 mb-1 flex items-center gap-1 font-sans">
                        <Info className="w-3.5 h-3.5" />
                        分析亮點：
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal font-sans">
                        產出報告包含：🎯 核心決議點、⚡ 行動分配表格、以及會議對白議題的深入分解。
                      </p>
                    </div>
                  </motion.div>

                ) : errorMsg ? (
                  /* Error Alert State */
                  <motion.div
                    key="error-state"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-6"
                  >
                    <div className="bg-rose-50 text-rose-600 p-3 rounded-full mb-4 border border-rose-100">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-bold text-rose-700 mb-1.5 font-sans">處理會議記錄失敗</h3>
                    <p className="text-xs text-slate-500 max-w-md leading-relaxed whitespace-pre-wrap mb-4 font-sans">
                      {errorMsg}
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-all inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      再次重試一次
                    </button>
                  </motion.div>

                ) : resultText ? (
                  /* Successful Markdown Rendering */
                  <motion.div
                    key="markdown-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="markdown-body text-slate-300 select-text leading-relaxed font-sans pb-10"
                  >
                    <Markdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-2xl font-extrabold text-white mt-6 mb-4 border-b border-white/10 pb-2 flex items-center gap-2 tracking-tight" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mt-5 mb-3.5 flex items-center gap-1.5 tracking-tight" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-semibold text-indigo-300 mt-4 mb-2" {...props} />,
                        p: ({node, ...props}) => <p className="text-sm text-slate-300 leading-relaxed mb-4 font-sans" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1.5 mb-4 text-sm text-slate-300 pl-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1.5 mb-4 text-sm text-slate-300 pl-2" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1 mb-1 leading-relaxed" {...props} />,
                        table: ({node, ...props}) => (
                          <div className="overflow-x-auto my-5 rounded-2xl border border-white/10 shadow-lg bg-slate-950/40 backdrop-blur-md">
                            <table className="w-full text-xs text-left text-slate-300" {...props} />
                          </div>
                        ),
                        thead: ({node, ...props}) => <thead className="text-[11px] text-slate-200 font-semibold bg-white/5 border-b border-white/10" {...props} />,
                        tbody: ({node, ...props}) => <tbody className="divide-y divide-white/5" {...props} />,
                        tr: ({node, ...props}) => <tr className="hover:bg-white/5 transition-all font-sans" {...props} />,
                        th: ({node, ...props}) => <th className="px-3 py-2.5 font-bold text-slate-100" {...props} />,
                        td: ({node, ...props}) => <td className="px-3 py-2.5 leading-relaxed text-slate-300" {...props} />,
                        blockquote: ({node, ...props}) => (
                          <blockquote className="border-l-4 border-indigo-500 bg-white/5 pl-4 pr-3 py-2 text-xs italic my-4 text-slate-400 rounded-r" {...props} />
                        ),
                        code: ({node, ...props}) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs font-semibold" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />
                      }}
                    >
                      {resultText}
                    </Markdown>
                  </motion.div>

                ) : (
                  /* Empty / Awaiting State */
                  <motion.div
                    key="empty-waiting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8"
                  >
                    <div className="bg-white/5 p-4 rounded-full mb-4 border border-white/10 shadow-lg">
                      <Sparkles className="w-10 h-10 text-indigo-400 animate-pulse" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 mb-1">準備好您的會議記錄了嗎？</h3>
                    <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                      請在左側貼上音訊逐字稿或會議大綱筆記，設定您想翻譯或生成的語系，AI 將在幾秒內在右側輸出結構化的高水準會議摘要與待辦行動卡！
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Design theme status footer indicators */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-slate-950/20 text-[10px] text-slate-500 font-mono tracking-wider">
              <div>SERVICE_STATUS: COMPLETED</div>
              <div>SECURITY_MODE: ON</div>
            </div>

          </div>
        </div>

      </main>

      {/* Humble Elegant Footer (Hidden details in margins removed to ensure focus) */}
      <footer className="bg-black/20 border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500 mt-auto z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© 2026 AI 會議記錄翻譯專家系統. 隱私加密傳輸協定已啟動.</p>
          <p className="font-semibold text-[11px] text-slate-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
            Powered by Google Gemini 3.5 Flash Model & React Typescript
          </p>
        </div>
      </footer>

    </div>
  );
}
