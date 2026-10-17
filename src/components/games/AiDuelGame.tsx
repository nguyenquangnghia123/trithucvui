import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GradeLevel, SubjectId, Question, QuizResult } from '../../types';
import { getQuestionsForGame } from '../../data/questions';
import { soundManager } from '../../services/sound';
import { StorageService } from '../../services/storage';
import { ExitGameModal } from '../ExitGameModal';
import { 
  Bot, 
  User, 
  Heart, 
  Swords, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ArrowRight,
  Lightbulb,
  Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AiDuelGameProps {
  grade: GradeLevel;
  subject: SubjectId;
  level: number;
  user: UserProfile;
  customQuestions?: Question[];
  onFinishGame: (result: QuizResult) => void;
  onBack: () => void;
  onOpenHeartRecovery?: () => void;
}

const AI_OPPONENTS: Record<SubjectId, { name: string; avatar: string; title: string; winRate: number }> = {
  toan: { name: 'AI Pythagoras', avatar: '🤖', title: 'Học Giả Toán Học Nhân Tạo', winRate: 0.75 },
  tieng_anh: { name: 'AI Shakespeare', avatar: '🧙‍♂️', title: 'Bậc Thầy Ngôn Ngữ AI', winRate: 0.72 },
  tin_hoc: { name: 'AI Turing', avatar: '🦾', title: 'Siêu Thuật Toán AI', winRate: 0.78 },
  ngu_van: { name: 'AI Thi Hào', avatar: '📜', title: 'Nhà Văn Hóa AI', winRate: 0.70 },
  khoa_hoc: { name: 'AI Einstein', avatar: '🔬', title: 'Nhà Khoa Học Lượng Tử AI', winRate: 0.76 },
};

export const AiDuelGame: React.FC<AiDuelGameProps> = ({
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
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [aiAnswerState, setAiAnswerState] = useState<'thinking' | 'answered_correct' | 'answered_wrong'>('thinking');
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [showHintText, setShowHintText] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const aiInfo = AI_OPPONENTS[subject] || AI_OPPONENTS.toan;
  const aiTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (customQuestions && customQuestions.length > 0) {
      setQuestions(customQuestions);
    } else {
      const list = getQuestionsForGame(grade, subject, level, 6, user.questionHistory || []);
      setQuestions(list);
    }
  }, [grade, subject, level, customQuestions]);

  const currentQ = questions[currentIndex];

  // AI response simulation
  useEffect(() => {
    if (!currentQ || isSubmitted) return;
    setAiAnswerState('thinking');

    const thinkingTime = 2000 + Math.random() * 2500; // 2 - 4.5 seconds
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    aiTimerRef.current = setTimeout(() => {
      // AI accuracy chance based on difficulty
      const chance = aiInfo.winRate - (currentQ.difficulty * 0.05);
      const isAiCorrect = Math.random() < Math.max(0.4, chance);

      if (isAiCorrect) {
        setAiAnswerState('answered_correct');
        setAiScore((prev) => prev + 10);
      } else {
        setAiAnswerState('answered_wrong');
      }
    }, thinkingTime);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [currentIndex, currentQ, isSubmitted]);

  const handleSelectOption = (idx: number) => {
    if (isSubmitted || eliminatedOptions.includes(idx) || !currentQ) return;
    setSelectedOption(idx);
    setIsSubmitted(true);

    const isCorrect = idx === currentQ.correctIndex;
    StorageService.recordAnswer(currentQ.id, isCorrect, subject, currentQ.topic, currentQ.difficulty);

    if (isCorrect) {
      soundManager.playCorrect();
      setPlayerScore((prev) => prev + 10);
      setEarnedCoins((prev) => prev + 25);
      setEarnedXp((prev) => prev + 35);
      setCorrectCount((prev) => prev + 1);
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
    const isPlayerVictor = playerScore > aiScore;
    const victoryBonusXp = isPlayerVictor ? 80 : 20;
    const victoryBonusCoins = isPlayerVictor ? 50 : 10;

    if (isPlayerVictor) {
      soundManager.playVictory();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    }

    StorageService.addXpAndCoins(earnedXp + victoryBonusXp, earnedCoins + victoryBonusCoins, 'ai_duel_game');
    const updatedUser = StorageService.getUserProfile();

    onFinishGame({
      gameMode: 'thach_dau_ai',
      subject,
      level,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      xpEarned: earnedXp + victoryBonusXp,
      coinsEarned: earnedCoins + victoryBonusCoins,
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
      {/* Top Header */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center justify-between gap-4">
        <button
          onClick={() => setShowExitModal(true)}
          className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-lg">
            🤖
          </div>
          <div>
            <h2 className="font-extrabold text-sm sm:text-base text-slate-800">
              Thách Đấu AI
            </h2>
            <p className="text-[11px] text-slate-500">
              Vòng đấu {currentIndex + 1} / {questions.length || 6}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-rose-50 px-2.5 py-1.5 rounded-2xl border border-rose-100">
          <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
          <span className="font-black text-xs text-rose-600">{hearts}</span>
        </div>
      </div>

      {/* Duel Battle Score Arena */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
        <div className="grid grid-cols-3 items-center text-center">
          {/* Player Side */}
          <div className="space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-white/20 mx-auto flex items-center justify-center text-2xl border border-white/30 shadow-inner">
              {user.avatar || '🎓'}
            </div>
            <div className="font-extrabold text-sm line-clamp-1">{user.fullName}</div>
            <div className="text-2xl font-black text-amber-300">{playerScore} pts</div>
          </div>

          {/* Versus Center */}
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-black text-xs">
              VS
            </div>
            <span className="text-[11px] font-semibold text-indigo-200">
              {playerScore > aiScore ? 'Bạn đang dẫn trước!' : playerScore < aiScore ? 'AI đang dẫn điểm!' : 'Hòa điểm!'}
            </span>
          </div>

          {/* AI Side */}
          <div className="space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-white/20 mx-auto flex items-center justify-center text-2xl border border-white/30 shadow-inner">
              {aiInfo.avatar}
            </div>
            <div className="font-extrabold text-sm line-clamp-1">{aiInfo.name}</div>
            <div className="text-2xl font-black text-violet-300">{aiScore} pts</div>
          </div>
        </div>

        {/* AI Status Pill */}
        <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-center gap-2 text-xs font-semibold">
          <Bot className="w-4 h-4 text-violet-300" />
          <span>Trạng thái AI:</span>
          {aiAnswerState === 'thinking' && (
            <span className="text-amber-300 animate-pulse">Đang phân tích câu hỏi...</span>
          )}
          {aiAnswerState === 'answered_correct' && (
            <span className="text-emerald-300 flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> AI đã trả lời đúng!
            </span>
          )}
          {aiAnswerState === 'answered_wrong' && (
            <span className="text-rose-300 flex items-center gap-1 font-bold">
              <XCircle className="w-3.5 h-3.5" /> AI đã trả lời sai!
            </span>
          )}
        </div>
      </div>

      {/* Question Card */}
      {currentQ ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between text-xs">
            <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-full font-bold">
              {currentQ.topic}
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

              let cardStyle = 'border-slate-200 hover:border-violet-400 bg-white hover:bg-violet-50/30 text-slate-700';
              if (isSelected && !isSubmitted) cardStyle = 'border-violet-600 bg-violet-50/50 text-violet-900';
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
            <div className="p-4 bg-violet-50/70 rounded-2xl border border-violet-200 text-xs text-violet-900 space-y-1">
              <span className="font-bold text-violet-800">💡 Kiến thức trọng tâm:</span>
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
                className="py-3 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-200 flex items-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
              >
                <span>{currentIndex < questions.length - 1 ? 'Hiệp Tiếp Theo' : 'Kết Thúc Trận Đấu'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
          <p className="text-slate-500 font-medium">Đang kết nối đấu thủ AI...</p>
        </div>
      )}

      {/* Exit Modal */}
      <ExitGameModal
        isOpen={showExitModal}
        gameTitle="Thách Đấu AI"
        onStay={() => setShowExitModal(false)}
        onConfirmExit={() => {
          setShowExitModal(false);
          onBack();
        }}
      />
    </div>
  );
};
