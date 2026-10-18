export type GradeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type SubjectId = 'toan' | 'tieng_anh' | 'tin_hoc' | 'ngu_van' | 'khoa_hoc';

export interface SubjectInfo {
  id: SubjectId;
  name: string;
  icon: string;
  color: string;
  bgLight: string;
  borderColor: string;
  topics: string[];
  description: string;
}

export type GameModeId = 
  | 'dau_truong' 
  | 'cuoc_dua' 
  | 'thap_tri_thuc' 
  | 'san_kho_bau' 
  | 'dau_boss'
  | 'phan_xa'
  | 'xep_hinh'
  | 'thach_dau_ai';

export interface GameModeInfo {
  id: GameModeId;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  badge: string;
  color: string;
  bgGradient: string;
}

export interface Question {
  id: string;
  grade: GradeLevel;
  subject: SubjectId;
  topic: string;
  difficulty: 1 | 2 | 3 | 4 | 5 | 6; // Level 1 - 6
  content: string;
  options: string[];
  correctIndex: number;
  correctAnswerText?: string;
  explanation: string;
  hint: string;
  lessonName?: string;
  textbook?: string;
  proofSource?: string;
  qualityScore?: number;
  qualityCheck?: {
    inScope: boolean;
    dataConsistent: boolean;
    answerAccurate: boolean;
    explanationValid: boolean;
    singleCorrectOption: boolean;
    distractorsValid: boolean;
    nonDuplicate: boolean;
    gradeAppropriate: boolean;
    qualityScore: number;
    overallStatus: 'PASSED' | 'FLAGGED' | 'REJECTED';
    notes: string;
  };
}

export type SkillProficiency = 'Mới bắt đầu' | 'Cơ bản' | 'Khá' | 'Tốt' | 'Nâng cao';

export interface SubjectStats {
  answeredCount: number;
  correctCount: number;
  proficiency: SkillProficiency;
}

export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  grade: GradeLevel;
  school?: string;
  favoriteSubject: SubjectId;
  learningGoal: string;
  avatar: string;
  avatarFrame?: string;
  equippedBackground?: string;
  equippedOutfit?: string;
  level: number;
  xp: number;
  coins: number;
  hearts: number;
  maxHearts: number;
  lastHeartRegenTime: number; // timestamp
  hintsCount: number;
  hasTakenPlacementTest: boolean;
  initialRecommendedLevel: number;
  recommendedFocus: {
    shouldPractice: string[];
    strongAt: string[];
  };
  unlockedAchievements: string[];
  inventory: string[]; // item IDs
  subjectStats: Record<SubjectId, SubjectStats>;
  totalGamesPlayed: number;
  highestStreak: number;
  dailyStreak: number;
  lastActiveDate?: string;
  joinedDate: string;
  questionHistory?: string[]; // IDs of answered questions for no-repeat logic
  wrongQuestionsHistory?: { questionId: string; subject: SubjectId; topic: string; timestamp: number }[];
  claimedMilestones?: number[]; // Level rewards already claimed
  privacySettings?: StudentPrivacySettings;
}

export type LeaderboardPrivacyMode = 'anonymous' | 'private' | 'custom_name';

export interface StudentPrivacySettings {
  leaderboardMode: LeaderboardPrivacyMode;
  safeNickname: string;
  hideSchool: boolean;
  allowFriendSearch?: boolean;
}

export interface UserSession {
  userId: string;
  token: string;
  authProvider: 'firebase' | 'firebase_email' | 'firebase_google' | 'local';
  createdAt: number;
  expiresAt: number;
}

export interface StoredAccount {
  id: string;
  username: string;
  email: string;
  authProvider: 'firebase' | 'firebase_email' | 'firebase_google' | 'local';
  createdAt: number;
  profile: UserProfile;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'general' | 'streak' | 'subject' | 'game';
  rewardCoins: number;
  rewardXp: number;
  badgeName: string;
  isUnlocked?: boolean;
}

