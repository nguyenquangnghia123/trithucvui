import React, { useState, useEffect } from 'react';
import { UserProfile, GradeLevel, SubjectId, Question, QuizResult } from '../../types';
import { getQuestionsForGame } from '../../data/questions';
import { soundManager } from '../../services/sound';
import { StorageService } from '../../services/storage';
import { ExitGameModal } from '../ExitGameModal';
import { 
  Puzzle, 
  Heart, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ArrowRight,
  Lightbulb,
  Unlock
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface KnowledgePuzzleGameProps {
  grade: GradeLevel;
  subject: SubjectId;
  level: number;
  user: UserProfile;
  customQuestions?: Question[];
  onFinishGame: (result: QuizResult) => void;
  onBack: () => void;
  onOpenHeartRecovery?: () => void;
}

const PUZZLE_TILES = [
  { id: 1, label: 'Khái Niệm Cốt Lõi', icon: '💎', color: 'from-blue-500 to-indigo-600' },
  { id: 2, label: 'Quy Luật Tự Nhiên', icon: '⚡', color: 'from-amber-500 to-orange-600' },
  { id: 3, label: 'Công Thức Vàng', icon: '📐', color: 'from-emerald-500 to-teal-600' },
  { id: 4, label: 'Tư Duy Phản Biện', icon: '🧠', color: 'from-purple-500 to-pink-600' },
  { id: 5, label: 'Ứng Dụng Thực Tiễn', icon: '🌍', color: 'from-cyan-500 to-blue-600' },
  { id: 6, label: 'Đỉnh Cao Tri Thức', icon: '👑', color: 'from-rose-500 to-red-600' },
];

export const KnowledgePuzzleGame: React.FC<KnowledgePuzzleGameProps> = ({
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
  const [unlockedTiles, setUnlockedTiles] = useState<number[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [showHintText, setShowHintText] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    if (customQuestions && customQuestions.length > 0) {
      setQuestions(customQuestions);
    } else {
      const list = getQuestionsForGame(grade, subject, level, 6, user.questionHistory || []);
      setQuestions(list);
    }
  }, [grade, subject, level, customQuestions]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isSubmitted || eliminatedOptions.includes(idx) || !currentQ) return;
    setSelectedOption(idx);
    setIsSubmitted(true);

    const isCorrect = idx === currentQ.correctIndex;
    StorageService.recordAnswer(currentQ.id, isCorrect, subject, currentQ.topic, currentQ.difficulty);

    if (isCorrect) {
      soundManager.playCorrect();
      setUnlockedTiles((prev) => [...prev, currentIndex + 1]);
      setEarnedCoins((prev) => prev + 25);
      setEarnedXp((prev) => prev + 35);
      setCorrectCount((prev) => prev + 1);

      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    } else {
      soundManager.playIncorrect();
      setWrongCount((prev) => prev + 1);
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
    // Check if fully completed
    const bonusXp = unlockedTiles.length === 6 ? 100 : 0;
    const bonusCoins = unlockedTiles.length === 6 ? 50 : 0;

    StorageService.addXpAndCoins(earnedXp + bonusXp, earnedCoins + bonusCoins, 'knowledge_puzzle_game');
    const updatedUser = StorageService.getUserProfile();

    onFinishGame({
      gameMode: 'xep_hinh',
      subject,
      level,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      xpEarned: earnedXp + bonusXp,
      coinsEarned: earnedCoins + bonusCoins,
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
      {/* Top Navigation */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center justify-between gap-4">
        <button
          onClick={() => setShowExitModal(true)}
          className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center font-bold text-lg">
            🧩
          </div>
          <div>
            <h2 className="font-extrabold text-sm sm:text-base text-slate-800">
              Xếp Hình Kiến Thức
            </h2>
            <p className="text-[11px] text-slate-500">
              Đã ghép: {unlockedTiles.length} / 6 mảnh
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-rose-50 px-2.5 py-1.5 rounded-2xl border border-rose-100">
          <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
          <span className="font-black text-xs text-rose-600">{hearts}</span>
        </div>
      </div>

      {/* Visual Mosaic / Puzzle Progress Grid */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Bức Tranh Tri Thức Toàn Cảnh
          </span>
          <span className="font-semibold text-cyan-600">
            {Math.round((unlockedTiles.length / 6) * 100)}% Hoàn Tất
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {PUZZLE_TILES.map((tile) => {
            const isUnlocked = unlockedTiles.includes(tile.id);
            const isCurrent = currentIndex + 1 === tile.id && !isUnlocked;

            return (
              <div
                key={tile.id}
                className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center p-2 text-center transition-all ${
                  isUnlocked
                    ? `bg-gradient-to-br ${tile.color} text-white border-transparent shadow-md scale-105`
                    : isCurrent
                    ? 'border-cyan-400 bg-cyan-50/70 border-dashed animate-pulse'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                }`}
              >
                <span className="text-xl mb-1">{isUnlocked ? tile.icon : '🔒'}</span>
                <span className="text-[10px] font-bold leading-tight line-clamp-1">
                  {isUnlocked ? tile.label : `Mảnh #${tile.id}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question Card */}
      {currentQ ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between text-xs">
            <span className="px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full font-bold">
              Mảnh ghép số {currentIndex + 1}: {currentQ.topic}
            </span>
            <span className="font-semibold text-slate-400">
              Độ khó: {currentQ.difficulty}/6
            </span>
          </div>

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

              let cardStyle = 'border-slate-200 hover:border-cyan-400 bg-white hover:bg-cyan-50/30 text-slate-700';
              if (isSelected && !isSubmitted) cardStyle = 'border-cyan-600 bg-cyan-50/50 text-cyan-900';
              if (isCorrectAnswer) cardStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
              if (isWrongSelected) cardStyle = 'border-rose-500 bg-rose-50 text-rose-900 line-through';
              if (isEliminated) cardStyle = 'opacity-30 border-slate-200 bg-slate-50 cursor-not-allowed';

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

          {/* Explanation */}
          {isSubmitted && (
            <div className="p-4 bg-cyan-50/70 rounded-2xl border border-cyan-200 text-xs text-cyan-900 space-y-1">
              <span className="font-bold text-cyan-800">💡 Khám phá tri thức:</span>
              <p>{currentQ.explanation}</p>
            </div>
          )}

          {/* Actions */}
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
                className="py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-2xl font-black text-sm shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
              >
                <span>{currentIndex < questions.length - 1 ? 'Mảnh Tiếp Theo' : 'Xem Bức Tranh Hoàn Chỉnh'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
          <p className="text-slate-500 font-medium">Đang chuẩn bị các mảnh ghép...</p>
        </div>
      )}

      {/* Exit Modal */}
      <ExitGameModal
        isOpen={showExitModal}
        gameTitle="Xếp Hình Kiến Thức"
        onStay={() => setShowExitModal(false)}
        onConfirmExit={() => {
          setShowExitModal(false);
          onBack();
        }}
      />
    </div>
  );
};
