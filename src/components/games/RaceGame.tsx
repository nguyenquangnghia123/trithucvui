import React, { useState, useEffect } from 'react';
import { Question, SubjectId, GradeLevel, UserProfile, QuizResult } from '../../types';
import { getQuestionsForGame } from '../../data/questions';
import { soundManager } from '../../services/sound';
import { StorageService } from '../../services/storage';
import { Flag, Heart, Sparkles, CheckCircle2, XCircle, ArrowRight, Zap, Trophy } from 'lucide-react';

interface RaceGameProps {
  user: UserProfile;
  subject: SubjectId;
  grade: GradeLevel;
  level: number;
  customQuestions?: Question[];
  onFinish: (result: QuizResult) => void;
  onExit: () => void;
}

export const RaceGame: React.FC<RaceGameProps> = ({
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
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);

  // Race positions (0 to 100%)
  const [playerPos, setPlayerPos] = useState(5);
  const [rival1Pos, setRival1Pos] = useState(5); // Thỏ Thông Thái
  const [rival2Pos, setRival2Pos] = useState(5); // Rùa Kiên Trì
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (customQuestions && customQuestions.length > 0) {
      setQuestions(customQuestions);
    } else {
      const list = getQuestionsForGame(grade, subject, level, 5, user.questionHistory || []);
      setQuestions(list);
    }
  }, [grade, subject, level, customQuestions]);

  const currentQ = questions[currentIndex];
  const stepSize = Math.round(90 / (questions.length || 5));

  const handleConfirmAnswer = () => {
    if (selectedOption === null || isSubmitted || !currentQ) return;
    setIsSubmitted(true);

    const isCorrect = selectedOption === currentQ.correctIndex;
    if (isCorrect) {
      soundManager.playCorrect();
      setCorrectCount((prev) => prev + 1);
      setPlayerPos((prev) => Math.min(100, prev + stepSize));
      setEarnedCoins((prev) => prev + 25 * level);
      setEarnedXp((prev) => prev + 35 * level);

      // Rivals also advance slightly
      setRival1Pos((prev) => Math.min(95, prev + Math.floor(Math.random() * (stepSize - 2))));
      setRival2Pos((prev) => Math.min(92, prev + Math.floor(Math.random() * (stepSize - 4))));
    } else {
      soundManager.playIncorrect();
      setWrongCount((prev) => prev + 1);
      setHearts((prev) => Math.max(0, prev - 1));
      // Stumble penalty: rival overtakes slightly
      setRival1Pos((prev) => Math.min(95, prev + Math.floor(stepSize * 0.8)));
      setRival2Pos((prev) => Math.min(92, prev + Math.floor(stepSize * 0.6)));
    }
  };

  const handleNext = () => {
    if (hearts <= 0 || currentIndex >= questions.length - 1) {
      finalizeRace();
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    }
  };

  const finalizeRace = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const speedBonus = durationSeconds < 40 ? 50 : 20;

    const finalXp = earnedXp + speedBonus;
    const finalCoins = earnedCoins + 30;

    const updatedUser: UserProfile = {
      ...user,
      hearts,
      coins: user.coins + finalCoins,
      xp: user.xp + finalXp,
      totalGamesPlayed: user.totalGamesPlayed + 1,
    };
    const oldLevel = user.level;
    updatedUser.level = StorageService.calculateLevel(updatedUser.xp);
    StorageService.saveUserProfile(updatedUser);

    onFinish({
      gameMode: 'cuoc_dua',
      subject,
      level,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      xpEarned: finalXp,
      coinsEarned: finalCoins,
      remainingHearts: hearts,
      newAchievements: [],
      leveledUp: updatedUser.level > oldLevel,
      newLevel: updatedUser.level,
    });
  };

  if (!currentQ) {
    return <div className="p-12 text-center text-slate-500">Đang chuẩn bị đường đua...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* Top status */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="text-xl">
                {i < hearts ? '❤️' : '🤍'}
              </span>
            ))}
          </div>
          <span className="text-xs font-bold text-rose-700 ml-1">{hearts}/5 Tim</span>
        </div>

        <div className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl">
          🏎️ Cuộc Đua Tri Thức (Chặng {currentIndex + 1}/{questions.length})
        </div>

        <button onClick={onExit} className="text-xs text-slate-400 hover:text-slate-600">
          Rời giải đua
        </button>
      </div>

      {/* VISUAL RACE TRACK CANVAS */}
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-5 rounded-3xl text-white shadow-md border-4 border-amber-400/80 space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-amber-300">
          <span>🏁 VẠCH XUẤT PHÁT</span>
          <span>ĐÍCH ĐẾN QUÁN QUÂN 🏆</span>
        </div>

        {/* Lane 1: Player */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-300 font-semibold">
            <span>Bạn ({user.fullName.split(' ').slice(-1)[0]})</span>
            <span>{playerPos}% quãng đường</span>
          </div>
          <div className="h-8 bg-slate-700/80 rounded-xl relative overflow-hidden border border-slate-600 flex items-center px-1">
            <div 
              className="absolute transition-all duration-700 ease-out flex items-center gap-1 text-2xl z-10"
              style={{ left: `calc(${playerPos}% - 24px)` }}
            >
              <span>{user.avatar}</span>
              <span className="text-xs px-1.5 py-0.2 bg-amber-400 text-slate-900 rounded-md font-black shadow-xs">
                Bạn
              </span>
            </div>
          </div>
        </div>

        {/* Lane 2: Rival 1 (Thỏ) */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-300 font-semibold">
            <span>Thỏ Thông Thái (Đối thủ)</span>
            <span>{rival1Pos}%</span>
          </div>
          <div className="h-8 bg-slate-700/80 rounded-xl relative overflow-hidden border border-slate-600 flex items-center px-1">
            <div 
              className="absolute transition-all duration-700 ease-out flex items-center gap-1 text-2xl z-10"
              style={{ left: `calc(${rival1Pos}% - 24px)` }}
            >
              <span>🐰</span>
            </div>
          </div>
        </div>

        {/* Lane 3: Rival 2 (Rùa) */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-300 font-semibold">
            <span>Rùa Kiên Trì (Đối thủ)</span>
            <span>{rival2Pos}%</span>
          </div>
          <div className="h-8 bg-slate-700/80 rounded-xl relative overflow-hidden border border-slate-600 flex items-center px-1">
            <div 
              className="absolute transition-all duration-700 ease-out flex items-center gap-1 text-2xl z-10"
              style={{ left: `calc(${rival2Pos}% - 24px)` }}
            >
              <span>🐢</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUESTION BOX */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-800">
            {currentQ.content}
          </h2>
        </div>

        <div className="space-y-2.5">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentQ.correctIndex;
            let style = 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/40';

            if (isSelected && !isSubmitted) {
              style = 'bg-blue-50 border-blue-500 text-blue-900 font-bold ring-2 ring-blue-300';
            } else if (isSubmitted) {
              if (isCorrect) style = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold';
              else if (isSelected) style = 'bg-rose-50 border-rose-500 text-rose-900';
              else style = 'opacity-50 border-slate-200';
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => !isSubmitted && setSelectedOption(idx)}
                disabled={isSubmitted}
                className={`w-full p-3.5 rounded-2xl border-2 text-left font-semibold text-sm transition-all flex items-center justify-between cursor-pointer ${style}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{opt}</span>
                </div>
                {isSubmitted && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              </button>
            );
          })}
        </div>

        {isSubmitted && (
          <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-xs text-blue-900">
            <strong>Giải thích:</strong> {currentQ.explanation}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          {!isSubmitted ? (
            <button
              onClick={handleConfirmAnswer}
              disabled={selectedOption === null}
              className="py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-all"
            >
              Tăng Tốc Về Đích 🚀
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-all"
            >
              {currentIndex < questions.length - 1 ? 'Chặng Tiếp Theo →' : 'Xem Kết Quả Về Đích 🏁'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
