import { LeaderboardUser, GradeLevel } from '../types';

export const SAFE_NICKNAME_PRESETS = [
  'Học Sinh Mặt Trời ☀️',
  'Chiến Binh Tri Thức 🛡️',
  'Nhà Thám Hiểm Toán Học 🚀',
  'Mầm Xanh Chăm Học 🌱',
  'Sao Sáng Đất Việt ⭐',
  'Hiệp Sĩ Ngôn Từ 📖',
  'Thần Đồng Tính Nhanh ⚡',
  'Búp Măng Non 🎋',
  'Nhà Thông Thái Nhí 🦉',
  'Bạn Nhỏ Tinh Anh 🌟',
  'Hiệp Sĩ Sáng Tạo 🎨',
  'Chiến Binh Sao Băng 🌠',
  'Ong Chăm Chỉ 🐝',
  'Người Học Kiên Trì 🧭',
  'Họa Sĩ Nhí Đam Mê 🖌️',
  'Nhà Khoa Học Tương Lai 🔬'
];

/**
 * Generate a playful, positive and child-safe nickname based on grade or random index
 */
export function generateSafeNickname(grade?: number): string {
  const seed = typeof grade === 'number' && grade >= 1 && grade <= 12 ? grade : Math.floor(Math.random() * 100);
  const index = Math.abs(seed * 7 + Math.floor(Math.random() * SAFE_NICKNAME_PRESETS.length)) % SAFE_NICKNAME_PRESETS.length;
  const numSuffix = Math.floor(100 + Math.random() * 900);
  const base = SAFE_NICKNAME_PRESETS[index];
  return `${base.split(' ')[0]} ${base.split(' ')[1] || 'Nhí'} #${numSuffix}`;
}

/**
 * Validate that a nickname does not contain PII (emails, phone numbers, full addresses)
 */
export function validateSafeNickname(nickname: string): { isValid: boolean; message?: string } {
  if (!nickname || typeof nickname !== 'string') {
    return { isValid: false, message: 'Biệt danh không được để trống.' };
  }
  const clean = nickname.trim();
  if (clean.length < 2) {
    return { isValid: false, message: 'Biệt danh cần có ít nhất 2 ký tự.' };
  }
  if (clean.length > 30) {
    return { isValid: false, message: 'Biệt danh tối đa 30 ký tự.' };
  }
  // Check for email addresses
  if (/@|(\.com|\.vn|\.edu|\.org|\.net)/i.test(clean)) {
    return { isValid: false, message: 'Biệt danh an toàn không được chứa địa chỉ email.' };
  }
  // Check for phone numbers (6 or more digits)
  if (/(?:\d[\s.-]?){6,}/.test(clean)) {
    return { isValid: false, message: 'Biệt danh an toàn không được chứa số điện thoại.' };
  }
  // Check for inappropriate words
  const forbiddenPatterns = [
    /\b(admin|root|system|mod)\b/i,
    /\b(chửi|tục|bậy|sex|porn|hack|cheat)\b/i
  ];
  for (const pat of forbiddenPatterns) {
    if (pat.test(clean)) {
      return { isValid: false, message: 'Biệt danh chứa từ ngữ không phù hợp với môi trường học tập.' };
    }
  }

  return { isValid: true };
}

/**
 * Sanitize display name for leaderboard, falling back to safe alias if private or contains PII
 */
export function getSafeDisplayName(
  fullName: string,
  safeNickname?: string,
  privacyMode: 'anonymous' | 'private' | 'custom_name' = 'anonymous'
): string {
  if (privacyMode === 'private') {
    return 'Người Học Ẩn Danh 🔒';
  }
  if (privacyMode === 'anonymous' || !fullName) {
    return safeNickname || 'Bạn Học Tri Thức ⭐';
  }
  const validation = validateSafeNickname(fullName);
  if (!validation.isValid) {
    return safeNickname || 'Bạn Học Tri Thức ⭐';
  }
  return fullName.trim();
}

