import React, { useState, useEffect } from 'react';
import { Question, SubjectId, GradeLevel, UserProfile, QuizResult } from '../../types';
import { getQuestionsForGame } from '../../data/questions';
import { soundManager } from '../../services/sound';
import { StorageService } from '../../services/storage';
import { Castle, Heart, Sparkles, CheckCircle2, ArrowUp, Crown, Shield } from 'lucide-react';

interface TowerGameProps {
  user: UserProfile;
  subject: SubjectId;
  grade: GradeLevel;
  level: number;
  customQuestions?: Question[];
  onFinish: (result: QuizResult) => void;
  onExit: () => void;
}

export const TowerGame: React.FC<TowerGameProps> = ({
  user,
  subject,
  grade,
  level,
  customQuestions,
  onFinish,
  onExit,
}) => {
  const TOTAL_FLOORS = 6;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentFloor, setCurrentFloor] = useState(1); // Floor 1 to 6
  const [hearts, setHearts] = useState(user.hearts > 0 ? user.hearts : 5);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  useEffect(() => {
    if (customQuestions && customQuestions.length > 0) {
      setQuestions(customQuestions);
    } else {
      // Generate questions that scale up in difficulty per floor
      const list = getQuestionsForGame(grade, subject, level, TOTAL_FLOORS, user.questionHistory || []);
      setQuestions(list);
    }
  }, [grade, subject, level, customQuestions]);

  const currentQ = questions[currentFloor - 1];

  const handleConfirmAnswer = () => {
    if (selectedOption === null || isSubmitted || !currentQ) return;
    setIsSubmitted(true);

    const isCorrect = selectedOption === currentQ.correctIndex;
    if (isCorrect) {
      soundManager.playCorrect();
      setCorrectCount((prev) => prev + 1);
      // Floor scaling rewards
      const coinFloorBonus = 20 * currentFloor;
      const xpFloorBonus = 30 * currentFloor;
      setEarnedCoins((prev) => prev + coinFloorBonus);
      setEarnedXp((prev) => prev + xpFloorBonus);
    } else {
      soundManager.playIncorrect();
      setWrongCount((prev) => prev + 1);
      setHearts((prev) => Math.max(0, prev - 1));
    }
  };

  const handleNextFloor = () => {
    if (hearts <= 0) {
      finalizeTower(false);
      return;
    }

    if (currentFloor < TOTAL_FLOORS) {
      setCurrentFloor((prev) => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    } else {
      // Completed all floors!
      finalizeTower(true);
    }
  };

  const finalizeTower = (conquered: boolean) => {
    const towerBonus = conquered ? 100 : 0;
    const finalCoins = earnedCoins + (conquered ? 80 : 20);
    const finalXp = earnedXp + towerBonus;

    const unlockedIds = [...user.unlockedAchievements];
    if (conquered && !unlockedIds.includes('tower_climber')) {
      unlockedIds.push('tower_climber');
    }

    const updatedUser: UserProfile = {
      ...user,
      hearts,
      coins: user.coins + finalCoins,
      xp: user.xp + finalXp,
      unlockedAchievements: unlockedIds,
      totalGamesPlayed: user.totalGamesPlayed + 1,
    };
    const oldLevel = user.level;
    updatedUser.level = StorageService.calculateLevel(updatedUser.xp);
    StorageService.saveUserProfile(updatedUser);

    onFinish({
      gameMode: 'thap_tri_thuc',
      subject,
      level,
      totalQuestions: TOTAL_FLOORS,
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
    return <div className="p-12 text-center text-slate-500">Đang chuẩn bị Tháp Kiến Thức...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* Header bar */}
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

        <div className="text-xs font-black text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-xl flex items-center gap-1">
          <Crown className="w-4 h-4 text-amber-500" />
          Tầng {currentFloor}/{TOTAL_FLOORS}
        </div>

        <button onClick={onExit} className="text-xs text-slate-400 hover:text-slate-600">
          Rời khỏi tháp
        </button>
      </div>

      {/* VISUAL TOWER ELEVATOR */}
      <div className="bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 p-5 rounded-3xl text-white shadow-lg border border-purple-800">
        <div className="flex items-center justify-between text-xs font-bold text-purple-200 mb-3">
          <span>🏰 THÁP KIẾN THỨC HUYỀN BÍ</span>
          <span>Đỉnh tháp nhận cúp Hoàng Gia 👑</span>
        </div>

        {/* Floor steps display */}
        <div className="grid grid-cols-6 gap-2 text-center">
          {Array.from({ length: TOTAL_FLOORS }).map((_, idx) => {
            const floorNum = idx + 1;
            const isCurrent = floorNum === currentFloor;
            const isPassed = floorNum < currentFloor;

            return (
              <div
                key={floorNum}
                className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  isCurrent
                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-md scale-105'
                    : isPassed
                    ? 'bg-emerald-600/60 text-white border-emerald-500 font-bold'
                    : 'bg-purple-900/40 text-purple-300/60 border-purple-800'
                }`}
              >
                <span className="text-[10px] uppercase">Tầng</span>
                <span className="text-sm font-extrabold">{floorNum}</span>
                {isCurrent && <span className="text-base animate-bounce">{user.avatar}</span>}
                {isPassed && <span className="text-xs">✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* QUESTION BOX */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block mb-1">
            Thử Thách Tầng {currentFloor} • {currentQ.topic}
          </span>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-800">
            {currentQ.content}
          </h2>
        </div>

        <div className="space-y-2.5">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentQ.correctIndex;
            let style = 'bg-white border-slate-200 text-slate-700 hover:border-purple-400 hover:bg-purple-50/40';

            if (isSelected && !isSubmitted) {
              style = 'bg-purple-50 border-purple-500 text-purple-900 font-bold ring-2 ring-purple-300';
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
            <strong>Gợi ý lời giải:</strong> {currentQ.explanation}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          {!isSubmitted ? (
            <button
              onClick={handleConfirmAnswer}
              disabled={selectedOption === null}
              className="py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-all flex items-center gap-2"
            >
              <ArrowUp className="w-4 h-4" />
              Mở Cửa Lên Tầng
            </button>
          ) : (
            <button
              onClick={handleNextFloor}
              className="py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-all"
            >
              {currentFloor < TOTAL_FLOORS ? `Leo Lên Tầng ${currentFloor + 1} →` : 'Chạm Đỉnh Tháp! 👑'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
