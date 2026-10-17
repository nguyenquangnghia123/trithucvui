import React, { useState, useMemo } from 'react';
import { UserProfile, Question, SubjectId, GradeLevel } from '../types';
import { ALL_QUESTIONS } from '../data/questions';
import { SUBJECTS } from '../data/subjects';
import { StorageService } from '../services/storage';
import { soundManager } from '../services/sound';
import {
  Search,
  Filter,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Sparkles,
  RotateCcw,
  Star,
  Gamepad2,
  HelpCircle,
  ArrowUpDown,
  Tag,
  GraduationCap,
  Eye,
  EyeOff,
  Check,
  X,
  Bot
} from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';

interface QuestionSearchViewProps {
  user: UserProfile;
  onNavigate: (tab: string, extra?: unknown) => void;
  onUserUpdate?: (updated: UserProfile) => void;
  initialQuery?: string;
  initialSubject?: SubjectId | 'all';
}

export const QuestionSearchView: React.FC<QuestionSearchViewProps> = ({
  user,
  onNavigate,
  onUserUpdate,
  initialQuery = '',
  initialSubject = 'all',
}) => {
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedSubject, setSelectedSubject] = useState<SubjectId | 'all'>(initialSubject);
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | 'all' | 'my_grade'>('my_grade');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | 'all'>('all');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() =>
    StorageService.getBookmarkedQuestions()
  );

  // Practice state for each question { [qId]: { selectedIndex: number, isSubmitted: boolean } }
  const [userAnswers, setUserAnswers] = useState<
    Record<string, { selectedIndex: number; isSubmitted: boolean }>
  >({});

  // Revealed hints or solutions { [qId]: boolean }
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});

  // Popular search tags for quick suggestions
  const POPULAR_TAGS = [
    'Phân số',
    'Hình học',
    'Số thập phân',
    'Từ vựng',
    'Present Continuous',
    'Python',
    'Thuật toán',
    'Quang hợp',
    'Văn học',
    'Bảng cửu chương'
  ];

  const handleToggleBookmark = (qId: string) => {
    const isNow = StorageService.toggleBookmarkQuestion(qId);
    setBookmarkedIds(StorageService.getBookmarkedQuestions());
    if (isNow) {
      soundManager.playCoin();
    }
  };

  const handleSelectOption = (qId: string, optionIndex: number) => {
    const current = userAnswers[qId];
    if (current && current.isSubmitted) return; // already submitted

    setUserAnswers((prev) => ({
      ...prev,
      [qId]: { selectedIndex: optionIndex, isSubmitted: false },
    }));
  };

  const handleCheckAnswer = (q: Question) => {
    const current = userAnswers[q.id];
    if (!current || current.selectedIndex === undefined) return;

    const isCorrect = current.selectedIndex === q.correctIndex;
    setUserAnswers((prev) => ({
      ...prev,
      [q.id]: { selectedIndex: current.selectedIndex, isSubmitted: true },
    }));

    if (isCorrect) {
      soundManager.playCorrect();
      // Award minor revision XP
      if (onUserUpdate) {
        const updated = {
          ...user,
          xp: user.xp + 5,
          coins: user.coins + 2,
        };
        StorageService.saveUserProfile(updated);
        onUserUpdate(updated);
      }
    } else {
      soundManager.playIncorrect();
    }
  };

  const handleResetAnswer = (qId: string) => {
    setUserAnswers((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  const toggleHint = (qId: string) => {
    setRevealedHints((prev) => ({ ...prev, [qId]: !prev[qId] }));
    soundManager.playClick();
  };

  const toggleSolution = (qId: string) => {
    setRevealedSolutions((prev) => ({ ...prev, [qId]: !prev[qId] }));
    soundManager.playClick();
  };

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return ALL_QUESTIONS.filter((q) => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const inContent = q.content.toLowerCase().includes(term);
        const inTopic = q.topic.toLowerCase().includes(term);
        const inOptions = q.options.some((opt) => opt.toLowerCase().includes(term));
        const inExplanation = q.explanation?.toLowerCase().includes(term);
        const inHint = q.hint?.toLowerCase().includes(term);
        if (!inContent && !inTopic && !inOptions && !inExplanation && !inHint) {
          return false;
        }
      }

      // Subject filter
      if (selectedSubject !== 'all' && q.subject !== selectedSubject) {
        return false;
      }

      // Grade filter
      if (selectedGrade === 'my_grade') {
        if (q.grade !== user.grade) return false;
      } else if (selectedGrade !== 'all') {
        if (q.grade !== selectedGrade) return false;
      }

      // Difficulty filter
      if (selectedDifficulty !== 'all') {
        if (q.difficulty !== selectedDifficulty) return false;
      }

      // Bookmarked filter
      if (onlyBookmarked && !bookmarkedIds.includes(q.id)) {
        return false;
      }

      return true;
    });
  }, [
    searchTerm,
    selectedSubject,
    selectedGrade,
    selectedDifficulty,
    onlyBookmarked,
    bookmarkedIds,
    user.grade,
  ]);

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedSubject('all');
    setSelectedGrade('all');
    setSelectedDifficulty('all');
    setOnlyBookmarked(false);
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedSubject !== 'all' ||
    selectedGrade !== 'all' ||
    selectedDifficulty !== 'all' ||
    onlyBookmarked;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10 text-9xl select-none pointer-events-none">
          🔍
        </div>
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-bold text-blue-100 mb-1 border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Ngân Hàng Câu Hỏi Thông Minh
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Tìm Kiếm & Ôn Tập Câu Hỏi
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Tra cứu nhanh hàng trăm câu hỏi theo từ khóa, khối lớp 1 - 12, môn học và chủ đề. Bạn có thể tự kiểm tra câu trả lời trực tiếp hoặc lưu lại để ôn thi!
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="bg-white/20 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              📚 {ALL_QUESTIONS.length} câu hỏi hệ thống
            </span>
            <span className="bg-white/20 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              ⭐ {bookmarkedIds.length} câu đã đánh dấu ôn tập
            </span>
            <span className="bg-amber-400 text-slate-900 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              ✨ +5 XP mỗi câu làm thử chính xác
            </span>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS CONTAINER */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        {/* Main Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="input-search-questions"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nhập nội dung câu hỏi, chủ đề, công thức, từ vựng hoặc khái niệm cần tìm..."
            className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Tag Suggestions */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Tag className="w-3.5 h-3.5" /> Gợi ý tìm nhanh:
          </span>
          {POPULAR_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setSearchTerm(tag)}
              className={`px-2.5 py-1 rounded-lg border text-xs transition-colors cursor-pointer ${
                searchTerm.toLowerCase() === tag.toLowerCase()
                  ? 'bg-blue-600 text-white border-blue-600 font-bold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Subject Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Môn Học
            </label>
            <select
              id="filter-subject"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value as SubjectId | 'all')}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả môn học (5 môn)</option>
              {SUBJECTS.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.icon} {subj.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Khối Lớp
            </label>
            <select
              id="filter-grade"
              value={selectedGrade}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') setSelectedGrade('all');
                else if (val === 'my_grade') setSelectedGrade('my_grade');
                else setSelectedGrade(Number(val) as GradeLevel);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="my_grade">Lớp của em (Lớp {user.grade})</option>
              <option value="all">Tất cả khối lớp (Lớp 1 - 12)</option>
              <optgroup label="Tiểu học">
                <option value="1">Lớp 1</option>
                <option value="2">Lớp 2</option>
                <option value="3">Lớp 3</option>
                <option value="4">Lớp 4</option>
                <option value="5">Lớp 5</option>
              </optgroup>
              <optgroup label="Trung học cơ sở (THCS)">
                <option value="6">Lớp 6</option>
                <option value="7">Lớp 7</option>
                <option value="8">Lớp 8</option>
                <option value="9">Lớp 9</option>
              </optgroup>
              <optgroup label="Trung học phổ thông (THPT)">
                <option value="10">Lớp 10</option>
                <option value="11">Lớp 11</option>
                <option value="12">Lớp 12</option>
              </optgroup>
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Độ Khó
            </label>
            <select
              id="filter-difficulty"
              value={selectedDifficulty}
              onChange={(e) =>
                setSelectedDifficulty(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả cấp độ</option>
              <option value="1">⭐ Cấp 1 - Nhận biết / Cơ bản</option>
              <option value="2">⭐⭐ Cấp 2 - Thông hiểu</option>
              <option value="3">⭐⭐⭐ Cấp 3 - Vận dụng vừa</option>
              <option value="4">⭐⭐⭐⭐ Cấp 4 - Vận dụng cao</option>
              <option value="5">⭐⭐⭐⭐⭐ Cấp 5 - Thử thách chuyên sâu</option>
            </select>
          </div>

          {/* Bookmark Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Trạng Thái Lưu
            </label>
            <button
              onClick={() => setOnlyBookmarked(!onlyBookmarked)}
              id="btn-filter-bookmark"
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border cursor-pointer ${
                onlyBookmarked
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${onlyBookmarked ? 'fill-white' : ''}`} />
              {onlyBookmarked ? 'Đang lọc: Đã Lưu' : 'Chỉ xem câu đã lưu'}
            </button>
          </div>
        </div>
      </div>

      {/* RESULTS HEADER & COUNTER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-extrabold text-slate-800">
            Kết Quả Tìm Kiếm
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
            {filteredQuestions.length} câu hỏi
          </span>
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetAllFilters}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Đặt lại tất cả bộ lọc
          </button>
        )}
      </div>

      {/* QUESTIONS LIST */}
      {filteredQuestions.length > 0 ? (
        <div className="space-y-4">
          {filteredQuestions.map((q, index) => {
            const subjectMeta = SUBJECTS.find((s) => s.id === q.subject);
            const isBookmarked = bookmarkedIds.includes(q.id);
            const userAns = userAnswers[q.id];
            const isSubmitted = userAns?.isSubmitted;
            const isCorrect = isSubmitted && userAns.selectedIndex === q.correctIndex;
            const showHint = revealedHints[q.id];
            const showSolution = revealedSolutions[q.id];

            return (
              <div
                key={q.id}
                id={`question-card-${q.id}`}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                {/* Question Header Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Subject badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                        subjectMeta?.bgLight || 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{subjectMeta?.icon}</span>
                      <span>{subjectMeta?.name || q.subject}</span>
                    </span>

                    {/* Grade badge */}
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                      Lớp {q.grade}
                    </span>

                    {/* Topic badge */}
                    <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-semibold">
                      {q.topic}
                    </span>

                    {/* Difficulty Stars */}
                    <span
                      className="text-amber-500 text-xs flex items-center gap-0.5 font-bold"
                      title={`Độ khó: ${q.difficulty}/5`}
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={i < q.difficulty ? 'text-amber-500' : 'text-slate-200'}>
                          ★
                        </span>
                      ))}
                    </span>
                  </div>

                  {/* Bookmark Button */}
                  <button
                    onClick={() => handleToggleBookmark(q.id)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold ${
                      isBookmarked
                        ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                    title={isBookmarked ? 'Bỏ lưu câu hỏi này' : 'Lưu câu hỏi để ôn tập'}
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                    <span className="hidden sm:inline">
                      {isBookmarked ? 'Đã lưu' : 'Lưu ôn tập'}
                    </span>
                  </button>
                </div>

                {/* Question Content */}
                <div className="text-slate-900 font-bold text-base sm:text-lg leading-relaxed flex items-start gap-2">
                  <span className="text-blue-600 font-black shrink-0">#{index + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <MathMarkdown content={q.content} inline />
                  </div>
                </div>

                {/* Options List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const letters = ['A', 'B', 'C', 'D'];
                    const isSelected = userAns?.selectedIndex === optIdx;
                    const isTheCorrectOption = optIdx === q.correctIndex;

                    let btnStyle = 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-800';

                    if (isSelected && !isSubmitted) {
                      btnStyle = 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs ring-2 ring-blue-400/30';
                    }

                    if (isSubmitted) {
                      if (isTheCorrectOption) {
                        btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-400/30';
                      } else if (isSelected && !isTheCorrectOption) {
                        btnStyle = 'bg-rose-50 border-rose-400 text-rose-950 ring-2 ring-rose-300';
                      } else {
                        btnStyle = 'bg-slate-50/50 border-slate-200 text-slate-400 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        disabled={isSubmitted}
                        onClick={() => handleSelectOption(q.id, optIdx)}
                        className={`p-3 rounded-2xl border text-left text-sm flex items-center justify-between gap-3 transition-all cursor-pointer ${btnStyle}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSubmitted && isTheCorrectOption
                                ? 'bg-emerald-500 text-white'
                                : isSubmitted && isSelected && !isTheCorrectOption
                                ? 'bg-rose-500 text-white'
                                : isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-700'
                            }`}
                          >
                            {letters[optIdx]}
                          </span>
                          <div className="font-medium flex-1 min-w-0">
                            <MathMarkdown content={opt} inline />
                          </div>
                        </div>

                        {/* Status icon if submitted */}
                        {isSubmitted && isTheCorrectOption && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                        {isSubmitted && isSelected && !isTheCorrectOption && (
                          <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Submission & Action Bar */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Check answer button */}
                    {!isSubmitted ? (
                      <button
                        onClick={() => handleCheckAnswer(q)}
                        disabled={userAns?.selectedIndex === undefined}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          userAns?.selectedIndex !== undefined
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer active:scale-95'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Kiểm Tra Đáp Án
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                            isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Chính xác! (+5 XP)
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              Chưa đúng rồi!
                            </>
                          )}
                        </span>

                        <button
                          onClick={() => handleResetAnswer(q.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Làm lại
                        </button>
                      </div>
                    )}

                    {/* Hint Toggle */}
                    {q.hint && (
                      <button
                        onClick={() => toggleHint(q.id)}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        {showHint ? 'Ẩn gợi ý' : 'Gợi ý giải'}
                      </button>
                    )}

                    {/* Solution Toggle */}
                    {q.explanation && (
                      <button
                        onClick={() => toggleSolution(q.id)}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {showSolution ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-indigo-600" />
                            Ẩn lời giải
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            Xem lời giải chi tiết
                          </>
                        )}
                      </button>
                    )}

                    {/* Ask AI Tutor button */}
                    <button
                      onClick={() => {
                        onNavigate('ai-tutor', {
                          prompt: `Thầy/Cô hướng dẫn giải chi tiết từng bước giúp em câu này với ạ:\n"${q.content}"\nĐáp án đúng là: ${q.options[q.correctIndex]}`,
                          subject: q.subject,
                          question: q
                        });
                      }}
                      className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
                      title="Hỏi riêng Gia Sư AI về câu hỏi này"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Hỏi AI câu này</span>
                    </button>
                  </div>

                  {/* Play with this subject button */}
                  <button
                    onClick={() => {
                      onNavigate('games');
                    }}
                    className="text-xs text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    Chơi chế độ Đấu trường với môn này →
                  </button>
                </div>

                {/* Hint Box (if revealed) */}
                {showHint && q.hint && (
                  <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
                    <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="font-bold mr-1">Mẹo giải:</span>
                      <MathMarkdown content={q.hint} inline />
                    </div>
                  </div>
                )}

                {/* Explanation Box (if revealed or checked) */}
                {(showSolution || isSubmitted) && q.explanation && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-700 space-y-1 animate-in fade-in slide-in-from-top-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      Lời giải thích chi tiết:
                    </div>
                    <div className="leading-relaxed pl-5">
                      <MathMarkdown content={q.explanation} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-xs max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-3xl mx-auto shadow-inner">
            🔍
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-lg text-slate-800">
              Không tìm thấy câu hỏi phù hợp
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hãy thử tìm với từ khóa ngắn gọn hơn hoặc điều chỉnh bộ lọc Môn học, Khối lớp và Độ khó nhé!
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <button
              onClick={resetAllFilters}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-transform active:scale-95"
            >
              Xem Tất Cả Câu Hỏi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
