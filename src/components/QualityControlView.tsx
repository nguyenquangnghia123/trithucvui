import React, { useState, useEffect } from 'react';
import { UserProfile, SubjectId, GradeLevel, Question } from '../types';
import { SUBJECTS } from '../data/subjects';
import { 
  CurriculumScopeConfig, 
  LessonScope, 
  QuestionQualityCheck, 
  DEFAULT_CURRICULUM_SCOPES, 
  QuestionReport 
} from '../data/defaultCurriculums';
import { CurriculumQualityService } from '../services/curriculumQualityService';
import { soundManager } from '../services/sound';
import { registerCustomQuestions } from '../data/questions';
import { MathMarkdown } from './MathMarkdown';
import { 
  ShieldCheck, 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Sparkles, 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RefreshCw, 
  FileText, 
  HelpCircle, 
  ChevronRight, 
  Scale, 
  Play, 
  Award,
  Filter
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QualityControlViewProps {
  user: UserProfile;
  onNavigate: (tab: string, extra?: unknown) => void;
  onStartPracticeWithQuestions?: (questions: Question[], subject: SubjectId, topic: string) => void;
}

export const QualityControlView: React.FC<QualityControlViewProps> = ({
  user,
  onNavigate,
  onStartPracticeWithQuestions,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'scopes' | 'generate' | 'reports'>('generate');
  const [scopes, setScopes] = useState<CurriculumScopeConfig[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('toan');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(user.grade || 6);
  const [selectedScopeId, setSelectedScopeId] = useState<string>('');
  const [selectedLessonNumber, setSelectedLessonNumber] = useState<number>(1);
  const [reports, setReports] = useState<QuestionReport[]>([]);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [auditResult, setAuditResult] = useState<{ passed: boolean; notes: string } | null>(null);
  const [approvedQuestions, setApprovedQuestions] = useState<Set<string>>(new Set());

  // Scope editing state
  const [isEditingScope, setIsEditingScope] = useState(false);
  const [editTextbook, setEditTextbook] = useState('');
  const [editLessons, setEditLessons] = useState<LessonScope[]>([]);
  const [editDisallowed, setEditDisallowed] = useState<string>('');

  // Load scopes and reports on mount
  useEffect(() => {
    const loadData = async () => {
      const allScopes = await CurriculumQualityService.getCurriculumScopes();
      setScopes(allScopes);

      const allReports = await CurriculumQualityService.getReports();
      setReports(allReports);

      // Auto select matching scope
      const match = allScopes.find(s => s.subject === selectedSubject && s.grade === selectedGrade) || allScopes[0];
      if (match) {
        setSelectedScopeId(match.id);
        setSelectedLessonNumber(match.lessons[0]?.lessonNumber || 1);
      }
    };
    loadData();
  }, []);

  // Update selected scope when subject or grade changes
  useEffect(() => {
    const match = scopes.find(s => s.subject === selectedSubject && s.grade === selectedGrade);
    if (match) {
      setSelectedScopeId(match.id);
      setSelectedLessonNumber(match.lessons[0]?.lessonNumber || 1);
    } else if (scopes.length > 0) {
      setSelectedScopeId(scopes[0].id);
      setSelectedLessonNumber(scopes[0].lessons[0]?.lessonNumber || 1);
    }
  }, [selectedSubject, selectedGrade, scopes]);

  const activeScope = scopes.find(s => s.id === selectedScopeId) || scopes[0] || DEFAULT_CURRICULUM_SCOPES[0];

  const handleStartEditScope = () => {
    soundManager.playClick();
    if (!activeScope) return;
    setEditTextbook(activeScope.textbook);
    setEditLessons([...activeScope.lessons]);
    setEditDisallowed(activeScope.disallowedTopics.join(', '));
    setIsEditingScope(true);
  };

  const handleSaveScopeEdit = async () => {
    soundManager.playClick();
    if (!activeScope) return;

    const updated: CurriculumScopeConfig = {
      ...activeScope,
      textbook: editTextbook.trim() || activeScope.textbook,
      lessons: editLessons,
      disallowedTopics: editDisallowed.split(',').map(s => s.trim()).filter(Boolean),
      updatedAt: new Date().toISOString()
    };

    const saved = await CurriculumQualityService.saveCurriculumScope(updated);
    setScopes(prev => prev.map(s => s.id === saved.id ? saved : s));
    setIsEditingScope(false);
    soundManager.playCorrect();
  };

  const handleGenerateQuestions = async () => {
    soundManager.playClick();
    if (!activeScope) return;

    setIsGenerating(true);
    setAuditResult(null);

    try {
      const res = await CurriculumQualityService.generateScopeBoundQuestions({
        scope: activeScope,
        selectedLessonNumber,
        count: 3,
        difficulty: 3,
      });

      setGeneratedQuestions(res.questions);
      setAuditResult({ passed: res.auditPassed, notes: res.notes });

      if (res.auditPassed) {
        soundManager.playCorrect();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      }
    } catch (err) {
      console.error('Error generating questions with scope:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveQuestion = (q: Question) => {
    soundManager.playCoin();
    registerCustomQuestions([q]);
    setApprovedQuestions(prev => new Set(prev).add(q.id));
  };

  const handleStartPracticeWithAll = () => {
    if (generatedQuestions.length === 0) return;
    soundManager.playVictory();
    registerCustomQuestions(generatedQuestions);
    if (onStartPracticeWithQuestions) {
      const activeLesson = activeScope.lessons.find(l => l.lessonNumber === selectedLessonNumber);
      onStartPracticeWithQuestions(
        generatedQuestions, 
        activeScope.subject, 
        activeLesson ? activeLesson.title : 'Kiến thức SGK chuẩn'
      );
    } else {
      onNavigate('games', { customQuestions: generatedQuestions, subject: activeScope.subject });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold border border-white/20">
            <ShieldCheck className="w-4 h-4 text-emerald-200" />
            <span>Hệ Thống Thẩm Định Chất Lượng GDPT 2018</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            Kiểm Soát Chất Lượng Câu Hỏi AI & Chuẩn Hóa SGK
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
            Chỉ tạo câu hỏi từ phạm vi kiến thức đã được cấu hình trong sách giáo khoa. Tự động kiểm định qua 8 tiêu chí chất lượng nghiêm ngặt trước khi đưa vào ngân hàng đề thi.
          </p>
        </div>

        {/* Quick Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 relative z-10">
          <button
            onClick={() => setActiveSubTab('generate')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'generate'
                ? 'bg-white text-emerald-800 shadow-md font-extrabold scale-105'
                : 'bg-emerald-700/60 hover:bg-emerald-700 text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Kiểm Định & Sinh Câu Hỏi SGK</span>
          </button>
          <button
            onClick={() => setActiveSubTab('scopes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'scopes'
                ? 'bg-white text-emerald-800 shadow-md font-extrabold scale-105'
                : 'bg-emerald-700/60 hover:bg-emerald-700 text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Cấu Hình Phạm Vi SGK (5 Bài Học)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'reports'
                ? 'bg-white text-emerald-800 shadow-md font-extrabold scale-105'
                : 'bg-emerald-700/60 hover:bg-emerald-700 text-white'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Hộp Thư Phúc Khảo ({reports.length})</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR: Subject and Grade selection */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            Chọn Môn & Lớp:
          </span>

          {/* Subject pills */}
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSubject(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedSubject === s.id
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grade selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600">Khối Lớp:</label>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(Number(e.target.value) as GradeLevel)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-800 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>
                Lớp {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SUB-TAB 1: AI GENERATION & 8-POINT QUALITY AUDIT */}
      {activeSubTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Scope Info & Generator Trigger */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Phạm Vi Đang Áp Dụng
                </span>
                <button
                  onClick={() => setActiveSubTab('scopes')}
                  className="text-xs text-slate-500 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Chỉnh Sửa
                </button>
              </div>

              <div>
                <h3 className="font-extrabold text-base text-slate-800 mb-1">
                  {activeScope.textbook}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeScope.description}
                </p>
              </div>

              {/* Lesson Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Chọn Bài Học Để Sinh Câu Hỏi:
                </label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {activeScope.lessons.map((lesson) => (
                    <button
                      key={lesson.lessonNumber}
                      onClick={() => setSelectedLessonNumber(lesson.lessonNumber)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                        selectedLessonNumber === lesson.lessonNumber
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-400'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold line-clamp-1">{lesson.title}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {lesson.coreKnowledge}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Strict Scope Safeguards */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 text-xs space-y-1.5">
                <span className="font-bold text-slate-700 block flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Quy Tắc Ràng Buộc AI:
                </span>
                <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                  <li>Chỉ dùng kiến thức và công thức trong bài đã chọn.</li>
                  <li>Không tự ý mở rộng nội dung ngoài phạm vi SGK.</li>
                  <li>Loại bỏ hoàn toàn nội dung chưa học / cấm kỵ.</li>
                </ul>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateQuestions}
                disabled={isGenerating}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gemini Đang Tạo & Kiểm Định 8 Tiêu Chí...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Sinh Câu Hỏi & Chạy Kiểm Định Tự Động</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Generated Questions & 8-Point Audit Checklist */}
          <div className="lg:col-span-2 space-y-4">
            {auditResult && (
              <div className={`p-4 rounded-3xl border ${
                auditResult.passed
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50/90 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-black text-sm">
                    {auditResult.passed ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>KẾT QUẢ KIỂM ĐỊNH: 100% ĐẠT CHUẨN SƯ PHẠM</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <span>KẾT QUẢ KIỂM ĐỊNH: CÓ ĐIỂM CẦN LƯU Ý</span>
                      </>
                    )}
                  </div>
                  <span className="px-3 py-1 bg-white rounded-full text-xs font-black shadow-xs">
                    {generatedQuestions.length} câu đã kiểm duyệt
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {auditResult.notes}
                </p>
              </div>
            )}

            {/* List of Questions */}
            {generatedQuestions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    Danh Sách Câu Hỏi Chuẩn Hóa ({generatedQuestions.length}):
                  </span>
                  <button
                    onClick={handleStartPracticeWithAll}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Luyện Tập Ngay Với Bộ Câu Này</span>
                  </button>
                </div>

                {generatedQuestions.map((q, idx) => {
                  const check = q.qualityCheck;
                  const isApproved = approvedQuestions.has(q.id);

                  return (
                    <div
                      key={q.id || idx}
                      className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4"
                    >
                      {/* Question Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-xs text-slate-700">
                            {q.lessonName || activeScope.lessons.find(l => l.lessonNumber === selectedLessonNumber)?.title}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Độ khó: {q.difficulty}/6
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Điểm kiểm định: {q.qualityScore || 100}%
                          </span>
                          <button
                            onClick={() => handleApproveQuestion(q)}
                            disabled={isApproved}
                            className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                              isApproved
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isApproved ? 'Đã Vào Ngân Hàng' : 'Duyệt Vào Đề'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="text-sm font-bold text-slate-800">
                        <MathMarkdown content={q.content} />
                      </div>

                      {/* Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = optIdx === q.correctIndex;
                          return (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-2xl border text-xs flex items-start gap-2 ${
                                isCorrect
                                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold ring-1 ring-emerald-400'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                                isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <div className="flex-1">
                                <MathMarkdown content={opt} />
                              </div>
                              {isCorrect && (
                                <span className="text-[10px] text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                  Đáp Án Đúng
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation & Source */}
                      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 text-xs space-y-1.5">
                        <div className="font-bold text-slate-700 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                          <span>Lời Giải & Căn Cứ Xác Định:</span>
                        </div>
                        <div className="text-slate-600 text-xs">
                          <MathMarkdown content={q.explanation} />
                        </div>
                        {q.proofSource && (
                          <div className="text-[11px] text-emerald-700 font-semibold pt-1 border-t border-slate-200/60 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            <span>Nguồn SGK: {q.proofSource}</span>
                          </div>
                        )}
                      </div>

                      {/* 8-Point Quality Verification Card */}
                      {check && (
                        <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 text-[11px] space-y-2">
                          <div className="flex items-center justify-between font-bold text-emerald-900">
                            <span className="flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Bảng Đánh Giá 8 Tiêu Chí Kiểm Định Sư Phạm:
                            </span>
                            <span className="text-emerald-700">Trạng Thái: {check.overallStatus}</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="flex items-center gap-1 text-slate-700">
                              {check.inScope ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              <span>Trong phạm vi SGK</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-700">
                              {check.dataConsistent ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              <span>Dữ kiện đầy đủ</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-700">
                              {check.answerAccurate ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              <span>Đáp án chính xác</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-700">
                              {check.explanationValid ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              <span>Lời giải chứng minh</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-700">
                              {check.singleCorrectOption ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              <span>Duy nhất 1 đáp án</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-700">
                              {check.distractorsValid ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              <span>Phương án nhiễu hợp lý</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-700">
                              {check.nonDuplicate ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              <span>Không bị trùng lặp</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-700">
                              {check.gradeAppropriate ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              <span>Phù hợp trình độ</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
                  📖
                </div>
                <h4 className="font-extrabold text-slate-800 text-base">
                  Chưa Có Câu Hỏi Nào Được Sinh Cho Bài Này
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Hãy bấm nút <strong>"Sinh Câu Hỏi & Chạy Kiểm Định Tự Động"</strong> ở cột bên trái để AI tạo ra các câu hỏi trắc nghiệm chuẩn mực theo SGK {activeScope.textbook}.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CURRICULUM SCOPE MANAGEMENT (5 LESSONS) */}
      {activeSubTab === 'scopes' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-800">
                Phạm Vi Kiến Thức SGK: {activeScope.textbook}
              </h3>
              <p className="text-xs text-slate-500">
                Môn: {activeScope.subject.toUpperCase()} • Lớp {activeScope.grade} • Khung chương trình chuẩn
              </p>
            </div>

            {!isEditingScope ? (
              <button
                onClick={handleStartEditScope}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh Sửa Phạm Vi Bài Học</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingScope(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleSaveScopeEdit}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            )}
          </div>

          {isEditingScope ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Bộ Sách Giáo Khoa:
                </label>
                <input
                  type="text"
                  value={editTextbook}
                  onChange={(e) => setEditTextbook(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chủ Đề Cấm / Vượt Quá Chương Trình (cách nhau bởi dấu phẩy):
                </label>
                <input
                  type="text"
                  value={editDisallowed}
                  onChange={(e) => setEditDisallowed(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="space-y-4 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Nội Dung Chi Tiết 5 Bài Học:
                </label>
                {editLessons.map((lesson, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        Bài {lesson.lessonNumber}
                      </span>
                      <input
                        type="text"
                        value={lesson.title}
                        onChange={(e) => {
                          const updated = [...editLessons];
                          updated[idx].title = e.target.value;
                          setEditLessons(updated);
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-600 mb-1">Kiến thức trọng tâm:</span>
                      <textarea
                        rows={2}
                        value={lesson.coreKnowledge}
                        onChange={(e) => {
                          const updated = [...editLessons];
                          updated[idx].coreKnowledge = e.target.value;
                          setEditLessons(updated);
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="block text-[11px] font-bold text-slate-600 mb-1">Khái niệm cho phép (cách nhau dấu phẩy):</span>
                        <input
                          type="text"
                          value={lesson.allowedConcepts.join(', ')}
                          onChange={(e) => {
                            const updated = [...editLessons];
                            updated[idx].allowedConcepts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            setEditLessons(updated);
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] font-bold text-slate-600 mb-1">Công thức cho phép:</span>
                        <input
                          type="text"
                          value={lesson.allowedFormulas.join(', ')}
                          onChange={(e) => {
                            const updated = [...editLessons];
                            updated[idx].allowedFormulas = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            setEditLessons(updated);
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {activeScope.lessons.map((lesson) => (
                  <div
                    key={lesson.lessonNumber}
                    className="p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-colors space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">
                          {lesson.lessonNumber}
                        </span>
                        <span>{lesson.title}</span>
                      </h4>
                      <button
                        onClick={() => {
                          setSelectedLessonNumber(lesson.lessonNumber);
                          setActiveSubTab('generate');
                        }}
                        className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Tạo Đề Bài Này</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      <strong>Kiến thức cốt lõi:</strong> {lesson.coreKnowledge}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                      <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                        <span className="font-bold text-slate-600 block mb-1">Khái niệm & Định nghĩa được phép:</span>
                        <div className="flex flex-wrap gap-1">
                          {lesson.allowedConcepts.map((c, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px]">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                        <span className="font-bold text-slate-600 block mb-1">Công thức & Biểu thức cho phép:</span>
                        <div className="flex flex-wrap gap-1">
                          {lesson.allowedFormulas.map((f, i) => (
                            <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-mono rounded-md text-[11px] border border-emerald-100">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: STUDENT DISPUTE REPORTS */}
      {activeSubTab === 'reports' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                <span>Hộp Thư Khiếu Nại & Phúc Khảo Câu Hỏi</span>
              </h3>
              <p className="text-xs text-slate-500">
                Ghi nhận các câu hỏi được học sinh báo cáo khi làm bài • Thẩm định và bù điểm minh bạch
              </p>
            </div>
          </div>

          {reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{report.userName}</span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(report.timestamp).toLocaleTimeString('vi-VN')} {new Date(report.timestamp).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      report.status === 'RESOLVED_VALID_APPEAL'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : report.status === 'RESOLVED_REJECTED'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {report.status === 'RESOLVED_VALID_APPEAL'
                        ? 'Đã Phê Duyệt Phúc Khảo (Hoàn Tim + Thưởng)'
                        : report.status === 'RESOLVED_REJECTED'
                        ? 'Đã Xem Xét'
                        : 'Đang Chờ Thẩm Định'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-800 font-medium">
                    <MathMarkdown content={report.questionContent} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                      <span className="font-bold text-rose-700 block">Lựa chọn của học sinh:</span>
                      <span>{report.selectedOptionText}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="font-bold text-emerald-700 block">Đáp án hệ thống:</span>
                      <span>{report.correctAnswerText}</span>
                    </div>
                  </div>

                  <div className="text-slate-600 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                    <strong>Lý do học sinh khiếu nại:</strong> {report.studentComment}
                  </div>

                  {report.resolutionNotes && (
                    <div className="text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      <strong>Phán quyết của Trọng Tài:</strong> {report.resolutionNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center space-y-2 text-slate-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-sm text-slate-800">
                Chưa Có Khiếu Nại Nào Cần Xử Lý
              </h4>
              <p className="text-xs">
                Khi học sinh thi đấu và phát hiện câu hỏi nghi vấn, các báo cáo sẽ hiển thị trực tiếp tại đây.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
