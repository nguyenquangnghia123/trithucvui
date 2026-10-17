import React, { useState } from 'react';
import { GameModeId, SubjectId, GradeLevel, UserProfile } from '../types';
import { GAME_MODES } from '../data/gameModes';
import { SUBJECTS } from '../data/subjects';
import { soundManager } from '../services/sound';
import { Sparkles, Play, ShieldAlert, Heart, Trophy, Zap, Flame } from 'lucide-react';

interface GamesHubViewProps {
  user: UserProfile;
  initialSubjectId?: SubjectId;
  onStartGame: (mode: GameModeId, subject: SubjectId, grade: GradeLevel, level: number) => void;
  onOpenRechargeModal?: () => void;
  onOpenQuestionGenerator?: () => void;
}

export const GamesHubView: React.FC<GamesHubViewProps> = ({
  user,
  initialSubjectId = 'toan',
  onStartGame,
  onOpenRechargeModal,
  onOpenQuestionGenerator,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameModeId>('dau_truong');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>(initialSubjectId);
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(user.grade);
  const [selectedLevel, setSelectedLevel] = useState<number>(user.initialRecommendedLevel || 2);

  const activeModeInfo = GAME_MODES.find((m) => m.id === selectedMode) || GAME_MODES[0];
  const activeSubjectInfo = SUBJECTS.find((s) => s.id === selectedSubject) || SUBJECTS[0];

  const levelsList = [
    { lvl: 1, name: 'Làm quen', desc: 'Khởi động nhẹ nhàng, củng cố kiến thức' },
    { lvl: 2, name: 'Cơ bản', desc: 'Nắm vững các quy tắc và định nghĩa chuẩn' },
    { lvl: 3, name: 'Khá', desc: 'Áp dụng bài toán tư duy linh hoạt' },
    { lvl: 4, name: 'Nâng cao', desc: 'Phản xạ nhanh với câu hỏi vận dụng' },
    { lvl: 5, name: 'Thử thách', desc: 'Chinh phục độ khó cao, nhân đôi XP' },
    { lvl: 6, name: 'Chuyên gia', desc: 'Đỉnh cao trí tuệ, nhận huy hiệu siêu cấp' },
  ];

  const handleLaunch = () => {
    if (user.hearts <= 0) {
      soundManager.playIncorrect();
      if (onOpenRechargeModal) onOpenRechargeModal();
      return;
    }
    soundManager.playCoin();
    onStartGame(selectedMode, selectedSubject, selectedGrade, selectedLevel);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <span>🎮</span>
            Trung Tâm 8 Trò Chơi Học Tập Gamified
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Mỗi chế độ mang một trải nghiệm tương tác độc đáo, phù hợp đúng chương trình Lớp {selectedGrade}!
          </p>
        </div>

        {/* Current Hearts Status */}
        <div className="flex items-center gap-2 bg-rose-50 px-4 py-2 rounded-2xl border border-rose-200 self-start md:self-auto">
          <Heart className="w-5 h-5 text-rose-500 fill-rose-500 animate-pulse" />
          <div>
            <div className="text-xs font-bold text-rose-800">
              {user.hearts}/5 Tim Năng Lượng
            </div>
            <div className="text-[10px] text-rose-600 font-medium">
              {user.hearts > 0 ? 'Sẵn sàng thi đấu' : 'Cần hồi tim trước khi chơi'}
            </div>
          </div>
        </div>
      </div>

      {/* AI GENERATOR PROMO BANNER */}
      {onOpenQuestionGenerator && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shrink-0 shadow-xs">
              ✨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base">
                  Tạo Vô Hạn Câu Hỏi với Gemini & Google Search
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] uppercase">
                  Mới
                </span>
              </div>
              <p className="text-xs text-indigo-100 mt-0.5">
                Tự động tìm kiếm tài liệu mới nhất, đảm bảo 100% không trùng lặp câu hỏi cũ theo từng môn và khối lớp {user.grade}!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenQuestionGenerator}
            id="games-hub-open-ai-gen-btn"
            className="px-5 py-2.5 bg-white hover:bg-amber-50 text-indigo-900 rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            Tạo Đề Mới Ngay ✨
          </button>
        </div>
      )}

      {/* STEP 1: SELECT GAME MODE (8 DISTINCT MODES) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-500 text-white text-xs flex items-center justify-center font-bold">1</span>
            Chọn Chế Độ Trò Chơi
          </h2>
          <span className="text-xs text-slate-500 font-bold text-indigo-600">8 game modes đa dạng</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {GAME_MODES.map((mode) => {
            const isSelected = mode.id === selectedMode;
            return (
              <div
                key={mode.id}
                onClick={() => {
                  setSelectedMode(mode.id);
                  soundManager.playCoin();
                }}
                className={`p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between text-left ${
                  isSelected
                    ? `${mode.bgGradient} border-amber-500 shadow-md scale-[1.02]`
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{mode.icon}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {mode.badge}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-slate-800 mb-1">
                    {mode.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-3">
                    {mode.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold">
                  <span className={isSelected ? 'text-amber-700' : 'text-slate-400'}>
                    {isSelected ? '✓ Đang chọn' : 'Chọn mode'}
                  </span>
                  <span>→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 2: SELECT SUBJECT & GRADE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SUBJECT SELECTION */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-500 text-white text-xs flex items-center justify-center font-bold">2</span>
            Chọn Môn Học Thử Thách
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSubject(s.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  selectedSubject === s.id
                    ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <span className="text-2xl shrink-0">{s.icon}</span>
                <span className="text-xs sm:text-sm truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* GRADE SELECTION */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-500 text-white text-xs flex items-center justify-center font-bold">3</span>
            Chọn Lớp Đang Học (Lớp 1 - 12)
          </h2>

          <div className="grid grid-cols-6 gap-1.5">
            {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as GradeLevel[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGrade(g)}
                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  selectedGrade === g
                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs scale-105'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Lớp {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* STEP 3: SELECT DIFFICULTY LEVEL (1 to 6) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">4</span>
            Chọn Cấp Độ Thử Thách (Level 1 - 6)
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Độ khó tăng dần theo từng cấp độ
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {levelsList.map(({ lvl, name, desc }) => {
            const isSelected = selectedLevel === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedLevel(lvl)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 shadow-sm scale-105 ring-2 ring-emerald-300'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-800">
                      Level {lvl}
                    </span>
                    <span className="text-sm">
                      {lvl === 1 ? '🌱' : lvl === 2 ? '⭐' : lvl === 3 ? '🔥' : lvl === 4 ? '⚡' : lvl === 5 ? '👑' : '💎'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-700">{name}</div>
                  <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* LAUNCH BAR BANNER */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-5 sm:p-6 rounded-3xl text-white shadow-xl shadow-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">{activeModeInfo.icon}</span>
            <span className="font-extrabold text-lg sm:text-xl">
              {activeModeInfo.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/25 text-white font-bold text-xs">
              {activeSubjectInfo.name} • Lớp {selectedGrade}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-300 text-amber-950 font-black text-xs">
              Level {selectedLevel}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-amber-100 font-medium">
            Luật chơi: {activeModeInfo.subtitle} • Đúng nhận XP & Xu, Sai trừ 1 tim.
          </p>
        </div>

        <button
          onClick={handleLaunch}
          id="btn-launch-game"
          className="px-8 py-4 bg-white hover:bg-amber-50 text-slate-900 rounded-2xl font-black text-base shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <Play className="w-5 h-5 fill-slate-900" />
          BẮT ĐẦU CHƠI NGAY!
        </button>
      </div>
    </div>
  );
};
