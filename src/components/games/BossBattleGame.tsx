import React, { useState, useEffect, useRef } from 'react';
import { Question, SubjectId, GradeLevel, UserProfile, QuizResult } from '../../types';
import { getQuestionsForGame } from '../../data/questions';
import { soundManager } from '../../services/sound';
import { StorageService } from '../../services/storage';
import confetti from 'canvas-confetti';
import {
  Sword,
  Shield,
  Zap,
  Skull,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  Flame,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Heart,
  Scale
} from 'lucide-react';
import { QuestionDisputeModal } from '../QuestionDisputeModal';

interface BossBattleGameProps {
  user: UserProfile;
  subject: SubjectId;
  grade: GradeLevel;
  level: number;
  customQuestions?: Question[];
  onFinish: (result: QuizResult) => void;
  onExit: () => void;
}

type BattlePhase =
  | 'question'         // Waiting for player to answer
  | 'player_attacking'// Player attack animation and damage to Boss
  | 'boss_attacking'  // Boss attack animation and damage to Player
  | 'turn_resolved'   // Turn ended, showing explanations and next button
  | 'victory'         // Boss HP <= 0, player wins
  | 'defeat';         // Player HP <= 0, player loses

interface CombatLogEntry {
  id: string;
  actor: 'player' | 'boss';
  type: 'hit' | 'miss' | 'crit';
  text: string;
  damage?: number;
}

interface WrongAnswerRecord {
  question: Question;
  selectedIndex: number;
}

const BOSS_THEMES: Record<
  SubjectId,
  { name: string; avatar: string; subtitle: string; skills: { normal: string; crit: string } }
> = {
  toan: {
    name: 'Quái Thú Nghịch Đảo Phương Trình',
    avatar: '👾',
    subtitle: 'Chúa Tể Ma Trận & Bẫy Đại Số',
    skills: { normal: 'Ma Trận Hỗn Loạn', crit: 'Tia Sét Nghịch Đảo Định Lý' },
  },
  ngu_van: {
    name: 'Trùm Rối Loạn Ngữ Pháp',
    avatar: '👹',
    subtitle: 'Kẻ Bẻ Cong Dấu Câu & Chính Tả',
    skills: { normal: 'Cơn Mưa Chữ Đảo Lộn', crit: 'Tiếng Gầm Bão Táp Ngữ Pháp' },
  },
  tieng_anh: {
    name: 'Vocabulary Phantom (Bóng Ma Quên Từ)',
    avatar: '🦇',
    subtitle: 'Chúa Tể Bẫy Chia Thì & Cụm Động Từ',
    skills: { normal: 'Shadow Word Trap', crit: 'Grammar Chaos Explosion' },
  },
  khoa_hoc: {
    name: 'Hắc Thần Nghịch Chuyển Tự Nhiên',
    avatar: '⚡',
    subtitle: 'Kẻ Phá Vỡ Quy Luật Vật Lý & Sinh Thái',
    skills: { normal: 'Sóng Từ Nhiễu Loạn', crit: 'Thiên Thạch Phản Vật Chất' },
  },
  tin_hoc: {
    name: 'Siêu Virus Bug Vô Hạn',
    avatar: '🤖',
    subtitle: 'Trùm Cuối Mã Độc Trì Hoãn',
    skills: { normal: 'Tràn Bộ Nhớ Stack Overflow', crit: 'Tấn Công Từ Chối Dịch Vụ DDoS' },
  },
};

