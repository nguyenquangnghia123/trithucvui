import React from 'react';
import { AlertTriangle, Home, Play } from 'lucide-react';

interface ExitGameModalProps {
  isOpen: boolean;
  onStay: () => void;
  onConfirmExit: () => void;
  gameTitle?: string;
}

export const ExitGameModal: React.FC<ExitGameModalProps> = ({
  isOpen,
  onStay,
  onConfirmExit,
  gameTitle = 'trò chơi',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center space-y-5 animate-in zoom-in-95">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-3xl shadow-inner">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xl font-black text-slate-800">
            Bạn có chắc muốn rời khỏi {gameTitle}?
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Tiến trình màn chơi hiện tại sẽ bị tạm dừng. Kết quả các câu bạn vừa trả lời vẫn được ghi nhận vào lịch sử học tập, nhưng bạn sẽ không nhận được thưởng vượt ải.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onStay}
            id="btn-stay-in-game"
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-white" />
            Ở LẠI CHƠI
          </button>

          <button
            onClick={onConfirmExit}
            id="btn-confirm-exit-game"
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm border border-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Home className="w-4 h-4" />
            VỀ TRANG CHỦ
          </button>
        </div>
      </div>
    </div>
  );
};
