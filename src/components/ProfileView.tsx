import React, { useState } from 'react';
import { UserProfile, GradeLevel, SubjectId } from '../types';
import { SUBJECTS } from '../data/subjects';
import { StorageService } from '../services/storage';
import { soundManager } from '../services/sound';
import { auth, FirebaseDataService } from '../services/firebase';
import { 
  User, 
  Settings, 
  BookOpen, 
  LogOut, 
  CheckCircle2, 
  Award, 
  Heart, 
  Coins, 
  Flame, 
  Target, 
  School,
  Sparkles,
  Edit2,
  Cloud,
  CloudCheck,
  RefreshCw
} from 'lucide-react';

interface ProfileViewProps {
  user: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUserUpdate,
  onLogout,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [grade, setGrade] = useState<GradeLevel>(user.grade);
  const [school, setSchool] = useState(user.school || '');
  const [favoriteSubject, setFavoriteSubject] = useState<SubjectId>(user.favoriteSubject);
  const [learningGoal, setLearningGoal] = useState(user.learningGoal);
  const [saveToast, setSaveToast] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleManualSync = async () => {
    if (!auth.currentUser) {
      setSyncStatus('Bạn đang dùng tài khoản khách cục bộ. Hãy đăng nhập Google để đồng bộ dữ liệu đám mây!');
      setTimeout(() => setSyncStatus(null), 4000);
      return;
    }
    setIsSyncing(true);
    try {
      await FirebaseDataService.syncUserProfile(user);
      soundManager.playCorrect();
      setSyncStatus('Đã đồng bộ thành công dữ liệu hồ sơ và tiến độ lên Firestore!');
    } catch (err: any) {
      setSyncStatus(`Lỗi đồng bộ: ${err.message || 'Không thể kết nối Firestore'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  // Available avatars to pick from
  const avatarChoices = ['🧑‍🎓', '👧', '👦', '🦸', '🧙', '🧑‍🚀', '🥷', '🐱', '🦊', '🦁'];
  const frameChoices = [null, '👑', '⭐', '💎', '🔥', '🌸'];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...user,
      fullName: fullName.trim() || user.fullName,
      grade,
      school: school.trim(),
      favoriteSubject,
      learningGoal: learningGoal.trim() || user.learningGoal,
    };

    StorageService.saveUserProfile(updated);
    onUserUpdate(updated);
    setIsEditing(false);
    soundManager.playCorrect();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleSelectAvatar = (av: string) => {
    const updated = { ...user, avatar: av };
    StorageService.saveUserProfile(updated);
    onUserUpdate(updated);
    soundManager.playCoin();
  };

  const handleSelectFrame = (frame: string | null) => {
    const updated = { ...user, avatarFrame: frame };
    StorageService.saveUserProfile(updated);
    onUserUpdate(updated);
    soundManager.playCoin();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Toast */}
      {saveToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Đã lưu thông tin hồ sơ thành công!
        </div>
      )}

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          {/* Avatar with frame */}
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-amber-100 to-orange-200 border-2 border-amber-300 flex items-center justify-center text-6xl shadow-inner">
              {user.avatar}
            </div>
            {user.avatarFrame && (
              <span className="absolute -top-3 -right-2 text-3xl drop-shadow-md">
                {user.avatarFrame}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800">
                {user.fullName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                Lớp {user.grade}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-black">
                Cấp độ {user.level}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-900 text-xs font-black flex items-center gap-1 border border-orange-200 shadow-xs">
                <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                Chuỗi {user.dailyStreak || 1} ngày
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              @{user.username} • {user.email || 'Học sinh chính thức'}
            </p>

            <div className="text-xs text-slate-600 flex items-center justify-center sm:justify-start gap-1.5 pt-1 font-medium">
              <School className="w-3.5 h-3.5 text-slate-400" />
              <span>{user.school || 'Trường Phổ Thông'}</span>
            </div>

            <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-xl font-semibold inline-block border border-amber-200/60">
              🎯 {user.learningGoal}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto"
            title="Đồng bộ dữ liệu điểm số, huy hiệu, tiến độ lên Firebase Firestore"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng Bộ Firestore'}</span>
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {isEditing ? 'Đóng Chỉnh Sửa' : 'Sửa Hồ Sơ'}
          </button>

          <button
            onClick={onLogout}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng Xuất
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Key Metrics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
            <Flame className="w-6 h-6 text-white fill-white animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-orange-700 uppercase tracking-wider">Daily Streak</div>
            <div className="text-lg font-black text-orange-950">
              {user.dailyStreak || 1} <span className="text-xs font-semibold text-orange-700">ngày</span>
            </div>
            <div className="text-[10px] text-orange-600 font-medium">Kỷ lục: {Math.max(user.highestStreak || 0, user.dailyStreak || 1)} ngày</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
            <Coins className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Kho báu Xu</div>
            <div className="text-lg font-black text-amber-950">{user.coins.toLocaleString()}</div>
            <div className="text-[10px] text-amber-600 font-medium">Đổi quà cửa hàng</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-4 border border-rose-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Năng lượng</div>
            <div className="text-lg font-black text-rose-950">{user.hearts}/{user.maxHearts} Tim</div>
            <div className="text-[10px] text-rose-600 font-medium">Hồi 1 tim/3 phút</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-4 border border-indigo-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-500 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Trận Đã Chơi</div>
            <div className="text-lg font-black text-indigo-950">{user.totalGamesPlayed || 0}</div>
            <div className="text-[10px] text-indigo-600 font-medium">Học sinh tích cực</div>
          </div>
        </div>
      </div>

      {/* Quick Avatar & Frame Customizer */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Chọn Nhanh Avatar & Khung Vinh Danh
        </h3>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-slate-500 mb-2 font-semibold">Chọn hình đại diện:</div>
            <div className="flex flex-wrap gap-2">
              {avatarChoices.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => handleSelectAvatar(av)}
                  className={`w-11 h-11 rounded-2xl text-2xl flex items-center justify-center border transition-all cursor-pointer ${
                    user.avatar === av
                      ? 'bg-amber-100 border-amber-400 scale-110 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-2 font-semibold">Chọn khung danh hiệu:</div>
            <div className="flex flex-wrap gap-2">
              {frameChoices.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectFrame(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                    user.avatarFrame === f
                      ? 'bg-purple-100 text-purple-900 border-purple-400 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>{f || '🚫 Không dùng'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form (Collapsible) */}
      {isEditing && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-blue-300 shadow-md space-y-4 animate-in fade-in"
        >
          <h3 className="font-extrabold text-base text-slate-800">
            Chỉnh Sửa Thông Tin Học Sinh
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Họ và Tên
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Khối Lớp
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value) as GradeLevel)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>
                    Lớp {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Trường Học
              </label>
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="VD: THCS Lê Quý Đôn"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Môn Học Yêu Thích
              </label>
              <select
                value={favoriteSubject}
                onChange={(e) => setFavoriteSubject(e.target.value as SubjectId)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Mục Tiêu Học Tập
              </label>
              <input
                type="text"
                value={learningGoal}
                onChange={(e) => setLearningGoal(e.target.value)}
                placeholder="VD: Chinh phục điểm 10 môn Toán học kỳ này"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              Lưu Cập Nhật
            </button>
          </div>
        </form>
      )}

      {/* Comprehensive Subject Proficiency Matrix */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Năng Lực & Trình Độ Từng Môn Học
            </h3>
            <p className="text-xs text-slate-500">
              Được tự động cập nhật liên tục dựa trên kết quả các bài kiểm tra và trò chơi
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {SUBJECTS.map((subj) => {
            const stat = user.subjectStats[subj.id] || {
              answeredCount: 0,
              correctCount: 0,
              proficiency: 'Cơ bản',
            };
            const acc = stat.answeredCount > 0 ? Math.round((stat.correctCount / stat.answeredCount) * 100) : 0;

            return (
              <div
                key={subj.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <span className="text-xl">{subj.icon}</span>
                    {subj.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                    {stat.proficiency}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 text-center bg-white p-2 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Đã làm</div>
                    <div className="font-bold text-slate-700">{stat.answeredCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Đúng</div>
                    <div className="font-bold text-emerald-600">{stat.correctCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Chính xác</div>
                    <div className="font-bold text-purple-600">{acc}%</div>
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
