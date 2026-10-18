import { 
  UserProfile, 
  GradeLevel, 
  SubjectId, 
  Achievement, 
  DailyMission, 
  LeaderboardUser, 
  UserSession, 
  StoredAccount,
  StudentPrivacySettings,
  LeaderboardPrivacyMode
} from '../types';
import { INITIAL_ACHIEVEMENTS } from '../data/achievements';
import { INITIAL_DAILY_MISSIONS } from '../data/dailyMissions';
import { 
  MOCK_GLOBAL_LEADERBOARD, 
  MOCK_FRIENDS_LEADERBOARD,
  generateSafeNickname,
  getSafeDisplayName,
  validateSafeNickname
} from '../data/leaderboardData';
import { 
  calculateLevelFromXp, 
  getLevelProgress, 
  MAX_LEVEL, 
  LEVEL_MILESTONE_REWARDS 
} from '../data/levelConfig';

const STORAGE_KEYS = {
  USER_PROFILE: 'eduplay_user_profile',
  SESSION: 'eduplay_active_session',
  ACCOUNTS_DB: 'eduplay_all_accounts',
  ACHIEVEMENTS: 'eduplay_achievements',
  DAILY_MISSIONS: 'eduplay_daily_missions',
  LEADERBOARD: 'eduplay_leaderboard',
};

