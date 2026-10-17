import React, { useState } from 'react';
import { Sparkles, Globe, RefreshCw, CheckCircle2, Play, BookOpen, Layers, X, Lightbulb, ExternalLink, ShieldCheck, History, Trash2 } from 'lucide-react';
import { UserProfile, SubjectId, Question } from '../types';
import { SUBJECTS } from '../data/subjects';
import { soundManager } from '../services/sound';
import { FirebaseDataService, auth } from '../services/firebase';
import {
  getSessionSeenQuestionIds,
  markQuestionAsSeen,
  registerCustomQuestions,
  getSessionGeneratedQuestions,
  getRecentSessionQuestions,
  addSessionGeneratedQuestions,
  clearSessionGeneratedQuestions
} from '../data/questions';
import { MathMarkdown } from './MathMarkdown';

interface AiQuestionGeneratorModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onStartPracticeWithQuestions?: (questions: Question[], subject: SubjectId, topic: string) => void;
}

export const AiQuestionGeneratorModal: React.FC<AiQuestionGeneratorModalProps> = ({
  user,
  isOpen,
  onClose,
  onStartPracticeWithQuestions,
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'session'>('generate');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('toan');
  const [selectedGrade, setSelectedGrade] = useState<number>(user.grade || 1);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<number>(3);
  const [useSearch, setUseSearch] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>(() => getSessionGeneratedQuestions());
  const [groundingSources, setGroundingSources] = useState<Array<{ title: string; url: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedToCloud, setSavedToCloud] = useState<boolean>(false);
  const [seenCountTracked, setSeenCountTracked] = useState<number>(0);

  // Refresh seen count and session questions whenever modal is opened
  React.useEffect(() => {
    if (!isOpen) return;
    setSessionQuestions(getSessionGeneratedQuestions());
    let isCancelled = false;

    const countInitialSeen = async () => {
      const sessionIds = getSessionSeenQuestionIds();
      const localHistoryIds = user.questionHistory || [];
      const currentUid = auth.currentUser?.uid || user.id;
      let firestoreIds: string[] = [];

      if (currentUid) {
        try {
          firestoreIds = await FirebaseDataService.getUserAllSeenQuestionIds(currentUid);
        } catch {
          // ignore
        }
      }

      if (!isCancelled) {
        const combined = new Set([...sessionIds, ...localHistoryIds, ...firestoreIds]);
        setSeenCountTracked(combined.size);
      }
    };

    countInitialSeen();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, user.id, user.questionHistory]);

  // Default topics for current subject
  const currentSubjectInfo = SUBJECTS.find(s => s.id === selectedSubject) || SUBJECTS[0];
  const availableTopics = currentSubjectInfo.topics;

  const activeTopicName = customTopic.trim() || selectedTopic || availableTopics[0];

  const handleGenerate = async () => {
    soundManager.playClick();
    setIsGenerating(true);
    setErrorMsg(null);
    setSavedToCloud(false);

    try {
      // 1. Collect question IDs seen in current learning session
      const sessionIds = getSessionSeenQuestionIds();

      // 2. Collect question IDs from local user question history
      const localHistoryIds = user.questionHistory || [];

      // 3. Collect question IDs already rendered in modal or in session
      const inModalIds = generatedQuestions.map(q => q.id);

      // 4. Retrieve recent session questions to pass to Gemini for explicit contrast
      const recentSessionList = getRecentSessionQuestions(25);

      // 5. Collect previously seen question IDs and question content snippets from Firestore
      let firestoreSeenIds: string[] = [];
      let existingQuestions: string[] = [];
      const currentUid = auth.currentUser?.uid || user.id;

      if (currentUid) {
        try {
          const [storedQuestions, allFirestoreIds] = await Promise.all([
            FirebaseDataService.getGeneratedQuestions(
              currentUid,
              selectedSubject,
              selectedGrade,
              activeTopicName
            ),
            FirebaseDataService.getUserAllSeenQuestionIds(currentUid)
          ]);

          existingQuestions = storedQuestions.map(s => s.content || '').filter(Boolean);
          firestoreSeenIds = allFirestoreIds;
        } catch (firestoreErr) {
          console.warn('Could not read question history from Firestore:', firestoreErr);
        }
      }

      // Aggregate all seen question IDs to ensure 100% exclusion
      const seenIdsSet = new Set<string>([
        ...sessionIds,
        ...localHistoryIds,
        ...inModalIds,
        ...firestoreSeenIds
      ]);
      const seen_question_ids = Array.from(seenIdsSet).filter(Boolean);
      setSeenCountTracked(seen_question_ids.length);

      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: selectedGrade,
          subject: selectedSubject,
          topic: activeTopicName,
          count: questionCount,
          difficulty,
          seen_question_ids,
          existingQuestions,
          recentSessionQuestions: recentSessionList.map(q => ({
            id: q.id,
            content: q.content,
            topic: q.topic,
            subject: q.subject,
            options: q.options,
            explanation: q.explanation
          })),
          useSearch
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (!data.questions || data.questions.length === 0) {
        throw new Error('Không nhận được câu hỏi từ Gemini');
      }

      // Store in session questions tracker (persisted in sessionStorage & in-memory)
      addSessionGeneratedQuestions(data.questions);
      setSessionQuestions(getSessionGeneratedQuestions());

      // Mark all received questions as seen for this session
      data.questions.forEach((q: Question) => {
        if (q.id) markQuestionAsSeen(q.id);
      });
      registerCustomQuestions(data.questions);

      setGeneratedQuestions(data.questions);
      setGroundingSources(data.groundingSources || []);
      soundManager.playCorrect();

      // Persist newly generated questions to Firestore with user ID
      if (currentUid) {
        try {
          await FirebaseDataService.saveGeneratedQuestions(
            currentUid,
            data.questions,
            selectedSubject,
            selectedGrade,
            activeTopicName
          );
          setSavedToCloud(true);
        } catch (saveErr) {
          console.warn('Could not save questions to Firestore:', saveErr);
        }
      }
    } catch (err: any) {
      console.error('Error generating questions:', err);
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi tạo câu hỏi. Vui lòng thử lại!');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartGame = () => {
    if (!generatedQuestions || generatedQuestions.length === 0) return;
    soundManager.playClick();
    if (onStartPracticeWithQuestions) {
      onStartPracticeWithQuestions(generatedQuestions, selectedSubject, activeTopicName);
    }
    onClose();
  };

  const handleStartSessionPractice = () => {
    if (!sessionQuestions || sessionQuestions.length === 0) return;
    soundManager.playClick();
    if (onStartPracticeWithQuestions) {
      onStartPracticeWithQuestions(sessionQuestions, selectedSubject, activeTopicName);
    }
    onClose();
  };

  const handleClearSession = () => {
    soundManager.playClick();
    if (window.confirm('Bạn có chắc chắn muốn xóa danh sách câu hỏi đã lưu trong phiên này không?')) {
      clearSessionGeneratedQuestions();
      setSessionQuestions([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        id="ai-question-generator-modal"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl shadow-xs">
              ✨
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                Tạo Câu Hỏi Vô Hạn với Gemini & Google Search
              </h3>
              <p className="text-xs text-amber-100 font-medium">
                Cập nhật dữ liệu thực tế • Không trùng lặp • Chuẩn khung chương trình Lớp {selectedGrade}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            id="close-ai-generator-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'generate'
                ? 'border-amber-500 text-amber-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tạo Câu Hỏi Mới</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('session')}
            className={`px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'session'
                ? 'border-amber-500 text-amber-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Câu Hỏi Đã Tạo Trong Phiên ({sessionQuestions.length})</span>
            {sessionQuestions.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {activeTab === 'generate' ? (
            <>
              {/* Session Context Banner */}
              <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-2xl flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-700">
                  <div className="font-bold text-amber-900 flex items-center gap-2">
                    <span>Bộ nhớ chống trùng lặp trong phiên: {sessionQuestions.length} câu đã lưu</span>
                    {sessionQuestions.length > 0 && (
                      <span className="bg-amber-200/80 text-amber-900 text-[10px] px-1.5 py-0.5 rounded-md font-extrabold">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Mỗi lần tạo mới, hệ thống tự động gửi danh sách các câu đã xuất hiện cho Gemini. AI được chỉ thị bắt buộc: <strong>không lặp lại câu hỏi giống hệt</strong>, <strong>không lặp lại cùng dữ kiện với cách viết khác</strong>, <strong>thay đổi số liệu</strong>, <strong>thay đổi tình huống thực tế</strong>, <strong>thay đổi cách hỏi</strong> và <strong>thay đổi dạng bài</strong>.
                  </p>
                </div>
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Subject Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    Môn học:
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value as SubjectId);
                      setSelectedTopic('');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    id="select-generator-subject"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icon} {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grade Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-orange-500" />
                    Khối lớp:
                  </label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    id="select-generator-grade"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        Lớp {g} (Học sinh Lớp {g})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Topics selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    Chủ đề / Chuyên đề môn học:
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">Chọn chủ đề có sẵn hoặc gõ riêng</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {availableTopics.map((topic) => {
                    const isSelected = (!customTopic && selectedTopic === topic) || (!customTopic && !selectedTopic && topic === availableTopics[0]);
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => {
                          setSelectedTopic(topic);
                          setCustomTopic('');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Hoặc tự nhập chủ đề (ví dụ: Định lý Pythagoras, Thì Quá khứ đơn, Thơ Lục bát...)"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Difficulty & Count */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Độ khó (1 - 6): <span className="text-amber-600 font-extrabold">{difficulty}/6</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Cơ bản</span>
                    <span>Trung bình</span>
                    <span>Nâng cao</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Số lượng câu tạo mỗi lần:
                  </label>
                  <div className="flex gap-2">
                    {[3, 5, 10].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionCount(count)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                          questionCount === count
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {count} câu
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Google Search Grounding Checkbox */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3">
                <input
                  type="checkbox"
                  id="grounding-search-toggle"
                  checked={useSearch}
                  onChange={(e) => setUseSearch(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded-sm text-blue-600 accent-blue-600 cursor-pointer"
                />
                <label htmlFor="grounding-search-toggle" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    Sử dụng dữ liệu tìm kiếm Google Search (Real-time Grounding)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tìm kiếm tài liệu học tập, các đề thi và số liệu mới nhất để tạo ra các tình huống thực tế độc đáo, không bị lặp lại đề cũ.
                  </p>
                </label>
              </div>

              {/* Seen Exclusion Status */}
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-800">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Đang tích cực loại trừ câu hỏi cũ trong phiên & lịch sử
                </span>
                {seenCountTracked > 0 && (
                  <span className="font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-300">
                    Đã lưu {seenCountTracked} câu cũ
                  </span>
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                id="btn-trigger-ai-question-generation"
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-orange-200 transition-transform active:scale-[0.99] cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang đối chiếu câu cũ & biên soạn câu hỏi mới Lớp {selectedGrade}...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Tạo {questionCount} câu hỏi mới ngay (Đổi mới dạng bài & tình huống)</span>
                  </>
                )}
              </button>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Display Generated Questions Preview */}
              {generatedQuestions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Vừa tạo thành công {generatedQuestions.length} câu hỏi mới:
                    </h4>
                    {savedToCloud && (
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        ☁️ Đã lưu Firestore
                      </span>
                    )}
                  </div>

                  {/* Grounding sources pill */}
                  {groundingSources.length > 0 && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="text-slate-500 font-medium block mb-1">Nguồn dẫn chứng Google Search:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {groundingSources.map((source, sIdx) => (
                          <a
                            key={sIdx}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{source.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Question list items */}
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {generatedQuestions.map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                        <div className="font-bold text-slate-800 mb-1.5 flex items-start gap-1">
                          <span className="shrink-0 font-extrabold text-amber-600">Câu {idx + 1}:</span>
                          <div className="flex-1 min-w-0">
                            <MathMarkdown content={q.content} inline />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 ${
                                optIdx === q.correctIndex
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold'
                                  : 'bg-white text-slate-600 border border-slate-200'
                              }`}
                            >
                              <span className="shrink-0">{String.fromCharCode(65 + optIdx)}.</span>
                              <span className="flex-1 min-w-0"><MathMarkdown content={opt} inline /></span>
                              {optIdx === q.correctIndex && <span className="text-emerald-700 font-bold shrink-0">✓</span>}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <div className="text-[11px] text-slate-600 italic bg-white/80 p-2 rounded-xl border border-slate-100 flex items-start gap-1.5">
                            <span className="shrink-0 not-italic font-bold text-amber-600">💡 Giải thích:</span>
                            <div className="flex-1 min-w-0 not-italic">
                              <MathMarkdown content={q.explanation} inline />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Session Questions List View */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-600" />
                    Danh Sách Câu Hỏi Đã Tạo Trong Phiên Học
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Toàn bộ câu hỏi này được ứng dụng ghi nhớ để gửi cho Gemini đối chiếu mỗi khi tạo mới, đảm bảo 100% không trùng dạng hay chỉ thay số.
                  </p>
                </div>
                {sessionQuestions.length > 0 && (
                  <button
                    onClick={handleClearSession}
                    type="button"
                    className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Xóa danh sách phiên"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Làm mới phiên</span>
                  </button>
                )}
              </div>

              {sessionQuestions.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
                    📚
                  </div>
                  <p className="text-xs font-bold text-slate-700">Chưa có câu hỏi nào được tạo trong phiên này</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Hãy chuyển sang tab "Tạo Câu Hỏi Mới", chọn môn học và chủ đề yêu thích để Gemini tạo câu hỏi độc nhất cho bạn.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('generate')}
                    className="mt-3 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                  >
                    Tạo Câu Hỏi Ngay
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Tổng số: <span className="text-amber-600">{sessionQuestions.length}</span> câu hỏi trong phiên
                    </span>
                    {onStartPracticeWithQuestions && (
                      <button
                        onClick={handleStartSessionPractice}
                        type="button"
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:from-emerald-600 hover:to-teal-700 cursor-pointer shadow-xs"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Luyện tập tất cả ({sessionQuestions.length} câu)</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {sessionQuestions.map((q, qIdx) => (
                      <div key={q.id || qIdx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs hover:border-amber-300 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold rounded-md text-[10px]">
                              Câu {qIdx + 1}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-medium rounded-md text-[10px]">
                              Lớp {q.grade}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-medium rounded-md text-[10px]">
                              {q.topic}
                            </span>
                          </div>
                        </div>

                        <div className="font-bold text-slate-800 mb-2 leading-relaxed">
                          <MathMarkdown content={q.content} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${
                                optIdx === q.correctIndex
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold'
                                  : 'bg-white text-slate-600 border border-slate-200'
                              }`}
                            >
                              <span className="shrink-0 font-semibold">{String.fromCharCode(65 + optIdx)}.</span>
                              <span className="flex-1 min-w-0"><MathMarkdown content={opt} inline /></span>
                              {optIdx === q.correctIndex && <span className="text-emerald-700 font-bold shrink-0">✓</span>}
                            </div>
                          ))}
                        </div>

                        {q.explanation && (
                          <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-xl border border-slate-100 flex items-start gap-1.5 mt-1">
                            <span className="shrink-0 font-bold text-amber-600">💡 Giải thích:</span>
                            <div className="flex-1 min-w-0">
                              <MathMarkdown content={q.explanation} inline />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Đóng
          </button>

          {activeTab === 'generate' && generatedQuestions.length > 0 && onStartPracticeWithQuestions && (
            <button
              onClick={handleStartGame}
              id="btn-play-generated-questions"
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-200 transition-transform active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Chơi Ngay Với Bộ Câu Hỏi Vừa Tạo ({generatedQuestions.length} câu)</span>
            </button>
          )}

          {activeTab === 'session' && sessionQuestions.length > 0 && onStartPracticeWithQuestions && (
            <button
              onClick={handleStartSessionPractice}
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-200 transition-transform active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Luyện Tập Với Tất Cả {sessionQuestions.length} Câu Trong Phiên</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

