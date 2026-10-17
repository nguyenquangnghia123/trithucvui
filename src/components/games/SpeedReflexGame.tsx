import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GradeLevel, SubjectId, Question, QuizResult } from '../../types';
import { getQuestionsForGame } from '../../data/questions';
import { soundManager } from '../../services/sound';
import { StorageService } from '../../services/storage';
import { ExitGameModal } from '../ExitGameModal';
import { 
  Zap, 
  Heart, 
  Clock, 
  Flame, 
  Coins, 
  Lightbulb, 
  ArrowRight, 
  RotateCcw,
  CheckCircle2,
  XCircle,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SpeedReflexGameProps {
  grade: GradeLevel;
  subject: SubjectId;
  level: number;
  user: UserProfile;
  customQuestions?: Question[];
  onFinishGame: (result: QuizResult) => void;
  onBack: () => void;
  onOpenHeartRecovery?: () => void;
}

const QUESTION_TIME_LIMIT = 10; // 10 seconds per question

export const SpeedReflexGame: React.FC<SpeedReflexGameProps> = ({
  grade,
  subject,
  level,
  user,
  customQuestions,
  onFinishGame,
  onBack,
  onOpenHeartRecovery,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hearts, setHearts] = useState(user.hearts > 0 ? user.hearts : 5);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [showHintText, setShowHintText] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [showExitModal, setShowExitModal] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (customQuestions && customQuestions.length > 0) {
      setQuestions(customQuestions);
    } else {
      const list = getQuestionsForGame(grade, subject, level, 6, user.questionHistory || []);
      setQuestions(list);
    }
  }, [grade, subject, level, customQuestions]);

  const currentQ = questions[currentIndex];

  // Question countdown timer
  useEffect(() => {
    if (!currentQ || isSubmitted) return;

    setTimeLeft(QUESTION_TIME_LIMIT);
    startTimeRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, currentQ, isSubmitted]);

  const handleTimeOut = () => {
    if (isSubmitted || !currentQ) return;
    setIsSubmitted(true);
    soundManager.playIncorrect();

    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    StorageService.recordAnswer(currentQ.id, false, subject, currentQ.topic, currentQ.difficulty, timeSpent);

    setWrongCount((prev) => prev + 1);
    setStreak(0);
    setHearts((prev) => {
      const nextH = Math.max(0, prev - 1);
      StorageService.updateHearts(nextH);
      return nextH;
    });
  };

  const handleSelectOption = (idx: number) => {
    if (isSubmitted || eliminatedOptions.includes(idx) || !currentQ) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(idx);
    setIsSubmitted(true);

    const isCorrect = idx === currentQ.correctIndex;
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    StorageService.recordAnswer(currentQ.id, isCorrect, subject, currentQ.topic, currentQ.difficulty, timeSpent);

    if (isCorrect) {
      soundManager.playCorrect();
      // Speed bonus: faster answer yields more bonus points
      const speedMultiplier = timeLeft >= 7 ? 2.0 : timeLeft >= 4 ? 1.5 : 1.0;
      const speedBonusCoins = Math.round(15 * speedMultiplier);
      const speedBonusXp = Math.round(25 * speedMultiplier);

      setEarnedCoins((prev) => prev + speedBonusCoins);
      setEarnedXp((prev) => prev + speedBonusXp);
      setCorrectCount((prev) => prev + 1);

      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);

      if (newStreak >= 3) {
        soundManager.playLevelUp();
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
      }
    } else {
      soundManager.playIncorrect();
      setWrongCount((prev) => prev + 1);
      setStreak(0);
      setHearts((prev) => {
        const nextH = Math.max(0, prev - 1);
        StorageService.updateHearts(nextH);
        return nextH;
      });
    }
  };

  const handleNext = () => {
    if (hearts <= 0) {
      finishGame();
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
      setEliminatedOptions([]);
      setShowHintText(false);
    } else {
      finishGame();
    }
  };

  const finishGame = () => {
    // Add rewards to profile
    StorageService.addXpAndCoins(earnedXp, earnedCoins, 'speed_reflex_game');
    const updatedUser = StorageService.getUserProfile();

    onFinishGame({
      gameMode: 'phan_xa',
      subject,
      level,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      xpEarned: earnedXp,
      coinsEarned: earnedCoins,
      remainingHearts: hearts,
      newAchievements: [],
      leveledUp: (updatedUser?.level || 1) > user.level,
      newLevel: updatedUser?.level || user.level,
    });
  };

  const handleUseHint = () => {
    if (showHintText || isSubmitted || !currentQ) return;
    if (user.coins >= 30) {
      StorageService.addCoins(-30);
      soundManager.playCoin();
      setShowHintText(true);
      const wrongIndices = [0, 1, 2, 3].filter((idx) => idx !== currentQ.correctIndex);
      setEliminatedOptions(wrongIndices.slice(0, 2));
    } else {
      soundManager.playIncorrect();
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center justify-between gap-4">
        <button
          onClick={() => setShowExitModal(true)}
          className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-lg">
            ⚡
          </div>
          <div>
            <h2 className="font-extrabold text-sm sm:text-base text-slate-800">
              Phản Xạ Tri Thức
            </h2>
            <p className="text-[11px] text-slate-500">
              Câu {currentIndex + 1} / {questions.length || 6}
            </p>
          </div>
        </div>

        {/* Hearts & Streak */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-rose-50 px-2.5 py-1.5 rounded-2xl border border-rose-100">
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            <span className="font-black text-xs text-rose-600">{hearts}</span>
          </div>

          <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1.5 rounded-2xl border border-amber-100">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="font-black text-xs text-amber-600">{streak}x</span>
          </div>
        </div>
      </div>

      {/* Speed Timer Countdown Bar */}
      <div className="bg-slate-200/70 h-3 rounded-full overflow-hidden relative shadow-inner">
        <div 
          className={`h-full transition-all duration-1000 ease-linear rounded-full ${
            timeLeft > 5 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
            timeLeft > 2 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
            'bg-gradient-to-r from-rose-500 to-red-600 animate-pulse'
          }`}
          style={{ width: `${(timeLeft / QUESTION_TIME_LIMIT) * 100}%` }}
        />
      </div>

      {/* Main Question Card */}
      {currentQ ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
          {/* Header Info */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-bold">
              {currentQ.topic}
            </span>
            <div className="flex items-center gap-1 font-bold text-amber-600">
              <Clock className="w-4 h-4" />
              <span>{timeLeft}s còn lại</span>
            </div>
          </div>

          {/* Question Content */}
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 leading-relaxed">
            {currentQ.content}
          </h3>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrectAnswer = isSubmitted && idx === currentQ.correctIndex;
              const isWrongSelected = isSubmitted && isSelected && !isCorrectAnswer;
              const isEliminated = eliminatedOptions.includes(idx);

              let cardStyle = 'border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 text-slate-700';
              if (isSelected && !isSubmitted) {
                cardStyle = 'border-indigo-600 bg-indigo-50/50 text-indigo-900';
              }
              if (isCorrectAnswer) {
                cardStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
              }
              if (isWrongSelected) {
                cardStyle = 'border-rose-500 bg-rose-50 text-rose-900 line-through';
              }
              if (isEliminated) {
                cardStyle = 'opacity-30 border-slate-200 bg-slate-50 cursor-not-allowed';
              }

              return (
                <button
                  key={idx}
                  disabled={isSubmitted || isEliminated}
                  onClick={() => handleSelectOption(idx)}
                  className={`p-4 rounded-2xl border-2 text-left font-semibold text-sm transition-all flex items-center justify-between cursor-pointer ${cardStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </div>
                  {isCorrectAnswer && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {isWrongSelected && <XCircle className="w-5 h-5 text-rose-500" />}
                </button>
              );
            })}
          </div>

          {/* Explanation if submitted */}
          {isSubmitted && (
            <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200 text-xs text-blue-900 space-y-1">
              <span className="font-bold text-blue-800">💡 Giải thích chi tiết:</span>
              <p>{currentQ.explanation}</p>
            </div>
          )}

          {/* Bottom Bar: Hint & Next Button */}
          <div className="flex items-center justify-between pt-2">
            {!isSubmitted ? (
              <button
                onClick={handleUseHint}
                disabled={showHintText || user.coins < 30}
                className={`py-2 px-4 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  showHintText || user.coins < 30 
                    ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer'
                }`}
              >
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>Trợ giúp 50/50 (-30 xu)</span>
              </button>
            ) : <div />}

            {isSubmitted && (
              <button
                onClick={handleNext}
                className="py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-black text-sm shadow-md shadow-orange-200 flex items-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
              >
                <span>{currentIndex < questions.length - 1 ? 'Câu Tiếp Theo' : 'Hoàn Thành Màn Chơi'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
          <p className="text-slate-500 font-medium">Đang tải câu hỏi phản xạ...</p>
        </div>
      )}

      {/* Exit Modal */}
      <ExitGameModal
        isOpen={showExitModal}
        gameTitle="Phản Xạ Tri Thức"
        onStay={() => setShowExitModal(false)}
        onConfirmExit={() => {
          setShowExitModal(false);
          onBack();
        }}
      />
    </div>
  );
};