export type ShopItemType = 'avatar' | 'character' | 'outfit' | 'frame' | 'booster' | 'hint' | 'background' | 'title';

export interface ShopItem {
  id: string;
  name: string;
  category?: 'character' | 'outfit' | 'frame' | 'background' | 'hint' | 'booster' | 'title';
  type?: 'avatar' | 'outfit' | 'frame' | 'booster' | 'hint' | 'title';
  price: number;
  preview?: string;
  icon?: string;
  avatar?: string;
  avatarFrame?: string;
  description: string;
  isEquipped?: boolean;
  isOwned?: boolean;
}

export type LeaderboardEntry = LeaderboardUser;

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  rewardCoins: number;
  rewardXp: number;
  completed: boolean;
  claimed: boolean;
}

export interface LeaderboardUser {
  id: string;
  rank: number;
  fullName: string;
  displayName?: string;
  safeNickname?: string;
  username: string;
  avatar: string;
  avatarFrame?: string;
  grade: GradeLevel;
  school: string;
  isSchoolHidden?: boolean;
  level: number;
  xp: number;
  correctAnswers: number;
  streak: number;
  isCurrentUser?: boolean;
  privacyMode?: LeaderboardPrivacyMode;
  encouragingBadge?: string;
}

export interface QuizResult {
  gameMode: GameModeId;
  subject: SubjectId;
  level: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  xpEarned: number;
  coinsEarned: number;
  remainingHearts: number;
  newAchievements: Achievement[];
  leveledUp: boolean;
  newLevel: number;
}

// ==========================================
// QUY TRÌNH TẠO, KIỂM TRA & LƯU CÂU HỎI BÁM SÁT SGK
// ==========================================

export interface TextbookLesson {
  lessonNumber: number;
  title: string;
  coreKnowledge: string;
  pageReference?: string;
  allowedConcepts?: string[];
  allowedFormulas?: string[];
}

export interface TextbookKnowledgeSet {
  id: string;
  subject: SubjectId;
  grade: GradeLevel;
  textbook: string;
  edition?: string;
  description?: string;
  lessons: TextbookLesson[];
  disallowedTopics?: string[];
  createdAt: string;
  updatedAt: string;
}

export type QuestionVerificationStatus = 'pending_verification' | 'passed_review' | 'flagged' | 'rejected';
export type QuestionReviewerStatus = 'pending_review' | 'approved' | 'rejected';

export interface QuestionVerificationResult {
  passed: boolean;
  codeValidationPassed: boolean;
  codeValidationErrors: string[];
  inScope: boolean;
  answerConsistent: boolean;
  evidenceSufficient: boolean;
  singleCorrectOption: boolean;
  distractorsValid: boolean;
  explanationValid: boolean;
  gradeAppropriate: boolean;
  issueType?: 'OUT_OF_SCOPE' | 'WRONG_ANSWER' | 'MULTIPLE_CORRECT' | 'NO_CORRECT' | 'CONTRADICTORY_EXPLANATION' | 'INSUFFICIENT_EVIDENCE' | 'AMBIGUOUS' | 'DATA_INVALID' | null;
  reviewNotes: string;
  suggestedCorrection?: {
    correctedIndex?: number;
    explanation?: string;
    notes?: string;
  } | null;
  qualityScore: number;
}

export interface TextbookQuestion {
  id: string;
  grade: GradeLevel;
  subject: SubjectId;
  topic: string;
  content: string;
  options: string[];
  correctIndex: number;
  correctAnswerText: string;
  explanation: string;
  hint?: string;
  textbook: string;
  edition?: string;
  lessonNumber: number;
  lessonTitle: string;
  pageReference?: string;
  sourceEvidence: string;
  sourceKnowledgeSetId?: string;
  verificationStatus: QuestionVerificationStatus;
  verificationResult?: QuestionVerificationResult;
  qualityScore?: number;
  reviewerStatus: QuestionReviewerStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
}

