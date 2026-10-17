// Level 1 to 300 XP Table and Milestone Rewards configuration
// Required XP increases smoothly up to Level 300 (Max Level)

export const MAX_LEVEL = 300;

export interface LevelMilestoneReward {
  level: number;
  coins?: number;
  title?: string;
  badge?: string;
  icon: string;
  description: string;
}

// XP formula: Cumulative XP for level L
// L1 = 0, L2 = 100, L3 = 250, L4 = 450, L5 = 700, L6 = 1000, L7 = 1350, L8 = 1750, L9 = 2200, L10 = 2700...
export function getRequiredTotalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) level = MAX_LEVEL;
  return 25 * (level * level + level - 2);
}

// Calculate level (1 - 300) directly from TOTAL_XP
export function calculateLevelFromXp(totalXp: number): number {
  if (totalXp <= 0) return 1;
  
  // Inverse of 25*(L^2 + L - 2) <= totalXp
  // L^2 + L - (2 + totalXp / 25) = 0
  // L = (-1 + sqrt(1 + 4*(2 + totalXp / 25))) / 2
  const c = 2 + totalXp / 25;
  const rawL = (-1 + Math.sqrt(1 + 4 * c)) / 2;
  const level = Math.floor(rawL);
  
  if (level < 1) return 1;
  if (level >= MAX_LEVEL) return MAX_LEVEL;
  return level;
}

// Get XP progress within current level
export function getLevelProgress(totalXp: number): {
  currentLevel: number;
  isMaxLevel: boolean;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  percent: number;
  remainingXpToNext: number;
  currentLevelFloorXp: number;
  nextLevelFloorXp: number;
} {
  const currentLevel = calculateLevelFromXp(totalXp);
  const isMaxLevel = currentLevel >= MAX_LEVEL;
  
  const currentFloor = getRequiredTotalXpForLevel(currentLevel);
  const nextFloor = getRequiredTotalXpForLevel(currentLevel + 1);
  
  if (isMaxLevel) {
    return {
      currentLevel: MAX_LEVEL,
      isMaxLevel: true,
      xpInCurrentLevel: totalXp - currentFloor,
      xpNeededForNextLevel: 0,
      percent: 100,
      remainingXpToNext: 0,
      currentLevelFloorXp: currentFloor,
      nextLevelFloorXp: currentFloor,
    };
  }

  const xpInCurrentLevel = Math.max(0, totalXp - currentFloor);
  const xpNeededForNextLevel = Math.max(1, nextFloor - currentFloor);
  const percent = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100));
  const remainingXpToNext = Math.max(0, nextFloor - totalXp);

  return {
    currentLevel,
    isMaxLevel: false,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    percent,
    remainingXpToNext,
    currentLevelFloorXp: currentFloor,
    nextLevelFloorXp: nextFloor,
  };
}

// Milestone rewards
export const LEVEL_MILESTONE_REWARDS: Record<number, LevelMilestoneReward> = {
  2: {
    level: 2,
    coins: 20,
    icon: '🪙',
    description: 'Thưởng khởi đầu hành trình: +20 Xu',
  },
  3: {
    level: 3,
    coins: 30,
    icon: '🪙',
    description: 'Vững bước tri thức: +30 Xu',
  },
  5: {
    level: 5,
    coins: 50,
    badge: 'badge_level_5',
    title: 'Học Giả Tí Hon',
    icon: '🌱',
    description: 'Huy hiệu "Học Giả Tí Hon" & +50 Xu',
  },
  10: {
    level: 10,
    coins: 100,
    title: 'Ngôi Sao Sáng',
    icon: '🌿',
    description: 'Khung Avatar "Vòng Nguyệt Quế Vàng" & +100 Xu',
  },
  15: {
    level: 15,
    coins: 150,
    title: 'Chiến Binh Trí Tuệ',
    icon: '⚡',
    description: 'Hiệu ứng "Tia Sét Trí Tuệ" & +150 Xu',
  },
  20: {
    level: 20,
    coins: 250,
    badge: 'badge_level_20',
    title: 'Học Bá Siêu Đẳng',
    icon: '💎',
    description: 'Huy hiệu Kim Cương & +250 Xu',
  },
  50: {
    level: 50,
    coins: 500,
    badge: 'badge_level_50',
    title: 'Bậc Thầy Học Viện',
    icon: '⭐',
    description: 'Badge Hiếm "Cao Thủ Tri Thức" & +500 Xu',
  },
  100: {
    level: 100,
    coins: 1000,
    badge: 'badge_level_100',
    title: 'Huyền Thoại Trẻ',
    icon: '👑',
    description: 'Khung Hoàng Gia & +1.000 Xu',
  },
  200: {
    level: 200,
    coins: 2000,
    badge: 'badge_level_200',
    title: 'Đại Tôn Sư',
    icon: '🔮',
    description: 'Hiệu ứng "Hào Quang Vĩ Đại" & +2.000 Xu',
  },
  300: {
    level: 300,
    coins: 5000,
    badge: 'badge_level_300',
    title: 'Đại Tông Sư Tri Thức Tối Cao',
    icon: '🏆',
    description: 'Cúp Vinh Quang Cấp 300 - ĐẠT CẤP TỐI ĐA & +5.000 Xu',
  },
};
