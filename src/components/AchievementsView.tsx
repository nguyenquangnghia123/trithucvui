import React, { useState } from 'react';
import { UserProfile, Achievement } from '../types';
import { StorageService } from '../services/storage';
import { soundManager } from '../services/sound';
import { Award, Trophy, CheckCircle2, Lock, Sparkles, Star, Coins } from 'lucide-react';

interface AchievementsViewProps {
  user: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  user,
  onUserUpdate,
}) => {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const allAchievements = StorageService.getAchievements(user.unlockedAchievements);
  const unlockedCount = allAchievements.filter((a) => a.isUnlocked).length;
  const progressPercent = Math.round((unlockedCount / allAchievements.length) * 100);

  const filtered = allAchievements.filter((ach) => {
    if (filter === 'unlocked') return ach.isUnlocked;
    if (filter === 'locked') return !ach.isUnlocked;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 p-6 sm:p-8 rounded-3xl text-white shadow-xl shadow-purple-500/15 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-white/20 text-2xl">🎖️</span>
            <h1 className="text-xl sm:text-2xl font-black">
              Bộ Sưu Tập Huy Hiệu & Danh Hiệu
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-purple-100 max-w-xl">
            Mỗi huy hiệu là minh chứng cho một cột mốc rèn luyện, sự kiên trì và kiến thức vững chắc của bạn!
          </p>
        </div>

        {/* Progress summary block */}
        <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/20 min-w-[200px]">
          <div className="flex items-center justify-between text-xs text-purple-200 mb-1.5 font-bold">
            <span>Tiến độ mở khóa</span>
            <span className="text-white font-black">{unlockedCount}/{allAchievements.length}</span>
          </div>
          <div className="w-full h-3 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[11px] text-right text-purple-200 mt-1 font-semibold">
            Đạt {progressPercent}% bộ sưu tập
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          Tất cả ({allAchievements.length})
        </button>
        <button
          onClick={() => setFilter('unlocked')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'unlocked'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          Đã mở khóa ({unlockedCount})
        </button>
        <button
          onClick={() => setFilter('locked')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'locked'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          Chưa mở khóa ({allAchievements.length - unlockedCount})
        </button>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((ach) => (
          <div
            key={ach.id}
            className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between ${
              ach.isUnlocked
                ? 'bg-white border-amber-300/80 shadow-md shadow-amber-500/5'
                : 'bg-slate-50/70 border-slate-200/80 opacity-70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-xs border ${
                    ach.isUnlocked
                      ? 'bg-gradient-to-tr from-amber-100 to-yellow-200 border-amber-300'
                      : 'bg-slate-200 border-slate-300 grayscale opacity-50'
                  }`}
                >
                  {ach.icon}
                </div>

                {ach.isUnlocked ? (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Đã mở khóa
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-slate-200 text-slate-600 rounded-full font-bold text-[11px] flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    Đang khóa
                  </span>
                )}
              </div>

              <h3 className="font-extrabold text-base text-slate-800">
                {ach.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {ach.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                {ach.badgeName}
              </span>

              <div className="flex items-center gap-2 font-bold">
                <span className="text-amber-600">🪙 +{ach.rewardCoins}</span>
                <span className="text-blue-600">⭐ +{ach.rewardXp} XP</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
