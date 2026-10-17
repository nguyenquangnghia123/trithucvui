import React, { useState, useMemo } from 'react';
import { UserProfile, Question, SkillProficiency } from '../types';
import { getPlacementQuestions } from '../data/questions';
import { SUBJECTS } from '../data/subjects';
import { soundManager } from '../services/sound';
import { StorageService } from '../services/storage';
import confetti from 'canvas-confetti';
import { 
  Sparkles, 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight, 
  Award, 
  Target, 
  BookOpen,
  Compass,
  Zap
} from 'lucide-react';

interface PlacementTestModalProps {
  user: UserProfile;
  onComplete: (updatedUser: UserProfile) => void;
  onClose?: () => void;
}

export const PlacementTestModal: React.FC<PlacementTestModalProps> = ({
  user,
  onComplete,
  onClose,
}) => {
  const questions = useMemo(() => getPlacementQuestions(user.grade), [user.grade]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [subjectScores, setSubjectScores] = useState<Record<string, boolean>>({});
  const [showResult, setShowResult] = useState(false);

  const currentQ = questions[currentIndex];
  const subjectMeta = SUBJECTS.find((s) => s.id === currentQ?.subject);

  const handleSelectOption = (idx: number) => {
    if (isAnswerSubmitted) return;
    setSelectedAnswer(idx);
  };

  const handleConfirmAnswer = () => {
    if (selectedAnswer === null || isAnswerSubmitted) return;
    setIsAnswerSubmitted(true);

    const isCorrect = selectedAnswer === currentQ.correctIndex;
    if (isCorrect) {
      soundManager.playCorrect();
      setCorrectCount((prev) => prev + 1);
    } else {
      soundManager.playIncorrect();
    }

    setSubjectScores((prev) => ({
      ...prev,
      [currentQ.subject]: isCorrect,
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsAnswerSubmitted(false);
    } else {
      // Completed all questions!
      soundManager.playVictory();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      setShowResult(true);
    }
  };

  // Evaluate proficiency level positively
  const calculateResultData = () => {
    const total = questions.length || 5;
    const ratio = correctCount / total;

    // Strict evaluation according to guidelines:
    // 0–2 câu đúng → Chưa đạt
    // 3–4 → Trung bình
    // 5–6 → Khá
    // 7–8 → Giỏi
    // 9–10 → Xuất sắc
    let proficiency = 'Trung bình';
    let recLevel = 2;

    if (correctCount >= 9) {
      proficiency = 'Xuất sắc';
      recLevel = 6;
    } else if (correctCount >= 7) {
      proficiency = 'Giỏi';
      recLevel = 5;
    } else if (correctCount >= 5) {
      proficiency = 'Khá';
      recLevel = 4;
    } else if (correctCount >= 3) {
      proficiency = 'Trung bình';
      recLevel = 3;
    } else {
      proficiency = 'Chưa đạt';
      recLevel = 1;
    }

    const practiceTopics: string[] = [];
    const strongTopics: string[] = [];

    questions.forEach((q) => {
      const correct = subjectScores[q.subject];
      const subjName = SUBJECTS.find((s) => s.id === q.subject)?.name || q.topic;
      if (correct) {
        strongTopics.push(`${subjName} (${q.topic})`);
      } else {
        practiceTopics.push(`${subjName} (${q.topic})`);
      }
    });

    return {
      proficiency,
      recommendedLevel: recLevel,
      practiceTopics: practiceTopics.length > 0 ? practiceTopics : ['Rèn luyện thêm bài tập nâng cao'],
      strongTopics: strongTopics.length > 0 ? strongTopics : ['Sẵn sàng bứt phá các thử thách mới'],
    };
  };

  const handleFinishAndSave = () => {
    const evalData = calculateResultData();
    const updatedUser: UserProfile = {
      ...user,
      hasTakenPlacementTest: true,
      initialRecommendedLevel: evalData.recommendedLevel,
      xp: user.xp + 150,
      coins: user.coins + 100,
      recommendedFocus: {
        shouldPractice: evalData.practiceTopics,
        strongAt: evalData.strongTopics,
      },
    };

    // Update proficiency in subject stats
    questions.forEach((q) => {
      const isCorrect = subjectScores[q.subject] ?? false;
      const cur = updatedUser.subjectStats[q.subject] || {
        answeredCount: 0,
        correctCount: 0,
        proficiency: 'Cơ bản',
      };
      updatedUser.subjectStats[q.subject] = {
        answeredCount: cur.answeredCount + 1,
        correctCount: cur.correctCount + (isCorrect ? 1 : 0),
        proficiency: isCorrect ? 'Tốt' : 'Khá',
      };
    });

    StorageService.saveUserProfile(updatedUser);
    onComplete(updatedUser);
  };

  const resultData = calculateResultData();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden relative">
        
        {/* Header bar */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/15 text-xl">🎯</span>
              <div>
                <h3 className="font-extrabold text-lg sm:text-xl leading-tight">
                  KIỂM TRA TRÌNH ĐỘ
                </h3>
                <p className="text-blue-100 text-xs">
                  Phù hợp chương trình Lớp {user.grade} • Khảo sát năng lực ban đầu
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!showResult && (
                <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">
                  Câu {currentIndex + 1}/{questions.length}
                </span>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                  title="Để sau"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {!showResult && (
            <div className="w-full bg-white/20 h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-amber-300 h-full transition-all duration-300 rounded-full"
                style={{ width: `${((currentIndex + (isAnswerSubmitted ? 1 : 0.5)) / questions.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Content area: Active Quiz or Result Screen */}
        {!showResult ? (
          <div className="p-6 sm:p-7 space-y-5">
            {/* Subject badge */}
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${subjectMeta?.bgLight || 'bg-blue-50 text-blue-700'}`}>
                <span>{subjectMeta?.icon || '📚'}</span>
                <span>{subjectMeta?.name}</span>
                <span className="text-slate-400">•</span>
                <span className="font-medium text-slate-600">{currentQ?.topic}</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Độ khó: {currentQ?.difficulty}/6
              </span>
            </div>

            {/* Question Text */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <p className="text-base sm:text-lg font-bold text-slate-800 leading-relaxed">
                {currentQ?.content}
              </p>
            </div>

            {/* Answer Options */}
            <div className="space-y-2.5">
              {currentQ?.options.map((opt, idx) => {
                const isSelected = selectedAnswer === idx;
                const isCorrect = idx === currentQ.correctIndex;
                let btnStyle = 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/50';

                if (isSelected && !isAnswerSubmitted) {
                  btnStyle = 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400/40';
                } else if (isAnswerSubmitted) {
                  if (isCorrect) {
                    btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold';
                  } else if (isSelected && !isCorrect) {
                    btnStyle = 'bg-rose-50 border-rose-400 text-rose-800';
                  } else {
                    btnStyle = 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(idx)}
                    disabled={isAnswerSubmitted}
                    className={`w-full p-3.5 rounded-2xl border-2 text-left font-semibold text-sm transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt}</span>
                    </div>
                    {isAnswerSubmitted && isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation card after submit */}
            {isAnswerSubmitted && (
              <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200 text-xs text-blue-900 space-y-1 animate-in fade-in">
                <span className="font-bold flex items-center gap-1 text-blue-700">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Giải thích dễ hiểu:
                </span>
                <p>{currentQ?.explanation}</p>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 flex justify-end">
              {!isAnswerSubmitted ? (
                <button
                  onClick={handleConfirmAnswer}
                  disabled={selectedAnswer === null}
                  id="btn-confirm-test-answer"
                  className={`py-3 px-6 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all ${
                    selectedAnswer !== null
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-200 cursor-pointer hover:scale-[1.02]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Xác Nhận Đáp Án
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  id="btn-next-test-question"
                  className="py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-teal-200 flex items-center gap-2 cursor-pointer hover:scale-[1.02] transition-all"
                >
                  {currentIndex < questions.length - 1 ? (
                    <>
                      Câu Tiếp Theo <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Xem Kết Quả Đánh Giá <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* RESULT SCREEN - POSITIVE & MOTIVATING */
          <div className="p-6 sm:p-8 space-y-6 text-center animate-in zoom-in-95">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-3xl text-3xl shadow-lg shadow-orange-200">
              🌟
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-800">
                Chúc Mừng {user.fullName}!
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Bạn đã hoàn thành xuất sắc bài khảo sát trình độ Lớp {user.grade}.
              </p>
            </div>

            {/* Score, Correct, Wrong, Capability, and Level */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 text-left">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Điểm kiểm tra</span>
                <div className="text-xl font-black text-indigo-900">
                  {Math.round((correctCount / Math.max(1, questions.length)) * 100)}/100
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] text-emerald-600 font-bold uppercase">Số câu đúng</span>
                <div className="text-xl font-black text-emerald-600">
                  {correctCount} câu
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] text-rose-500 font-bold uppercase">Số câu sai</span>
                <div className="text-xl font-black text-rose-500">
                  {questions.length - correctCount} câu
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] text-purple-600 font-bold uppercase">Đánh giá năng lực</span>
                <div className="text-lg font-black text-purple-900">
                  {resultData.proficiency}
                </div>
              </div>
            </div>

            {/* Level Recommendation Banner */}
            <div className="p-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🎖️</span>
                <div className="text-left">
                  <div className="text-xs text-indigo-200 font-semibold">Cấp độ đề xuất ban đầu</div>
                  <div className="text-base font-black">Level {resultData.recommendedLevel}</div>
                </div>
              </div>
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold">
                Phù hợp Lớp {user.grade}
              </span>
            </div>

            {/* Recommendations section */}
            <div className="space-y-2.5 text-left text-xs">
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                <div className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Chủ đề mạnh:
                </div>
                <ul className="list-disc list-inside text-emerald-700 space-y-0.5">
                  {resultData.strongTopics.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200">
                <div className="font-bold text-amber-800 flex items-center gap-1.5 mb-1">
                  <Compass className="w-4 h-4 text-amber-600" />
                  Chủ đề cần cải thiện:
                </div>
                <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                  {resultData.practiceTopics.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Starter Gift */}
            <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-around text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1 text-amber-700">
                🪙 +100 Xu Khởi Điểm
              </span>
              <span className="flex items-center gap-1 text-indigo-700">
                ⭐ +150 XP Khởi Động
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                ❤️ 5/5 Tim Đầy Đủ
              </span>
            </div>

            <button
              onClick={handleFinishAndSave}
              id="btn-finish-placement-test"
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-2xl font-black text-base shadow-lg shadow-teal-200 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
            >
              🚀 BẮT ĐẦU HỌC
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
