import React, { useState, useEffect, useRef } from 'react';
import { Question, SubjectId, GradeLevel, UserProfile, QuizResult, Achievement } from '../../types';
import { getQuestionsForGame, markQuestionAsSeen, registerCustomQuestions } from '../../data/questions';
import { soundManager } from '../../services/sound';
import { StorageService } from '../../services/storage';
import { MathMarkdown } from '../MathMarkdown';
import { Heart, Coins, Sparkles, HelpCircle, ArrowRight, Zap, CheckCircle2, XCircle, Flame, Loader2, Scale } from 'lucide-react';
import { QuestionDisputeModal } from '../QuestionDisputeModal';

interface ArenaGameProps {
  user: UserProfile;
  subject: SubjectId;
  grade: GradeLevel;
  level: number;
  customQuestions?: Question[];
  onFinish: (result: QuizResult) => void;
  onExit: () => void;
}

export const ArenaGame: React.FC<ArenaGameProps> = ({
  user,
  subject,
  grade,
  level,
  customQuestions,
  onFinish,
  onExit,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hearts, setHearts] = useState(user.hearts > 0 ? user.hearts : 5);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreakInGame, setMaxStreakInGame] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [showHintText, setShowHintText] = useState(false);
  const [userCoins, setUserCoins] = useState(user.coins);
  const [userHints, setUserHints] = useState(user.hintsCount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const isFetchingRef = useRef(false);

  const handleResolveAppeal = (refundHeart: boolean, bonusXp: number, bonusCoins: number) => {
    if (refundHeart) {
      setHearts((prev) => Math.min(5, prev + 1));
      setCorrectCount((prev) => prev + 1);
      setWrongCount((prev) => Math.max(0, prev - 1));
    }
    if (bonusXp > 0) setEarnedXp((prev) => prev + bonusXp);
    if (bonusCoins > 0) setEarnedCoins((prev) => prev + bonusCoins);
  };

  useEffect(() => {
    if (customQuestions && customQuestions.length > 0) {
      setQuestions(customQuestions);
      customQuestions.forEach((q) => {
        if (q.id) markQuestionAsSeen(q.id);
      });
    } else {
      const list = getQuestionsForGame(grade, subject, level, 6, user.questionHistory || []);
      setQuestions(list);
      list.forEach((q) => {
        if (q.id) markQuestionAsSeen(q.id);
      });
    }
  }, [grade, subject, level, customQuestions]);

  const currentQ = questions[currentIndex];

  /**
   * Fetch a brand-new infinite question from Gemini API
   */
  const fetchNextGeminiQuestion = async (): Promise<Question | null> => {
    try {
      const seenIds = Array.from(
        new Set([
          ...questions.map((q) => q.id).filter(Boolean),
          ...(user.questionHistory || []),
        ])
      );

      const difficultyMap: Record<number, 'easy' | 'medium' | 'hard' | 'olympiad'> = {
        1: 'easy',
        2: 'easy',
        3: 'medium',
        4: 'medium',
        5: 'hard',
        6: 'hard',
        7: 'olympiad',
        8: 'olympiad',
        9: 'olympiad',
        10: 'olympiad',
      };
      const difficulty = difficultyMap[level] || 'medium';

      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          subject,
          topic: currentQ?.topic,
          count: 1,
          difficulty,
          seen_question_ids: seenIds,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const newQuestions: Question[] = data.questions;

      if (Array.isArray(newQuestions) && newQuestions.length > 0) {
        const newQ = newQuestions[0];
        registerCustomQuestions([newQ]);
        if (newQ.id) markQuestionAsSeen(newQ.id);
        return newQ;
      }
      return null;
    } catch (err) {
      console.warn('Could not generate question via Gemini API, using procedural fallback:', err);
      // Fallback if network/API fails: pull from fallback pool so user is never blocked
      const fallbackList = getQuestionsForGame(grade, subject, level, 1, questions.map((q) => q.id));
      if (fallbackList.length > 0) {
        const fallbackQ = fallbackList[0];
        if (fallbackQ.id) markQuestionAsSeen(fallbackQ.id);
        return fallbackQ;
      }
      return null;
    }
  };

  const handleUseHint = () => {
    if (showHintText || isSubmitted || !currentQ) return;

    if (userHints > 0) {
      setUserHints((prev) => prev - 1);
      soundManager.playCoin();
      triggerHintEffects();
    } else if (userCoins >= 30) {
      setUserCoins((prev) => prev - 30);
      soundManager.playCoin();
      triggerHintEffects();
    } else {
      soundManager.playIncorrect();
    }
  };

  const triggerHintEffects = () => {
    setShowHintText(true);
    // Eliminate up to 2 incorrect answers
    const wrongIndices = [0, 1, 2, 3].filter((idx) => idx !== currentQ.correctIndex);
    const shuffledWrongs = wrongIndices.sort(() => Math.random() - 0.5).slice(0, 2);
    setEliminatedOptions(shuffledWrongs);
  };

  const handleSelectOption = (idx: number) => {
    if (isSubmitted || eliminatedOptions.includes(idx)) return;
    setSelectedOption(idx);
  };

  const handleConfirmAnswer = () => {
    if (selectedOption === null || isSubmitted || !currentQ) return;
    setIsSubmitted(true);

    const isCorrect = selectedOption === currentQ.correctIndex;

    if (isCorrect) {
      soundManager.playCorrect();
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreakInGame) setMaxStreakInGame(newStreak);
      setCorrectCount((prev) => prev + 1);

      // Multiplier bonus for combos
      const streakMultiplier = newStreak >= 3 ? 1.5 : 1;
      const coinGain = Math.round(15 * level * streakMultiplier);
      const xpGain = Math.round(25 * level * streakMultiplier);

      setEarnedCoins((prev) => prev + coinGain);
      setEarnedXp((prev) => prev + xpGain);
    } else {
      soundManager.playIncorrect();
      setStreak(0);
      setWrongCount((prev) => prev + 1);
      const nextHearts = Math.max(0, hearts - 1);
      setHearts(nextHearts);
    }
  };

  const handleNextQuestion = async () => {
    // Check game over by hearts
    if (hearts <= 0) {
      finalizeGame(hearts);
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
      setShowHintText(false);
      setEliminatedOptions([]);
    } else {
      // Infinite questions mode: generate new question from Gemini dynamically
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsLoadingMore(true);

      try {
        const newQ = await fetchNextGeminiQuestion();
        if (newQ) {
          setQuestions((prev) => [...prev, newQ]);
          setCurrentIndex((prev) => prev + 1);
          setSelectedOption(null);
          setIsSubmitted(false);
          setShowHintText(false);
          setEliminatedOptions([]);
        } else {
          // If no question could be obtained even from fallback, end round gracefully
          finalizeGame(hearts);
        }
      } catch (err) {
        console.error('Error fetching next infinite question:', err);
        finalizeGame(hearts);
      } finally {
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    }
  };

  const finalizeGame = (finalHearts: number) => {
    // Calculate new achievements
    const newAchievements: Achievement[] = [];
    const unlockedIds = [...user.unlockedAchievements];

    if (!unlockedIds.includes('first_game')) {
      unlockedIds.push('first_game');
    }
    if (maxStreakInGame >= 5 && !unlockedIds.includes('streak_10')) {
      // Near streak achievement
    }
    if (wrongCount === 0 && correctCount >= 4 && !unlockedIds.includes('flawless_victory')) {
      unlockedIds.push('flawless_victory');
    }
    if (level >= 5 && correctCount >= 3 && !unlockedIds.includes('level_5_master')) {
      unlockedIds.push('level_5_master');
    }

    // Update user stats
    const updatedUser: UserProfile = {
      ...user,
      hearts: finalHearts,
      coins: userCoins + earnedCoins,
      xp: user.xp + earnedXp,
      hintsCount: userHints,
      unlockedAchievements: unlockedIds,
      totalGamesPlayed: user.totalGamesPlayed + 1,
      highestStreak: Math.max(user.highestStreak, maxStreakInGame),
    };

    const oldLevel = user.level;
    updatedUser.level = StorageService.calculateLevel(updatedUser.xp);
    const leveledUp = updatedUser.level > oldLevel;

    // Update subject stats
    const curSubject = updatedUser.subjectStats[subject] || { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' };
    updatedUser.subjectStats[subject] = {
      answeredCount: curSubject.answeredCount + (correctCount + wrongCount),
      correctCount: curSubject.correctCount + correctCount,
      proficiency: curSubject.proficiency,
    };

    StorageService.saveUserProfile(updatedUser);

    // Update missions
    if (subject === 'toan') StorageService.updateMissionProgress('math', correctCount);
    if (subject === 'tieng_anh') StorageService.updateMissionProgress('english', 1);
    if (maxStreakInGame >= 5) StorageService.updateMissionProgress('streak', maxStreakInGame);
    if (correctCount >= 4) StorageService.updateMissionProgress('level', 1);

    onFinish({
      gameMode: 'dau_truong',
      subject,
      level,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      xpEarned: earnedXp,
      coinsEarned: earnedCoins,
      remainingHearts: finalHearts,
      newAchievements,
      leveledUp,
      newLevel: updatedUser.level,
    });
  };

  if (!currentQ) {
    return (
      <div className="p-12 text-center text-slate-500">
        Đang tải câu hỏi Đấu Trường...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* Top Header Card with Hearts, Streak, Coins */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        {/* Hearts */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="text-xl">
                {i < hearts ? '❤️' : '🤍'}
              </span>
            ))}
          </div>
          <span className="text-xs font-bold text-rose-700 ml-1">
            {hearts}/5
          </span>
        </div>

        {/* Streak Combo */}
        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
          <Flame className={`w-4 h-4 text-orange-500 ${streak >= 2 ? 'fill-orange-500 animate-bounce' : ''}`} />
          <span className="text-xs font-black text-amber-900">
            Combo: x{streak}
          </span>
        </div>

        {/* Live Rewards */}
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="text-amber-700">🪙 +{earnedCoins}</span>
          <span className="text-indigo-700">⭐ +{earnedXp} XP</span>
          <button
            onClick={onExit}
            className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer ml-1"
          >
            Thoát
          </button>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-5 relative overflow-hidden">
        {/* Progress Bar & Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            Đấu Trường • Câu {currentIndex + 1} (Level {level})
          </span>
          <span className="text-xs text-slate-500 font-semibold">
            {currentQ.topic}
          </span>
        </div>

        {/* Question content */}
        <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/70">
          <div className="text-base sm:text-lg font-extrabold text-slate-800 leading-relaxed">
            <MathMarkdown content={currentQ.content} />
          </div>
        </div>

        {/* Hint Display */}
        {showHintText && (
          <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1 animate-in fade-in">
            <span className="font-bold flex items-center gap-1.5 text-amber-800">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Gợi ý tư duy (Đã loại bớt đáp án sai):
            </span>
            <div>
              <MathMarkdown content={currentQ.hint} />
            </div>
          </div>
        )}

        {/* Answer Options */}
        <div className="space-y-3">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isEliminated = eliminatedOptions.includes(idx);
            const isCorrect = idx === currentQ.correctIndex;

            let btnClasses = 'bg-white border-slate-200 text-slate-700 hover:border-amber-400 hover:bg-amber-50/40';

            if (isEliminated) {
              btnClasses = 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-40 cursor-not-allowed line-through';
            } else if (isSelected && !isSubmitted) {
              btnClasses = 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-300 font-bold';
            } else if (isSubmitted) {
              if (isCorrect) {
                btnClasses = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold';
              } else if (isSelected && !isCorrect) {
                btnClasses = 'bg-rose-50 border-rose-500 text-rose-900';
              } else {
                btnClasses = 'bg-slate-50/80 border-slate-200 text-slate-400 opacity-60';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(idx)}
                disabled={isSubmitted || isEliminated}
                className={`w-full p-4 rounded-2xl border-2 text-left text-sm font-semibold transition-all flex items-center justify-between cursor-pointer ${btnClasses}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">
                    <MathMarkdown content={opt} />
                  </span>
                </div>
                {isSubmitted && isCorrect && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                {isSubmitted && isSelected && !isCorrect && (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation upon answer */}
        {isSubmitted && (
          <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 text-xs text-blue-900 space-y-1 animate-in fade-in">
            <span className="font-bold flex items-center gap-1.5 text-blue-800">
              <HelpCircle className="w-3.5 h-3.5" />
              Giải thích cặn kẽ:
            </span>
            <div>
              <MathMarkdown content={currentQ.explanation} />
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          {/* Hint Trigger or Dispute Button */}
          {!isSubmitted ? (
            <button
              onClick={handleUseHint}
              disabled={showHintText}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                showHintText
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 shadow-2xs'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              {showHintText ? (
                'Đã mở gợi ý'
              ) : userHints > 0 ? (
                `Dùng Gợi Ý (${userHints} thẻ còn)`
              ) : (
                'Dùng Gợi Ý (30 Xu)'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDisputeModal(true)}
              className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1.5 font-bold cursor-pointer bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors shadow-2xs"
              title="Phúc khảo kết quả nếu cho rằng đáp án có nhầm lẫn"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Khiếu nại / Phúc khảo câu này</span>
            </button>
          )}

          <div className="ml-auto">
            {!isSubmitted ? (
              <button
                onClick={handleConfirmAnswer}
                disabled={selectedOption === null}
                id="btn-arena-confirm"
                className={`py-3 px-6 rounded-2xl font-bold text-sm transition-all ${
                  selectedOption !== null
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-200 cursor-pointer hover:scale-105'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Trả Lời
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                disabled={isLoadingMore}
                id="btn-arena-next"
                className={`py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-sm shadow-md shadow-teal-200 flex items-center gap-2 transition-all ${
                  isLoadingMore ? 'opacity-80 cursor-wait' : 'cursor-pointer hover:scale-105'
                }`}
              >
                {hearts <= 0 ? (
                  'Xem Tổng Kết (Hết Tim)'
                ) : isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gemini Đang Tạo Câu Mới...
                  </>
                ) : (
                  <>
                    Câu Tiếp Theo <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {showDisputeModal && currentQ && (
        <QuestionDisputeModal
          isOpen={showDisputeModal}
          onClose={() => setShowDisputeModal(false)}
          question={currentQ}
          user={user}
          selectedOptionIndex={selectedOption}
          onResolveAppeal={handleResolveAppeal}
        />
      )}
    </div>
  );
};