/**
 * Mock global leaderboard with child-friendly safe nicknames and non-identifying schools
 */
export const MOCK_GLOBAL_LEADERBOARD: LeaderboardUser[] = [
  {
    id: 'user_top_1',
    rank: 1,
    fullName: 'Chiến Binh Sao Băng 🌠',
    displayName: 'Chiến Binh Sao Băng 🌠',
    safeNickname: 'Chiến Binh Sao Băng 🌠',
    username: 'sao_bang_tri_thuc',
    avatar: '🧙‍♂️',
    avatarFrame: '👑',
    grade: 7,
    school: 'Trường Bạn Học Tri Thức',
    isSchoolHidden: true,
    level: 18,
    xp: 6420,
    correctAnswers: 412,
    streak: 24,
    privacyMode: 'anonymous',
    encouragingBadge: 'Quán Quân Chuyên Cần 👑'
  },
  {
    id: 'user_top_2',
    rank: 2,
    fullName: 'Mầm Xanh Tri Thức 🌱',
    displayName: 'Mầm Xanh Tri Thức 🌱',
    safeNickname: 'Mầm Xanh Tri Thức 🌱',
    username: 'mam_xanh_chăm_học',
    avatar: '🚀',
    avatarFrame: '⚡',
    grade: 7,
    school: 'Trường Bạn Học Cùng Khối',
    isSchoolHidden: true,
    level: 17,
    xp: 5980,
    correctAnswers: 388,
    streak: 19,
    privacyMode: 'anonymous',
    encouragingBadge: 'Chiến Binh Tốc Độ ⚡'
  },
  {
    id: 'user_top_3',
    rank: 3,
    fullName: 'Hiệp Sĩ Toán Học ⚔️',
    displayName: 'Hiệp Sĩ Toán Học ⚔️',
    safeNickname: 'Hiệp Sĩ Toán Học ⚔️',
    username: 'hiep_si_toan',
    avatar: '🤖',
    avatarFrame: '🔥',
    grade: 8,
    school: 'Trường Bạn Học Tri Thức',
    isSchoolHidden: true,
    level: 16,
    xp: 5410,
    correctAnswers: 350,
    streak: 16,
    privacyMode: 'anonymous',
    encouragingBadge: 'Bộ Não Siêu Phàm 🧠'
  },
  {
    id: 'user_top_4',
    rank: 4,
    fullName: 'Nhà Thám Hiểm Nhí 🔬',
    displayName: 'Nhà Thám Hiểm Nhí 🔬',
    safeNickname: 'Nhà Thám Hiểm Nhí 🔬',
    username: 'nha_tham_hiem',
    avatar: '🔬',
    avatarFrame: '🌱',
    grade: 6,
    school: 'Trường Bạn Học Vui Vẻ',
    isSchoolHidden: true,
    level: 15,
    xp: 4950,
    correctAnswers: 320,
    streak: 14,
    privacyMode: 'anonymous',
    encouragingBadge: 'Khám Phá Sáng Tạo 🌟'
  },
  {
    id: 'user_top_5',
    rank: 5,
    fullName: 'Ong Vàng Chăm Chỉ 🐝',
    displayName: 'Ong Vàng Chăm Chỉ 🐝',
    safeNickname: 'Ong Vàng Chăm Chỉ 🐝',
    username: 'ong_vang_cham_chi',
    avatar: '💻',
    grade: 10,
    school: 'Trường Bạn Học Tri Thức',
    isSchoolHidden: true,
    level: 14,
    xp: 4520,
    correctAnswers: 295,
    streak: 12,
    privacyMode: 'anonymous',
    encouragingBadge: 'Chuyên Cần Kiên Trì 🛡️'
  },
  {
    id: 'user_top_6',
    rank: 6,
    fullName: 'Búp Măng Non 🎋',
    displayName: 'Búp Măng Non 🎋',
    safeNickname: 'Búp Măng Non 🎋',
    username: 'bup_mang_non',
    avatar: '🎒',
    grade: 5,
    school: 'Trường Tiểu Học Thân Thiện',
    isSchoolHidden: true,
    level: 13,
    xp: 3980,
    correctAnswers: 260,
    streak: 11,
    privacyMode: 'anonymous',
    encouragingBadge: 'Hạt Giống Tri Thức 🌾'
  },
  {
    id: 'user_top_7',
    rank: 7,
    fullName: 'Thần Đồng Tính Nhanh ⚡',
    displayName: 'Thần Đồng Tính Nhanh ⚡',
    safeNickname: 'Thần Đồng Tính Nhanh ⚡',
    username: 'tinh_nhanh_sieutoc',
    avatar: '⚡',
    grade: 9,
    school: 'Trường Bạn Học Cùng Khối',
    isSchoolHidden: true,
    level: 12,
    xp: 3650,
    correctAnswers: 240,
    streak: 10,
    privacyMode: 'anonymous',
    encouragingBadge: 'Phản Xạ Tia Chớp ⚡'
  },
  {
    id: 'user_top_8',
    rank: 8,
    fullName: 'Học Sinh Mặt Trời ☀️',
    displayName: 'Học Sinh Mặt Trời ☀️',
    safeNickname: 'Học Sinh Mặt Trời ☀️',
    username: 'hoc_sinh_mat_troi',
    avatar: '🌸',
    grade: 7,
    school: 'Trường Bạn Học Thân Thiện',
    isSchoolHidden: true,
    level: 11,
    xp: 3320,
    correctAnswers: 215,
    streak: 9,
    privacyMode: 'anonymous',
    encouragingBadge: 'Tỏa Sáng Tri Thức ☀️'
  },
];

