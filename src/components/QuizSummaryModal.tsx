import React, { useEffect } from 'react';
import { QuizResult, UserProfile } from '../types';
import { GAME_MODES } from '../data/gameModes';
import { SUBJECTS } from '../data/subjects';
import { soundManager } from '../services/sound';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  RotateCcw, 
  Home, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Heart, 
  Coins, 
  Award,
  ArrowRight,
  Flame,
  Scale
} from 'lucide-react';
import { QuestionDisputeModal } from './QuestionDisputeModal';

interface QuizSummaryModalProps {
  result: QuizResult;
  user: UserProfile;
  onPlayAgain: () => void;
  onGoHome: () => void;
  onGoToGamesHub: () => void;
}

export const QuizSummaryModal: React.FC<QuizSummaryModalProps> = ({
  result,
  user,
  onPlayAgain,
  onGoHome,
  onGoToGamesHub,
}) => {
  const modeInfo = GAME_MODES.find((m) => m.id === result.gameMode);
  const subjectInfo = SUBJECTS.find((s) => s.id === result.subject);

  const isWin = result.correctCount >= Math.ceil(result.totalQuestions / 2) && result.remainingHearts > 0;
  const [showDispute, setShowDispute] = React.useState(false);

  useEffect(() => {
    if (isWin) {
      soundManager.playVictory();
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
      });
    } else {
      soundManager.playIncorrect();
    }
  }, [isWin]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200 text-center">
        
        {/* Header Ribbon */}
        <div className={`p-6 text-white ${
          isWin 
            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500' 
            : 'bg-gradient-to-r from-slate-700 to-slate-800'
        }`}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/20 backdrop-blur-md text-3xl shadow-inner mb-2">
            {isWin ? '🏆' : '💪'}
          </div>

          <h2 className="text-2xl font-black tracking-tight">
            {isWin ? 'CHIẾN THẮNG XUẤT SẮC!' : 'CỐ GẮNG LẦN SAU NHÉ!'}
          </h2>
          <p className="text-white/90 text-xs sm:text-sm mt-1">
            {modeInfo?.name} • {subjectInfo?.name} (Level {result.level})
          </p>
        </div>

        {/* Core Results Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {/* Level Up Banner if applicable */}
          {result.leveledUp && (
            <div className="p-3 bg-gradient-to-r from-amber-100 to-yellow-200 rounded-2xl border border-amber-300 text-amber-900 font-extrabold text-sm flex items-center justify-center gap-2 animate-bounce">
              <Sparkles className="w-5 h-5 text-amber-600" />
              CHÚC MỪNG BẠN ĐÃ ĐẠT CẤP ĐỘ {result.newLevel}! 🎉
            </div>
          )}

          {/* Stats 4 Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="text-[11px] text-emerald-700 font-semibold">Số câu đúng</div>
              <div className="text-xl font-black text-emerald-800 mt-0.5 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {result.correctCount}
              </div>
            </div>

            <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
              <div className="text-[11px] text-rose-700 font-semibold">Số câu sai</div>
              <div className="text-xl font-black text-rose-800 mt-0.5 flex items-center justify-center gap-1">
                <XCircle className="w-4 h-4 text-rose-600" />
                {result.wrongCount}
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
              <div className="text-[11px] text-amber-700 font-semibold">Xu nhận được</div>
              <div className="text-xl font-black text-amber-800 mt-0.5">
                +{result.coinsEarned}
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="text-[11px] text-blue-700 font-semibold">XP nhận được</div>
              <div className="text-xl font-black text-blue-800 mt-0.5">
                +{result.xpEarned}
              </div>
            </div>
          </div>

          {/* Hearts status after match */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              Năng lượng tim còn lại:
            </span>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="text-base">
                  {i < result.remainingHearts ? '❤️' : '🤍'}
                </span>
              ))}
            </div>
          </div>

          {/* New Achievements awarded */}
          {result.newAchievements && result.newAchievements.length > 0 && (
            <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 text-left space-y-1.5">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-purple-600" />
                Thành Tích Mới Vừa Mở Khóa:
              </span>
              <div className="space-y-1">
                {result.newAchievements.map((ach) => (
                  <div key={ach.id} className="flex items-center gap-2 text-xs font-semibold text-purple-800">
                    <span>{ach.icon}</span>
                    <span>{ach.title}</span>
                    <span className="text-purple-600 font-normal">({ach.badgeName})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Encouraging Pedagogy Message */}
          <div className="text-xs text-slate-500 italic bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/60">
            💡 Mỗi bài học là một bước tiến! Kiên trì rèn luyện sẽ giúp bạn mở khóa thêm nhiều nhân vật và trang phục đỉnh cao.
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <button
              onClick={onPlayAgain}
              id="btn-summary-play-again"
              className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs shadow-md shadow-amber-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Chơi Lại Ván Này
            </button>

            <button
              onClick={onGoToGamesHub}
              id="btn-summary-other-game"
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              Chọn Trò Khác
            </button>

            <button
              onClick={onGoHome}
              id="btn-summary-go-home"
              className="py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Về Trang Chủ
            </button>
          </div>

          {/* Dispute / Appeal Link */}
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setShowDispute(true)}
              className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1.5 font-bold cursor-pointer underline underline-offset-4"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Báo cáo câu hỏi có nhầm lẫn / Phúc khảo kết quả</span>
            </button>
          </div>
        </div>
      </div>

      {showDispute && (
        <QuestionDisputeModal
          isOpen={showDispute}
          onClose={() => setShowDispute(false)}
          question={{
            id: `q_summary_${result.gameMode}_${Date.now()}`,
            grade: user.grade,
            subject: result.subject,
            topic: `Ván thi đấu: ${modeInfo?.name || result.gameMode}`,
            difficulty: 3,
            content: `Ván đấu vừa diễn ra tại ${modeInfo?.name || 'Đấu Trường'} môn ${subjectInfo?.name || result.subject} Lớp ${user.grade}.`,
            options: ['Đáp án của em chính xác', 'Đề bài thiếu dữ kiện', 'Đáp án hệ thống chấm bị sai', 'Kiến thức ngoài phạm vi SGK'],
            correctIndex: 0,
            correctAnswerText: 'Đáp án của em chính xác',
            explanation: 'Trọng tài Sư phạm sẽ thẩm định ván đấu và bù đắp quyền lợi nếu phát hiện lỗi chấm.',
            hint: 'Hãy ghi rõ câu hỏi nào bạn thấy có sai sót.'
          }}
          user={user}
        />
      )}
    </div>
  );
};
