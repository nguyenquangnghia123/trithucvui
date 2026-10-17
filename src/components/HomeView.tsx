import React, { useState } from 'react';
import { UserProfile, DailyMission } from '../types';
import { StorageService } from '../services/storage';
import { soundManager } from '../services/sound';
import { 
  Sparkles, 
  Gamepad2, 
  BookOpen, 
  Trophy, 
  Award, 
  ShoppingBag, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  Flame, 
  Heart, 
  Coins, 
  Target, 
  Compass, 
  ShieldCheck,
  TrendingUp,
  Clock,
  Gift,
  Search,
  Bot
} from 'lucide-react';

interface HomeViewProps {
  user: UserProfile;
  onNavigate: (tab: string, extra?: unknown) => void;
  onUserUpdate: (updated: UserProfile) => void;
  onStartPlacementTest?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  onNavigate,
  onUserUpdate,
  onStartPlacementTest,
}) => {
  const [leaderboardScope, setLeaderboardScope] = useState<'global' | 'school' | 'grade' | 'classroom' | 'friends'>('global');
  const [missions, setMissions] = useState<DailyMission[]>(() => StorageService.getDailyMissions());
  const [homeSearchInput, setHomeSearchInput] = useState('');

  const xpProgress = StorageService.getXpProgress(user.xp, user.level);
  const leaderboards = StorageService.getLeaderboards(user);
  const currentLeaderboard = leaderboards[leaderboardScope] || leaderboards.global;

  // Calculate stats
  const subjectStatsList = Object.values(user.subjectStats || {}) as Array<{ answeredCount: number; correctCount: number }>;
  const totalAnswered: number = subjectStatsList.reduce((sum, s) => sum + (s.answeredCount || 0), 0);
  const totalCorrect: number = subjectStatsList.reduce((sum, s) => sum + (s.correctCount || 0), 0);
  const accuracyPercent: number = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const achievements = StorageService.getAchievements(user.unlockedAchievements);
  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;

  const handleClaimMission = (missionId: string) => {
    const res = StorageService.claimMission(missionId);
    if (res) {
      soundManager.playLevelUp();
      onUserUpdate(res.user);
      setMissions(StorageService.getDailyMissions());
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* 1. HERO PLAYER WELCOME & STATUS CARD */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5 sm:p-7 text-white shadow-xl shadow-orange-500/15">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl sm:text-5xl shadow-inner border border-white/30">
                {user.avatar}
              </div>
              {user.avatarFrame && (
                <span className="absolute -top-3 -right-2 text-2xl drop-shadow-md">
                  {user.avatarFrame}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  Chào {user.fullName}!
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-white/25 text-white font-bold text-xs backdrop-blur-xs">
                  Lớp {user.grade}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-300 text-amber-950 font-black text-xs shadow-xs">
                  Cấp độ {user.level}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-100 font-medium line-clamp-1">
                🎯 {user.learningGoal}
              </p>
              <div className="flex items-center gap-3 pt-1 text-xs text-white/90">
                <span className="flex items-center gap-1 font-bold">
                  <Flame className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
                  Daily Streak: {user.dailyStreak || 1} ngày
                </span>
                <span className="text-white/40">•</span>
                <span className="flex items-center gap-1 font-medium text-white/90">
                  Chuỗi thắng: {user.highestStreak || 0} câu
                </span>
                <span className="text-white/40">•</span>
                <span className="flex items-center gap-1 font-bold">
                  🏫 {user.school || 'Trường phổ thông'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stat Badges in Hero */}
          <div className="w-full md:w-auto flex flex-wrap md:flex-nowrap gap-2 sm:gap-3 bg-black/15 backdrop-blur-md p-3 rounded-2xl border border-white/15">
            <div className="flex-1 md:flex-none text-center px-3 py-1">
              <div className="text-[11px] text-amber-200 font-medium">Năng Lượng</div>
              <div className="text-base font-black flex items-center justify-center gap-1 text-rose-300">
                <Heart className="w-4 h-4 fill-rose-300" />
                {user.hearts}/{user.maxHearts} Tim
              </div>
            </div>
            <div className="w-px bg-white/20 hidden sm:block" />
            <div className="flex-1 md:flex-none text-center px-3 py-1">
              <div className="text-[11px] text-amber-200 font-medium">Xu Tích Lũy</div>
              <div className="text-base font-black flex items-center justify-center gap-1 text-amber-300">
                🪙 {user.coins.toLocaleString()}
              </div>
            </div>
            <div className="w-px bg-white/20 hidden sm:block" />
            <div className="flex-1 md:flex-none text-center px-3 py-1">
              <div className="text-[11px] text-amber-200 font-medium">Kinh Nghiệm</div>
              <div className="text-base font-black flex items-center justify-center gap-1 text-white">
                ⭐ {user.xp} XP
              </div>
            </div>
          </div>
        </div>

        {/* XP Progress line at bottom of hero */}
        <div className="mt-5 pt-4 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="font-bold text-amber-200 shrink-0">Cấp {user.level}</span>
            <div className="w-full sm:w-64 h-2.5 bg-black/25 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-300 to-yellow-200 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${xpProgress.percent}%` }}
              />
            </div>
            <span className="font-bold text-amber-100 shrink-0">Cấp {user.level + 1}</span>
          </div>
          <span className="text-[11px] text-amber-100/90 font-medium">
            Còn {xpProgress.max - xpProgress.current} XP nữa để lên Cấp {user.level + 1}!
          </span>
        </div>
      </section>

      {/* QUICK QUESTION SEARCH BANNER */}
      <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-base font-black">
              🔍
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                Tìm Kiếm Câu Hỏi & Mẹo Giải Nhanh
              </h3>
              <p className="text-xs text-slate-500">
                Tra cứu tức thì hàng trăm câu hỏi môn Toán, Tiếng Anh, Tin, Văn, Khoa học (Lớp 1 - 12)
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('search')}
            id="home-btn-view-all-questions"
            className="hidden sm:inline-flex text-xs font-bold text-blue-600 hover:text-blue-800 items-center gap-1 cursor-pointer"
          >
            Mở ngân hàng câu hỏi →
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onNavigate('search', { query: homeSearchInput });
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="home-input-search-question"
              value={homeSearchInput}
              onChange={(e) => setHomeSearchInput(e.target.value)}
              placeholder="Nhập nội dung câu hỏi, công thức toán, từ vựng hoặc khái niệm..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
            />
          </div>
          <button
            type="submit"
            id="home-btn-search-submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95 shrink-0"
          >
            <Search className="w-4 h-4" />
            Tìm Kiếm
          </button>
        </form>

        <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 pt-1">
          <span className="font-semibold text-slate-400 text-[11px]">Từ khóa gợi ý:</span>
          {['Phân số', 'Hình tam giác', 'Present Continuous', 'Python', 'Quang hợp', 'Bảng cửu chương'].map((keyword) => (
            <button
              key={keyword}
              type="button"
              onClick={() => onNavigate('search', { query: keyword })}
              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-600 border border-slate-200/80 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
            >
              {keyword}
            </button>
          ))}
        </div>
      </section>

      {/* AI TUTOR INTERACTIVE BANNER */}
      <section className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-4 sm:p-6 text-white shadow-md shadow-orange-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shadow-inner shrink-0">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-white/25 rounded-md text-[10px] font-black uppercase tracking-wider">
                MỚI: HỎI RIÊNG GIA SƯ AI
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
            </div>
            <h3 className="text-base sm:text-lg font-black mt-1">
              Gặp Bài Khó? Hỏi Ngay Thầy Cú & Cô Mèo AI!
            </h3>
            <p className="text-xs sm:text-sm text-amber-100 max-w-xl mt-0.5">
              Giải thích bài tập từng bước, soạn văn, dịch thuật, lập trình và mẹo nhớ công thức dành riêng cho Lớp 1 - 12.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => onNavigate('ai-tutor')}
            id="home-btn-open-ai-tutor"
            className="w-full md:w-auto px-5 py-2.5 bg-white hover:bg-amber-50 text-orange-600 rounded-2xl text-xs sm:text-sm font-black shadow-md cursor-pointer transition-transform active:scale-95 flex items-center justify-center gap-2 shrink-0"
          >
            <Bot className="w-4 h-4" />
            Hỏi Gia Sư Ngay →
          </button>
        </div>
      </section>

      {/* 2. THE 6 MAJOR NAVIGATION CARDS */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Lối Tắt Đấu Trường
          </h2>
          <span className="text-xs text-slate-500">Khám phá các tính năng chính</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {/* 1. CHƠI NGAY */}
          <div
            onClick={() => onNavigate('games')}
            id="home-btn-play-now"
            className="group p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl text-white shadow-md shadow-orange-500/15 cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl group-hover:rotate-6 transition-transform">
              🎮
            </div>
            <div className="mt-4">
              <div className="text-xs text-amber-100 font-semibold uppercase tracking-wider">8 Chế độ</div>
              <div className="font-black text-base leading-tight">CHƠI NGAY</div>
            </div>
          </div>

          {/* 2. CÁCH HỌC / LỘ TRÌNH */}
          <div
            onClick={() => onNavigate('roadmap')}
            id="home-btn-roadmap"
            className="group p-4 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl text-white shadow-md shadow-indigo-500/15 cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl group-hover:rotate-6 transition-transform">
              🧭
            </div>
            <div className="mt-4">
              <div className="text-xs text-violet-200 font-semibold uppercase tracking-wider">Phân tích AI</div>
              <div className="font-black text-base leading-tight">CÁCH HỌC</div>
            </div>
          </div>

          {/* 2. MÔN HỌC */}
          <div
            onClick={() => onNavigate('subjects')}
            id="home-btn-subjects"
            className="group p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-md shadow-blue-500/15 cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl group-hover:rotate-6 transition-transform">
              📚
            </div>
            <div className="mt-4">
              <div className="text-xs text-blue-100 font-semibold uppercase tracking-wider">5 Bộ môn</div>
              <div className="font-black text-base sm:text-lg leading-tight">MÔN HỌC</div>
            </div>
          </div>

          {/* 3. BẢNG XẾP HẠNG */}
          <div
            onClick={() => onNavigate('leaderboard')}
            id="home-btn-leaderboard"
            className="group p-4 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl text-white shadow-md shadow-yellow-500/15 cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl group-hover:rotate-6 transition-transform">
              🏆
            </div>
            <div className="mt-4">
              <div className="text-xs text-amber-100 font-semibold uppercase tracking-wider">Tranh tài</div>
              <div className="font-black text-base sm:text-lg leading-tight">XẾP HẠNG</div>
            </div>
          </div>

          {/* 4. THÀNH TÍCH */}
          <div
            onClick={() => onNavigate('achievements')}
            id="home-btn-achievements"
            className="group p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl text-white shadow-md shadow-purple-500/15 cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl group-hover:rotate-6 transition-transform">
              🎖️
            </div>
            <div className="mt-4">
              <div className="text-xs text-purple-100 font-semibold uppercase tracking-wider">{unlockedCount} Đã mở</div>
              <div className="font-black text-base sm:text-lg leading-tight">THÀNH TÍCH</div>
            </div>
          </div>

          {/* 5. CỬA HÀNG */}
          <div
            onClick={() => onNavigate('shop')}
            id="home-btn-shop"
            className="group p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-md shadow-emerald-500/15 cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl group-hover:rotate-6 transition-transform">
              🛒
            </div>
            <div className="mt-4">
              <div className="text-xs text-emerald-100 font-semibold uppercase tracking-wider">Đổi quà & avatar</div>
              <div className="font-black text-base sm:text-lg leading-tight">CỬA HÀNG</div>
            </div>
          </div>

          {/* 6. HỒ SƠ */}
          <div
            onClick={() => onNavigate('profile')}
            id="home-btn-profile"
            className="group p-4 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl text-white shadow-md shadow-slate-700/15 cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl group-hover:rotate-6 transition-transform">
              👤
            </div>
            <div className="mt-4">
              <div className="text-xs text-slate-300 font-semibold uppercase tracking-wider">Học sinh</div>
              <div className="font-black text-base sm:text-lg leading-tight">HỒ SƠ</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PROMINENT SECTION: BẢNG XẾP HẠNG TỔNG & THÀNH TÍCH CỦA BẠN (GRID 2 COLUMNS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEADERBOARD (7 COLS) */}
        <section className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl font-bold">
                  🏆
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-800">
                    BẢNG XẾP HẠNG TỔNG
                  </h3>
                  <p className="text-xs text-slate-500">Vinh danh cao thủ học tập tích cực</p>
                </div>
              </div>

              {/* Scope filter selector tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto text-[11px] font-bold">
                <button
                  onClick={() => setLeaderboardScope('global')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    leaderboardScope === 'global' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Toàn hệ thống
                </button>
                <button
                  onClick={() => setLeaderboardScope('school')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    leaderboardScope === 'school' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Toàn trường
                </button>
                <button
                  onClick={() => setLeaderboardScope('grade')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    leaderboardScope === 'grade' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Khối Lớp {user.grade}
                </button>
                <button
                  onClick={() => setLeaderboardScope('friends')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    leaderboardScope === 'friends' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bạn bè
                </button>
              </div>
            </div>

            {/* List */}
            <div className="divide-y divide-slate-100 mt-2">
              {currentLeaderboard.slice(0, 5).map((player, idx) => {
                const isCurrentUser = player.isCurrentUser || player.id === user.id;
                let rankBadge = (
                  <span className="w-7 h-7 rounded-full bg-slate-100 font-black text-xs text-slate-600 flex items-center justify-center">
                    {idx + 1}
                  </span>
                );
                if (idx === 0) rankBadge = <span className="text-xl">🥇</span>;
                if (idx === 1) rankBadge = <span className="text-xl">🥈</span>;
                if (idx === 2) rankBadge = <span className="text-xl">🥉</span>;

                return (
                  <div
                    key={player.id}
                    className={`py-3 px-2 flex items-center justify-between rounded-xl transition-colors ${
                      isCurrentUser ? 'bg-amber-50/80 border border-amber-200/80 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 flex items-center justify-center w-7">
                        {rankBadge}
                      </div>

                      <div className="relative text-2xl shrink-0">
                        <span>{player.avatar}</span>
                        {player.avatarFrame && (
                          <span className="absolute -top-2 -right-1 text-xs">{player.avatarFrame}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                            {player.fullName}
                          </span>
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-md font-bold">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          Lớp {player.grade} • {player.school}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs sm:text-sm font-black text-amber-600 flex items-center justify-end gap-1">
                        ⭐ {player.xp} XP
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        Cấp độ {player.level}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Vị trí của bạn: <strong className="text-amber-600">Top 5</strong> ({user.xp} XP)
            </span>
            <button
              onClick={() => onNavigate('leaderboard')}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
            >
              Xem đầy đủ bảng xếp hạng <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* THÀNH TÍCH CỦA BẠN (5 COLS) */}
        <section className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xl font-bold">
                  🎖️
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-800">
                    THÀNH TÍCH CỦA BẠN
                  </h3>
                  <p className="text-xs text-slate-500">Tổng kết quá trình nỗ lực</p>
                </div>
              </div>
            </div>

            {/* Grid of stats */}
            <div className="grid grid-cols-2 gap-2.5 mt-3.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium">Trò chơi đã chơi</div>
                <div className="text-xl font-black text-slate-800 mt-0.5">
                  {user.totalGamesPlayed} ván
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium">Tổng câu hỏi</div>
                <div className="text-xl font-black text-blue-600 mt-0.5">
                  {totalAnswered} câu
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium">Số câu trả lời đúng</div>
                <div className="text-xl font-black text-emerald-600 mt-0.5">
                  {totalCorrect} câu
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium">Tỷ lệ chính xác</div>
                <div className="text-xl font-black text-purple-600 mt-0.5">
                  {accuracyPercent}%
                </div>
              </div>
            </div>

            {/* Unlocked Badges Preview */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-700">Huy hiệu đã mở khóa:</span>
                <span className="text-purple-600 font-bold">{unlockedCount}/{achievements.length}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {achievements.map((ach) => (
                  <div
                    key={ach.id}
                    title={`${ach.title}: ${ach.description}`}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition-all ${
                      ach.isUnlocked
                        ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs scale-105'
                        : 'bg-slate-100 border-slate-200 text-slate-400 opacity-40 grayscale'
                    }`}
                  >
                    {ach.icon}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Tổng xu: <strong className="text-amber-600">🪙 {user.coins}</strong>
            </span>
            <button
              onClick={() => onNavigate('achievements')}
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
            >
              Mở kho thành tích <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>

      {/* 4. NHIỆM VỤ HÔM NAY (DAILY MISSIONS) & HỆ THỐNG ĐỀ XUẤT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* DAILY MISSIONS (6 COLS) */}
        <section className="lg:col-span-6 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold">
                🎁
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-800">
                  NHIỆM VỤ HÔM NAY
                </h3>
                <p className="text-xs text-slate-500">Hoàn thành để nhận thêm XP và Xu thưởng</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {missions.map((m) => {
              const progressPct = Math.min(100, Math.round((m.current / m.target) * 100));

              return (
                <div
                  key={m.id}
                  className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{m.title}</span>
                      {m.completed && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                          Xong!
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{m.description}</p>
                    
                    {/* Progress indicator */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600">
                        {m.current}/{m.target}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <div className="text-right text-xs">
                      <div className="font-bold text-amber-600">+{m.rewardCoins} Xu</div>
                      <div className="text-[11px] text-slate-500">+{m.rewardXp} XP</div>
                    </div>

                    {m.claimed ? (
                      <span className="px-3 py-1.5 bg-slate-200 text-slate-500 text-xs font-bold rounded-xl">
                        Đã nhận
                      </span>
                    ) : m.completed ? (
                      <button
                        onClick={() => handleClaimMission(m.id)}
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold rounded-xl shadow-xs hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                      >
                        Nhận Thưởng
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigate('games')}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Làm Ngay
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* AI LEARNING RECOMMENDATIONS (6 COLS) */}
        <section className="lg:col-span-6 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold">
                  💡
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-800">
                    GỢI Ý TỰ ĐỘNG THEO NĂNG LỰC
                  </h3>
                  <p className="text-xs text-slate-500">Phân tích từ kiểm tra trình độ & lịch sử làm bài</p>
                </div>
              </div>

              {onStartPlacementTest && (
                <button
                  onClick={onStartPlacementTest}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Khảo sát lại
                </button>
              )}
            </div>

            <div className="space-y-3">
              {/* Should practice */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80">
                <div className="font-bold text-amber-800 text-xs flex items-center gap-1.5 mb-1.5">
                  <Compass className="w-4 h-4 text-amber-600" />
                  Bạn nên luyện thêm để bứt phá:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {user.recommendedFocus.shouldPractice.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-white border border-amber-200 text-amber-900 text-xs font-semibold rounded-xl shadow-2xs"
                    >
                      • {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Strong at */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80">
                <div className="font-bold text-emerald-800 text-xs flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Bạn đang có thế mạnh vượt trội ở:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {user.recommendedFocus.strongAt.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl shadow-2xs"
                    >
                      🌟 {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Độ khó đề xuất hiện tại: <strong className="text-indigo-600">Level {user.initialRecommendedLevel}</strong>
            </span>
            <button
              onClick={() => onNavigate('games')}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              Luyện Tập Theo Gợi Ý →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