export const BossBattleGame: React.FC<BossBattleGameProps> = ({
  user,
  subject,
  grade,
  level,
  customQuestions,
  onFinish,
  onExit,
}) => {
  // Required HP Specifications
  const MAX_BOSS_HP = 1000;
  const MAX_PLAYER_HP = 100;

  const [bossHp, setBossHp] = useState(MAX_BOSS_HP);
  const [playerHp, setPlayerHp] = useState(MAX_PLAYER_HP);
  const [phase, setPhase] = useState<BattlePhase>('question');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Turn battle states & animations
  const [isPlayerAttacking, setIsPlayerAttacking] = useState(false);
  const [isBossAttacking, setIsBossAttacking] = useState(false);
  const [isPlayerHurt, setIsPlayerHurt] = useState(false);
  const [isBossHurt, setIsBossHurt] = useState(false);
  const [screenShake, setScreenShake] = useState(false);

  const [lastPlayerDmg, setLastPlayerDmg] = useState<number | null>(null);
  const [lastBossDmg, setLastBossDmg] = useState<number | null>(null);

  // Battle score & rewards
  const [combo, setCombo] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  // Combat log feed
  const [combatLogs, setCombatLogs] = useState<CombatLogEntry[]>([
    {
      id: 'init',
      actor: 'boss',
      type: 'hit',
      text: '👹 Trùm Cuối xuất hiện với 1000 HP! Trả lời đúng để tấn công Boss, nếu trả lời sai Boss sẽ phản công!',
    },
  ]);

  // Review mistakes list
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerRecord[]>([]);
  const [showWrongAnswersReview, setShowWrongAnswersReview] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  const handleResolveAppeal = (refundHeart: boolean, bonusXp: number, bonusCoins: number) => {
    if (refundHeart) {
      setPlayerHp((prev) => Math.min(MAX_PLAYER_HP, prev + 35));
      setCorrectCount((prev) => prev + 1);
      setWrongCount((prev) => Math.max(0, prev - 1));
      setCombatLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          actor: 'player',
          type: 'crit',
          text: '🎉 Trọng Tài Sư Phạm phê duyệt phúc khảo! Phục hồi 35 HP cho người chơi!',
        },
        ...prev.slice(0, 15),
      ]);
    }
    if (bonusXp > 0) setEarnedXp((prev) => prev + bonusXp);
    if (bonusCoins > 0) setEarnedCoins((prev) => prev + bonusCoins);
  };

  // Ref to prevent double-firing attacks
  const isExecutingTurnRef = useRef(false);

  // Boss Theme lookup
  const bossTheme = BOSS_THEMES[subject] || {
    name: 'Quái Thú Trì Hoãn & Mất Tập Trung',
    avatar: '👹',
    subtitle: 'Trùm Cuối Đại Chiến Tri Thức',
    skills: { normal: 'Cào Cấu Hỗn Loạn', crit: 'Gầm Rú Lười Biếng Địa Ngục' },
  };

  // Initialize questions
  useEffect(() => {
    if (customQuestions && customQuestions.length > 0) {
      setQuestions(customQuestions);
    } else {
      // Fetch 8 questions to allow an epic fight
      const list = getQuestionsForGame(grade, subject, level, 8, user.questionHistory || []);
      setQuestions(list);
    }
  }, [grade, subject, level, customQuestions]);

  const currentQ = questions[currentIndex];

  // =========================================================================
  // TWO-WAY TURN-BASED COMBAT ENGINE
  // =========================================================================
  const handleConfirmAnswer = () => {
    if (selectedOption === null || phase !== 'question' || !currentQ || isExecutingTurnRef.current) {
      return;
    }

    isExecutingTurnRef.current = true;
    const isCorrect = selectedOption === currentQ.correctIndex;

    // -----------------------------------------------------------------------
    // STEP 1: PLAYER'S TURN
    // -----------------------------------------------------------------------
    setPhase('player_attacking');
    setIsPlayerAttacking(true);

    let playerDmg = 0;
    if (isCorrect) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      setCorrectCount((prev) => prev + 1);
      soundManager.playCorrect();
      soundManager.playSlash();

      // Damage formula: ~200 base + level bonus + difficulty bonus + combo bonus
      const comboBonus = (newCombo - 1) * 25;
      playerDmg = Math.round(195 + level * 10 + currentQ.difficulty * 20 + comboBonus);
      setLastPlayerDmg(playerDmg);

      const coinGain = 40 * level + newCombo * 10;
      const xpGain = 50 * level + newCombo * 15;
      setEarnedCoins((prev) => prev + coinGain);
      setEarnedXp((prev) => prev + xpGain);

      setCombatLogs((prev) => [
        {
          id: `player_${Date.now()}`,
          actor: 'player',
          type: newCombo >= 2 ? 'crit' : 'hit',
          text: `⚔️ Bạn trả lời ĐÚNG! Tung đòn Trí Tuệ${newCombo >= 2 ? ` (Combo x${newCombo} 🔥)` : ''} gây ${playerDmg} sát thương lên Boss!`,
          damage: playerDmg,
        },
        ...prev.slice(0, 4),
      ]);
    } else {
      setCombo(0);
      setWrongCount((prev) => prev + 1);
      soundManager.playIncorrect();
      setLastPlayerDmg(0);
      setWrongAnswers((prev) => [...prev, { question: currentQ, selectedIndex: selectedOption }]);

      setCombatLogs((prev) => [
        {
          id: `player_${Date.now()}`,
          actor: 'player',
          type: 'miss',
          text: `❌ Bạn trả lời SAI! Đòn đánh Trí Tuệ hụt (gây 0 sát thương)!`,
          damage: 0,
        },
        ...prev.slice(0, 4),
      ]);
    }

    // After player's attack animation reaches the Boss (500ms)
    setTimeout(() => {
      setIsPlayerAttacking(false);

      if (playerDmg > 0) {
        soundManager.playHit();
        setIsBossHurt(true);
        setTimeout(() => setIsBossHurt(false), 550);
      }

      setBossHp((prevBossHp) => {
        const nextBossHp = Math.max(0, prevBossHp - playerDmg);

        // Check if BOSS is defeated by player's attack!
        if (nextBossHp <= 0) {
          setTimeout(() => {
            soundManager.playVictory();
            confetti({
              particleCount: 100,
              spread: 90,
              origin: { y: 0.5 },
            });
            setPhase('victory');
            isExecutingTurnRef.current = false;
          }, 600);
          return 0;
        }

        // -------------------------------------------------------------------
        // STEP 2: BOSS'S COUNTERATTACK TURN (Boss is still alive)
        // -------------------------------------------------------------------
        setTimeout(() => {
          setPhase('boss_attacking');
          setIsBossAttacking(true);
          soundManager.playBossRoar();

          const bossSkill = isCorrect ? bossTheme.skills.normal : bossTheme.skills.crit;

          // Sát thương của Boss:
          // Nếu người chơi đúng: Khiên Tri Thức đỡ đòn, Boss chỉ gây 10 - 15 HP
          // Nếu người chơi sai: Boss cuồng nộ tung đòn bạo kích 25 - 35 HP!
          const bossDmg = isCorrect
            ? Math.round(11 + Math.random() * 4)
            : Math.round(26 + Math.random() * 8);

          setLastBossDmg(bossDmg);

          // Boss strike connects after windup (500ms)
          setTimeout(() => {
            setIsBossAttacking(false);
            setIsPlayerHurt(true);
            soundManager.playHit();
            setScreenShake(true);

            setTimeout(() => {
              setIsPlayerHurt(false);
              setScreenShake(false);
            }, 500);

            setCombatLogs((prev) => [
              {
                id: `boss_${Date.now()}`,
                actor: 'boss',
                type: isCorrect ? 'hit' : 'crit',
                text: isCorrect
                  ? `👹 Boss phản công với [${bossSkill}]! Khiên Tri Thức giảm tải, bạn nhận ${bossDmg} sát thương.`
                  : `💥 Boss chớp thời cơ tung [${bossSkill}] BẠO KÍCH! Bạn nhận ${bossDmg} sát thương!`,
                damage: bossDmg,
              },
              ...prev.slice(0, 4),
            ]);

            setPlayerHp((prevPlayerHp) => {
              const nextPlayerHp = Math.max(0, prevPlayerHp - bossDmg);

              // Check if PLAYER is defeated by boss's attack!
              if (nextPlayerHp <= 0) {
                setTimeout(() => {
                  soundManager.playIncorrect();
                  setPhase('defeat');
                  isExecutingTurnRef.current = false;
                }, 600);
                return 0;
              }

              // Both turns completed safely. Ready for next round!
              setPhase('turn_resolved');
              isExecutingTurnRef.current = false;
              return nextPlayerHp;
            });
          }, 500);
        }, 550);

        return nextBossHp;
      });
    }, 500);
  };

  // Move to next question or evaluate conclusion
  const handleNextTurn = () => {
    if (bossHp <= 0) {
      finalizeBossBattle(true);
      return;
    }
    if (playerHp <= 0) {
      finalizeBossBattle(false);
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setLastPlayerDmg(null);
      setLastBossDmg(null);
      setPhase('question');
    } else {
      // If questions ran out but both are still alive, summon 4 sudden death questions!
      const extraQuestions = getQuestionsForGame(
        grade,
        subject,
        level,
        4,
        questions.map((q) => q.id)
      );

      if (extraQuestions.length > 0) {
        setQuestions((prev) => [...prev, ...extraQuestions]);
        setCurrentIndex((prev) => prev + 1);
        setSelectedOption(null);
        setLastPlayerDmg(null);
        setLastBossDmg(null);
        setPhase('question');
      } else {
        // If question bank exhausted, judge by damage dealt
        const playerWon = bossHp <= 300 || playerHp > 40;
        finalizeBossBattle(playerWon);
      }
    }
  };

  // Restart match from defeat screen
  const handleRetryBattle = () => {
    setBossHp(MAX_BOSS_HP);
    setPlayerHp(MAX_PLAYER_HP);
    setCurrentIndex(0);
    setSelectedOption(null);
    setPhase('question');
    setCombo(0);
    setEarnedCoins(0);
    setEarnedXp(0);
    setCorrectCount(0);
    setWrongCount(0);
    setWrongAnswers([]);
    setLastPlayerDmg(null);
    setLastBossDmg(null);
    setShowWrongAnswersReview(false);
    isExecutingTurnRef.current = false;

    // Refresh question list
    const freshQuestions = getQuestionsForGame(grade, subject, level, 8, user.questionHistory || []);
    setQuestions(freshQuestions);
  };

  // Save game results and call parent callback
  const finalizeBossBattle = (isDefeatWin: boolean) => {
    const bossDefeated = isDefeatWin || bossHp <= 0;
    const bossBonusCoins = bossDefeated ? 250 : 30;
    const bossBonusXp = bossDefeated ? 300 : 40;

    const unlockedIds = [...user.unlockedAchievements];
    if (bossDefeated && !unlockedIds.includes('boss_slayer')) {
      unlockedIds.push('boss_slayer');
    }

    // Sync remaining hearts based on remaining HP percentage
    const remainingHearts = bossDefeated
      ? Math.max(1, Math.ceil((playerHp / MAX_PLAYER_HP) * 5))
      : Math.max(0, Math.ceil((playerHp / MAX_PLAYER_HP) * 5));

    const updatedUser: UserProfile = {
      ...user,
      hearts: remainingHearts,
      coins: user.coins + earnedCoins + bossBonusCoins,
      xp: user.xp + earnedXp + bossBonusXp,
      unlockedAchievements: unlockedIds,
      totalGamesPlayed: user.totalGamesPlayed + 1,
    };

    const oldLevel = user.level;
    updatedUser.level = StorageService.calculateLevel(updatedUser.xp);
    StorageService.saveUserProfile(updatedUser);

    onFinish({
      gameMode: 'dau_boss',
      subject,
      level,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      xpEarned: earnedXp + bossBonusXp,
      coinsEarned: earnedCoins + bossBonusCoins,
      remainingHearts,
      newAchievements: [],
      leveledUp: updatedUser.level > oldLevel,
      newLevel: updatedUser.level,
    });
  };

  if (!currentQ && phase !== 'victory' && phase !== 'defeat') {
    return (
      <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
        <div className="text-4xl animate-bounce mb-3">👹</div>
        <p className="font-extrabold text-base text-slate-700">Đang triệu hồi Trùm Cuối Tri Thức...</p>
      </div>
    );
  }

  // Health percentages (clamped 0 - 100)
  const bossHpPercent = Math.max(0, Math.min(100, Math.round((bossHp / MAX_BOSS_HP) * 100)));
  const playerHpPercent = Math.max(0, Math.min(100, Math.round((playerHp / MAX_PLAYER_HP) * 100)));

  return (
    <div
      className={`max-w-2xl mx-auto space-y-4 pb-12 transition-transform duration-100 ${
        screenShake ? 'animate-shake' : ''
      }`}
    >
      {/* Top Match Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
        {/* Player mini HP indicator */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-sm font-black text-emerald-700">
            {user.avatar}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">Máu Của Bạn</div>
            <div className="text-xs font-black text-emerald-700 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              {playerHp} / {MAX_PLAYER_HP} HP
            </div>
          </div>
        </div>

        {/* Round Badge */}
        <div className="text-xs font-black text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-xs">
          <Skull className="w-4 h-4 text-rose-600" />
          Hiệp {currentIndex + 1}
          {questions.length > 0 && ` / ${questions.length}`}
          {combo >= 2 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold animate-pulse">
              Combo x{combo}!
            </span>
          )}
        </div>

        {/* Exit button */}
        <button
          onClick={onExit}
          className="text-xs font-bold text-slate-400 hover:text-rose-600 px-2.5 py-1 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
        >
          Rút lui
        </button>
      </div>

      {/* =================================================================== */}
      {/* 2-WAY ARENA BATTLEFIELD */}
      {/* =================================================================== */}
      <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-rose-950 p-5 sm:p-6 rounded-3xl text-white shadow-2xl border-2 border-rose-600/70 relative overflow-hidden space-y-4">
        {/* Atmospheric battle particles / grid backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

        {/* ==================== BOSS HP BAR ==================== */}
        <div className="relative z-10 max-w-md mx-auto space-y-1.5 bg-black/40 p-2.5 rounded-2xl border border-rose-500/30">
          <div className="flex justify-between items-center text-xs font-extrabold">
            <span className="text-rose-300 flex items-center gap-1.5 truncate">
              <span>{bossTheme.avatar}</span>
              <span className="truncate uppercase tracking-wide">{bossTheme.name}</span>
            </span>
            <span className="text-amber-400 font-mono font-black shrink-0">
              {bossHp} / {MAX_BOSS_HP} HP
            </span>
          </div>

          <div className="w-full h-4 bg-slate-950 rounded-full border border-rose-600/60 overflow-hidden p-0.5 shadow-inner relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                bossHpPercent > 50
                  ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-red-600'
                  : bossHpPercent > 20
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 animate-pulse'
                  : 'bg-red-600 animate-ping'
              }`}
              style={{ width: `${bossHpPercent}%` }}
            />
          </div>
        </div>

        {/* ==================== ARENA COMBATANTS ==================== */}
        <div className="relative z-10 py-3 sm:py-5 flex items-center justify-between px-2 sm:px-6">
          {/* PLAYER FIGHTER SIDE (LEFT) */}
          <div className="text-center relative flex-1 max-w-[150px]">
            {/* Floating Damage above Player */}
            {lastBossDmg !== null && lastBossDmg > 0 && isPlayerHurt && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-red-400 font-black text-base sm:text-lg animate-bounce drop-shadow-[0_2px_8px_rgba(239,68,68,0.8)] whitespace-nowrap z-20">
                -{lastBossDmg} HP!
              </div>
            )}

            {/* Player Avatar Sprite */}
            <div
              className={`text-5xl sm:text-6xl select-none inline-block transition-transform duration-300 ${
                isPlayerAttacking
                  ? 'translate-x-8 sm:translate-x-12 scale-125 rotate-6 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.9)]'
                  : isPlayerHurt
                  ? '-translate-x-4 scale-95 rotate-[-12deg] filter drop-shadow-[0_0_15px_rgba(239,68,68,0.9)]'
                  : 'animate-bounce'
              }`}
            >
              {playerHp > 0 ? user.avatar : '😵'}
            </div>

            <div className="mt-1.5 font-black text-xs text-slate-200 truncate">
              {user.fullName.split(' ').slice(-1)[0] || 'Chiến Binh'}
            </div>

            {/* Player Mini Health Bar */}
            <div className="mt-1 w-full bg-slate-950 rounded-full h-2.5 border border-emerald-500/50 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  playerHpPercent > 50
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                    : playerHpPercent > 25
                    ? 'bg-amber-400'
                    : 'bg-rose-500 animate-pulse'
                }`}
                style={{ width: `${playerHpPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-emerald-300 font-bold font-mono mt-0.5">
              {playerHp} / {MAX_PLAYER_HP} HP
            </div>
          </div>

          {/* CLASH CENTER STAGE */}
          <div className="flex flex-col items-center justify-center px-2">
            <div className="w-10 h-10 rounded-2xl bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-lg">
              {isPlayerAttacking ? (
                <Zap className="w-6 h-6 text-amber-300 animate-spin" />
              ) : isBossAttacking ? (
                <Flame className="w-6 h-6 text-red-500 animate-bounce" />
              ) : (
                <Sword className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <span className="text-[10px] font-mono font-black text-rose-400 mt-1">VS</span>
          </div>

          {/* BOSS FIGHTER SIDE (RIGHT) */}
          <div className="text-center relative flex-1 max-w-[150px]">
            {/* Floating Damage above Boss */}
            {lastPlayerDmg !== null && lastPlayerDmg > 0 && isBossHurt && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-amber-300 font-black text-base sm:text-lg animate-bounce drop-shadow-[0_2px_8px_rgba(245,158,11,0.9)] whitespace-nowrap z-20">
                -{lastPlayerDmg} HP!
              </div>
            )}

            {/* Boss Avatar Sprite */}
            <div
              className={`text-6xl sm:text-7xl select-none inline-block transition-transform duration-300 ${
                isBossAttacking
                  ? '-translate-x-8 sm:-translate-x-12 scale-125 rotate-[-8deg] filter drop-shadow-[0_0_20px_rgba(239,68,68,0.9)]'
                  : isBossHurt
                  ? 'translate-x-4 scale-95 rotate-12 filter brightness-150 drop-shadow-[0_0_20px_rgba(255,255,255,0.9)]'
                  : bossHp <= 0
                  ? 'opacity-20 scale-50 rotate-90'
                  : 'hover:scale-105'
              }`}
            >
              {bossHp > 0 ? bossTheme.avatar : '💥'}
            </div>

            <div className="mt-1.5 font-black text-xs text-rose-300 truncate">
              {bossTheme.name.split(' ')[0]} {bossTheme.name.split(' ')[1]}
            </div>

            {/* Boss Subtitle */}
            <div className="text-[10px] text-rose-400/80 italic truncate">
              {bossHp > 0 ? (bossHp < 350 ? '🔥 ĐANG CUỒNG NỘ' : 'Trùm Cuối') : 'ĐÃ BỊ HẠ GỤC'}
            </div>
          </div>
        </div>

        {/* ==================== LIVE COMBAT LOG BANNER ==================== */}
        <div className="relative z-10 bg-black/60 rounded-2xl p-2.5 sm:p-3 border border-slate-700/60 text-left space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1 text-amber-400">
              <Zap className="w-3.5 h-3.5" /> Nhật Ký Đòn Đánh 2 Chiều:
            </span>
            <span className="text-[10px] text-slate-500">Cập nhật thời gian thực</span>
          </div>

          <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
            {combatLogs.slice(0, 2).map((log) => (
              <div
                key={log.id}
                className={`text-xs font-semibold py-0.5 px-2 rounded-lg flex items-center justify-between ${
                  log.actor === 'player'
                    ? log.type === 'hit' || log.type === 'crit'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                      : 'bg-rose-950/40 text-rose-300 border border-rose-900/30'
                    : log.type === 'crit'
                    ? 'bg-red-950/80 text-red-200 border border-red-700/60 font-bold'
                    : 'bg-slate-900/80 text-slate-300 border border-slate-700/40'
                }`}
              >
                <span className="truncate mr-2">{log.text}</span>
                {log.damage !== undefined && (
                  <span
                    className={`font-mono font-bold text-[11px] shrink-0 ${
                      log.actor === 'player' ? 'text-amber-400' : 'text-rose-400'
                    }`}
                  >
                    {log.damage > 0 ? `-${log.damage} HP` : '0 HP'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VICTORY OVERLAY SCREEN (Boss HP <= 0) */}
      {/* =================================================================== */}
      {phase === 'victory' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-amber-300 shadow-xl text-center space-y-5 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-4xl shadow-lg shadow-amber-200">
            🏆
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 bg-amber-100 text-amber-900 font-black text-xs rounded-full uppercase tracking-wider">
              Chiến Tích Vang Dội
            </span>
            <h2 className="text-2xl font-black text-slate-800">
              BẠN ĐÃ ĐÁNH BẠI TRÙM CUỐI!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Quái thú đã tan biến hoàn toàn trước tri thức vô địch của bạn. Nhận chiến lợi phẩm siêu cấp!
            </p>
          </div>

          {/* Reward Badges */}
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <div className="text-[11px] text-amber-700 font-bold">Xu Thưởng Boss</div>
              <div className="text-xl font-black text-amber-800">+{earnedCoins + 250} Xu</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
              <div className="text-[11px] text-blue-700 font-bold">XP Thưởng Boss</div>
              <div className="text-xl font-black text-blue-800">+{earnedXp + 300} XP</div>
            </div>
          </div>

          <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs font-bold text-purple-900 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Mở Khóa Danh Hiệu: <strong>Sát Thủ Diệt Trùm (Boss Slayer)</strong>
          </div>

          <button
            onClick={() => finalizeBossBattle(true)}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-200 hover:scale-102 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            Thu Nhận Chiến Lợi Phẩm & Tiếp Tục
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* DEFEAT OVERLAY SCREEN (Player HP <= 0) */}
      {/* =================================================================== */}
      {phase === 'defeat' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-rose-300 shadow-xl text-center space-y-5 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-100 flex items-center justify-center text-4xl shadow-inner border border-rose-200">
            💀
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 bg-rose-100 text-rose-800 font-black text-xs rounded-full uppercase tracking-wider">
              Hết Máu Chiến Đấu
            </span>
            <h2 className="text-2xl font-black text-slate-800">
              BẠN ĐÃ BỊ TRÙM CUỐI ĐÁNH BẠI!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Quái thú quá hung hãn khi bạn sơ hở! Thất bại là mẹ của thành công, hãy chuẩn bị tri thức và phục thù ngay!
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 text-left space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Tổng kết trận đánh:
            </div>
            <div>• Số câu trả lời đúng: <strong className="text-emerald-600">{correctCount}</strong></div>
            <div>• Số câu trả lời sai: <strong className="text-rose-600">{wrongCount}</strong></div>
            <div>• Sát thương đã gây lên Boss: <strong className="text-slate-800">{MAX_BOSS_HP - bossHp} / {MAX_BOSS_HP} HP</strong></div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5">
            <button
              onClick={handleRetryBattle}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-2xl font-black text-sm shadow-md shadow-rose-200 hover:scale-102 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Tái Đấu Ngay Lập Tức (Phục Thù!)
            </button>

            {wrongAnswers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowWrongAnswersReview(!showWrongAnswersReview)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-slate-600" />
                {showWrongAnswersReview ? 'Ẩn Xem Lại Câu Sai' : `Xem Lại ${wrongAnswers.length} Câu Đã Trả Lời Sai`}
              </button>
            )}

            <button
              onClick={() => finalizeBossBattle(false)}
              className="w-full py-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs transition-colors cursor-pointer"
            >
              Rút lui về Sảnh Trò Chơi
            </button>
          </div>

          {/* Expandable Review of Wrong Answers */}
          {showWrongAnswersReview && wrongAnswers.length > 0 && (
            <div className="text-left space-y-3 pt-3 border-t border-slate-200 max-h-64 overflow-y-auto">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">
                📖 Ôn Luyện Lại Đáp Án Đúng:
              </span>
              {wrongAnswers.map((item, idx) => (
                <div key={idx} className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl text-xs space-y-1.5">
                  <div className="font-bold text-slate-800">
                    Câu {idx + 1}: {item.question.content}
                  </div>
                  <div className="text-rose-700">
                    ❌ Bạn đã chọn: {item.question.options[item.selectedIndex]}
                  </div>
                  <div className="text-emerald-700 font-bold">
                    ✅ Đáp án chuẩn: {item.question.options[item.question.correctIndex]}
                  </div>
                  <div className="text-slate-600 italic bg-white/70 p-2 rounded-xl text-[11px]">
                    💡 <strong>Giải thích:</strong> {item.question.explanation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* QUESTION INTERACTION BOX (When actively fighting) */}
      {/* =================================================================== */}
      {phase !== 'victory' && phase !== 'defeat' && (
        <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
          {/* Question topic & question text */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-extrabold text-rose-700 uppercase tracking-wider">
                Hiệp {currentIndex + 1} • {currentQ.topic}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                Độ khó: {currentQ.difficulty === 1 ? 'Cơ Bản' : currentQ.difficulty === 2 ? 'Vận Dụng' : 'Nâng Cao'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 leading-snug">
              {currentQ.content}
            </h2>
          </div>

          {/* 4 Options Grid / Stack */}
          <div className="space-y-2.5">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQ.correctIndex;
              const isResolved = phase === 'turn_resolved' || phase === 'player_attacking' || phase === 'boss_attacking';

              let style = 'bg-white border-slate-200 text-slate-700 hover:border-rose-400 hover:bg-rose-50/40';

              if (isSelected && !isResolved) {
                style = 'bg-rose-50 border-rose-500 text-rose-950 font-bold ring-2 ring-rose-300';
              } else if (isResolved) {
                if (isCorrect) {
                  style = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-200';
                } else if (isSelected) {
                  style = 'bg-rose-50 border-rose-500 text-rose-950 font-bold';
                } else {
                  style = 'opacity-50 border-slate-200 text-slate-400';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => phase === 'question' && setSelectedOption(idx)}
                  disabled={phase !== 'question'}
                  className={`w-full p-3.5 rounded-2xl border-2 text-left font-semibold text-sm transition-all flex items-center justify-between cursor-pointer ${style}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-700 shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </div>

                  {isResolved && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                  {isResolved && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Explanation if turn resolved */}
          {phase === 'turn_resolved' && currentQ.explanation && (
            <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200 text-xs text-blue-950 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <strong className="text-blue-900 block font-black">💡 Bí quyết tri thức:</strong>
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(true)}
                  className="text-[11px] text-rose-600 hover:text-rose-700 flex items-center gap-1 font-bold cursor-pointer bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-xl border border-rose-200 transition-colors"
                  title="Khiếu nại nếu cho rằng đáp án có nhầm lẫn"
                >
                  <Scale className="w-3 h-3" />
                  <span>Phúc khảo câu này</span>
                </button>
              </div>
              <p>{currentQ.explanation}</p>
            </div>
          )}

          {/* Action Button Bar */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {phase === 'question' ? (
                <span>Chọn câu trả lời và nhấn <strong>Tung Đòn</strong></span>
              ) : phase === 'player_attacking' ? (
                <span className="text-amber-600 font-bold animate-pulse">⚡ Bạn đang tấn công Boss...</span>
              ) : phase === 'boss_attacking' ? (
                <span className="text-rose-600 font-bold animate-pulse">👹 Boss đang phản công...!</span>
              ) : (
                <span className="text-emerald-700 font-bold">Đã xong hiệp đấu! Sẵn sàng cho hiệp tiếp theo.</span>
              )}
            </div>

            {phase === 'question' ? (
              <button
                onClick={handleConfirmAnswer}
                disabled={selectedOption === null}
                className={`py-3 px-6 rounded-2xl font-black text-sm shadow-md flex items-center gap-2 transition-all ${
                  selectedOption !== null
                    ? 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white cursor-pointer hover:scale-105 shadow-rose-200'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Zap className="w-4 h-4" />
                Tung Đòn Trí Tuệ
              </button>
            ) : phase === 'turn_resolved' ? (
              <button
                onClick={handleNextTurn}
                className="py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black text-sm shadow-md shadow-emerald-200 cursor-pointer hover:scale-105 transition-all flex items-center gap-1.5"
              >
                <span>Hiệp Kế Tiếp</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="py-3 px-5 bg-slate-100 rounded-2xl text-xs font-black text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Đang giao chiến...
              </div>
            )}
          </div>
        </div>
      )}

      {showDisputeModal && currentQ && (
        <QuestionDisputeModal
          isOpen={showDisputeModal}
          onClose={() => setShowDisputeModal(false)}
          question={currentQ}
          user={user}
          selectedOptionIndex={selectedOption}
          onResolveAppeal={handleResolveAppeal}
        />
      )}
    </div>
  );
};
