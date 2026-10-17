import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  SubjectId, 
  GradeLevel, 
  Question,
  TextbookLesson,
  TextbookKnowledgeSet,
  TextbookQuestion,
  QuestionVerificationResult
} from '../types';
import { SUBJECTS } from '../data/subjects';
import { 
  CurriculumScopeConfig, 
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
  Filter,
  Check,
  X,
  Database,
  ExternalLink,
  Info,
  Sliders,
  RotateCcw
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
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'create' | 'approved_bank' | 'reports'>('create');

  // Filter selections
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('toan');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(user.grade || 6);

  // Step 1: Textbook Knowledge Set state
  const [knowledgeSets, setKnowledgeSets] = useState<TextbookKnowledgeSet[]>([]);
  const [currentSetId, setCurrentSetId] = useState<string>('');
  const [textbookName, setTextbookName] = useState<string>('Kết nối tri thức với cuộc sống (Bộ GD&ĐT)');
  const [textbookEdition, setTextbookEdition] = useState<string>('2024-2025');
  const [lessons, setLessons] = useState<TextbookLesson[]>([]);
  const [isEditingKnowledgeSet, setIsEditingKnowledgeSet] = useState<boolean>(false);
  const [inputErrors, setInputErrors] = useState<string[]>([]);

  // Step 2 & 3: Generation & Verification state
  const [selectedLessonNumber, setSelectedLessonNumber] = useState<number>(1);
  const [questionCount, setQuestionCount] = useState<number>(2); // 1-3 questions per batch, prioritizing accuracy
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<TextbookQuestion[]>([]);
  const [auditSummary, setAuditSummary] = useState<{ passed: boolean; notes: string } | null>(null);

  // Step 4: Question Edit Modal
  const [editingQuestion, setEditingQuestion] = useState<TextbookQuestion | null>(null);
  const [isReVerifying, setIsReVerifying] = useState<boolean>(false);

  // Step 4: Approved Questions Bank
  const [approvedQuestions, setApprovedQuestions] = useState<TextbookQuestion[]>([]);
  const [approvedFilterSubject, setApprovedFilterSubject] = useState<SubjectId | 'all'>('all');
  const [approvedFilterGrade, setApprovedFilterGrade] = useState<number | 'all'>('all');
  const [approvedSearchLesson, setApprovedSearchLesson] = useState<string>('');

  // Student Reports
  const [reports, setReports] = useState<QuestionReport[]>([]);

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    // 1. Load Knowledge Sets / Scopes
    const allScopes = await CurriculumQualityService.getCurriculumScopes();
    const sets = allScopes.map(mapScopeToKnowledgeSet);
    setKnowledgeSets(sets);

    // 2. Load Approved Questions
    const approved = await CurriculumQualityService.getTextbookApprovedQuestions();
    setApprovedQuestions(approved);

    // 3. Load Reports
    const allReports = await CurriculumQualityService.getReports();
    setReports(allReports);

    // Match current subject and grade
    syncSetForSubjectAndGrade(sets, selectedSubject, selectedGrade);
  };

  const mapScopeToKnowledgeSet = (scope: CurriculumScopeConfig): TextbookKnowledgeSet => ({
    id: scope.id,
    subject: scope.subject,
    grade: scope.grade,
    textbook: scope.textbook,
    edition: (scope as any).edition || '2024-2025',
    description: scope.description,
    lessons: scope.lessons.map(l => ({
      lessonNumber: l.lessonNumber,
      title: l.title,
      coreKnowledge: l.coreKnowledge,
      pageReference: (l as any).pageReference || '',
      allowedConcepts: l.allowedConcepts,
      allowedFormulas: l.allowedFormulas
    })),
    disallowedTopics: scope.disallowedTopics,
    createdAt: scope.createdAt,
    updatedAt: scope.updatedAt
  });

  const syncSetForSubjectAndGrade = (sets: TextbookKnowledgeSet[], subj: SubjectId, gr: GradeLevel) => {
    const match = sets.find(s => s.subject === subj && s.grade === gr);
    if (match) {
      setCurrentSetId(match.id);
      setTextbookName(match.textbook);
      setTextbookEdition(match.edition || '2024-2025');
      setLessons(match.lessons);
      setSelectedLessonNumber(match.lessons[0]?.lessonNumber || 1);
    } else {
      // Create empty/template for 5 lessons
      const newId = `set_${subj}_lop${gr}_${Date.now()}`;
      const defaultLessons: TextbookLesson[] = Array.from({ length: 5 }, (_, i) => ({
        lessonNumber: i + 1,
        title: `Bài ${i + 1}: Tên bài học SGK`,
        coreKnowledge: '',
        pageReference: '',
        allowedConcepts: [],
        allowedFormulas: []
      }));
      setCurrentSetId(newId);
      setTextbookName(gr <= 5 ? 'Chân trời sáng tạo (Bộ GD&ĐT)' : 'Kết nối tri thức với cuộc sống (Bộ GD&ĐT)');
      setTextbookEdition('2024-2025');
      setLessons(defaultLessons);
      setSelectedLessonNumber(1);
    }
  };

  // Re-sync when subject or grade filter changes
  useEffect(() => {
    syncSetForSubjectAndGrade(knowledgeSets, selectedSubject, selectedGrade);
  }, [selectedSubject, selectedGrade]);

  // ==========================================
  // BƯỚC 1: QUẢN LÝ BỘ KIẾN THỨC THEO SGK
  // ==========================================

  const handleLessonChange = (index: number, field: keyof TextbookLesson, value: any) => {
    const updated = [...lessons];
    updated[index] = { ...updated[index], [field]: value };
    setLessons(updated);
  };

  const handleAddLesson = () => {
    soundManager.playClick();
    const nextNumber = lessons.length > 0 ? Math.max(...lessons.map(l => l.lessonNumber)) + 1 : 1;
    setLessons([
      ...lessons,
      {
        lessonNumber: nextNumber,
        title: `Bài ${nextNumber}: Tên bài học mới`,
        coreKnowledge: '',
        pageReference: '',
        allowedConcepts: [],
        allowedFormulas: []
      }
    ]);
  };

  const handleRemoveLesson = (index: number) => {
    soundManager.playClick();
    if (lessons.length <= 1) {
      alert('Bộ kiến thức cần có ít nhất 1 bài học.');
      return;
    }
    const updated = lessons.filter((_, i) => i !== index);
    setLessons(updated);
  };

  const validateKnowledgeSetInputs = (): boolean => {
    const errors: string[] = [];
    if (!textbookName.trim()) {
      errors.push('Vui lòng nhập tên bộ sách giáo khoa (ví dụ: Kết nối tri thức, Chân trời sáng tạo, Cánh diều).');
    }
    if (lessons.length === 0) {
      errors.push('Vui lòng nhập ít nhất một bài học.');
    }
    lessons.forEach((l, idx) => {
      if (!l.title.trim()) {
        errors.push(`Bài ${idx + 1}: Chưa nhập tên bài học.`);
      }
      if (!l.coreKnowledge || l.coreKnowledge.trim().length < 15) {
        errors.push(`Bài ${idx + 1} ("${l.title || 'Chưa đặt tên'}"): Phần kiến thức chính quá ngắn (cần ít nhất 15 ký tự trích từ SGK).`);
      }
    });

    setInputErrors(errors);
    return errors.length === 0;
  };

  const handleSaveKnowledgeSet = async () => {
    soundManager.playClick();
    if (!validateKnowledgeSetInputs()) {
      return;
    }

    const setPayload: TextbookKnowledgeSet = {
      id: currentSetId,
      subject: selectedSubject,
      grade: selectedGrade,
      textbook: textbookName.trim(),
      edition: textbookEdition.trim(),
      description: `Bộ kiến thức SGK ${selectedSubject.toUpperCase()} Lớp ${selectedGrade}`,
      lessons: lessons,
      disallowedTopics: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // Save via API & local
      await fetch('/api/textbook/knowledge-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeSet: setPayload })
      });

      // Update state
      setKnowledgeSets(prev => {
        const idx = prev.findIndex(s => s.id === setPayload.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = setPayload;
          return copy;
        }
        return [setPayload, ...prev];
      });

      setIsEditingKnowledgeSet(false);
      setInputErrors([]);
      soundManager.playCorrect();
      alert('Đã lưu thành công bộ kiến thức SGK!');
    } catch (err: any) {
      alert(`Lỗi khi lưu bộ kiến thức: ${err?.message || err}`);
    }
  };

  // ==========================================
  // BƯỚC 2: AI TẠO CÂU HỎI TỪ NGUỒN ĐÃ NHẬP
  // ==========================================

  const handleGenerateQuestions = async () => {
    soundManager.playClick();
    const activeLesson = lessons.find(l => l.lessonNumber === selectedLessonNumber);
    if (!activeLesson) {
      alert('Vui lòng chọn bài học nguồn.');
      return;
    }

    if (!activeLesson.coreKnowledge || activeLesson.coreKnowledge.trim().length < 15) {
      alert(`Bài "${activeLesson.title}" chưa có đủ nội dung kiến thức chính trích từ SGK. Vui lòng bổ sung kiến thức cho bài này trước khi bấm tạo câu hỏi.`);
      setIsEditingKnowledgeSet(true);
      return;
    }

    setIsGenerating(true);
    setAuditSummary(null);

    try {
      const res = await CurriculumQualityService.generateTextbookQuestions({
        subject: selectedSubject,
        grade: selectedGrade,
        textbook: textbookName,
        edition: textbookEdition,
        lesson: activeLesson,
        count: questionCount,
        difficulty: 3,
        scopeId: currentSetId
      });

      if (res.success && res.questions.length > 0) {
        setGeneratedQuestions(res.questions);
        setAuditSummary({
          passed: res.auditPassed,
          notes: res.notes
        });

        if (res.auditPassed) {
          soundManager.playCorrect();
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 }
          });
        }
      } else {
        alert(res.notes || 'Không thể tạo câu hỏi từ bài học này. Vui lòng kiểm tra lại kiến thức đã cung cấp.');
      }
    } catch (err: any) {
      console.error('Error generating questions:', err);
      alert('Đã xảy ra lỗi khi tạo câu hỏi bám sát SGK. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ==========================================
  // BƯỚC 4: GIÁO VIÊN KIỂM DUYỆT & LƯU KHO
  // ==========================================

  const handleApproveAndSave = async (q: TextbookQuestion) => {
    soundManager.playCoin();
    const reviewerName = user.fullName || 'Giáo viên Chuyên môn';

    const res = await CurriculumQualityService.approveTextbookQuestion(q, reviewerName);
    if (res.success) {
      // Mark as approved in generated list
      setGeneratedQuestions(prev => prev.map(item => item.id === q.id ? { ...item, reviewerStatus: 'approved' } : item));

      // Add to official approved list
      setApprovedQuestions(prev => {
        const filtered = prev.filter(item => item.id !== q.id);
        return [res.question, ...filtered];
      });

      // Register into runtime question pool so games can immediately include it
      registerCustomQuestions([
        {
          id: res.question.id,
          grade: res.question.grade,
          subject: res.question.subject,
          topic: res.question.lessonTitle || res.question.topic,
          difficulty: 3,
          content: res.question.content,
          options: res.question.options,
          correctIndex: res.question.correctIndex,
          correctAnswerText: res.question.correctAnswerText,
          explanation: res.question.explanation,
          hint: res.question.hint || '',
          textbook: res.question.textbook,
          lessonName: res.question.lessonTitle,
          proofSource: `${res.question.textbook} - ${res.question.lessonTitle}`
        }
      ]);

      soundManager.playCorrect();
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.7 }
      });
    } else {
      alert(`Không thể duyệt câu hỏi: ${res.error || 'Lỗi không xác định'}`);
    }
  };

  const handleRejectQuestion = async (q: TextbookQuestion) => {
    soundManager.playClick();
    const reason = prompt('Nhập lý do từ chối câu hỏi (để lưu vào lịch sử thẩm định):', 'Câu hỏi chưa hoàn toàn sát SGK hoặc phương án chưa tối ưu');
    if (reason === null) return;

    await CurriculumQualityService.rejectTextbookQuestion(q.id, reason);
    setGeneratedQuestions(prev => prev.map(item => item.id === q.id ? { ...item, reviewerStatus: 'rejected', rejectionReason: reason } : item));
    setApprovedQuestions(prev => prev.filter(item => item.id !== q.id));
  };

  // Open edit modal for teacher to fine-tune question
  const handleOpenEditModal = (q: TextbookQuestion) => {
    soundManager.playClick();
    setEditingQuestion({ ...q, options: [...q.options] });
  };

  // Teacher saves edited question -> MUST RE-RUN INDEPENDENT VERIFICATION PASS!
  const handleSaveAndReVerify = async () => {
    if (!editingQuestion) return;
    soundManager.playClick();

    // Check basic constraints
    if (!editingQuestion.content.trim()) {
      alert('Nội dung câu hỏi không được để trống.');
      return;
    }
    if (editingQuestion.options.some(o => !o.trim())) {
      alert('Tất cả 4 phương án lựa chọn phải được điền đầy đủ.');
      return;
    }

    setIsReVerifying(true);
    const activeLesson = lessons.find(l => l.lessonNumber === editingQuestion.lessonNumber) || lessons[0];

    try {
      // Re-run independent 2-step verification for the edited version
      const verification = await CurriculumQualityService.verifyTextbookQuestion({
        question: editingQuestion,
        lesson: activeLesson,
        grade: selectedGrade,
        subject: selectedSubject,
        textbook: textbookName
      });

      const updatedQuestion: TextbookQuestion = {
        ...editingQuestion,
        correctAnswerText: editingQuestion.options[editingQuestion.correctIndex] || '',
        verificationStatus: verification.passed ? 'passed_review' : 'flagged',
        verificationResult: verification,
        qualityScore: verification.qualityScore,
        reviewerStatus: 'pending_review', // Needs teacher approval again
        updatedAt: new Date().toISOString()
      };

      setGeneratedQuestions(prev => prev.map(q => q.id === updatedQuestion.id ? updatedQuestion : q));
      setEditingQuestion(null);
      soundManager.playCorrect();
    } catch (err: any) {
      alert(`Lỗi khi kiểm định lại: ${err?.message || err}`);
    } finally {
      setIsReVerifying(false);
    }
  };

  const handleDeleteApprovedQuestion = async (id: string) => {
    soundManager.playClick();
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này khỏi kho chính thức?')) return;
    await CurriculumQualityService.deleteApprovedQuestion(id);
    setApprovedQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Launch practice session from official approved questions
  const handleStartPracticeWithApproved = (questionsToPlay: TextbookQuestion[]) => {
    if (questionsToPlay.length === 0) {
      alert('Chưa có câu hỏi nào được chọn để luyện tập.');
      return;
    }
    soundManager.playVictory();

    const converted: Question[] = questionsToPlay.map(q => ({
      id: q.id,
      grade: q.grade,
      subject: q.subject,
      topic: q.lessonTitle || q.topic,
      difficulty: 3,
      content: q.content,
      options: q.options,
      correctIndex: q.correctIndex,
      correctAnswerText: q.correctAnswerText,
      explanation: q.explanation,
      hint: q.hint || '',
      textbook: q.textbook,
      lessonName: q.lessonTitle,
      proofSource: `${q.textbook} - ${q.lessonTitle}`
    }));

    registerCustomQuestions(converted);

    if (onStartPracticeWithQuestions) {
      onStartPracticeWithQuestions(
        converted, 
        selectedSubject, 
        `Kiểm Định SGK: ${textbookName}`
      );
    } else {
      onNavigate('games', { customQuestions: converted, subject: selectedSubject });
    }
  };

  // Filter approved questions list
  const filteredApprovedList = approvedQuestions.filter(q => {
    if (approvedFilterSubject !== 'all' && q.subject !== approvedFilterSubject) return false;
    if (approvedFilterGrade !== 'all' && Number(q.grade) !== Number(approvedFilterGrade)) return false;
    if (approvedSearchLesson.trim()) {
      const matchText = `${q.lessonTitle} ${q.content} ${q.topic}`.toLowerCase();
      if (!matchText.includes(approvedSearchLesson.toLowerCase())) return false;
    }
    return true;
  });

  const activeLesson = lessons.find(l => l.lessonNumber === selectedLessonNumber) || lessons[0];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold border border-white/20">
            <ShieldCheck className="w-4 h-4 text-emerald-200" />
            <span>Quy Trình Kiểm Soát Chất Lượng Câu Hỏi Bám Sát SGK</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            Tạo, Kiểm Định & Lưu Câu Hỏi Chuẩn Sách Giáo Khoa
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
            Ưu tiên độ chính xác tuyệt đối: Giáo viên nhập kiến thức nguồn của 5 bài SGK → AI tạo câu hỏi giới hạn trong nguồn → Kiểm định độc lập 2 lớp → Giáo viên duyệt từng câu trước khi lưu kho chính thức.
          </p>
        </div>

        {/* 3 Main Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 relative z-10">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white text-emerald-800 shadow-md font-extrabold scale-105'
                : 'bg-emerald-700/60 hover:bg-emerald-700 text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Tạo Câu Hỏi Theo Kiến Thức SGK (4 Bước)</span>
          </button>

          <button
            onClick={() => setActiveTab('approved_bank')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'approved_bank'
                ? 'bg-white text-emerald-800 shadow-md font-extrabold scale-105'
                : 'bg-emerald-700/60 hover:bg-emerald-700 text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Kho Câu Hỏi Chính Thức Đã Duyệt ({approvedQuestions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-white text-emerald-800 shadow-md font-extrabold scale-105'
                : 'bg-emerald-700/60 hover:bg-emerald-700 text-white'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Hộp Thư Khiếu Nại & Phúc Khảo ({reports.length})</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR: Subject & Grade Selection */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            Chọn Môn & Khối Lớp:
          </span>

          {/* Subject buttons */}
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSubject(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedSubject === s.id
                    ? 'bg-emerald-600 text-white shadow-xs'
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

      {/* TAB 1: 4-STEP WORKFLOW SCREEN */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* STEP 1: BỘ KIẾN THỨC THEO SGK */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 mb-1">
                  <span>Bước 1</span>
                  <span>•</span>
                  <span>Tạo & Lưu Bộ Kiến Thức SGK ({lessons.length} Bài)</span>
                </div>
                <h2 className="text-lg font-black text-slate-800">
                  {textbookName} • Khối Lớp {selectedGrade}
                </h2>
                <p className="text-xs text-slate-500">
                  Giáo viên nhập kiến thức chính của khoảng 5 bài SGK làm nguồn chuẩn duy nhất để AI sinh câu hỏi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isEditingKnowledgeSet ? (
                  <button
                    onClick={() => setIsEditingKnowledgeSet(true)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Chỉnh Sửa Bộ Kiến Thức</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditingKnowledgeSet(false)}
                      className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      onClick={handleSaveKnowledgeSet}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu Bộ Kiến Thức</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Validation errors banner if any */}
            {inputErrors.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Vui lòng hoàn thiện nội dung trước khi lưu hoặc tạo câu hỏi:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700 pl-1">
                  {inputErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Bộ Sách / Tài Liệu Tham Chiếu:
                </label>
                <input
                  type="text"
                  disabled={!isEditingKnowledgeSet}
                  value={textbookName}
                  onChange={(e) => setTextbookName(e.target.value)}
                  placeholder="VD: Kết nối tri thức với cuộc sống (Bộ GD&ĐT)"
                  className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100/60 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phiên Bản / Năm Xuất Bản:
                </label>
                <input
                  type="text"
                  disabled={!isEditingKnowledgeSet}
                  value={textbookEdition}
                  onChange={(e) => setTextbookEdition(e.target.value)}
                  placeholder="VD: Bản tái bản năm 2024-2025"
                  className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100/60 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* List of ~5 Lessons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  Danh Sách {lessons.length} Bài Học Nguồn (Có Vùng Nhập Riêng Từng Bài):
                </label>
                {isEditingKnowledgeSet && (
                  <button
                    onClick={handleAddLesson}
                    className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Bài Học</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {lessons.map((lesson, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      selectedLessonNumber === lesson.lessonNumber && !isEditingKnowledgeSet
                        ? 'bg-emerald-50/60 border-emerald-400 ring-2 ring-emerald-300/60'
                        : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {lesson.lessonNumber}
                        </span>

                        {isEditingKnowledgeSet ? (
                          <input
                            type="text"
                            value={lesson.title}
                            onChange={(e) => handleLessonChange(idx, 'title', e.target.value)}
                            placeholder={`Bài ${lesson.lessonNumber}: Tên bài học`}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        ) : (
                          <span className="font-extrabold text-xs sm:text-sm text-slate-800">
                            {lesson.title}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isEditingKnowledgeSet ? (
                          <>
                            <input
                              type="text"
                              value={lesson.pageReference || ''}
                              onChange={(e) => handleLessonChange(idx, 'pageReference', e.target.value)}
                              placeholder="Trang SGK (VD: Trang 6-9)"
                              className="w-36 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] text-slate-700"
                            />
                            {lessons.length > 1 && (
                              <button
                                onClick={() => handleRemoveLesson(idx)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Xóa bài này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {lesson.pageReference && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                                📖 {lesson.pageReference}
                              </span>
                            )}
                            <button
                              onClick={() => setSelectedLessonNumber(lesson.lessonNumber)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                selectedLessonNumber === lesson.lessonNumber
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {selectedLessonNumber === lesson.lessonNumber ? 'Đang Chọn Bài Này' : 'Chọn Để Sinh Đề'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Core Knowledge Text Area */}
                    <div>
                      <span className="block text-[11px] font-bold text-slate-600 mb-1">
                        Kiến thức chính trích từ SGK hoặc tài liệu giảng dạy:
                      </span>
                      {isEditingKnowledgeSet ? (
                        <textarea
                          rows={3}
                          value={lesson.coreKnowledge}
                          onChange={(e) => handleLessonChange(idx, 'coreKnowledge', e.target.value)}
                          placeholder="Trích dẫn nguyên văn hoặc tóm tắt các định nghĩa, quy tắc, công thức có trong bài học..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      ) : (
                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed max-h-32 overflow-y-auto">
                          {lesson.coreKnowledge ? (
                            <MathMarkdown content={lesson.coreKnowledge} />
                          ) : (
                            <span className="text-amber-600 italic">
                              Chưa có nội dung kiến thức chính. Bấm "Chỉnh Sửa Bộ Kiến Thức" để nhập.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 2 & 3: BẢNG ĐIỀU KHIỂN SINH CÂU HỎI & KIỂM ĐỊNH TỰ ĐỘNG */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Generate Trigger & Safeguard Rules */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Bước 2: Tạo Câu Hỏi
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Lớp {selectedGrade} • {selectedSubject.toUpperCase()}
                  </span>
                </div>

                {/* Selected Lesson Info */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bài học đang chọn:</span>
                  <h4 className="font-extrabold text-xs text-slate-800 line-clamp-2">
                    {activeLesson?.title || 'Chưa chọn bài học'}
                  </h4>
                  {activeLesson?.pageReference && (
                    <span className="text-[11px] text-emerald-700 font-semibold block">
                      Số trang tham chiếu: {activeLesson.pageReference}
                    </span>
                  )}
                </div>

                {/* Number of questions selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Số lượng câu hỏi cần tạo:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        onClick={() => setQuestionCount(num)}
                        className={`py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          questionCount === num
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {num} câu
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 italic">
                    Nguyên tắc chất lượng: Ưu tiên tạo ít câu nhưng tuyệt đối chính xác và có bằng chứng SGK.
                  </p>
                </div>

                {/* Strict Constraints Card */}
                <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-xs space-y-2">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Ràng Buộc Chất Lượng AI:
                  </span>
                  <ul className="text-[11px] text-emerald-900 space-y-1 list-disc list-inside">
                    <li>Chỉ dùng kiến thức có trong bài học đã nhập.</li>
                    <li>Không tự suy đoán số liệu, công thức, quy tắc.</li>
                    <li>Có bằng chứng trích dẫn nguyên văn từ SGK.</li>
                    <li>Kiểm định độc lập 2 lớp trước khi gửi giáo viên.</li>
                  </ul>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerateQuestions}
                  disabled={isGenerating || isEditingKnowledgeSet}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang Tạo & Kiểm Định 2 Lớp...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Tạo Câu Hỏi Bám Sát Nguồn</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: STEP 3 & STEP 4: Review, Verify & Approve List */}
            <div className="lg:col-span-2 space-y-4">
              {auditSummary && (
                <div className={`p-4 rounded-3xl border ${
                  auditSummary.passed
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50/90 border-amber-300 text-amber-950'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 font-black text-sm">
                      {auditSummary.passed ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>Bước 3: Kiểm Định Độc Lập Đạt Chuẩn Sư Phạm</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                          <span>Bước 3: Cần Giáo Viên Rà Soát Trước Khi Duyệt</span>
                        </>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 bg-white rounded-full text-xs font-bold shadow-xs">
                      {generatedQuestions.length} câu mới tạo
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {auditSummary.notes}
                  </p>
                </div>
              )}

              {/* List of Generated Candidate Questions */}
              {generatedQuestions.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                      Bước 4: Giáo Viên Rà Soát & Phê Duyệt ({generatedQuestions.length} câu):
                    </span>
                  </div>

                  {generatedQuestions.map((q, idx) => {
                    const isApproved = q.reviewerStatus === 'approved';
                    const isRejected = q.reviewerStatus === 'rejected';
                    const ver = q.verificationResult;

                    return (
                      <div
                        key={q.id || idx}
                        className={`bg-white rounded-3xl p-5 border transition-all space-y-4 ${
                          isApproved
                            ? 'border-emerald-400 bg-emerald-50/20 ring-1 ring-emerald-300'
                            : isRejected
                            ? 'border-rose-300 bg-rose-50/10'
                            : 'border-slate-200 shadow-xs'
                        }`}
                      >
                        {/* Header Status Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-xs text-slate-800">
                              {q.lessonTitle}
                            </span>
                            {q.pageReference && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                {q.pageReference}
                              </span>
                            )}
                          </div>

                          {/* Status Badges */}
                          <div className="flex items-center gap-2">
                            {isApproved ? (
                              <span className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đã Duyệt Vào Kho</span>
                              </span>
                            ) : isRejected ? (
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Đã Từ Chối</span>
                              </span>
                            ) : q.verificationStatus === 'passed_review' ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Đạt Kiểm Tra Tự Động</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Cần Giáo Viên Xem Lại</span>
                              </span>
                            )}

                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                              Điểm: {q.qualityScore || 100}%
                            </span>
                          </div>
                        </div>

                        {/* Question Content */}
                        <div className="text-sm font-bold text-slate-900 leading-relaxed">
                          <MathMarkdown content={q.content} />
                        </div>

                        {/* Options A, B, C, D */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = optIdx === q.correctIndex;
                            return (
                              <div
                                key={optIdx}
                                className={`p-3 rounded-2xl border text-xs flex items-start gap-2 ${
                                  isCorrect
                                    ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <div className="flex-1">
                                  <MathMarkdown content={opt} />
                                </div>
                                {isCorrect && (
                                  <span className="text-[10px] text-emerald-800 font-extrabold bg-white px-1.5 py-0.5 rounded border border-emerald-300 shrink-0">
                                    Đáp Án Đúng
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation & Source Evidence Card */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-2 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-amber-600" />
                            <span>Lời Giải Chi Tiết:</span>
                          </div>
                          <div className="text-slate-700">
                            <MathMarkdown content={q.explanation} />
                          </div>

                          {/* Source Evidence & SGK Quote */}
                          <div className="pt-2 border-t border-slate-200/70 text-[11px] space-y-1">
                            <div className="font-bold text-emerald-800 flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Bằng chứng SGK làm căn cứ ({q.textbook} - {q.pageReference || q.lessonTitle}):</span>
                            </div>
                            <blockquote className="p-2 bg-emerald-50/70 border-l-2 border-emerald-500 rounded-r-lg text-emerald-950 italic">
                              "{q.sourceEvidence || 'Được suy luận trực tiếp từ kiến thức bài học đã nhập'}"
                            </blockquote>
                          </div>
                        </div>

                        {/* 2-Layer Automated Audit Feedback */}
                        {ver && (
                          <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                            ver.passed
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                              : 'bg-amber-50/80 border-amber-300 text-amber-950'
                          }`}>
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>Kết Quả Kiểm Định Độc Lập:</span>
                              </span>
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                ver.passed ? 'bg-emerald-200/70 text-emerald-900' : 'bg-amber-200/80 text-amber-900'
                              }`}>
                                {ver.passed ? 'Đạt 100% Tiêu Chí' : `Cảnh Báo: ${ver.issueType || 'Cần xem lại'}`}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700">
                              <strong>Nhận xét:</strong> {ver.reviewNotes}
                            </p>

                            {ver.suggestedCorrection && (
                              <div className="p-2 bg-white rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                                <strong>Đề xuất chỉnh sửa của Thẩm Định Viên:</strong>
                                <p>{ver.suggestedCorrection.explanation || ver.suggestedCorrection.notes}</p>
                              </div>
                            )}

                            {/* Checklist pills */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] pt-1">
                              <span className="flex items-center gap-1">
                                {ver.inScope ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-rose-500" />}
                                <span>Trong nguồn SGK</span>
                              </span>
                              <span className="flex items-center gap-1">
                                {ver.answerConsistent ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-rose-500" />}
                                <span>Đáp án nhất quán</span>
                              </span>
                              <span className="flex items-center gap-1">
                                {ver.evidenceSufficient ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-rose-500" />}
                                <span>Bằng chứng đầy đủ</span>
                              </span>
                              <span className="flex items-center gap-1">
                                {ver.singleCorrectOption ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-rose-500" />}
                                <span>Duy nhất 1 đáp án</span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons for Teacher */}
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleOpenEditModal(q)}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                            <span>Chỉnh Sửa Câu Này</span>
                          </button>

                          {!isRejected && (
                            <button
                              onClick={() => handleRejectQuestion(q)}
                              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer border border-rose-200 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Từ Chối</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleApproveAndSave(q)}
                            disabled={isApproved}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all ${
                              isApproved
                                ? 'bg-emerald-600 text-white cursor-default'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isApproved ? 'Đã Lưu Vào Kho Chính Thức' : 'Duyệt & Lưu Vào Kho Chính Thức'}</span>
                          </button>
                        </div>
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
                    Sẵn Sàng Tạo Câu Hỏi Chuẩn Sách Giáo Khoa
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Chọn bài học ở Bước 1 và nhấn <strong>"Tạo Câu Hỏi Bám Sát Nguồn"</strong>. Hệ thống sẽ tạo câu hỏi chỉ từ phần kiến thức đã nhập và tự động chạy bước kiểm định độc lập.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KHO CÂU HỎI CHÍNH THỨC ĐÃ DUYỆT */}
      {activeTab === 'approved_bank' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 mb-1">
                <Database className="w-3.5 h-3.5 text-emerald-700" />
                <span>Ngân Hàng Câu Hỏi Chuẩn Hóa SGK Đã Kiểm Duyệt</span>
              </div>
              <h2 className="text-xl font-black text-slate-800">
                Kho Câu Hỏi Chính Thức ({approvedQuestions.length} câu đã được giáo viên phê duyệt)
              </h2>
              <p className="text-xs text-slate-500">
                Chỉ những câu hỏi được giáo viên xác nhận đúng với SGK mới được lưu vào kho này và tham gia vào luồng thi đấu / luyện tập.
              </p>
            </div>

            {filteredApprovedList.length > 0 && (
              <button
                onClick={() => handleStartPracticeWithApproved(filteredApprovedList)}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer transition-transform active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Luyện Tập Ngay Với Bộ Câu Đã Duyệt ({filteredApprovedList.length})</span>
              </button>
            )}
          </div>

          {/* Filters for Approved Bank */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-emerald-600" />
              Lọc Kho Câu Hỏi:
            </span>

            {/* Subject filter */}
            <select
              value={approvedFilterSubject}
              onChange={(e) => setApprovedFilterSubject(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="all">Tất cả môn học</option>
              {SUBJECTS.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Grade filter */}
            <select
              value={approvedFilterGrade}
              onChange={(e) => setApprovedFilterGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="all">Tất cả khối lớp</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
                <option key={g} value={g}>Lớp {g}</option>
              ))}
            </select>

            {/* Search lesson title */}
            <input
              type="text"
              value={approvedSearchLesson}
              onChange={(e) => setApprovedSearchLesson(e.target.value)}
              placeholder="Tìm theo tên bài học hoặc từ khóa..."
              className="flex-1 min-w-[200px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
            />
          </div>

          {/* List of Approved Questions */}
          {filteredApprovedList.length > 0 ? (
            <div className="space-y-4">
              {filteredApprovedList.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-5 bg-white rounded-3xl border border-emerald-200/90 shadow-xs space-y-3 relative hover:border-emerald-400 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-extrabold text-xs text-slate-800">
                        {q.lessonTitle}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        Lớp {q.grade} • {q.subject.toUpperCase()}
                      </span>
                      {q.pageReference && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {q.pageReference}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Duyệt bởi: <strong>{q.reviewedBy || 'Giáo viên'}</strong> ({q.reviewedAt ? new Date(q.reviewedAt).toLocaleDateString('vi-VN') : 'Gần đây'})
                      </span>
                      <button
                        onClick={() => handleDeleteApprovedQuestion(q.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Xóa khỏi kho chính thức"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-sm font-bold text-slate-800">
                    <MathMarkdown content={q.content} />
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correctIndex;
                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1"><MathMarkdown content={opt} /></span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Evidence quote */}
                  {q.sourceEvidence && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700">
                      <span className="font-bold text-emerald-800">Căn cứ SGK: </span>
                      <span>"{q.sourceEvidence}"</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center space-y-3 text-slate-500">
              <Database className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="font-extrabold text-sm text-slate-800">
                Chưa Có Câu Hỏi Nào Trong Kho Chính Thức Thỏa Mãn Bộ Lọc
              </h4>
              <p className="text-xs">
                Hãy chuyển sang tab "Tạo Câu Hỏi Theo Kiến Thức SGK" để tạo câu hỏi và phê duyệt.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STUDENT DISPUTE REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
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

      {/* EDIT QUESTION MODAL (Step 4: Teacher fine-tunes & re-verifies) */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-600" />
                  <span>Chỉnh Sửa Câu Hỏi & Kiểm Định Lại</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sau khi sửa, hệ thống sẽ tự động chạy lại kiểm tra độc lập 2 lớp trước khi cho phép duyệt.
                </p>
              </div>
              <button
                onClick={() => setEditingQuestion(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Question Content */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nội dung câu hỏi:
              </label>
              <textarea
                rows={3}
                value={editingQuestion.content}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, content: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* 4 Options and correct choice */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                4 Phương án lựa chọn (Bấm nút tròn để chọn đáp án đúng):
              </label>
              <div className="space-y-2">
                {editingQuestion.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingQuestion({ ...editingQuestion, correctIndex: i })}
                      className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center cursor-pointer transition-all ${
                        editingQuestion.correctIndex === i
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                      title="Chọn làm đáp án đúng"
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[i] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: newOpts });
                      }}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                    />
                    {editingQuestion.correctIndex === i && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                        Đáp án đúng
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Explanation */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lời giải thích chi tiết:
              </label>
              <textarea
                rows={2}
                value={editingQuestion.explanation}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
              />
            </div>

            {/* Evidence quote */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bằng chứng trích dẫn từ SGK:
              </label>
              <input
                type="text"
                value={editingQuestion.sourceEvidence || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, sourceEvidence: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
              />
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isReVerifying}
                onClick={handleSaveAndReVerify}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isReVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang Thẩm Định Lại...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Lưu & Chạy Lại Kiểm Tra Tự Động</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
