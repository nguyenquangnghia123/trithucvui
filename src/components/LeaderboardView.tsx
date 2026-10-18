import React, { useState, useEffect } from 'react';
import { UserProfile, LeaderboardUser, LeaderboardPrivacyMode, StudentPrivacySettings } from '../types';
import { StorageService } from '../services/storage';
import { soundManager } from '../services/sound';
import { 
  SAFE_NICKNAME_PRESETS, 
  generateSafeNickname, 
  validateSafeNickname 
} from '../data/leaderboardData';
import { 
  Trophy, 
  Crown, 
  Star, 
  Flame, 
  Search, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  CheckCircle2, 
  Smile, 
  TrendingUp, 
  Heart, 
  RefreshCw,
  Award,
  HelpCircle,
  School
} from 'lucide-react';

interface LeaderboardViewProps {
  user: UserProfile;
  onUserUpdate?: (updated: UserProfile) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ user, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'personal_growth'>('leaderboard');
  const [scope, setScope] = useState<'global' | 'school' | 'grade' | 'classroom' | 'friends'>('global');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyToast, setPrivacyToast] = useState<string | null>(null);

  // Privacy form state
  const currentPrivacy = user.privacySettings || {
    leaderboardMode: 'anonymous' as LeaderboardPrivacyMode,
    safeNickname: generateSafeNickname(user.grade),
    hideSchool: true,
  };

  const [selectedMode, setSelectedMode] = useState<LeaderboardPrivacyMode>(currentPrivacy.leaderboardMode);
  const [customNickname, setCustomNickname] = useState(currentPrivacy.safeNickname || '');
  const [hideSchool, setHideSchool] = useState<boolean>(currentPrivacy.hideSchool !== false);
  const [nicknameError, setNicknameError] = useState<string>('');

  // Encouraging quote pool for students
  const encouragingQuotes = [
    '🌟 "Bạn đã tiến bộ rất nhiều so với tuần trước. Hãy tiếp tục phát huy nhé!"',
    '🎯 "Chúc mừng bạn đã hoàn thành mục tiêu học tập hôm nay! Mỗi ngày một bước tiến mới."',
    '🌱 "Học tập là một hành trình kỳ diệu, quan trọng nhất là niềm vui và sự bền bỉ của chính bạn!"',
    '✨ "Mỗi câu hỏi làm đúng là một vì sao sáng trên bầu trời tri thức của em!"',
    '💪 "Thất bại tạm thời chỉ là cơ hội để học hỏi thêm. Cố gắng lên nhé bạn nhỏ!"'
  ];

  // Rotate daily encouraging quote based on date
  const todaySeed = new Date().getDate() % encouragingQuotes.length;
  const currentQuote = encouragingQuotes[todaySeed];

  // Load leaderboard lists
  const leaderboards = StorageService.getLeaderboards(user);
  const currentList = leaderboards[scope] || leaderboards.global;

  // Filter list safely by nickname or grade without leaking full names or schools
  const filteredList = currentList.filter((p) => {
    // If user chose private mode and it's not the current user, hide them
    if (p.privacyMode === 'private' && !p.isCurrentUser) {
      return false;
    }

    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const nameToSearch = (p.displayName || p.safeNickname || p.fullName || '').toLowerCase();
    return nameToSearch.includes(term);
  });

  const top3 = filteredList.slice(0, 3);
  const remaining = filteredList.slice(3);

  // Positive badges mapping for positions 4+ to eliminate negative ranking pressure
  const getEncouragingBadge = (rank: number, streak: number = 1): string => {
    if (rank <= 3) return '';
    if (streak >= 7) return 'Chuyên Cần Vàng 🏆';
    if (streak >= 3) return 'Chăm Chỉ Bền Bỉ 🔥';
    if (rank <= 6) return 'Hạt Giống Tri Thức 🌱';
    if (rank <= 10) return 'Bạn Học Tích Cực ⭐';
    return 'Người Học Kiên Trì 🧭';
  };

  const handleSavePrivacy = async () => {
    const val = validateSafeNickname(customNickname);
    if (!val.isValid) {
      setNicknameError(val.message || 'Biệt danh không hợp lệ.');
      return;
    }
    setNicknameError('');

    const newSettings: StudentPrivacySettings = {
      leaderboardMode: selectedMode,
      safeNickname: customNickname.trim(),
      hideSchool: hideSchool,
      allowFriendSearch: false,
    };

    const updated = StorageService.updatePrivacySettings(newSettings);
    if (updated) {
      if (onUserUpdate) onUserUpdate(updated);

      // Also sync to server-side endpoint if available
      try {
        await fetch('/api/user/privacy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: updated.id,
            leaderboardMode: selectedMode,
            safeNickname: customNickname.trim(),
            hideSchool: hideSchool,
          }),
        });
      } catch {
        // Non-fatal if offline
      }

      soundManager.playCorrect();
      setPrivacyToast('Đã lưu thiết lập quyền riêng tư thành công! Thông tin của em luôn được an toàn.');
      setTimeout(() => setPrivacyToast(null), 4000);
      setShowPrivacyModal(false);
    }
  };

  const handleRollRandomNickname = () => {
    const randomPick = generateSafeNickname(user.grade);
    setCustomNickname(randomPick);
    soundManager.playCoin();
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      {/* Toast */}
      {privacyToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{privacyToast}</span>
        </div>
      )}

      {/* Main Header with Child Protection & Privacy Banner */}
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 sm:p-8 rounded-3xl text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[11px] font-bold text-amber-100 border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
              <span>Bảo vệ quyền riêng tư & An toàn dữ liệu học sinh</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <span>🏆</span>
              <span>Đấu Trường Học Tập & Tiến Bộ Tri Thức</span>
            </h1>
            <p className="text-xs sm:text-sm text-orange-100 leading-relaxed font-medium">
              Không gian thi đua học tập lành mạnh, tích cực dành cho các bạn nhỏ. Mọi thông tin cá nhân và trường học được bảo vệ an toàn theo chuẩn giáo dục phổ thông.
            </p>
          </div>

          {/* Privacy Status & Quick Button */}
          <div className="bg-white/15 backdrop-blur-md p-4 rounded-2xl border border-white/25 flex flex-col gap-2 shrink-0 sm:min-w-[240px]">
            <div className="text-[11px] text-orange-100 font-semibold flex items-center gap-1">
              <span>Trạng thái hiển thị của bạn:</span>
            </div>
            <div className="flex items-center gap-2">
              {currentPrivacy.leaderboardMode === 'private' ? (
                <span className="px-2.5 py-1 rounded-xl bg-slate-900/60 text-slate-100 font-bold text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                  Riêng tư (Ẩn khỏi BXH)
                </span>
              ) : currentPrivacy.leaderboardMode === 'custom_name' ? (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-950/60 text-emerald-200 font-bold text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                  {currentPrivacy.safeNickname}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-xl bg-blue-950/60 text-blue-200 font-bold text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                  {currentPrivacy.safeNickname || 'Biệt danh an toàn'}
                </span>
              )}
            </div>

            <button
              onClick={() => {
                setSelectedMode(currentPrivacy.leaderboardMode);
                setCustomNickname(currentPrivacy.safeNickname || generateSafeNickname(user.grade));
                setHideSchool(currentPrivacy.hideSchool !== false);
                setShowPrivacyModal(true);
              }}
              className="mt-1 w-full py-2 px-3 bg-white hover:bg-orange-50 text-orange-950 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
              <span>Cài Đặt Quyền Riêng Tư</span>
            </button>
          </div>
        </div>

        {/* Tab switcher: Leaderboard vs Personal Growth */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-white/20">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'leaderboard'
                ? 'bg-white text-orange-950 shadow-md font-black'
                : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Bảng Vinh Danh Học Tập</span>
          </button>

          <button
            onClick={() => setActiveTab('personal_growth')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'personal_growth'
                ? 'bg-white text-orange-950 shadow-md font-black'
                : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Hành Trình Tiến Bộ Của Em 🌟</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: PERSONAL GROWTH & ENCOURAGEMENT */}
      {activeTab === 'personal_growth' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Daily Motivational Message Box */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-3xl border border-amber-200/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-xs shrink-0">
              💌
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Lời nhắn khích lệ hôm nay
              </div>
              <div className="text-sm sm:text-base font-extrabold text-slate-800 italic">
                {currentQuote}
              </div>
            </div>
          </div>

          {/* Personal Progress Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl shrink-0">
                <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">Chuỗi ngày chuyên cần</div>
                <div className="text-xl font-black text-slate-800">
                  {user.dailyStreak || 1} ngày liên tiếp
                </div>
                <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                  Thói quen học tập tuyệt vời!
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl shrink-0">
                ⭐
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">Tổng điểm tích lũy</div>
                <div className="text-xl font-black text-slate-800">
                  {user.xp.toLocaleString()} XP
                </div>
                <div className="text-[11px] text-amber-600 font-bold mt-0.5">
                  Cấp độ {user.level} (Mục tiêu: Cấp {user.level + 1})
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center text-2xl shrink-0">
                🎖️
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">Huy hiệu đạt được</div>
                <div className="text-xl font-black text-slate-800">
                  {user.unlockedAchievements?.length || 0} danh hiệu
                </div>
                <div className="text-[11px] text-purple-600 font-bold mt-0.5">
                  Ghi nhận nỗ lực xuất sắc
                </div>
              </div>
            </div>
          </div>

          {/* Mindset Philosophy: Growth vs Pressure */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Triết Lý Học Tập Tích Cực Dành Cho Học Sinh
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-600">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/60 space-y-2">
                <span className="font-extrabold text-blue-900 text-sm flex items-center gap-1.5">
                  🌱 Tập trung vào sự tiến bộ của bản thân
                </span>
                <p>
                  Thứ hạng chỉ là một trò chơi vui nhộn. Điều quý giá nhất là ngày hôm nay bạn hiểu thêm một công thức mới, giải được một bài toán hay và tự tin hơn ngày hôm qua.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 space-y-2">
                <span className="font-extrabold text-emerald-900 text-sm flex items-center gap-1.5">
                  🛡️ An toàn thông tin là trên hết
                </span>
                <p>
                  Bạn luôn có toàn quyền chọn xuất hiện bằng biệt danh ngộ nghĩnh hoặc giữ chế độ riêng tư. Không ai có thể biết thông tin cá nhân hay đánh giá bạn tiêu cực.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LEADERBOARD DISPLAY */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Controls: Search & Scope Filter Tabs */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Scope tabs */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
              {[
                { id: 'global', name: 'Toàn Hệ Thống', icon: '🌍' },
                { id: 'grade', name: `Khối Lớp ${user.grade}`, icon: '🎒' },
                { id: 'friends', name: 'Nhóm Bạn Học', icon: '👥' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setScope(tab.id as typeof scope)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    scope === tab.id
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-200 scale-102'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>

            {/* Safe Search Box (Search only safe nicknames) */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm bạn học bằng biệt danh..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* TOP 3 PODIUM - Child-friendly, Positive Encouragement */}
          {top3.length >= 3 && !searchTerm && (
            <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-3">
              {/* Rank 2 (Silver) */}
              <div className="bg-white rounded-3xl p-4 sm:p-5 border-2 border-slate-200/90 shadow-xs flex flex-col items-center justify-end text-center relative pt-8">
                <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-black shadow-xs">
                  🥈 Hạng 2
                </span>
                <div className="text-4xl sm:text-5xl mb-2">{top3[1].avatar}</div>
                <div className="text-xs sm:text-sm font-black text-slate-800 truncate w-full">
                  {top3[1].displayName || top3[1].safeNickname || top3[1].fullName}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Lớp {top3[1].grade}
                </div>
                <div className="mt-2.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">
                  ⭐ {top3[1].xp} XP
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                  {top3[1].encouragingBadge || 'Tiến Bộ Xuất Sắc 🌟'}
                </div>
              </div>

              {/* Rank 1 (Gold - Elevated) */}
              <div className="bg-gradient-to-b from-amber-50 to-white rounded-3xl p-4 sm:p-6 border-2 border-amber-400 shadow-md shadow-amber-100 flex flex-col items-center justify-end text-center relative pt-9 -translate-y-1.5">
                <span className="absolute -top-4 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-black shadow-md flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" /> Quán Quân
                </span>
                <div className="text-5xl sm:text-6xl mb-2 animate-bounce">{top3[0].avatar}</div>
                <div className="text-sm sm:text-base font-black text-slate-900 truncate w-full">
                  {top3[0].displayName || top3[0].safeNickname || top3[0].fullName}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Lớp {top3[0].grade}
                </div>
                <div className="mt-2.5 px-4 py-1.5 rounded-xl bg-amber-400 text-amber-950 text-xs font-black shadow-xs">
                  ⭐ {top3[0].xp} XP
                </div>
                <div className="text-[10px] text-amber-700 mt-1 font-bold">
                  {top3[0].encouragingBadge || 'Quán Quân Chuyên Cần 👑'}
                </div>
              </div>

              {/* Rank 3 (Bronze) */}
              <div className="bg-white rounded-3xl p-4 sm:p-5 border-2 border-amber-700/20 shadow-xs flex flex-col items-center justify-end text-center relative pt-8">
                <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-black shadow-xs">
                  🥉 Hạng 3
                </span>
                <div className="text-4xl sm:text-5xl mb-2">{top3[2].avatar}</div>
                <div className="text-xs sm:text-sm font-black text-slate-800 truncate w-full">
                  {top3[2].displayName || top3[2].safeNickname || top3[2].fullName}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Lớp {top3[2].grade}
                </div>
                <div className="mt-2.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-800 text-xs font-black">
                  ⭐ {top3[2].xp} XP
                </div>
                <div className="text-[10px] text-amber-600 mt-1 font-semibold">
                  {top3[2].encouragingBadge || 'Bộ Não Siêu Phàm 🧠'}
                </div>
              </div>
            </div>
          )}

          {/* FULL LEADERBOARD LIST - Zero Negative Stigmatization */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Danh sách bạn học thi đua ({filteredList.length} bạn)
              </span>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                Tất cả tên học sinh được ẩn danh hóa an toàn
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredList.map((entry, idx) => {
                const isMe = entry.isCurrentUser || entry.id === user.id;
                const encouragingTag = entry.encouragingBadge || getEncouragingBadge(idx + 1, entry.streak);

                return (
                  <div
                    key={entry.id}
                    className={`p-4 flex items-center justify-between transition-colors ${
                      isMe ? 'bg-amber-50/90 font-bold border-l-4 border-amber-500' : 'hover:bg-slate-50'
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
                          <span className="font-extrabold text-xs sm:text-sm text-slate-500">
                            #{idx + 1}
                          </span>
                        )}
                      </div>

                      <div className="text-3xl sm:text-4xl shrink-0 relative">
                        {entry.avatar}
                        {entry.avatarFrame && (
                          <span className="absolute -top-2 -right-1 text-xs">{entry.avatarFrame}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-slate-800 truncate">
                            {entry.displayName || entry.safeNickname || entry.fullName}
                          </span>
                          {isMe && (
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-md font-bold">
                              Bạn
                            </span>
                          )}
                          {isMe && entry.privacyMode === 'private' && (
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[9px] rounded font-semibold flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Riêng tư
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                          <span>Khối Lớp {entry.grade}</span>
                          {encouragingTag && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-semibold text-[10px]">
                              {encouragingTag}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs sm:text-sm font-black text-amber-600">
                        ⭐ {entry.xp} XP
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Cấp {entry.level}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PRIVACY SETTINGS MODAL */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg">
                  🛡️
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-800">
                    Bảo Vệ Quyền Riêng Tư Của Em
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dành riêng cho lứa tuổi học sinh: An toàn, thân thiện, bảo mật
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Chọn chế độ hiển thị trên bảng xếp hạng:
              </label>

              {/* Option 1: Anonymous Safe Nickname (Recommended) */}
              <div
                onClick={() => setSelectedMode('anonymous')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  selectedMode === 'anonymous'
                    ? 'border-amber-500 bg-amber-50/60'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5 text-xl">🛡️</div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-slate-800">
                      Biệt danh an toàn (Được khuyến nghị)
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-bold">
                      Chuẩn COPPA
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Hệ thống sẽ chỉ hiển thị biệt danh ngộ nghĩnh (ví dụ: "Học Sinh Mặt Trời ☀️"). Tên thật và trường học của em được bảo vệ tuyệt đối.
                  </p>
                </div>
              </div>

              {/* Option 2: Completely Private */}
              <div
                onClick={() => setSelectedMode('private')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  selectedMode === 'private'
                    ? 'border-amber-500 bg-amber-50/60'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5 text-xl">🔒</div>
                <div className="space-y-0.5">
                  <div className="font-extrabold text-xs text-slate-800">
                    Chế độ riêng tư hoàn toàn
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Hồ sơ của em sẽ KHÔNG xuất hiện trên bất kỳ bảng xếp hạng công khai nào. Em chỉ nhìn thấy điểm số của chính mình để theo dõi tiến bộ.
                  </p>
                </div>
              </div>

              {/* Option 3: Custom Safe Name */}
              <div
                onClick={() => setSelectedMode('custom_name')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  selectedMode === 'custom_name'
                    ? 'border-amber-500 bg-amber-50/60'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5 text-xl">🌟</div>
                <div className="space-y-0.5">
                  <div className="font-extrabold text-xs text-slate-800">
                    Tên hiển thị tự chọn an toàn
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Em có thể tự đặt một tên gọi yêu thích đã được hệ thống kiểm duyệt (không chứa số điện thoại hay email).
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Nickname Input with Roll Button */}
            {selectedMode !== 'private' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Biệt danh an toàn của em:
                  </label>
                  <button
                    type="button"
                    onClick={handleRollRandomNickname}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer flex items-center gap-1"
                  >
                    🎲 Đổi biệt danh ngẫu nhiên
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={customNickname}
                    onChange={(e) => {
                      setCustomNickname(e.target.value);
                      setNicknameError('');
                    }}
                    placeholder="VD: Nhà Thám Hiểm Toán Học 🚀"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {nicknameError && (
                  <div className="text-[11px] text-rose-600 font-bold">
                    ⚠️ {nicknameError}
                  </div>
                )}
              </div>
            )}

            {/* Hide School Toggle */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <School className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-xs font-bold text-slate-800">Ẩn tên trường học của em</div>
                  <div className="text-[10px] text-slate-500">Giữ bí mật vị trí và ngôi trường em đang theo học</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hideSchool}
                onChange={(e) => setHideSchool(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSavePrivacy}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Lưu Thiết Lập</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
