import React, { useState } from 'react';
import { Question, UserProfile } from '../types';
import { CurriculumQualityService } from '../services/curriculumQualityService';
import { soundManager } from '../services/sound';
import { 
  ShieldAlert, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Heart, 
  Coins, 
  Sparkles, 
  Scale, 
  BookOpen,
  ArrowRight,
  Bot
} from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';
import confetti from 'canvas-confetti';

interface QuestionDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question;
  user: UserProfile;
  selectedOptionIndex?: number | null;
  onResolveAppeal?: (refundHeart: boolean, bonusXp: number, bonusCoins: number) => void;
}

export const QuestionDisputeModal: React.FC<QuestionDisputeModalProps> = ({
  isOpen,
  onClose,
  question,
  user,
  selectedOptionIndex,
  onResolveAppeal,
}) => {
  const [reason, setReason] = useState<
    'student_correct_marked_wrong' | 'wrong_answer' | 'inconsistent_data' | 'out_of_scope' | 'other'
  >('student_correct_marked_wrong');
  const [studentComment, setStudentComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    isValidAppeal: boolean;
    explanation: string;
    refundHeart: boolean;
    bonusXp: number;
    bonusCoins: number;
  } | null>(null);

  if (!isOpen) return null;

  const userSelectedText = 
    typeof selectedOptionIndex === 'number' && selectedOptionIndex >= 0 && selectedOptionIndex < question.options.length
      ? question.options[selectedOptionIndex]
      : 'Chưa chọn phương án cụ thể';

  const correctOptionText = 
    question.correctAnswerText || 
    (typeof question.correctIndex === 'number' && question.options[question.correctIndex]) || 
    question.options[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setIsSubmitting(true);

    try {
      const res = await CurriculumQualityService.submitDispute({
        userId: user.id,
        userName: user.fullName || user.username,
        question,
        selectedOptionIndex: typeof selectedOptionIndex === 'number' ? selectedOptionIndex : -1,
        selectedOptionText: userSelectedText,
        reason,
        studentComment: studentComment.trim() || 'Học sinh đề nghị phúc khảo kết quả chấm câu này.',
        studentGrade: user.grade,
      });

      setResult(res);

      if (res.isValidAppeal) {
        soundManager.playVictory();
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
        if (onResolveAppeal) {
          onResolveAppeal(res.refundHeart, res.bonusXp, res.bonusCoins);
        }
      } else {
        soundManager.playClick();
      }
    } catch (err) {
      console.error('Error submitting dispute:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        id="question-dispute-modal"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-rose-500 via-amber-500 to-orange-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-1.5">
                Trọng Tài Sư Phạm • Phúc Khảo Câu Hỏi
              </h3>
              <p className="text-[11px] text-amber-100">
                Bảo vệ quyền lợi học sinh • Thẩm định tính chính xác 100%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Question Brief */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                Môn: {question.subject.toUpperCase()} • Lớp {question.grade}
              </span>
              {question.textbook && (
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {question.textbook}
                </span>
              )}
            </div>
            <div className="font-bold text-slate-800 line-clamp-3">
              <MathMarkdown content={question.content} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
              <div className="p-2 rounded-xl bg-rose-50/80 border border-rose-200">
                <span className="font-bold text-rose-700 block mb-0.5">Lựa chọn của bạn:</span>
                <span className="text-slate-700">{userSelectedText}</span>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <span className="font-bold text-emerald-700 block mb-0.5">Đáp án hệ thống chấm:</span>
                <span className="text-slate-700">{correctOptionText}</span>
              </div>
            </div>
          </div>

          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 text-xs">
                  Vấn đề bạn muốn khiếu nại hoặc báo cáo:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    reason === 'student_correct_marked_wrong'
                      ? 'bg-amber-50 border-amber-400 font-bold text-amber-900 ring-1 ring-amber-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="dispute_reason" 
                      checked={reason === 'student_correct_marked_wrong'} 
                      onChange={() => setReason('student_correct_marked_wrong')}
                      className="text-amber-500 focus:ring-amber-400"
                    />
                    <span>Em chọn đúng nhưng bị chấm sai</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    reason === 'wrong_answer'
                      ? 'bg-amber-50 border-amber-400 font-bold text-amber-900 ring-1 ring-amber-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="dispute_reason" 
                      checked={reason === 'wrong_answer'} 
                      onChange={() => setReason('wrong_answer')}
                      className="text-amber-500 focus:ring-amber-400"
                    />
                    <span>Đáp án của câu hỏi bị sai</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    reason === 'inconsistent_data'
                      ? 'bg-amber-50 border-amber-400 font-bold text-amber-900 ring-1 ring-amber-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="dispute_reason" 
                      checked={reason === 'inconsistent_data'} 
                      onChange={() => setReason('inconsistent_data')}
                      className="text-amber-500 focus:ring-amber-400"
                    />
                    <span>Đề bài thiếu dữ kiện / gây nhập nhằng</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    reason === 'out_of_scope'
                      ? 'bg-amber-50 border-amber-400 font-bold text-amber-900 ring-1 ring-amber-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="dispute_reason" 
                      checked={reason === 'out_of_scope'} 
                      onChange={() => setReason('out_of_scope')}
                      className="text-amber-500 focus:ring-amber-400"
                    />
                    <span>Vượt quá chương trình Lớp {user.grade}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5 text-xs">
                  Giải thích của bạn (tại sao đáp án của bạn đúng / câu hỏi có lỗi):
                </label>
                <textarea
                  rows={3}
                  value={studentComment}
                  onChange={(e) => setStudentComment(e.target.value)}
                  placeholder="Ví dụ: Theo bài 2 SGK, công thức lũy thừa a^m * a^n = a^(m+n), nên phương án em chọn là chính xác..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Chính sách Trọng Tài:</strong> Nếu khiếu nại được duyệt, hệ thống sẽ <strong>hoàn lại 1 Tim</strong> ngay lập tức, thưởng <strong>+50 XP</strong> và <strong>+30 Xu</strong> khích lệ tinh thần học tập!
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 cursor-pointer text-xs"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2 text-xs transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Trọng Tài AI Đang Thẩm Định...</span>
                    </>
                  ) : (
                    <>
                      <Scale className="w-4 h-4" />
                      <span>Gửi Phúc Khảo & Thẩm Định Ngay</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className={`p-4 rounded-2xl border ${
                result.isValidAppeal
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}>
                <div className="flex items-center gap-2 mb-2 font-black text-sm">
                  {result.isValidAppeal ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>🎉 PHÚC KHẢO THÀNH CÔNG! BẠN ĐÃ TRẢ LỜI ĐÚNG!</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-5 h-5 text-amber-600" />
                      <span>PHÁN QUYẾT TỪ TRỌNG TÀI SƯ PHẠM</span>
                    </>
                  )}
                </div>
                <p className="text-xs leading-relaxed mb-3">
                  {result.explanation}
                </p>

                {result.isValidAppeal && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/80 text-xs font-bold text-emerald-800">
                    <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      +1 Tim Hồi Phục
                    </span>
                    <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      +{result.bonusXp} XP Khích Lệ
                    </span>
                    <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      +{result.bonusCoins} Xu Thưởng
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-xs text-xs cursor-pointer"
                >
                  Đã Hiểu & Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
