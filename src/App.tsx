import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  GameModeId, 
  SubjectId, 
  GradeLevel, 
  QuizResult 
} from './types';
import { StorageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { PlacementTestModal } from './components/PlacementTestModal';
import { HomeView } from './components/HomeView';
import { SubjectsView } from './components/SubjectsView';
import { GamesHubView } from './components/GamesHubView';
import { LeaderboardView } from './components/LeaderboardView';
import { AchievementsView } from './components/AchievementsView';
import { ShopView } from './components/ShopView';
import { ProfileView } from './components/ProfileView';
import { ArenaGame } from './components/games/ArenaGame';
import { RaceGame } from './components/games/RaceGame';
import { TowerGame } from './components/games/TowerGame';
import { TreasureHuntGame } from './components/games/TreasureHuntGame';
import { BossBattleGame } from './components/games/BossBattleGame';
import { SpeedReflexGame } from './components/games/SpeedReflexGame';
import { KnowledgePuzzleGame } from './components/games/KnowledgePuzzleGame';
import { AiDuelGame } from './components/games/AiDuelGame';
import { LearningRoadmapView } from './components/LearningRoadmapView';
import { QuizSummaryModal } from './components/QuizSummaryModal';
import { HeartRecoveryModal } from './components/HeartRecoveryModal';
import { QuestionSearchView } from './components/QuestionSearchView';
import { AiTutorView } from './components/AiTutorView';
import { AiQuestionGeneratorModal } from './components/AiQuestionGeneratorModal';
import { QualityControlView } from './components/QualityControlView';
import { Question } from './types';
import { auth, FirebaseAuthService, FirebaseDataService } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export type AuthStatus = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'ERROR';

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('INITIALIZING');
  const [authErrorMessage, setAuthErrorMessage] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPlacementTest, setShowPlacementTest] = useState(false);
  const [showHeartModal, setShowHeartModal] = useState(false);
  const [showQuestionGenModal, setShowQuestionGenModal] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [searchInitialSubject, setSearchInitialSubject] = useState<SubjectId | 'all'>('all');
  const [aiInitialPrompt, setAiInitialPrompt] = useState('');
  const [aiInitialSubject, setAiInitialSubject] = useState<SubjectId | 'all'>('all');
  const [aiContextQuestion, setAiContextQuestion] = useState<Question | null>(null);

  // Active game state
  const [activeGameConfig, setActiveGameConfig] = useState<{
    sessionId: string;
    mode: GameModeId;
    subject: SubjectId;
    grade: GradeLevel;
    level: number;
    customQuestions?: Question[];
    topic?: string;
  } | null>(null);

  const [lastQuizResult, setLastQuizResult] = useState<QuizResult | null>(null);

  // Authenticate and verify session on initial startup
  useEffect(() => {
    let isMounted = true;
    console.log('[Auth] App startup: checking active session and auth status');

    // 1. Clean up any legacy hard-coded test user data from previous dev sessions
    StorageService.cleanupLegacyTestData();

    // 2. Check local valid session first for instant resume without blank screen
    const existingUser = StorageService.getUserProfile();
    if (existingUser && isMounted) {
      console.log('[Auth] Restored active session from local storage for:', existingUser.id);
      setUser(existingUser);
      setAuthStatus('AUTHENTICATED');
    }

    // 3. Listen to Firebase Auth state for Google/Firebase users
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (fbUser) => {
        if (!isMounted) return;
        console.log('[Auth State Changed] Firebase user event:', fbUser ? `logged in (${fbUser.uid})` : 'logged out');

        if (fbUser) {
          // If this user is already authenticated in memory, skip duplicate profile recreation
          const activeSession = StorageService.getActiveSession();
          if (user && user.id === fbUser.uid && activeSession?.userId === fbUser.uid) {
            console.log('[Auth] User already authenticated in memory:', fbUser.uid);
            if (isMounted) setAuthStatus('AUTHENTICATED');
            return;
          }

          try {
            // Check local accounts first (instant, zero network latency)
            const allAccounts = StorageService.getAllAccounts();
            let profile = allAccounts[fbUser.uid]?.profile;

            if (!profile && StorageService.getUserProfile()?.id === fbUser.uid) {
              profile = StorageService.getUserProfile();
            }

            // If not found in local accounts, try loading from Firestore (with 3.5s timeout)
            if (!profile) {
              try {
                profile = await FirebaseDataService.loadUserProfile(fbUser.uid);
              } catch (cloudErr) {
                console.warn('[Auth] Firestore load warning on auth state changed:', cloudErr);
              }
            }

            if (profile && isMounted) {
              const provider = fbUser.providerData?.some((p) => p.providerId === 'google.com')
                ? 'firebase_google'
                : 'firebase_email';
              StorageService.createSession(profile.id, provider);
              StorageService.saveUserProfile(profile);
              StorageService.cacheAccountProfile(profile, provider);
              setUser(profile);
              setAuthStatus('AUTHENTICATED');
              setShowAuthModal(false);
              console.log('[Auth] Authentication complete for Firebase user:', profile.id, provider);
            } else if (isMounted) {
              console.log('[Auth] Profile for user pending completion in AuthModal');
            }
          } catch (err: any) {
            console.warn('[Auth] Error handling Firebase user in auth listener:', err);
          }
        } else {
          // Firebase reports no signed-in client user
          const activeSession = StorageService.getActiveSession();
          if (!activeSession) {
            if (isMounted) {
              setUser(null);
              setAuthStatus('UNAUTHENTICATED');
              setShowAuthModal(true);
            }
          }
        }

        if (isMounted && authStatus === 'INITIALIZING') {
          const validUser = StorageService.getUserProfile();
          if (validUser) {
            setUser(validUser);
            setAuthStatus('AUTHENTICATED');
            setShowAuthModal(false);
          } else {
            setAuthStatus('UNAUTHENTICATED');
            setShowAuthModal(true);
          }
        }
      },
      (authError) => {
        console.error('[Auth Error] onAuthStateChanged error:', authError);
        if (isMounted) {
          setAuthErrorMessage(authError?.message || 'Không thể kết nối đến dịch vụ xác thực.');
          setAuthStatus('ERROR');
        }
      }
    );

    // 4. Safety timeout: ensure auth checking doesn't hang indefinitely
    const timer = setTimeout(() => {
      if (isMounted) {
        setAuthStatus((prev) => {
          if (prev === 'INITIALIZING') {
            console.log('[Auth] Startup check timeout reached (1000ms)');
            const fallbackProfile = StorageService.getUserProfile();
            if (fallbackProfile) {
              setUser(fallbackProfile);
              return 'AUTHENTICATED';
            } else {
              setShowAuthModal(true);
              return 'UNAUTHENTICATED';
            }
          }
          return prev;
        });
      }
    }, 1000);

    // Periodically refresh user profile (heart regen, etc.)
    const interval = setInterval(() => {
      if (StorageService.getActiveSession()) {
        const refreshed = StorageService.getUserProfile();
        if (refreshed && isMounted) {
          setUser(refreshed);
        }
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribeAuth();
    };
  }, []);

  // If session check completed and no user is logged in, show AuthModal
  useEffect(() => {
    if (authStatus === 'UNAUTHENTICATED' && !user) {
      setShowAuthModal(true);
    }
  }, [authStatus, user]);

  // Check if new user needs placement test
  useEffect(() => {
    if (user && !user.hasTakenPlacementTest) {
      setShowPlacementTest(true);
    }
  }, [user]);

  const handleLoginSuccess = (loggedInUser: UserProfile, isNewRegistration?: boolean) => {
    console.log('[Auth] Login success handled for:', loggedInUser.id);
    setUser(loggedInUser);
    setAuthStatus('AUTHENTICATED');
    setShowAuthModal(false);
    if (isNewRegistration && !loggedInUser.hasTakenPlacementTest) {
      setShowPlacementTest(true);
    }
  };

  const handleLogout = async () => {
    console.log('[Auth] Initiating logout');
    try {
      await FirebaseAuthService.logOut();
    } catch {
      // ignore
    }
    StorageService.logoutUser();
    setUser(null);
    setAuthStatus('UNAUTHENTICATED');
    setCurrentTab('home');
    setShowAuthModal(true);
    console.log('[Auth] Logout finished, session wiped');
  };

  const handleUserUpdate = (updated: UserProfile) => {
    setUser(updated);
    if (auth.currentUser) {
      FirebaseDataService.syncUserProfile(updated).catch(() => {});
    }
  };

  const handleNavigate = (tab: string, extra?: unknown) => {
    setCurrentTab(tab);
    if (tab === 'search' && extra && typeof extra === 'object') {
      const ex = extra as { query?: string; subject?: SubjectId | 'all' };
      if (ex.query !== undefined) setSearchInitialQuery(ex.query);
      if (ex.subject !== undefined) setSearchInitialSubject(ex.subject);
    }
    if (tab === 'ai-tutor' && extra && typeof extra === 'object') {
      const ex = extra as { prompt?: string; subject?: SubjectId | 'all'; question?: Question | null };
      if (ex.prompt !== undefined) setAiInitialPrompt(ex.prompt);
      if (ex.subject !== undefined) setAiInitialSubject(ex.subject);
      if (ex.question !== undefined) setAiContextQuestion(ex.question);
    }
    if (tab === 'games' && extra && typeof extra === 'object') {
      const ex = extra as { customQuestions?: Question[]; subject?: SubjectId; topic?: string };
      if (ex.customQuestions && ex.customQuestions.length > 0 && user) {
        // Direct launch Arena Game with custom questions
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        setActiveGameConfig({
          sessionId: newSessionId,
          mode: 'dau_truong',
          subject: ex.subject || 'toan',
          grade: user.grade,
          level: 3,
          customQuestions: ex.customQuestions,
          topic: ex.topic,
        });
        setLastQuizResult(null);
        setCurrentTab('playing');
      }
    }
  };

  const handleStartGame = (mode: GameModeId, subject: SubjectId, grade: GradeLevel, level: number) => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setActiveGameConfig({
      sessionId: newSessionId,
      mode,
      subject,
      grade,
      level,
    });
    setLastQuizResult(null);
    setCurrentTab('playing');
  };

  const handleFinishQuiz = (result: QuizResult) => {
    setLastQuizResult(result);
    const refreshed = StorageService.getUserProfile();
    setUser(refreshed);

    // Save quiz result & question answers to Firebase Firestore if logged in
    if (auth.currentUser && refreshed) {
      FirebaseDataService.recordQuizResult(auth.currentUser.uid, result, refreshed.grade).catch(() => {});
      FirebaseDataService.syncUserProfile(refreshed).catch(() => {});
    }
  };

  const handlePlayAgain = () => {
    const prevConfig = activeGameConfig;
    const prevResult = lastQuizResult;

    // Determine target configuration from activeGameConfig or lastQuizResult
    const mode = prevConfig?.mode || prevResult?.gameMode || 'dau_truong';
    const subject = prevConfig?.subject || prevResult?.subject || 'toan';
    const grade = prevConfig?.grade || user?.grade || 6;
    const level = prevConfig?.level || prevResult?.level || 1;
    const customQuestions = prevConfig?.customQuestions;
    const topic = prevConfig?.topic;

    // Dismiss quiz result modal first
    setLastQuizResult(null);

    // Refresh user profile and ensure user has hearts so they are not blocked
    const currentProfile = StorageService.getUserProfile();
    if (currentProfile) {
      if (currentProfile.hearts <= 0) {
        StorageService.updateHearts(5);
      }
      const refreshed = StorageService.getUserProfile();
      if (refreshed) setUser(refreshed);
    }

    // Generate brand-new unique session ID:
    // By passing a new sessionId as React `key` to the game component, React unmounts
    // the completed game session and mounts a fresh game instance:
    // 1. Current question index resets to 0 (Question 1)
    // 2. Correct count & wrong count reset to 0
    // 3. Earned XP/Coins of this new round reset to 0
    // 4. Selected answers, submitted state, hint state reset
    // 5. Fresh questions are loaded/generated for this round
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    setActiveGameConfig({
      sessionId: newSessionId,
      mode,
      subject,
      grade,
      level,
      customQuestions,
      topic,
    });

    // Ensure user is returned to the playing screen
    setCurrentTab('playing');
  };

  const handleGoHome = () => {
    setLastQuizResult(null);
    setActiveGameConfig(null);
    setCurrentTab('home');
  };

  const handleGoToGamesHub = () => {
    setLastQuizResult(null);
    setActiveGameConfig(null);
    setCurrentTab('games');
  };

  if (authStatus === 'INITIALIZING') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 selection:bg-amber-400">
        <div className="flex flex-col items-center max-w-sm text-center space-y-4 animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/25">
              <span className="text-3xl">⚔️</span>
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-amber-400/20 animate-ping -z-10" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">Học Đường Tri Thức EduPlay</h2>
            <p className="text-xs text-slate-400 font-medium">Đang kiểm tra phiên đăng nhập...</p>
          </div>
          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse w-2/3 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'ERROR') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 selection:bg-amber-400">
        <div className="flex flex-col items-center max-w-sm text-center space-y-4 bg-slate-800/90 border border-slate-700/80 p-6 rounded-3xl shadow-xl animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-3xl">
            ⚠️
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-100">Kiểm Tra Phiên Đăng Nhập Thất Bại</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {authErrorMessage || 'Không thể kết nối đến hệ thống xác thực. Vui lòng thử lại.'}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full pt-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              Tải lại trang
            </button>
            <button
              onClick={() => {
                StorageService.logoutUser();
                setUser(null);
                setAuthStatus('UNAUTHENTICATED');
                setShowAuthModal(true);
              }}
              className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              Đăng nhập lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-amber-400 selection:text-amber-950">
      {/* Top Navigation */}
      <Navbar
        user={user}
        activeTab={currentTab}
        onNavigate={handleNavigate}
        onSelectTab={handleNavigate}
        onUserUpdate={handleUserUpdate}
        onOpenSettings={() => handleNavigate('profile')}
        onOpenLogin={() => setShowAuthModal(true)}
        onOpenHeartModal={() => setShowHeartModal(true)}
        onOpenQuestionGenerator={() => setShowQuestionGenModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-12">
        {/* Welcome message if not logged in */}
        {!user && (
          <div className="my-8 text-center max-w-xl mx-auto space-y-4 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-md">
            <span className="text-5xl">🎓</span>
            <h2 className="text-2xl font-black text-slate-800">
              Chào Mừng Đến Với Học Đường Tri Thức!
            </h2>
            <p className="text-sm text-slate-600">
              Học tập kết hợp trò chơi kỳ thú dành cho học sinh Lớp 1 - 12. Trả lời đúng, nhận XP, thăng cấp và sưu tập hàng loạt phần thưởng danh giá!
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-extrabold text-sm shadow-md shadow-orange-200 hover:scale-105 transition-transform cursor-pointer"
            >
              Đăng Nhập / Đăng Ký Ngay
            </button>
          </div>
        )}

        {/* Tab Routing */}
        {user && currentTab === 'home' && (
          <HomeView
            user={user}
            onNavigate={handleNavigate}
            onUserUpdate={handleUserUpdate}
            onStartPlacementTest={() => setShowPlacementTest(true)}
          />
        )}

        {user && currentTab === 'subjects' && (
          <SubjectsView
            user={user}
            onSelectSubject={(subjectId) => {
              handleNavigate('games');
            }}
            onSearchQuestions={(subjectId, topic) => {
              handleNavigate('search', { subject: subjectId, query: topic || '' });
            }}
          />
        )}

        {user && currentTab === 'ai-tutor' && (
          <AiTutorView
            user={user}
            onNavigate={handleNavigate}
            onUserUpdate={handleUserUpdate}
            initialPrompt={aiInitialPrompt}
            initialSubject={aiInitialSubject}
            contextQuestion={aiContextQuestion}
          />
        )}

        {user && currentTab === 'quality-control' && (
          <QualityControlView
            user={user}
            onNavigate={handleNavigate}
            onStartPracticeWithQuestions={(questions, subject, topic) => {
              handleNavigate('games', { customQuestions: questions, subject, topic });
            }}
          />
        )}

        {user && currentTab === 'search' && (
          <QuestionSearchView
            user={user}
            onNavigate={handleNavigate}
            onUserUpdate={handleUserUpdate}
            initialQuery={searchInitialQuery}
            initialSubject={searchInitialSubject}
          />
        )}

        {user && currentTab === 'games' && (
          <GamesHubView
            user={user}
            onStartGame={handleStartGame}
            onOpenRechargeModal={() => setShowHeartModal(true)}
            onOpenQuestionGenerator={() => setShowQuestionGenModal(true)}
          />
        )}

        {user && currentTab === 'leaderboard' && (
          <LeaderboardView user={user} onUserUpdate={handleUserUpdate} />
        )}

        {user && currentTab === 'achievements' && (
          <AchievementsView user={user} onUserUpdate={handleUserUpdate} />
        )}

        {user && currentTab === 'roadmap' && (
          <LearningRoadmapView
            user={user}
            onStartTargetedPractice={(subj) => handleStartGame('dau_truong', subj, user.grade, 2)}
            onRetakePlacement={() => setShowPlacementTest(true)}
          />
        )}

        {user && currentTab === 'shop' && (
          <ShopView user={user} onUserUpdate={handleUserUpdate} />
        )}

        {user && currentTab === 'profile' && (
          <ProfileView
            user={user}
            onUserUpdate={handleUserUpdate}
            onLogout={handleLogout}
          />
        )}

        {/* ACTIVE GAME PLAYING SCREEN */}
        {user && currentTab === 'playing' && activeGameConfig && (
          <div key={activeGameConfig.sessionId}>
            {activeGameConfig.mode === 'dau_truong' && (
              <ArenaGame
                key={activeGameConfig.sessionId}
                user={user}
                subject={activeGameConfig.subject}
                grade={activeGameConfig.grade}
                level={activeGameConfig.level}
                customQuestions={activeGameConfig.customQuestions}
                onFinish={handleFinishQuiz}
                onExit={handleGoToGamesHub}
              />
            )}

            {activeGameConfig.mode === 'cuoc_dua' && (
              <RaceGame
                key={activeGameConfig.sessionId}
                user={user}
                subject={activeGameConfig.subject}
                grade={activeGameConfig.grade}
                level={activeGameConfig.level}
                customQuestions={activeGameConfig.customQuestions}
                onFinish={handleFinishQuiz}
                onExit={handleGoToGamesHub}
              />
            )}

            {activeGameConfig.mode === 'thap_tri_thuc' && (
              <TowerGame
                key={activeGameConfig.sessionId}
                user={user}
                subject={activeGameConfig.subject}
                grade={activeGameConfig.grade}
                level={activeGameConfig.level}
                customQuestions={activeGameConfig.customQuestions}
                onFinish={handleFinishQuiz}
                onExit={handleGoToGamesHub}
              />
            )}

            {activeGameConfig.mode === 'san_kho_bau' && (
              <TreasureHuntGame
                key={activeGameConfig.sessionId}
                user={user}
                subject={activeGameConfig.subject}
                grade={activeGameConfig.grade}
                level={activeGameConfig.level}
                customQuestions={activeGameConfig.customQuestions}
                onFinish={handleFinishQuiz}
                onExit={handleGoToGamesHub}
              />
            )}

            {activeGameConfig.mode === 'dau_boss' && (
              <BossBattleGame
                key={activeGameConfig.sessionId}
                user={user}
                subject={activeGameConfig.subject}
                grade={activeGameConfig.grade}
                level={activeGameConfig.level}
                customQuestions={activeGameConfig.customQuestions}
                onFinish={handleFinishQuiz}
                onExit={handleGoToGamesHub}
              />
            )}

            {activeGameConfig.mode === 'phan_xa' && (
              <SpeedReflexGame
                key={activeGameConfig.sessionId}
                user={user}
                subject={activeGameConfig.subject}
                grade={activeGameConfig.grade}
                level={activeGameConfig.level}
                customQuestions={activeGameConfig.customQuestions}
                onFinishGame={handleFinishQuiz}
                onBack={handleGoToGamesHub}
                onOpenHeartRecovery={() => setShowHeartModal(true)}
              />
            )}

            {activeGameConfig.mode === 'xep_hinh' && (
              <KnowledgePuzzleGame
                key={activeGameConfig.sessionId}
                user={user}
                subject={activeGameConfig.subject}
                grade={activeGameConfig.grade}
                level={activeGameConfig.level}
                customQuestions={activeGameConfig.customQuestions}
                onFinishGame={handleFinishQuiz}
                onBack={handleGoToGamesHub}
                onOpenHeartRecovery={() => setShowHeartModal(true)}
              />
            )}

            {activeGameConfig.mode === 'thach_dau_ai' && (
              <AiDuelGame
                key={activeGameConfig.sessionId}
                user={user}
                subject={activeGameConfig.subject}
                grade={activeGameConfig.grade}
                level={activeGameConfig.level}
                customQuestions={activeGameConfig.customQuestions}
                onFinishGame={handleFinishQuiz}
                onBack={handleGoToGamesHub}
                onOpenHeartRecovery={() => setShowHeartModal(true)}
              />
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span>🎮</span>
            <span>Học Đường Tri Thức • Gamified Learning Platform (Lớp 1 - 12)</span>
          </div>
          <div className="text-slate-400">
            100% Học Tập Bằng Kiến Thức Thật • Không Pay-to-Win • Phát Triển Tư Duy Toàn Diện
          </div>
        </div>
      </footer>

      {/* POPUPS & MODALS */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleLoginSuccess}
        />
      )}

      {showPlacementTest && user && (
        <PlacementTestModal
          user={user}
          onClose={() => setShowPlacementTest(false)}
          onComplete={(updated) => {
            setUser(updated);
            setShowPlacementTest(false);
          }}
        />
      )}

      {lastQuizResult && user && (
        <QuizSummaryModal
          result={lastQuizResult}
          user={user}
          onPlayAgain={handlePlayAgain}
          onGoHome={handleGoHome}
          onGoToGamesHub={handleGoToGamesHub}
        />
      )}

      {showHeartModal && user && (
        <HeartRecoveryModal
          user={user}
          isOpen={showHeartModal}
          onClose={() => setShowHeartModal(false)}
          onUserUpdate={handleUserUpdate}
        />
      )}

      {showQuestionGenModal && user && (
        <AiQuestionGeneratorModal
          user={user}
          isOpen={showQuestionGenModal}
          onClose={() => setShowQuestionGenModal(false)}
          onStartPracticeWithQuestions={(questions, subject, topic) => {
            handleNavigate('games', { customQuestions: questions, subject, topic });
          }}
        />
      )}
    </div>
  );
};
export default App;
