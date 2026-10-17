import React, { useState, useEffect } from 'react';
import { Question, SubjectId, GradeLevel, UserProfile, QuizResult } from '../../types';
import { getQuestionsForGame } from '../../data/questions';
import { soundManager } from '../../services/sound';
import { StorageService } from '../../services/storage';
import { Compass, Heart, Sparkles, CheckCircle2, MapPin, Gift, Key } from 'lucide-react';

interface TreasureHuntGameProps {
  user: UserProfile;
  subject: SubjectId;
  grade: GradeLevel;
  level: number;
  customQuestions?: Question[];
  onFinish: (result: QuizResult) => void;
  onExit: () => void;
}

interface IslandTile {
  id: number;
  name: string;
  icon: string;
  revealed: boolean;
}

export const TreasureHuntGame: React.FC<TreasureHuntGameProps> = ({
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
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  // 6 map areas to reveal on island
  const [tiles, setTiles] = useState<IslandTile[]>([
    { id: 1, name: 'Bãi Biển Cát Vàng', icon: '🏖️', revealed: false },
    { id: 2, name: 'Rừng Dừa Cổ Thụ', icon: '🌴', revealed: false },
    { id: 3, name: 'Đền Thờ Cổ Tích', icon: '🏛️', revealed: false },
    { id: 4, name: 'Thác Nước Bí Mật', icon: '🌊', revealed: false },
    { id: 5, name: 'Hang Rồng Huyền Thoại', icon: '🐉', revealed: false },
    { id: 6, name: 'RƯƠNG VÀNG HOÀNG GIA', icon: '💎', revealed: false },
  ]);

  useEffect(() => {
    if (customQuestions && customQuestions.length > 0) {
      setQuestions(customQuestions);
    } else {
      const list = getQuestionsForGame(grade, subject, level, 6, user.questionHistory || []);
      setQuestions(list);
    }
  }, [grade, subject, level, customQuestions]);

  const currentQ = questions[currentIndex];

  const handleConfirmAnswer = () => {
    if (selectedOption === null || isSubmitted || !currentQ) return;
    setIsSubmitted(true);

    const isCorrect = selectedOption === currentQ.correctIndex;
    if (isCorrect) {
      soundManager.playCorrect();
      setCorrectCount((prev) => prev + 1);
      // Reveal the tile corresponding to this step
      setTiles((prev) =>
        prev.map((tile, i) => (i === currentIndex ? { ...tile, revealed: true } : tile))
      );
      setEarnedCoins((prev) => prev + 30 * level);
      setEarnedXp((prev) => prev + 40 * level);
    } else {
      soundManager.playIncorrect();
      setWrongCount((prev) => prev + 1);
      setHearts((prev) => Math.max(0, prev - 1));
    }
  };

  const handleNextTile = () => {
    if (hearts <= 0 || currentIndex >= questions.length - 1) {
      finalizeHunt();
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    }
  };

  const finalizeHunt = () => {
    const isCompletedIsland = correctCount >= 4;
    const islandBonusCoins = isCompletedIsland ? 120 : 30;
    const islandBonusXp = isCompletedIsland ? 150 : 40;

    const unlockedIds = [...user.unlockedAchievements];
    if (isCompletedIsland && !unlockedIds.includes('treasure_hunter')) {
      unlockedIds.push('treasure_hunter');
    }

    const updatedUser: UserProfile = {
      ...user,
      hearts,
      coins: user.coins + earnedCoins + islandBonusCoins,
      xp: user.xp + earnedXp + islandBonusXp,
      unlockedAchievements: unlockedIds,
      totalGamesPlayed: user.totalGamesPlayed + 1,
    };
    const oldLevel = user.level;
    updatedUser.level = StorageService.calculateLevel(updatedUser.xp);
    StorageService.saveUserProfile(updatedUser);

    onFinish({
      gameMode: 'san_kho_bau',
      subject,
      level,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      xpEarned: earnedXp + islandBonusXp,
      coinsEarned: earnedCoins + islandBonusCoins,
      remainingHearts: hearts,
      newAchievements: [],
      leveledUp: updatedUser.level > oldLevel,
      newLevel: updatedUser.level,
    });
  };

  if (!currentQ) {
    return <div className="p-12 text-center text-slate-500">Đang chuẩn bị Bản Đồ Kho Báu...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* Top Header */}
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

        <div className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1">
          <Compass className="w-4 h-4 text-emerald-600" />
          Khu Vực {currentIndex + 1}/{tiles.length}
        </div>

        <button onClick={onExit} className="text-xs text-slate-400 hover:text-slate-600">
          Rời đảo
        </button>
      </div>

      {/* VISUAL TREASURE ISLAND MAP */}
      <div className="bg-gradient-to-br from-amber-800 via-amber-900 to-amber-950 p-5 rounded-3xl text-amber-50 shadow-md border-4 border-amber-500/80 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-amber-200">
          <span>🗺️ HẢI TRÌNH THÁM HIỂM ĐẢO KHO BÁU</span>
          <span>{correctCount}/{tiles.length} Khu vực đã khám phá</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {tiles.map((tile, idx) => {
            const isCurrentTile = idx === currentIndex;
            return (
              <div
                key={tile.id}
                className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center min-h-[85px] ${
                  tile.revealed
                    ? 'bg-amber-400/90 text-amber-950 border-amber-300 font-bold shadow-xs scale-102'
                    : isCurrentTile
                    ? 'bg-amber-950/70 border-amber-400 text-amber-200 ring-2 ring-amber-300 animate-pulse'
                    : 'bg-black/30 border-amber-900/60 text-amber-400/40'
                }`}
              >
                <div className="text-2xl mb-1">
                  {tile.revealed ? tile.icon : isCurrentTile ? '🔍' : '🌫️'}
                </div>
                <div className="text-[10px] leading-tight font-semibold">
                  {tile.revealed ? tile.name : `Khu Vực ${tile.id}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUESTION BOX */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block mb-1">
            Mở Khóa: {tiles[currentIndex]?.name}
          </span>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-800">
            {currentQ.content}
          </h2>
        </div>

        <div className="space-y-2.5">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentQ.correctIndex;
            let style = 'bg-white border-slate-200 text-slate-700 hover:border-amber-400 hover:bg-amber-50/40';

            if (isSelected && !isSubmitted) {
              style = 'bg-amber-50 border-amber-500 text-amber-900 font-bold ring-2 ring-amber-300';
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
            <strong>Lời giải chi tiết:</strong> {currentQ.explanation}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          {!isSubmitted ? (
            <button
              onClick={handleConfirmAnswer}
              disabled={selectedOption === null}
              className="py-3 px-6 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-all flex items-center gap-2"
            >
              <Key className="w-4 h-4" />
              Mở Rương Kho Báu
            </button>
          ) : (
            <button
              onClick={handleNextTile}
              className="py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-all"
            >
              {currentIndex < questions.length - 1 ? 'Khám Phá Khu Vực Kế Tiếp →' : 'Thu Thập Toàn Bộ Kho Báu! 💎'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
