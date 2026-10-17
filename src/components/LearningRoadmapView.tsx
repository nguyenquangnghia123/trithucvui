import React from 'react';
import { UserProfile, SubjectId } from '../types';
import { SUBJECTS } from '../data/subjects';
import { 
  Compass, 
  Target, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  TrendingUp, 
  Brain, 
  BookOpen,
  Award,
  Zap,
  RotateCcw
} from 'lucide-react';
import { LEVEL_MILESTONE_REWARDS, MAX_LEVEL, getLevelProgress } from '../data/levelConfig';

interface LearningRoadmapViewProps {
  user: UserProfile;
  onStartTargetedPractice: (subject: SubjectId, topic?: string) => void;
  onRetakePlacement?: () => void;
}

export const LearningRoadmapView: React.FC<LearningRoadmapViewProps> = ({
  user,
  onStartTargetedPractice,
  onRetakePlacement,
}) => {
  const xpProgress = getLevelProgress(user.xp);

  // Analyze actual data from wrongQuestionsHistory and subjectStats
  const mistakesBySubject: Record<SubjectId, number> = {
    toan: 0,
    tieng_anh: 0,
    tin_hoc: 0,
    ngu_van: 0,
    khoa_hoc: 0,
  };

  const mistakesByTopic: Record<string, { count: number; subject: SubjectId }> = {};

  (user.wrongQuestionsHistory || []).forEach((item) => {
    if (mistakesBySubject[item.subject] !== undefined) {
      mistakesBySubject[item.subject] += 1;
    }
    if (!mistakesByTopic[item.topic]) {
      mistakesByTopic[item.topic] = { count: 0, subject: item.subject };
    }
    mistakesByTopic[item.topic].count += 1;
  });

  // Top weak topics sorted by mistake count
  const sortedWeakTopics = Object.entries(mistakesByTopic)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([topic, data]) => ({
      topic,
      subject: data.subject,
      mistakes: data.count,
    }));

  // Primary recommendation: either from recorded mistakes or placement test focus
  const primaryWeakTopic = sortedWeakTopics[0]?.topic || user.recommendedFocus?.shouldPractice?.[0] || 'Phép tính và Logic';
  const primaryWeakSubject: SubjectId = sortedWeakTopics[0]?.subject || user.favoriteSubject || 'toan';

  const strongTopics = user.recommendedFocus?.strongAt || ['Kỹ năng nhận diện và tư duy nhanh'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-xs font-bold text-indigo-100">
            <Brain className="w-4 h-4 text-amber-300" />
            <span>Phân Tích Năng Lực Học Tập Lớp {user.grade}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Lộ Trình Học Tập & Đề Xuất Cá Nhân Hóa
          </h1>

          <p className="text-sm text-indigo-100 leading-relaxed">
            Dựa trên {user.questionHistory?.length || 0} câu hỏi đã thực hiện, kết quả kiểm tra đầu vào và tỷ lệ chính xác theo thời gian thực.
          </p>
        </div>
      </div>

      {/* Primary Adaptive Recommendation Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/20 rounded-full text-xs font-black uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5 text-amber-200" />
            Đề Xuất Trọng Tâm Hôm Nay
          </div>
          <h2 className="text-xl sm:text-2xl font-black">
            Bạn nên luyện thêm: <span className="underline decoration-amber-200">{primaryWeakTopic}</span>
          </h2>
          <p className="text-xs sm:text-sm text-orange-100 max-w-xl">
            Hệ thống phát hiện đây là phần kiến thức bạn gặp nhiều thử thách nhất. Rèn luyện ngay 5 câu hỏi để củng cố và tăng điểm tích lũy!
          </p>
        </div>

        <button
          onClick={() => onStartTargetedPractice(primaryWeakSubject, primaryWeakTopic)}
          id="btn-practice-recommended-topic"
          className="px-8 py-4 bg-white hover:bg-slate-50 text-orange-600 font-black text-sm sm:text-base rounded-2xl shadow-xl hover:shadow-2xl flex items-center gap-2 cursor-pointer transition-transform active:scale-[0.98] shrink-0"
        >
          <Zap className="w-5 h-5 fill-orange-500 text-orange-500" />
          LUYỆN NGAY
        </button>
      </div>

      {/* Grid: Weaknesses vs Strengths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identified Weak Areas */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
              <Compass className="w-5 h-5 text-amber-500" />
              Chủ Đề Cần Cải Thiện
            </h3>
            <span className="text-xs text-slate-400 font-semibold">Theo dữ liệu thực tế</span>
          </div>

          <div className="space-y-3">
            {sortedWeakTopics.length > 0 ? (
              sortedWeakTopics.map((item, idx) => {
                const subjMeta = SUBJECTS.find((s) => s.id === item.subject);
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{subjMeta?.icon || '📚'}</span>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-amber-950">
                          {item.topic}
                        </div>
                        <div className="text-[11px] text-amber-700">
                          {subjMeta?.name} • Đã sai {item.mistakes} lần
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onStartTargetedPractice(item.subject, item.topic)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-sm"
                    >
                      Luyện tập
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">
                Chưa ghi nhận nhiều lỗi sai! Tiếp tục thi đấu để hệ thống tinh chỉnh đề xuất.
              </div>
            )}
          </div>
        </div>

        {/* Identified Strengths */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Chủ Đề Thế Mạnh Của Bạn
            </h3>
            <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
              Độ chính xác cao
            </span>
          </div>

          <div className="space-y-3">
            {strongTopics.map((topicStr, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-emerald-600 font-black text-sm">✓</span>
                  <span className="font-bold text-xs sm:text-sm text-emerald-950">
                    {topicStr}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                  Vững vàng
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5 Subjects Proficiency Breakdown */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-lg text-slate-800">
              Đánh Giá 5 Môn Học Trọng Tâm
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật theo chương trình chuẩn kiến thức Lớp {user.grade}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {SUBJECTS.map((subj) => {
            const stat = user.subjectStats[subj.id] || { answeredCount: 0, correctCount: 0, proficiency: 'Mới bắt đầu' };
            const accuracy = stat.answeredCount > 0 ? Math.round((stat.correctCount / stat.answeredCount) * 100) : 0;

            return (
              <div
                key={subj.id}
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{subj.icon}</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    {stat.proficiency}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-800">{subj.name}</h4>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {stat.correctCount} / {stat.answeredCount} đúng ({accuracy}%)
                  </div>
                </div>

                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${accuracy}%` }}
                  />
                </div>

                <button
                  onClick={() => onStartTargetedPractice(subj.id)}
                  className="w-full py-2 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Luyện tập môn này
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Level 1-300 Progression Roadmap */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Lộ Trình Cấp Độ: Level {user.level} / {MAX_LEVEL}
            </h3>
            <p className="text-xs text-slate-500">
              Tổng tích lũy: {user.xp.toLocaleString()} XP • Cần thêm {xpProgress.remainingXpToNext.toLocaleString()} XP để lên Level {user.level + 1}
            </p>
          </div>
        </div>

        {/* Milestone Cards Carousel / Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {[5, 10, 25, 50, 100, 200, 300].map((lvl) => {
            const isUnlocked = user.level >= lvl;
            const reward = LEVEL_MILESTONE_REWARDS[lvl];

            return (
              <div
                key={lvl}
                className={`p-3 rounded-2xl border text-center space-y-1.5 transition-all ${
                  isUnlocked
                    ? 'border-amber-300 bg-amber-50/80 text-amber-900 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                <div className="text-xs font-black">Level {lvl}</div>
                <div className="text-xl">{isUnlocked ? '🏆' : '🔒'}</div>
                <div className="text-[10px] font-bold text-slate-600 line-clamp-1">
                  {reward?.title || `Mốc ${lvl}`}
                </div>
                <div className="text-[10px] text-amber-600 font-semibold">
                  +{reward?.coins || 0} Xu
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
