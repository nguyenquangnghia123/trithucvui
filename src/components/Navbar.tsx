import React, { useState } from 'react';
import { UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { soundManager } from '../services/sound';
import { 
  Heart, 
  Coins, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  RotateCcw,
  BookOpen,
  Award,
  ShoppingBag,
  User as UserIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Trophy,
  Search,
  Bot,
  ShieldCheck
} from 'lucide-react';

interface NavbarProps {
  user: UserProfile | null;
  activeTab: string;
  onNavigate?: (tab: string) => void;
  onSelectTab?: (tab: string) => void;
  onUserUpdate?: (user: UserProfile) => void;
  onOpenSettings?: () => void;
  onOpenLogin?: () => void;
  onOpenHeartModal?: () => void;
  onOpenQuestionGenerator?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  onNavigate,
  onSelectTab,
  onUserUpdate,
  onOpenSettings,
  onOpenLogin,
  onOpenHeartModal,
  onOpenQuestionGenerator,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());
  const [showHeartInfo, setShowHeartInfo] = useState(false);

  const handleNav = (tab: string) => {
    if (onNavigate) onNavigate(tab);
    else if (onSelectTab) onSelectTab(tab);
  };

  const xpProg = user
    ? StorageService.getXpProgress(user.xp, user.level)
    : { current: 0, max: 100, percent: 0 };

  const handleToggleSound = () => {
    const next = soundManager.toggleSound();
    setSoundEnabled(next);
    if (next) soundManager.playCoin();
  };

  const handleRechargeHearts = () => {
    const updated = StorageService.rechargeHearts();
    if (updated && onUserUpdate) {
      onUserUpdate(updated);
      soundManager.playCorrect();
      setShowHeartInfo(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div 
          onClick={() => handleNav('home')} 
          className="flex items-center gap-2.5 cursor-pointer group select-none"
          id="nav-brand-logo"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-200 text-xl font-bold group-hover:scale-105 transition-transform">
            ✨
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 bg-clip-text text-transparent">
                TRI THỨC VUI
              </span>
              {user && (
                <span className="text-xs px-2 py-0.5 font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                  Lớp {user.grade}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">Đấu trường học tập Gamified</p>
          </div>
        </div>

        {/* Level & XP bar (when logged in) */}
        {user ? (
          <div className="hidden lg:flex items-center gap-3 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs rounded-md shadow-xs">
                LV.{user.level}
              </span>
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                  <span>XP</span>
                  <span>{xpProg.current} / {xpProg.max}</span>
                </div>
                <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500" 
                    style={{ width: `${xpProg.percent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Currency & Hearts Stats OR Login Button */}
        {user ? (
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Hearts */}
            <div className="relative">
              <button
                onClick={() => {
                  if (onOpenHeartModal) {
                    onOpenHeartModal();
                  } else {
                    setShowHeartInfo(!showHeartInfo);
                  }
                }}
                id="nav-hearts-button"
                className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-xl cursor-pointer transition-colors shadow-xs"
                title="Số tim còn lại - Bấm để hồi tim"
              >
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
                <span className="text-xs sm:text-sm font-bold text-rose-700">
                  {user.hearts}/{user.maxHearts}
                </span>
              </button>

              {/* Heart dropdown fallback */}
              {showHeartInfo && !onOpenHeartModal && (
                <div className="absolute right-0 mt-2 w-64 p-3.5 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                      Năng lượng học tập
                    </h4>
                    <span className="text-xs text-slate-500 font-semibold">{user.hearts}/5 tim</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Mỗi câu trả lời sai mất 1 tim. Tim tự động hồi phục 1 tim mỗi 3 phút học sinh nghỉ ngơi.
                  </p>
                  <div className="flex gap-1 mb-3 justify-center py-1 bg-rose-50/60 rounded-xl">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className="text-lg">
                        {i < user.hearts ? '❤️' : '🤍'}
                      </span>
                    ))}
                  </div>
                  {user.hearts < user.maxHearts && (
                    <button
                      onClick={handleRechargeHearts}
                      className="w-full py-1.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Nghỉ ngơi 1 phút & Hồi đầy tim
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Coins */}
            <div 
              onClick={() => handleNav('shop')}
              id="nav-coins-button"
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-xl cursor-pointer transition-colors shadow-xs"
              title="Số xu tích lũy - Bấm để vào Cửa Hàng"
            >
              <div className="w-4 h-4 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center text-[10px] font-black">
                🪙
              </div>
              <span className="text-xs sm:text-sm font-bold text-amber-800">
                {user.coins.toLocaleString()}
              </span>
            </div>

            {/* Quick AI Question Generator button */}
            <button
              onClick={() => {
                if (onOpenQuestionGenerator) {
                  onOpenQuestionGenerator();
                } else {
                  handleNav('ai-tutor');
                }
              }}
              id="nav-quick-question-gen-btn"
              className="p-2 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-xs"
              title="Tạo vô hạn câu hỏi bằng Gemini & Google Search"
            >
              <Sparkles className="w-4 h-4 text-violet-600 animate-pulse" />
              <span className="hidden xl:inline text-[11px]">Tạo Câu Hỏi AI</span>
            </button>

            {/* Quick AI Tutor button */}
            <button
              onClick={() => handleNav('ai-tutor')}
              id="nav-quick-ai-tutor-btn"
              className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                activeTab === 'ai-tutor'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-500 shadow-xs'
                  : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
              }`}
              title="Hỏi riêng Gia Sư AI"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Hỏi Gia Sư AI</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            {/* Quick Search button */}
            <button
              onClick={() => handleNav('search')}
              id="nav-quick-search-btn"
              className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold ${
                activeTab === 'search'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 border-slate-200/80'
              }`}
              title="Tìm kiếm câu hỏi"
            >
              <Search className="w-4 h-4" />
              <span className="hidden lg:inline text-[11px]">Tìm câu hỏi</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={handleToggleSound}
              id="nav-sound-toggle"
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200/80 transition-colors"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Settings */}
            <button
              onClick={() => {
                if (onOpenSettings) onOpenSettings();
                else handleNav('profile');
              }}
              id="nav-settings-button"
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200/80 transition-colors"
              title="Cài đặt hồ sơ"
            >
              <SettingsIcon className="w-4 h-4 text-slate-600" />
            </button>

            {/* Profile pill */}
            <div 
              onClick={() => handleNav('profile')}
              id="nav-profile-button"
              className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl hover:bg-slate-100 border border-slate-200/80 cursor-pointer transition-colors"
            >
              <div className="relative">
                <span className="text-xl leading-none">{user.avatar}</span>
                {user.avatarFrame && (
                  <span className="absolute -top-2 -right-1 text-xs">
                    {user.avatarFrame}
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[90px]">
                  {user.fullName.split(' ').slice(-1)[0]}
                </div>
                <div className="text-[10px] text-slate-500">Lớp {user.grade}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenLogin}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              Đăng Nhập / Đăng Ký
            </button>
          </div>
        )}
      </div>

      {/* Main Nav Bar Tabs */}
      <div className="bg-slate-50/90 border-t border-slate-200/60 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-1 py-1.5 text-xs font-semibold">
          <button
            onClick={() => handleNav('home')}
            id="nav-tab-home"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'home'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <HomeIcon className="w-3.5 h-3.5" />
            Trang Chủ
          </button>

          <button
            onClick={() => handleNav('games')}
            id="nav-tab-games"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'games'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            🎮 Chơi Ngay
          </button>

          <button
            onClick={() => handleNav('subjects')}
            id="nav-tab-subjects"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'subjects'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            📚 Môn Học
          </button>

          <button
            onClick={() => handleNav('roadmap')}
            id="nav-tab-roadmap"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'roadmap'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            🧭 Cách Học
          </button>

          <button
            onClick={() => handleNav('ai-tutor')}
            id="nav-tab-ai-tutor"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'ai-tutor'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            🤖 Gia Sư AI
          </button>

          <button
            onClick={() => handleNav('quality-control')}
            id="nav-tab-quality-control"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'quality-control'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 hover:text-emerald-900 border border-emerald-200/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            🛡️ Kiểm Định SGK
          </button>

          <button
            onClick={() => handleNav('search')}
            id="nav-tab-search"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'search'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            🔍 Tìm Câu Hỏi
          </button>

          <button
            onClick={() => handleNav('leaderboard')}
            id="nav-tab-leaderboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            🏆 Bảng Xếp Hạng
          </button>

          <button
            onClick={() => handleNav('achievements')}
            id="nav-tab-achievements"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'achievements'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            🎖️ Thành Tích
          </button>

          <button
            onClick={() => handleNav('shop')}
            id="nav-tab-shop"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'shop'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            🛒 Cửa Hàng
          </button>

          <button
            onClick={() => handleNav('profile')}
            id="nav-tab-profile"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'profile'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            👤 Hồ Sơ
          </button>
        </div>
      </div>
    </header>
  );
};
