import React, { useState } from 'react';
import { UserProfile, GradeLevel, SubjectId } from '../types';
import { StorageService } from '../services/storage';
import { soundManager } from '../services/sound';
import { FirebaseAuthService, FirebaseDataService } from '../services/firebase';
import { Sparkles, CheckCircle2, ArrowRight, UserPlus, LogIn, Heart, ShieldCheck, X, RefreshCw } from 'lucide-react';

interface AuthModalProps {
  isOpen?: boolean;
  onSuccess: (user: UserProfile, isNewRegistration: boolean) => void;
  onClose?: () => void;
  onCancel?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen = true, 
  onSuccess, 
  onClose, 
  onCancel 
}) => {
  const [mode, setMode] = useState<'welcome' | 'login' | 'register'>('welcome');

  if (!isOpen) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [grade, setGrade] = useState<GradeLevel>(6);
  const [school, setSchool] = useState('');
  const [favoriteSubject, setFavoriteSubject] = useState<SubjectId>('toan');
  const [learningGoal, setLearningGoal] = useState('Chăm chỉ học tập, rèn luyện tư duy và tiến bộ mỗi ngày');
  const [registerError, setRegisterError] = useState('');
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Friendly error translation for Firebase Authentication issues
  const getFriendlyAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
      case 'auth/user-not-found':
        return 'Tài khoản email này chưa được đăng ký. Vui lòng kiểm tra lại hoặc đăng ký tài khoản mới.';
      case 'auth/email-already-in-use':
        return 'Email này đã được đăng ký. Hãy đăng nhập hoặc sử dụng email khác.';
      case 'auth/invalid-email':
        return 'Địa chỉ email không đúng định dạng. Ví dụ: hocsinh@gmail.com';
      case 'auth/weak-password':
        return 'Mật khẩu quá ngắn. Vui lòng nhập tối thiểu 6 ký tự để bảo vệ tài khoản.';
      case 'auth/missing-password':
        return 'Vui lòng nhập mật khẩu.';
      case 'auth/missing-email':
        return 'Vui lòng nhập địa chỉ email.';
      case 'auth/too-many-requests':
        return 'Tài khoản tạm thời bị khóa do nhập sai nhiều lần. Vui lòng thử lại sau ít phút.';
      case 'auth/network-request-failed':
        return 'Lỗi kết nối mạng khi liên hệ hệ thống xác thực. Vui lòng kiểm tra lại Internet.';
      case 'auth/user-disabled':
        return 'Tài khoản này đã bị khóa.';
      case 'auth/popup-closed-by-user':
        return 'Cửa sổ đăng nhập Google đã được đóng trước khi hoàn tất.';
      case 'auth/popup-blocked':
        return 'Trình duyệt đã chặn cửa sổ đăng nhập Google. Vui lòng cho phép popup.';
      case 'auth/cancelled-popup-request':
        return 'Yêu cầu đăng nhập đã được làm mới. Vui lòng thử lại.';
      case 'auth/unauthorized-domain':
        return 'Tên miền chưa được cấp quyền trong Firebase Authentication.';
      case 'auth/operation-not-allowed':
        return 'Phương thức đăng nhập này chưa được kích hoạt trong Firebase Console.';
      default:
        return err?.message || 'Có lỗi xảy ra trong quá trình xác thực. Vui lòng thử lại.';
    }
  };

  const handleGoogleSignIn = async () => {
    if (isFirebaseLoading) return;
    setIsFirebaseLoading(true);
    setLoginError('');
    console.log('[Auth] Google OAuth started');

    try {
      // Step 1: Trigger Google OAuth popup
      const fbUser = await FirebaseAuthService.signInWithGoogle();
      console.log('[Auth] Google OAuth success, uid:', fbUser?.uid, fbUser?.email);

      if (!fbUser) {
        throw new Error('Không nhận được thông tin xác thực từ tài khoản Google.');
      }

      console.log('[Auth] Session received for user:', fbUser.email);

      // Step 2: Retrieve existing profile or create a fresh one
      let profile: UserProfile | null = null;

      // 2a. Check local account storage first (instant, guaranteed)
      const allAccounts = StorageService.getAllAccounts();
      if (allAccounts[fbUser.uid]?.profile) {
        profile = allAccounts[fbUser.uid].profile;
        console.log('[Auth] User profile loaded from local accounts:', fbUser.uid);
      }

      // 2b. If not in local accounts, try loading from Firestore (with 3.5s timeout)
      if (!profile) {
        try {
          profile = await FirebaseDataService.loadUserProfile(fbUser.uid);
          if (profile) {
            console.log('[Auth] User profile loaded from Firestore:', fbUser.uid);
          }
        } catch (cloudErr) {
          console.warn('[Auth] Firestore load non-fatal warning, fallback to profile creation:', cloudErr);
        }
      }

      let isNew = false;
      if (!profile) {
        isNew = true;
        console.log('[Auth] Creating new profile for Google user:', fbUser.uid);
        const displayName = fbUser.displayName || 'Học Sinh';
        const cleanUsername = (fbUser.displayName || fbUser.email?.split('@')[0] || 'hoc_sinh')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9_]/g, '_')
          .slice(0, 20) || 'hoc_sinh';

        profile = {
          id: fbUser.uid,
          fullName: displayName,
          username: cleanUsername,
          email: fbUser.email || '',
          grade: 6,
          school: 'Trường phổ thông',
          favoriteSubject: 'toan',
          learningGoal: 'Chăm chỉ học tập, rèn luyện tư duy và tiến bộ mỗi ngày',
          avatar: '🧑‍🎓',
          avatarFrame: '🌱',
          equippedBackground: 'bg_campus',
          level: 1,
          xp: 0,
          coins: 150,
          hearts: 5,
          maxHearts: 5,
          lastHeartRegenTime: Date.now(),
          hintsCount: 3,
          hasTakenPlacementTest: false,
          initialRecommendedLevel: 1,
          recommendedFocus: {
            shouldPractice: ['Làm quen với các câu hỏi kiểm tra cơ bản'],
            strongAt: []
          },
          unlockedAchievements: ['first_login'],
          inventory: ['bg_campus'],
          subjectStats: {
            toan: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
            tieng_anh: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
            tin_hoc: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
            ngu_van: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
            khoa_hoc: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' }
          },
          totalGamesPlayed: 0,
          highestStreak: 0,
          joinedDate: new Date().toISOString().split('T')[0]
        };
      } else {
        // Sync newer details from Google profile if available
        if (fbUser.displayName && (!profile.fullName || profile.fullName === 'Học Sinh')) {
          profile.fullName = fbUser.displayName;
        }
        if (fbUser.email && !profile.email) {
          profile.email = fbUser.email;
        }
      }

      // Step 3: Establish local session & persist profile with authProvider 'firebase_google'
      StorageService.createSession(profile.id, 'firebase_google');
      StorageService.saveUserProfile(profile);
      StorageService.cacheAccountProfile(profile, 'firebase_google');
      console.log('[Auth] Auth state updated: session saved for', profile.id);

      // Step 4: Background sync to Firestore without blocking the UI
      FirebaseDataService.syncUserProfile(profile).catch((syncErr) => {
        console.warn('[Auth] Background sync warning:', syncErr);
      });

      // Step 5: Sound & notify app success
      console.log('[Auth] Authentication complete');
      soundManager.playCorrect();
      onSuccess(profile, isNew);
    } catch (err: any) {
      console.error('[Auth] Google Sign-In caught error:', err);
      const friendlyMessage = getFriendlyAuthError(err);
      setLoginError(friendlyMessage);
    } finally {
      // Step 6: Guaranteed loading termination - never get stuck
      setIsFirebaseLoading(false);
      console.log('[Auth] Google Sign-In loading finished (false)');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginEmail.trim()) {
      setLoginError('Vui lòng nhập địa chỉ email đăng nhập.');
      return;
    }

    if (!loginPassword.trim()) {
      setLoginError('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    console.log('[Auth] Attempting loginWithEmail for:', loginEmail.trim());

    try {
      // 1. Official Firebase Auth login - verifies credentials with Firebase Authentication
      const fbUser = await FirebaseAuthService.loginWithEmail(loginEmail.trim(), loginPassword);

      if (!fbUser || !fbUser.uid) {
        throw new Error('Không nhận được thông tin xác thực từ hệ thống.');
      }

      console.log('[Auth] Firebase loginWithEmail successful, uid:', fbUser.uid);

      // 2. Load profile from local storage cache or Firestore
      let profile: UserProfile | null = null;
      const allAccounts = StorageService.getAllAccounts();
      if (allAccounts[fbUser.uid]?.profile) {
        profile = allAccounts[fbUser.uid].profile;
        console.log('[Auth] User profile retrieved from local cache:', fbUser.uid);
      }

      if (!profile) {
        try {
          profile = await FirebaseDataService.loadUserProfile(fbUser.uid);
          if (profile) {
            console.log('[Auth] User profile retrieved from Firestore:', fbUser.uid);
          }
        } catch (cloudErr) {
          console.warn('[Auth] Firestore load non-fatal warning on login:', cloudErr);
        }
      }

      if (!profile) {
        console.log('[Auth] Initializing default profile for authenticated email user:', fbUser.uid);
        const displayName = fbUser.displayName || loginEmail.split('@')[0] || 'Học Sinh';
        const cleanUsername = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20) || 'hoc_sinh';

        profile = {
          id: fbUser.uid,
          fullName: displayName,
          username: cleanUsername,
          email: fbUser.email || loginEmail.trim(),
          grade: 6,
          school: 'Trường phổ thông',
          favoriteSubject: 'toan',
          learningGoal: 'Chăm chỉ học tập, rèn luyện tư duy và tiến bộ mỗi ngày',
          avatar: '🎒',
          avatarFrame: '🌱',
          equippedBackground: 'bg_campus',
          level: 1,
          xp: 0,
          coins: 150,
          hearts: 5,
          maxHearts: 5,
          lastHeartRegenTime: Date.now(),
          hintsCount: 3,
          hasTakenPlacementTest: true,
          initialRecommendedLevel: 1,
          recommendedFocus: {
            shouldPractice: ['Làm quen với các câu hỏi kiểm tra cơ bản'],
            strongAt: [],
          },
          unlockedAchievements: ['first_login'],
          inventory: ['bg_campus'],
          subjectStats: {
            toan: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
            tieng_anh: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
            tin_hoc: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
            ngu_van: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
            khoa_hoc: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
          },
          totalGamesPlayed: 0,
          highestStreak: 0,
          joinedDate: new Date().toISOString().split('T')[0],
        };
      }

      // 3. Establish active session and save profile locally with provider 'firebase_email'
      StorageService.createSession(profile.id, 'firebase_email');
      StorageService.saveUserProfile(profile);
      StorageService.cacheAccountProfile(profile, 'firebase_email');

      // 4. Background sync to Firestore
      FirebaseDataService.syncUserProfile(profile).catch(() => {});

      // 5. Sound & success callback
      soundManager.playCorrect();
      onSuccess(profile, false);
    } catch (err: any) {
      console.error('[Auth] Login error:', err);
      const friendlyMsg = getFriendlyAuthError(err);
      setLoginError(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    if (!email.trim()) {
      setRegisterError('Vui lòng nhập địa chỉ email hợp lệ để đăng ký.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setRegisterError('Địa chỉ email không đúng định dạng. Ví dụ: hocsinh@gmail.com');
      return;
    }

    if (!password.trim()) {
      setRegisterError('Vui lòng nhập mật khẩu.');
      return;
    }

    if (password.length < 6) {
      setRegisterError('Mật khẩu phải có ít nhất 6 ký tự để bảo vệ tài khoản.');
      return;
    }

    if (password !== confirmPassword) {
      setRegisterError('Xác nhận mật khẩu không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    setIsSubmitting(true);
    console.log('[Auth] Registering user with Auth system:', email.trim());

    try {
      const resolvedFullName = fullName.trim() || email.split('@')[0] || 'Học Sinh';
      const resolvedUsername =
        username.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 20) ||
        email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
        'hoc_sinh';

      // 1. Create real account in Authentication service
      const fbUser = await FirebaseAuthService.registerWithEmail(
        email.trim(),
        password,
        resolvedFullName,
        {
          grade,
          school: school.trim() || 'Trường phổ thông',
          favoriteSubject,
          learningGoal: learningGoal.trim() || 'Chăm chỉ học tập, rèn luyện tư duy và tiến bộ mỗi ngày'
        }
      );

      if (!fbUser || !fbUser.uid) {
        throw new Error('Không thể tạo tài khoản xác thực.');
      }

      console.log('[Auth] Authentication account created with UID:', fbUser.uid);

      // 2. Construct clean user profile (NEVER save password directly or in plain text)
      const newProfile: UserProfile = {
        id: fbUser.uid,
        fullName: resolvedFullName,
        username: resolvedUsername,
        email: fbUser.email || email.trim().toLowerCase(),
        grade,
        school: school.trim() || 'Trường phổ thông',
        favoriteSubject,
        learningGoal: learningGoal.trim() || 'Chăm chỉ học tập, rèn luyện tư duy và tiến bộ mỗi ngày',
        avatar: '🎒',
        avatarFrame: '🌱',
        equippedBackground: 'bg_campus',
        level: 1,
        xp: 0,
        coins: 150,
        hearts: 5,
        maxHearts: 5,
        lastHeartRegenTime: Date.now(),
        hintsCount: 3,
        hasTakenPlacementTest: false,
        initialRecommendedLevel: 1,
        recommendedFocus: {
          shouldPractice: ['Làm quen với các câu hỏi kiểm tra cơ bản'],
          strongAt: ['Tinh thần học hỏi hăng hái'],
        },
        unlockedAchievements: ['first_login'],
        inventory: ['bg_campus'],
        subjectStats: {
          toan: { answeredCount: 0, correctCount: 0, proficiency: 'Mới bắt đầu' },
          tieng_anh: { answeredCount: 0, correctCount: 0, proficiency: 'Mới bắt đầu' },
          tin_hoc: { answeredCount: 0, correctCount: 0, proficiency: 'Mới bắt đầu' },
          ngu_van: { answeredCount: 0, correctCount: 0, proficiency: 'Mới bắt đầu' },
          khoa_hoc: { answeredCount: 0, correctCount: 0, proficiency: 'Mới bắt đầu' },
        },
        totalGamesPlayed: 0,
        highestStreak: 0,
        joinedDate: new Date().toISOString().split('T')[0],
      };

      // 3. Establish active session and save profile locally with provider 'firebase_email'
      StorageService.createSession(newProfile.id, 'firebase_email');
      StorageService.saveUserProfile(newProfile);
      StorageService.cacheAccountProfile(newProfile, 'firebase_email');

      // 4. Background sync to Firestore safely
      FirebaseDataService.syncUserProfile(newProfile).catch((syncErr) => {
        console.warn('[Auth] Firestore sync profile non-fatal warning:', syncErr);
      });

      console.log('[Auth] Registration complete and session created for:', newProfile.id);
      soundManager.playLevelUp();
      onSuccess(newProfile, true);
    } catch (err: any) {
      console.error('[Auth] Registration error:', err);
      const friendlyMsg = getFriendlyAuthError(err);
      setRegisterError(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top banner */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 text-white text-center relative">
          {(onClose || onCancel) && (
            <button
              onClick={handleClose}
              id="btn-close-auth-modal"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl mb-2 text-3xl shadow-inner">
            ✨
          </div>
          <h2 className="text-2xl font-black tracking-tight">TRI THỨC VUI</h2>
          <p className="text-amber-100 text-xs sm:text-sm font-medium mt-1">
            Đấu Trường Học Tập Kết Hợp Trò Chơi Dành Cho Lớp 1 - 12
          </p>
        </div>

        {/* WELCOME SCREEN */}
        {mode === 'welcome' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-800">Chào Mừng Bạn Nhỏ! 🎉</h3>
              <p className="text-slate-600 text-sm">
                Cùng chinh phục 5 chế độ trò chơi hấp dẫn, tích lũy điểm XP, xu thưởng và mở khóa trang phục siêu đỉnh!
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 bg-amber-50/60 rounded-2xl border border-amber-100 text-center">
              <div>
                <div className="text-xl">❤️</div>
                <div className="text-xs font-bold text-slate-700">5 Tim Khởi Đầu</div>
                <div className="text-[10px] text-slate-500">Thoải mái thử sức</div>
              </div>
              <div>
                <div className="text-xl">🏆</div>
                <div className="text-xs font-bold text-slate-700">5 Chế Độ Game</div>
                <div className="text-[10px] text-slate-500">Đua xe, Tháp, Boss</div>
              </div>
              <div>
                <div className="text-xl">🛡️</div>
                <div className="text-xs font-bold text-slate-700">100% An Toàn</div>
                <div className="text-[10px] text-slate-500">Không nạp tiền thật</div>
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2 animate-in fade-in">
                <span className="text-base shrink-0">⚠️</span>
                <div className="space-y-1">
                  <div className="font-semibold">{loginError}</div>
                  <button
                    type="button"
                    onClick={() => setLoginError('')}
                    className="text-[11px] text-rose-600 hover:underline font-medium"
                  >
                    Đóng thông báo
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {/* Google Sign-In with Firebase Auth */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isFirebaseLoading}
                id="btn-google-signin-welcome"
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 disabled:opacity-75 text-slate-700 border-2 border-slate-200 hover:border-slate-300 rounded-2xl font-bold text-sm shadow-xs flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-[0.98]"
              >
                {isFirebaseLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                    <span>Đang kết nối Google Sign-In...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Đăng Nhập Nhanh Bằng Google</span>
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-semibold uppercase">Hoặc</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                onClick={() => setMode('register')}
                id="btn-welcome-register"
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-bold text-sm shadow-md shadow-orange-200 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4" />
                Đăng Ký Tài Khoản Mới
              </button>

              <button
                onClick={() => setMode('login')}
                id="btn-welcome-login"
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Đã Có Tài Khoản? Đăng Nhập
              </button>
            </div>
          </div>
        )}

        {/* LOGIN SCREEN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Đăng Nhập Tài Khoản</h3>
              <button
                type="button"
                onClick={() => setMode('welcome')}
                className="text-xs text-amber-600 font-semibold hover:underline"
              >
                ← Quay lại
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email đăng nhập *
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="VD: hocsinh@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu *
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                required
              />
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                id="btn-submit-login"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 text-white rounded-2xl font-bold text-sm shadow-md shadow-orange-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                {isSubmitting ? 'Đang Đăng Nhập...' : 'Vào Đấu Trường Ngay'}
              </button>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isFirebaseLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 disabled:opacity-75 text-slate-700 border border-slate-200 rounded-2xl font-bold text-xs shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                {isFirebaseLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                    <span>Đang kết nối Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Đăng nhập nhanh bằng Google</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <span className="text-xs text-slate-500">Chưa có tài khoản? </span>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs font-bold text-amber-600 hover:underline"
                >
                  Đăng ký ngay
                </button>
              </div>
            </div>
          </form>
        )}

        {/* REGISTER SCREEN */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="p-6 sm:p-8 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Đăng Ký Học Sinh Mới</h3>
                <p className="text-xs text-slate-500">Tạo hồ sơ và chuẩn bị kiểm tra trình độ</p>
              </div>
              <button
                type="button"
                onClick={() => setMode('welcome')}
                className="text-xs text-amber-600 font-semibold hover:underline"
              >
                ← Quay lại
              </button>
            </div>

            {registerError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {registerError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên học sinh (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Trần Hoàng Long"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên tài khoản (Biệt danh - không bắt buộc)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: hoanglong_star"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email đăng ký (Học sinh hoặc phụ huynh) *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: hocsinh@gmail.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu đăng nhập *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 text-sm"
                  minLength={6}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Xác nhận mật khẩu *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 text-sm"
                  minLength={6}
                  required
                />
              </div>
            </div>

            {/* GRADE SELECTION (1 to 12) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Lớp đang học hiện tại *</span>
                <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                  Đang chọn: Lớp {grade}
                </span>
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as GradeLevel[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      grade === g
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm scale-105'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Lớp {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trường học (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="VD: THCS Chu Văn An"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Môn học yêu thích nhất
                </label>
                <select
                  value={favoriteSubject}
                  onChange={(e) => setFavoriteSubject(e.target.value as SubjectId)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 text-sm bg-white font-medium"
                >
                  <option value="toan">📐 Toán Học</option>
                  <option value="tieng_anh">🇬🇧 Tiếng Anh</option>
                  <option value="tin_hoc">💻 Tin Học</option>
                  <option value="ngu_van">📖 Ngữ Văn</option>
                  <option value="khoa_hoc">🔬 Khoa Học Tự Nhiên</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mục tiêu học tập của bạn
              </label>
              <input
                type="text"
                value={learningGoal}
                onChange={(e) => setLearningGoal(e.target.value)}
                placeholder="VD: Đạt học sinh Giỏi, nâng cao tiếng Anh, rèn luyện tư duy logic"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                id="btn-submit-register"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 text-white rounded-2xl font-bold text-sm shadow-md shadow-orange-200 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                {isSubmitting ? 'Đang Tạo Tài Khoản...' : 'Hoàn Tất & Vào Kiểm Tra Trình Độ'}
              </button>
            </div>
          </form>
        )}

        {/* Footer safety pledge */}
        <div className="bg-slate-50 px-6 py-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Môi trường học tập an toàn, thân thiện
          </span>
          <span>EduPlay © 2026</span>
        </div>
      </div>
    </div>
  );
};
