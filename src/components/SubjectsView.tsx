import React, { useState } from 'react';
import { SubjectInfo, SubjectId, GradeLevel, UserProfile } from '../types';
import { SUBJECTS } from '../data/subjects';
import { Sparkles, ArrowRight, BookOpen, Star, CheckCircle2, Search } from 'lucide-react';

interface SubjectsViewProps {
  user: UserProfile;
  onSelectSubject: (subjectId: SubjectId, topic?: string) => void;
  onSearchQuestions?: (subjectId: SubjectId, topic?: string) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  user,
  onSelectSubject,
  onSearchQuestions,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(user.grade);
  const [activeSubjectId, setActiveSubjectId] = useState<SubjectId>('toan');

  const activeSubject = SUBJECTS.find((s) => s.id === activeSubjectId) || SUBJECTS[0];
  const userStats = user.subjectStats[activeSubjectId] || {
    answeredCount: 0,
    correctCount: 0,
    proficiency: 'Cơ bản',
  };

  const accuracy = userStats.answeredCount > 0
    ? Math.round((userStats.correctCount / userStats.answeredCount) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <span>📚</span>
            Chương Trình 5 Môn Học Chuẩn Lớp 1 - 12
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Chọn môn học và chuyên đề yêu thích để bắt đầu luyện tập qua các trò chơi tương tác!
          </p>
        </div>

        {/* Grade selector pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap mr-1">
            Lớp học:
          </span>
          {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as GradeLevel[]).map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGrade(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedGrade === g
                  ? 'bg-amber-500 text-white shadow-xs scale-105'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Lớp {g}
            </button>
          ))}
        </div>
      </div>

      {/* 5 Subjects Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {SUBJECTS.map((subj) => {
          const isCurrentActive = subj.id === activeSubjectId;
          const stat = user.subjectStats[subj.id];
          const prof = stat?.proficiency || 'Cơ bản';

          return (
            <div
              key={subj.id}
              onClick={() => setActiveSubjectId(subj.id)}
              className={`p-4 rounded-3xl border-2 transition-all cursor-pointer text-left flex flex-col justify-between ${
                isCurrentActive
                  ? 'bg-white shadow-lg border-amber-500 scale-[1.02]'
                  : 'bg-white/80 border-slate-200/80 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl shadow-xs">
                    {subj.icon}
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {prof}
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-slate-800 mb-1">
                  {subj.name}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {subj.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">
                  {subj.topics.length} chuyên đề
                </span>
                <span className={`font-bold ${isCurrentActive ? 'text-amber-600' : 'text-slate-500'}`}>
                  {isCurrentActive ? 'Đang xem' : 'Chọn môn →'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail view of selected subject */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center text-3xl shadow-md shadow-orange-200">
              {activeSubject.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800">
                  {activeSubject.name} - Lớp {selectedGrade}
                </h2>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-xs">
                  {userStats.proficiency}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                {activeSubject.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div className="text-center px-2">
              <div className="text-[11px] text-slate-500 font-semibold">Đã trả lời</div>
              <div className="text-base font-black text-slate-800">{userStats.answeredCount} câu</div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center px-2">
              <div className="text-[11px] text-slate-500 font-semibold">Chính xác</div>
              <div className="text-base font-black text-emerald-600">{accuracy}%</div>
            </div>
            {onSearchQuestions && (
              <button
                onClick={() => onSearchQuestions(activeSubject.id)}
                className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                title={`Tra cứu ngân hàng câu hỏi môn ${activeSubject.name}`}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tra cứu câu hỏi</span>
              </button>
            )}
            <button
              onClick={() => onSelectSubject(activeSubject.id)}
              className="ml-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              Vào Chơi Môn Này <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Topics List */}
        <div className="mt-6">
          <h3 className="font-extrabold text-base text-slate-800 mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Các Chuyên Đề Trọng Tâm Của Môn {activeSubject.name}:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {activeSubject.topics.map((topic, idx) => (
              <div
                key={idx}
                onClick={() => onSelectSubject(activeSubject.id, topic)}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-300 transition-all cursor-pointer group flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200 group-hover:border-amber-400 group-hover:text-amber-700">
                    0{idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 group-hover:text-amber-900">
                      {topic}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Luyện tập & Chinh phục câu hỏi
                    </div>
                  </div>
                </div>

                <span className="text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all">
                  →
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
