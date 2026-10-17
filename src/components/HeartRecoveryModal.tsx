import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { soundManager } from '../services/sound';
import { Heart, Clock, Coins, Sparkles, X, CheckCircle2 } from 'lucide-react';

interface HeartRecoveryModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updated: UserProfile) => void;
}

export const HeartRecoveryModal: React.FC<HeartRecoveryModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdate,
}) => {
  const [secondsUntilNext, setSecondsUntilNext] = useState(180);

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - user.lastHeartRegenTime) / 1000);
      const remaining = Math.max(0, 180 - (elapsed % 180));
      setSecondsUntilNext(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, user.lastHeartRegenTime]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsUntilNext / 60);
  const seconds = secondsUntilNext % 60;

  const handleBuyFullHearts = () => {
    if (user.coins < 50) {
      soundManager.playIncorrect();
      return;
    }

    soundManager.playCoin();
    const updated: UserProfile = {
      ...user,
      coins: user.coins - 50,
      hearts: 5,
      lastHeartRegenTime: Date.now(),
    };
    StorageService.saveUserProfile(updated);
    onUserUpdate(updated);
    onClose();
  };

  const handleQuickPracticeHeal = () => {
    // Reward player with 1 free heart for perseverance
    soundManager.playLevelUp();
    const updated: UserProfile = {
      ...user,
      hearts: Math.min(5, user.hearts + 1),
      lastHeartRegenTime: Date.now(),
    };
    StorageService.saveUserProfile(updated);
    onUserUpdate(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 text-center space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center text-3xl mx-auto shadow-inner">
          <Heart className="w-8 h-8 fill-rose-500" />
        </div>

        <div>
          <h3 className="text-xl font-black text-slate-800">
            Trạm Hồi Phục Năng Lượng Tim
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Mỗi bài học cần có sự tập trung và nghỉ ngơi hợp lý.
          </p>
        </div>

        {/* Current status */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Số tim hiện tại:</span>
            <span className="text-rose-600 flex items-center gap-1">
              <Heart className="w-4 h-4 fill-rose-600" />
              {user.hearts}/5
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Tự động hồi 1 tim sau:
            </span>
            <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2.5 text-left">
          {/* Option 1: Buy with in-game coins */}
          <button
            onClick={handleBuyFullHearts}
            disabled={user.coins < 50}
            className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
              user.coins >= 50
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">⚡</span>
              <div>
                <div className="text-xs font-black">Hồi Đầy 5 Tim Lập Tức</div>
                <div className="text-[10px] opacity-75">Dùng 50 Xu kiếm được từ học tập</div>
              </div>
            </div>
            <span className="font-black text-xs text-amber-700">🪙 50 Xu</span>
          </button>

          {/* Option 2: Quick free recharge bonus */}
          <button
            onClick={handleQuickPracticeHeal}
            className="w-full p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 transition-all cursor-pointer flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🌱</span>
              <div>
                <div className="text-xs font-black">Nhận 1 Tim Khởi Động Miễn Phí</div>
                <div className="text-[10px] text-emerald-700">Khuyến khích học sinh chăm chỉ học tập</div>
              </div>
            </div>
            <span className="font-bold text-xs text-emerald-700">+1 Tim Free</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          Để sau, tôi sẽ quay lại
        </button>
      </div>
    </div>
  );
};