export class StorageService {
  // Clean up any legacy test user data or stored password remnants
  public static cleanupLegacyTestData(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id === 'user_default' || parsed?.username === 'haidang_2026' || parsed?.email === 'haidang@eduplay.vn') {
          localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
        }
      }
      const sessionRaw = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        if (session?.userId === 'user_default') {
          localStorage.removeItem(STORAGE_KEYS.SESSION);
        }
      }
      const accountsRaw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS_DB);
      if (accountsRaw) {
        const accounts = JSON.parse(accountsRaw);
        let changed = false;
        for (const key of Object.keys(accounts)) {
          if (key === 'user_default' || key === 'haidang_2026') {
            delete accounts[key];
            changed = true;
          } else {
            // Security: remove any legacy password fields from client storage
            if (accounts[key].passwordHash || accounts[key].passwordSalt || accounts[key].password) {
              delete accounts[key].passwordHash;
              delete accounts[key].passwordSalt;
              delete accounts[key].password;
              changed = true;
            }
          }
        }
        if (changed) {
          localStorage.setItem(STORAGE_KEYS.ACCOUNTS_DB, JSON.stringify(accounts));
        }
      }
    } catch {
      // ignore
    }
  }

  // Get all local registered accounts
  public static getAllAccounts(): Record<string, StoredAccount> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS_DB);
      if (!raw) return {};
      const accounts = JSON.parse(raw);
      return typeof accounts === 'object' && accounts !== null ? accounts : {};
    } catch {
      return {};
    }
  }

  // Save all local registered accounts
  public static saveAllAccounts(accounts: Record<string, StoredAccount>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS_DB, JSON.stringify(accounts));
    } catch {
      // ignore
    }
  }

  // Cache an authenticated account profile in local storage
  public static cacheAccountProfile(
    profile: UserProfile,
    authProvider: 'firebase' | 'firebase_email' | 'firebase_google' | 'local'
  ): void {
    const accounts = this.getAllAccounts();
    accounts[profile.id] = {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      authProvider,
      createdAt: Date.now(),
      profile,
    };
    this.saveAllAccounts(accounts);
  }

  // Create and persist active session
  public static createSession(
    userId: string,
    authProvider: 'firebase' | 'firebase_email' | 'firebase_google' | 'local'
  ): UserSession {
    const session: UserSession = {
      userId,
      token: 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10),
      authProvider,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30-day session
    };
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    } catch {
      // ignore
    }
    return session;
  }

  // Get active session if still valid
  public static getActiveSession(): UserSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!raw) return null;
      const session: UserSession = JSON.parse(raw);
      if (!session || !session.userId) return null;
      if (session.userId === 'user_default') {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        return null;
      }
      if (session.expiresAt && Date.now() > session.expiresAt) {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  // Ensure child-safe privacy defaults on profile
  public static ensurePrivacyDefaults(user: UserProfile): UserProfile {
    if (!user) return user;
    let changed = false;
    if (!user.privacySettings) {
      user.privacySettings = {
        leaderboardMode: 'anonymous', // Default: Safe anonymous alias
        safeNickname: generateSafeNickname(user.grade),
        hideSchool: true, // Default: Protect student's school
        allowFriendSearch: false,
      };
      changed = true;
    } else {
      if (!user.privacySettings.safeNickname) {
        user.privacySettings.safeNickname = generateSafeNickname(user.grade);
        changed = true;
      }
      if (user.privacySettings.hideSchool === undefined) {
        user.privacySettings.hideSchool = true;
        changed = true;
      }
      if (!user.privacySettings.leaderboardMode) {
        user.privacySettings.leaderboardMode = 'anonymous';
        changed = true;
      }
    }
    if (changed) {
      try {
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));
      } catch {}
    }
    return user;
  }

  // Update student privacy preferences
  public static updatePrivacySettings(privacy: Partial<StudentPrivacySettings>): UserProfile | null {
    const user = this.getUserProfile();
    if (!user) return null;
    user.privacySettings = {
      ...(user.privacySettings || {
        leaderboardMode: 'anonymous',
        safeNickname: generateSafeNickname(user.grade),
        hideSchool: true,
        allowFriendSearch: false,
      }),
      ...privacy,
    } as StudentPrivacySettings;
    this.saveUserProfile(user);
    return user;
  }

  // Get active profile for the current valid session. Returns null if not logged in.
  public static getUserProfile(): UserProfile | null {
    this.cleanupLegacyTestData();
    const session = this.getActiveSession();
    if (!session) {
      return null;
    }

    // Lookup user in isolated accounts DB
    const accounts = this.getAllAccounts();
    const account = accounts[session.userId];
    if (account && account.profile && account.profile.id !== 'user_default') {
      const withHearts = this.processHeartRegen(account.profile);
      const withStreak = this.processDailyStreak(withHearts);
      return this.ensurePrivacyDefaults(withStreak);
    }

    // Fallback: check cached active profile
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (raw) {
      try {
        const user: UserProfile = JSON.parse(raw);
        if (user && user.id === session.userId && user.id !== 'user_default') {
          const withHearts = this.processHeartRegen(user);
          const withStreak = this.processDailyStreak(withHearts);
          return this.ensurePrivacyDefaults(withStreak);
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  // Save active profile and persist directly into user's isolated account entry
  public static saveUserProfile(user: UserProfile): void {
    if (!user || !user.id || user.id === 'user_default') return;

    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));

      // Also persist into isolated accounts DB
      const accounts = this.getAllAccounts();
      if (accounts[user.id]) {
        accounts[user.id].profile = user;
        this.saveAllAccounts(accounts);
      } else {
        accounts[user.id] = {
          id: user.id,
          username: user.username,
          email: user.email,
          authProvider: 'firebase',
          createdAt: Date.now(),
          profile: user,
        };
        this.saveAllAccounts(accounts);
      }
    } catch {
      // ignore
    }
  }

  // Clear active profile and session token completely on logout
  public static logoutUser(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    } catch {
      // ignore
    }
  }

  // Process heart regeneration (1 heart every 3 minutes)
  private static processHeartRegen(user: UserProfile): UserProfile {
    if (user.hearts >= user.maxHearts) {
      user.lastHeartRegenTime = Date.now();
      return user;
    }
    const REGEN_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
    const now = Date.now();
    const elapsed = now - user.lastHeartRegenTime;
    if (elapsed >= REGEN_INTERVAL_MS) {
      const heartsToAdd = Math.floor(elapsed / REGEN_INTERVAL_MS);
      user.hearts = Math.min(user.maxHearts, user.hearts + heartsToAdd);
      user.lastHeartRegenTime = now - (elapsed % REGEN_INTERVAL_MS);
      this.saveUserProfile(user);
    }
    return user;
  }

  // Helper to format date as YYYY-MM-DD in local time
  public static getTodayDateString(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  public static getYesterdayDateString(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return this.getTodayDateString(d);
  }

  // Process and update daily learning streak
  public static processDailyStreak(user: UserProfile): UserProfile {
    if (!user || !user.id || user.id === 'user_default') return user;

    const today = this.getTodayDateString();
    const yesterday = this.getYesterdayDateString();
    let changed = false;

    if (!user.lastActiveDate) {
      user.lastActiveDate = today;
      user.dailyStreak = Math.max(1, user.dailyStreak || 1);
      changed = true;
    } else if (user.lastActiveDate === today) {
      if (!user.dailyStreak || user.dailyStreak < 1) {
        user.dailyStreak = 1;
        changed = true;
      }
    } else if (user.lastActiveDate === yesterday) {
      // User was active yesterday and is continuing streak today!
      user.dailyStreak = (user.dailyStreak || 0) + 1;
      user.lastActiveDate = today;
      changed = true;
    } else {
      // User missed one or more days -> streak resets to 1 today
      user.dailyStreak = 1;
      user.lastActiveDate = today;
      changed = true;
    }

    if ((user.dailyStreak || 1) > (user.highestStreak || 0)) {
      user.highestStreak = user.dailyStreak;
      changed = true;
    }

    // Check streak achievements
    if (!user.unlockedAchievements) user.unlockedAchievements = [];
    if (user.dailyStreak >= 3 && !user.unlockedAchievements.includes('streak_3')) {
      user.unlockedAchievements.push('streak_3');
      changed = true;
    }
    if (user.dailyStreak >= 7 && !user.unlockedAchievements.includes('streak_7')) {
      user.unlockedAchievements.push('streak_7');
      changed = true;
    }

    if (changed) {
      this.saveUserProfile(user);
    }

    return user;
  }

  // Update daily streak explicitly
  public static updateDailyStreak(user?: UserProfile | null): UserProfile | null {
    const targetUser = user || this.getUserProfile();
    if (!targetUser) return null;
    return this.processDailyStreak(targetUser);
  }

  // Instantly heal hearts with gentle mindful breath break
  public static rechargeHearts(): UserProfile | null {
    const user = this.getUserProfile();
    if (!user) return null;
    user.hearts = user.maxHearts;
    user.lastHeartRegenTime = Date.now();
    this.saveUserProfile(user);
    return user;
  }

  // Update current hearts count
  public static updateHearts(hearts: number): UserProfile | null {
    const user = this.getUserProfile();
    if (!user) return null;
    user.hearts = Math.max(0, Math.min(user.maxHearts, hearts));
    this.saveUserProfile(user);
    return user;
  }

  // Add or subtract coins
  public static addCoins(amount: number): UserProfile | null {
    const user = this.getUserProfile();
    if (!user) return null;
    user.coins = Math.max(0, user.coins + amount);
    this.saveUserProfile(user);
    return user;
  }

  // Add XP and Coins, check Level 1 - 300 promotions, unlock milestone rewards and achievements
  public static addXp(amount: number): UserProfile | null {
    return this.addXpAndCoins(amount, 0, 'xp_award');
  }

  public static addXpAndCoins(xpAmount: number, coinAmount: number = 0, source: string = 'gameplay'): UserProfile | null {
    const user = this.getUserProfile();
    if (!user) return null;

    user.xp = Math.max(0, user.xp + xpAmount);
    user.coins = Math.max(0, user.coins + coinAmount);
    
    const prevLevel = user.level;
    const newLevel = this.calculateLevel(user.xp);
    user.level = newLevel;

    // Check level milestone rewards
    if (!user.claimedMilestones) user.claimedMilestones = [];
    Object.keys(LEVEL_MILESTONE_REWARDS).forEach((lvlStr) => {
      const milestoneLvl = Number(lvlStr);
      if (user.level >= milestoneLvl && !user.claimedMilestones?.includes(milestoneLvl)) {
        user.claimedMilestones.push(milestoneLvl);
        const reward = LEVEL_MILESTONE_REWARDS[milestoneLvl];
        if (reward.coins) user.coins += reward.coins;
      }
    });

    // Check level-based achievements
    if (!user.unlockedAchievements) user.unlockedAchievements = [];
    if (user.level >= 10 && !user.unlockedAchievements.includes('ach_level_10')) {
      user.unlockedAchievements.push('ach_level_10');
    }
    if (user.level >= 50 && !user.unlockedAchievements.includes('ach_level_50')) {
      user.unlockedAchievements.push('ach_level_50');
    }
    if (user.level >= 100 && !user.unlockedAchievements.includes('ach_level_100')) {
      user.unlockedAchievements.push('ach_level_100');
    }
    if (user.level >= 300 && !user.unlockedAchievements.includes('ach_level_300')) {
      user.unlockedAchievements.push('ach_level_300');
    }

    this.saveUserProfile(user);
    return user;
  }

  // Record an answered question for "No-repeat" tracking, adaptive weaknesses, and statistics
  public static recordAnswer(
    questionId: string,
    isCorrect: boolean,
    subject: SubjectId,
    topic: string,
    difficulty: number,
    timeSpentSec?: number
  ): UserProfile | null {
    const user = this.getUserProfile();
    if (!user) return null;
    if (!user.questionHistory) user.questionHistory = [];
    if (!user.wrongQuestionsHistory) user.wrongQuestionsHistory = [];

    // Add to answered questions history if not already recorded
    if (!user.questionHistory.includes(questionId)) {
      user.questionHistory.push(questionId);
    }

    // If wrong, log to wrongQuestionsHistory for adaptive recommendation
    if (!isCorrect) {
      user.wrongQuestionsHistory.push({
        questionId,
        subject,
        topic,
        timestamp: Date.now(),
      });
      // Keep up to 100 recent errors
      if (user.wrongQuestionsHistory.length > 100) {
        user.wrongQuestionsHistory.shift();
      }
    }

    // Update subject stats
    if (!user.subjectStats) {
      user.subjectStats = {
        toan: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
        tieng_anh: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
        tin_hoc: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
        ngu_van: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
        khoa_hoc: { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' },
      };
    }
    if (!user.subjectStats[subject]) {
      user.subjectStats[subject] = { answeredCount: 0, correctCount: 0, proficiency: 'Cơ bản' };
    }

    user.subjectStats[subject].answeredCount += 1;
    if (isCorrect) {
      user.subjectStats[subject].correctCount += 1;
    }

    const accuracy = user.subjectStats[subject].correctCount / Math.max(1, user.subjectStats[subject].answeredCount);
    if (accuracy >= 0.85 && user.subjectStats[subject].answeredCount >= 10) {
      user.subjectStats[subject].proficiency = 'Nâng cao';
    } else if (accuracy >= 0.7) {
      user.subjectStats[subject].proficiency = 'Tốt';
    } else if (accuracy >= 0.5) {
      user.subjectStats[subject].proficiency = 'Khá';
    } else if (accuracy >= 0.3) {
      user.subjectStats[subject].proficiency = 'Cơ bản';
    } else {
      user.subjectStats[subject].proficiency = 'Mới bắt đầu';
    }

    // Recompute recommended focus areas dynamically from actual wrong answers
    const topicMistakes: Record<string, number> = {};
    user.wrongQuestionsHistory.forEach((item) => {
      if (item.subject === subject || !subject) {
        topicMistakes[item.topic] = (topicMistakes[item.topic] || 0) + 1;
      }
    });
    const weakTopics = Object.entries(topicMistakes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([top]) => top);
    if (weakTopics.length > 0) {
      user.recommendedFocus.shouldPractice = weakTopics;
    }

    this.processDailyStreak(user);
    this.saveUserProfile(user);
    return user;
  }

  // Clear question history for review / revision mode
  public static resetTopicHistory(subject?: SubjectId): void {
    const user = this.getUserProfile();
    if (!user) return;
    if (!subject) {
      user.questionHistory = [];
    } else {
      // Keep only other subjects
      user.questionHistory = (user.questionHistory || []).filter((qId) => !qId.startsWith(subject.slice(0, 3)));
    }
    this.saveUserProfile(user);
  }

  // XP & Level calculations (Level 1 to 300)
  public static calculateLevel(xp: number): number {
    return calculateLevelFromXp(xp);
  }

  public static getXpProgress(xp: number, level: number): { current: number; max: number; percent: number; isMaxLevel: boolean; remaining: number } {
    const prog = getLevelProgress(xp);
    return {
      current: prog.xpInCurrentLevel,
      max: prog.xpNeededForNextLevel,
      percent: prog.percent,
      isMaxLevel: prog.isMaxLevel,
      remaining: prog.remainingXpToNext,
    };
  }

  // Get achievements
  public static getAchievements(unlockedIds: string[] = []): Achievement[] {
    return INITIAL_ACHIEVEMENTS.map((ach) => ({
      ...ach,
      isUnlocked: unlockedIds.includes(ach.id),
    }));
  }

  // Get daily missions
  public static getDailyMissions(): DailyMission[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY_MISSIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DAILY_MISSIONS, JSON.stringify(INITIAL_DAILY_MISSIONS));
      return INITIAL_DAILY_MISSIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_DAILY_MISSIONS;
    }
  }

  public static saveDailyMissions(missions: DailyMission[]): void {
    localStorage.setItem(STORAGE_KEYS.DAILY_MISSIONS, JSON.stringify(missions));
  }

  // Update mission progress
  public static updateMissionProgress(
    type: 'math' | 'english' | 'streak' | 'level',
    value = 1
  ): DailyMission[] {
    const missions = this.getDailyMissions();
    missions.forEach((m) => {
      if (type === 'math' && m.id === 'mission_math_10') {
        m.current = Math.min(m.target, m.current + value);
      }
      if (type === 'english' && m.id === 'mission_english_play') {
        m.current = Math.min(m.target, m.current + value);
      }
      if (type === 'streak' && m.id === 'mission_streak_5') {
        m.current = Math.max(m.current, value);
      }
      if (type === 'level' && m.id === 'mission_complete_level') {
        m.current = Math.min(m.target, m.current + value);
      }
      if (m.current >= m.target) {
        m.completed = true;
      }
    });
    this.saveDailyMissions(missions);
    return missions;
  }

  // Claim mission reward
  public static claimMission(missionId: string): { user: UserProfile; mission: DailyMission } | null {
    const user = this.getUserProfile();
    const missions = this.getDailyMissions();
    const mission = missions.find((m) => m.id === missionId);
    if (!user || !mission || !mission.completed || mission.claimed) return null;

    mission.claimed = true;
    user.coins += mission.rewardCoins;
    user.xp += mission.rewardXp;
    user.level = this.calculateLevel(user.xp);

    this.saveDailyMissions(missions);
    this.saveUserProfile(user);
    return { user, mission };
  }

  // Leaderboard data with child-friendly privacy protections
  public static getLeaderboards(currentUser?: UserProfile): {
    global: LeaderboardUser[];
    school: LeaderboardUser[];
    grade: LeaderboardUser[];
    classroom: LeaderboardUser[];
    friends: LeaderboardUser[];
  } {
    let globalList = [...MOCK_GLOBAL_LEADERBOARD];

    if (currentUser) {
      const ensuredUser = this.ensurePrivacyDefaults(currentUser);
      const privacy = ensuredUser.privacySettings || {
        leaderboardMode: 'anonymous',
        safeNickname: generateSafeNickname(ensuredUser.grade),
        hideSchool: true,
      };

      // Compute display name based on privacy settings
      const safeName = getSafeDisplayName(
        ensuredUser.fullName,
        privacy.safeNickname,
        privacy.leaderboardMode
      );

      const userEntry: LeaderboardUser = {
        id: ensuredUser.id,
        rank: 0,
        fullName: safeName,
        displayName: safeName,
        safeNickname: privacy.safeNickname,
        username: privacy.leaderboardMode === 'private' ? 'an_danh' : ensuredUser.username,
        avatar: ensuredUser.avatar,
        avatarFrame: ensuredUser.avatarFrame,
        grade: ensuredUser.grade,
        school: privacy.hideSchool ? 'Trường Bạn Học Tri Thức' : (ensuredUser.school || 'Trường Phổ Thông'),
        isSchoolHidden: privacy.hideSchool,
        level: ensuredUser.level,
        xp: ensuredUser.xp,
        correctAnswers: Object.values(ensuredUser.subjectStats || {}).reduce((acc, s) => acc + (s.correctCount || 0), 0),
        streak: Math.max(ensuredUser.dailyStreak || 1, ensuredUser.highestStreak || 1),
        isCurrentUser: true,
        privacyMode: privacy.leaderboardMode,
        encouragingBadge: ensuredUser.dailyStreak >= 7 ? 'Chuyên Cần Vàng 🏆' : ensuredUser.dailyStreak >= 3 ? 'Chuyên Cần Bạc 🥈' : 'Người Học Tích Cực ⭐',
      };

      const existingIdx = globalList.findIndex((u) => u.id === ensuredUser.id);
      if (existingIdx >= 0) {
        globalList[existingIdx] = userEntry;
      } else {
        globalList.push(userEntry);
      }
    }

    // Sort by XP descending
    globalList.sort((a, b) => b.xp - a.xp);
    globalList = globalList.map((u, i) => ({ ...u, rank: i + 1 }));

    // Filter subsets by grade / peer group
    const gradeList = globalList.filter((u) => u.grade === (currentUser?.grade || 6) || u.isCurrentUser);
    const schoolList = globalList.filter((u) => u.isCurrentUser || u.grade === (currentUser?.grade || 6));
    const classroomList = globalList.slice(0, 5);

    const friendsList = [...MOCK_FRIENDS_LEADERBOARD];
    if (currentUser) {
      const ensuredUser = this.ensurePrivacyDefaults(currentUser);
      const safeName = getSafeDisplayName(
        ensuredUser.fullName,
        ensuredUser.privacySettings?.safeNickname,
        ensuredUser.privacySettings?.leaderboardMode
      );
      friendsList.push({
        id: ensuredUser.id,
        rank: 0,
        fullName: safeName,
        displayName: safeName,
        safeNickname: ensuredUser.privacySettings?.safeNickname,
        username: ensuredUser.username,
        avatar: ensuredUser.avatar,
        avatarFrame: ensuredUser.avatarFrame,
        grade: ensuredUser.grade,
        school: 'Cùng nhóm học',
        isSchoolHidden: true,
        level: ensuredUser.level,
        xp: ensuredUser.xp,
        correctAnswers: Object.values(ensuredUser.subjectStats || {}).reduce((acc, s) => acc + (s.correctCount || 0), 0),
        streak: Math.max(ensuredUser.dailyStreak || 1, ensuredUser.highestStreak || 1),
        isCurrentUser: true,
        privacyMode: ensuredUser.privacySettings?.leaderboardMode || 'anonymous',
        encouragingBadge: 'Đồng Đội Thân Thiết 🤝',
      });
      friendsList.sort((a, b) => b.xp - a.xp);
      friendsList.forEach((u, i) => (u.rank = i + 1));
    }

    return {
      global: globalList,
      school: schoolList.length > 0 ? schoolList : globalList.slice(0, 5),
      grade: gradeList.length > 0 ? gradeList : globalList.slice(0, 5),
      classroom: classroomList,
      friends: friendsList,
    };
  }

  // Bookmarked questions for revision
  public static getBookmarkedQuestions(): string[] {
    const raw = localStorage.getItem('eduplay_bookmarked_questions');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static toggleBookmarkQuestion(questionId: string): boolean {
    const list = this.getBookmarkedQuestions();
    const idx = list.indexOf(questionId);
    let isBookmarked = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      isBookmarked = false;
    } else {
      list.push(questionId);
      isBookmarked = true;
    }
    localStorage.setItem('eduplay_bookmarked_questions', JSON.stringify(list));
    return isBookmarked;
  }
}