export const MOCK_FRIENDS_LEADERBOARD: LeaderboardUser[] = [
  {
    id: 'friend_1',
    rank: 1,
    fullName: 'Học Sinh Mặt Trời ☀️',
    displayName: 'Học Sinh Mặt Trời ☀️',
    safeNickname: 'Học Sinh Mặt Trời ☀️',
    username: 'hoc_sinh_mat_troi',
    avatar: '🌸',
    avatarFrame: '🌱',
    grade: 7,
    school: 'Cùng nhóm học',
    isSchoolHidden: true,
    level: 11,
    xp: 3320,
    correctAnswers: 215,
    streak: 9,
    privacyMode: 'anonymous',
    encouragingBadge: 'Tiến Bộ Xuất Sắc 🌟'
  },
  {
    id: 'friend_2',
    rank: 2,
    fullName: 'Bạn Học Khám Phá 🧭',
    displayName: 'Bạn Học Khám Phá 🧭',
    safeNickname: 'Bạn Học Khám Phá 🧭',
    username: 'ban_hoc_kham_pha',
    avatar: '🎮',
    grade: 7,
    school: 'Cùng nhóm học',
    isSchoolHidden: true,
    level: 9,
    xp: 2650,
    correctAnswers: 180,
    streak: 7,
    privacyMode: 'anonymous',
    encouragingBadge: 'Đồng Đội Tích Cực 🤝'
  },
  {
    id: 'friend_3',
    rank: 3,
    fullName: 'Họa Sĩ Nhí Đam Mê 🎨',
    displayName: 'Họa Sĩ Nhí Đam Mê 🎨',
    safeNickname: 'Họa Sĩ Nhí Đam Mê 🎨',
    username: 'hoa_si_nhi',
    avatar: '🎨',
    grade: 7,
    school: 'Cùng nhóm học',
    isSchoolHidden: true,
    level: 8,
    xp: 2200,
    correctAnswers: 150,
    streak: 6,
    privacyMode: 'anonymous',
    encouragingBadge: 'Sáng Tạo Không Ngừng 🎨'
  },
];
