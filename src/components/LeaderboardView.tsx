import React, { useState } from 'react';
import { UserProfile, LeaderboardEntry } from '../types';
import { StorageService } from '../services/storage';
import { Trophy, Medal, Crown, Star, Flame, Search, Users, School, Globe } from 'lucide-react';

interface LeaderboardViewProps {
  user: UserProfile;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ user }) => {
  const [scope, setScope] = useState<'global' | 'school' | 'grade' | 'classroom' | 'friends'>('global');
  const [searchTerm, setSearchTerm] = useState('');

  const leaderboards = StorageService.getLeaderboards(user);
  const currentList = leaderboards[scope] || leaderboards.global;

  const filteredList = currentList.filter((p) =>
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.school.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const top3 = filteredList.slice(0, 3);
  const remaining = filteredList.slice(3);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <span>🏆</span>
            Bảng Vinh Danh Cao Thủ Tri Thức
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Thi đua học tập lành mạnh, tích lũy XP qua các câu hỏi để leo hạng dẫn đầu!
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm tên bạn học, trường..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Scope Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'global', name: 'Toàn Hệ Thống', icon: '🌍' },
          { id: 'school', name: 'Toàn Trường', icon: '🏫' },
          { id: 'grade', name: `Khối Lớp ${user.grade}`, icon: '🎒' },
          { id: 'classroom', name: `Lớp ${user.grade}A1`, icon: '✏️' },
          { id: 'friends', name: 'Bạn Bè Thân Thiết', icon: '👥' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setScope(tab.id as typeof scope)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              scope === tab.id
                ? 'bg-amber-500 text-white shadow-md shadow-amber-200 scale-102'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* TOP 3 PODIUM */}
      {top3.length >= 3 && !searchTerm && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-4">
          {/* Rank 2 (Silver) */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border-2 border-slate-200/90 shadow-sm flex flex-col items-center justify-end text-center relative pt-8">
            <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-black shadow-xs">
              🥈 Hạng 2
            </span>
            <div className="text-4xl sm:text-5xl mb-2">{top3[1].avatar}</div>
            <div className="text-xs sm:text-sm font-black text-slate-800 truncate w-full">
              {top3[1].fullName}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Lớp {top3[1].grade} • Cấp {top3[1].level}
            </div>
            <div className="mt-3 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">
              ⭐ {top3[1].xp} XP
            </div>
          </div>

          {/* Rank 1 (Gold - Elevated) */}
          <div className="bg-gradient-to-b from-amber-50 to-white rounded-3xl p-4 sm:p-6 border-2 border-amber-400 shadow-lg shadow-amber-100 flex flex-col items-center justify-end text-center relative pt-9 -translate-y-2">
            <span className="absolute -top-4 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-black shadow-md flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" /> Quán Quân
            </span>
            <div className="text-5xl sm:text-6xl mb-2 animate-bounce">{top3[0].avatar}</div>
            <div className="text-sm sm:text-base font-black text-slate-900 truncate w-full">
              {top3[0].fullName}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Lớp {top3[0].grade} • Cấp {top3[0].level}
            </div>
            <div className="mt-3 px-4 py-1.5 rounded-xl bg-amber-400 text-amber-950 text-xs font-black shadow-xs">
              ⭐ {top3[0].xp} XP
            </div>
          </div>

          {/* Rank 3 (Bronze) */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border-2 border-amber-700/20 shadow-sm flex flex-col items-center justify-end text-center relative pt-8">
            <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-black shadow-xs">
              🥉 Hạng 3
            </span>
            <div className="text-4xl sm:text-5xl mb-2">{top3[2].avatar}</div>
            <div className="text-xs sm:text-sm font-black text-slate-800 truncate w-full">
              {top3[2].fullName}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Lớp {top3[2].grade} • Cấp {top3[2].level}
            </div>
            <div className="mt-3 px-3 py-1 rounded-xl bg-amber-50 text-amber-800 text-xs font-black">
              ⭐ {top3[2].xp} XP
            </div>
          </div>
        </div>
      )}

      {/* FULL LEADERBOARD LIST */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">
            Hiển thị {filteredList.length} người chơi
          </span>
          <span className="text-xs font-semibold text-amber-600">
            Điểm số tự động cập nhật sau mỗi ván chơi
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredList.map((entry, idx) => {
            const isMe = entry.isCurrentUser || entry.id === user.id;

            return (
              <div
                key={entry.id}
                className={`p-4 flex items-center justify-between transition-colors ${
                  isMe ? 'bg-amber-50/80 font-bold border-l-4 border-amber-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-8 text-center shrink-0">
                    {idx === 0 ? (
                      <span className="text-xl">🥇</span>
                    ) : idx === 1 ? (
                      <span className="text-xl">🥈</span>
                    ) : idx === 2 ? (
                      <span className="text-xl">🥉</span>
                    ) : (
                      <span className="font-extrabold text-sm text-slate-500">#{idx + 1}</span>
                    )}
                  </div>

                  <div className="text-3xl sm:text-4xl shrink-0 relative">
                    {entry.avatar}
                    {entry.avatarFrame && (
                      <span className="absolute -top-2 -right-1 text-xs">{entry.avatarFrame}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-extrabold text-slate-800 truncate">
                        {entry.fullName}
                      </span>
                      {isMe && (
                        <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-md font-bold">
                          Bạn
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      Lớp {entry.grade} • {entry.school}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm sm:text-base font-black text-amber-600">
                    ⭐ {entry.xp} XP
                  </div>
                  <div className="text-xs text-slate-500">
                    Cấp độ {entry.level}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
