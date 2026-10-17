import { Question, GradeLevel, SubjectId } from '../types';
import { PRIMARY_QUESTIONS } from './questions/primaryQuestions';
import { SECONDARY_QUESTIONS } from './questions/secondaryQuestions';
import { HIGH_SCHOOL_QUESTIONS } from './questions/highSchoolQuestions';
import { generateProceduralQuestions } from './proceduralQuestionGenerator';

// Combined question bank for all 12 grades and 5 subjects
export const ALL_QUESTIONS: Question[] = [
  ...PRIMARY_QUESTIONS,
  ...SECONDARY_QUESTIONS,
  ...HIGH_SCHOOL_QUESTIONS,
];

// Runtime dynamic pool that grows as new questions are generated
let dynamicQuestionPool: Question[] = [...ALL_QUESTIONS];
const sessionSeenQuestionIds = new Set<string>();

const SESSION_GENERATED_STORAGE_KEY = 'ai_tutor_session_generated_questions_v1';

function loadSessionQuestionsFromStorage(): Question[] {
  if (typeof window === 'undefined' || !window.sessionStorage) return [];
  try {
    const raw = sessionStorage.getItem(SESSION_GENERATED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Failed to load session questions from sessionStorage:', err);
  }
  return [];
}

function saveSessionQuestionsToStorage(questions: Question[]): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(SESSION_GENERATED_STORAGE_KEY, JSON.stringify(questions));
  } catch (err) {
    console.warn('Failed to save session questions to sessionStorage:', err);
  }
}

// In-memory list of questions generated during the current study session
let sessionGeneratedQuestions: Question[] = loadSessionQuestionsFromStorage();

// Seed initial session storage into dynamic pool
if (sessionGeneratedQuestions.length > 0) {
  sessionGeneratedQuestions.forEach((q) => {
    if (q.id) sessionSeenQuestionIds.add(q.id);
    if (!dynamicQuestionPool.some((existing) => existing.id === q.id)) {
      dynamicQuestionPool.unshift(q);
    }
  });
}

// Seed official approved textbook questions into dynamic pool
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const rawApproved = localStorage.getItem('eduplay_approved_textbook_questions_v1');
    if (rawApproved) {
      const parsed = JSON.parse(rawApproved);
      if (Array.isArray(parsed)) {
        parsed.filter((q) => q && q.reviewerStatus === 'approved').forEach((q) => {
          if (!dynamicQuestionPool.some((existing) => existing.id === q.id)) {
            dynamicQuestionPool.unshift(q);
          }
        });
      }
    }
  } catch {}
}


/**
 * Get all questions generated in the current learning session
 */
export function getSessionGeneratedQuestions(): Question[] {
  return [...sessionGeneratedQuestions];
}

/**
 * Get the most recent questions generated in this session (or dynamic pool)
 * to pass to Gemini for anti-duplication comparison.
 */
export function getRecentSessionQuestions(count: number = 20): Question[] {
  if (sessionGeneratedQuestions.length > 0) {
    return sessionGeneratedQuestions.slice(-count);
  }
  // Fallback to recent dynamic questions if no session questions yet
  return dynamicQuestionPool.slice(-Math.min(count, 10));
}

/**
 * Store questions generated during this session, sync with sessionStorage,
 * and register them in the dynamic question pool.
 */
export function addSessionGeneratedQuestions(questions: Question[]): void {
  if (!questions || !Array.isArray(questions) || questions.length === 0) return;

  questions.forEach((newQ) => {
    if (!newQ || !newQ.id) return;
    sessionSeenQuestionIds.add(newQ.id);

    const existingIndex = sessionGeneratedQuestions.findIndex((q) => q.id === newQ.id);
    if (existingIndex >= 0) {
      sessionGeneratedQuestions[existingIndex] = newQ;
    } else {
      sessionGeneratedQuestions.push(newQ);
    }

    if (!dynamicQuestionPool.some((existing) => existing.id === newQ.id)) {
      dynamicQuestionPool.unshift(newQ);
    }
  });

  saveSessionQuestionsToStorage(sessionGeneratedQuestions);
}

/**
 * Clear the session-generated questions list
 */
export function clearSessionGeneratedQuestions(): void {
  sessionGeneratedQuestions = [];
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.removeItem(SESSION_GENERATED_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Get all question IDs seen/played in the current session
 */
export function getSessionSeenQuestionIds(): string[] {
  return Array.from(sessionSeenQuestionIds);
}

/**
 * Mark a question ID as seen in the current session
 */
export function markQuestionAsSeen(questionId: string): void {
  if (questionId) {
    sessionSeenQuestionIds.add(questionId);
  }
}

/**
 * Register newly generated questions (e.g. from Gemini or AI Generator)
 * into the active pool so all games can immediately use them.
 */
export function registerCustomQuestions(questions: Question[]): void {
  if (!questions || !Array.isArray(questions)) return;
  addSessionGeneratedQuestions(questions);
}

/**
 * Reset session seen tracker if user wants a clean rotation
 */
export function resetSessionSeenQuestions(): void {
  sessionSeenQuestionIds.clear();
}

// Helper to shuffle options so correct answer position is unpredictable
export function shuffleQuestionOptions(q: Question): Question {
  const originalCorrect = q.options[q.correctIndex];
  const indexedOptions = q.options.map((opt, idx) => ({ opt, isCorrect: idx === q.correctIndex }));
  
  // Fisher-Yates shuffle
  for (let i = indexedOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexedOptions[i], indexedOptions[j]] = [indexedOptions[j], indexedOptions[i]];
  }

  const newOptions = indexedOptions.map((item) => item.opt);
  const newCorrectIndex = indexedOptions.findIndex((item) => item.isCorrect);

  const correctText = q.correctAnswerText || q.options[q.correctIndex] || newOptions[newCorrectIndex >= 0 ? newCorrectIndex : 0];

  return {
    ...q,
    options: newOptions,
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
    correctAnswerText: correctText,
  };
}

export interface GameQuestionsResult {
  questions: Question[];
  allNewCompleted: boolean;
  totalAvailableInGrade: number;
}

/**
 * Strict Grade-Subject Filter & Infinite Non-Repeating Rule:
 * 1. Filter: grade == user.grade AND subject == selected_subject
 * 2. Exclude previously answered or seen questions
 * 3. If remaining unplayed pool is low, AUTOMATICALLY generate fresh unique questions
 *    so the student NEVER receives identical questions repeatedly.
 */
export function getQuestionsForGameDetailed(
  grade: GradeLevel,
  subject: SubjectId,
  difficulty: number = 1,
  count: number = 5,
  excludedIds: string[] = [],
  topic?: string
): GameQuestionsResult {
  const combinedExcluded = new Set([...excludedIds, ...sessionSeenQuestionIds]);

  // 1. Strict filter: EXACT grade and EXACT subject
  let gradeSubjectPool = dynamicQuestionPool.filter(
    (q) => q.grade === grade && q.subject === subject
  );

  // 2. Filter by topic if specified
  let pool = topic
    ? gradeSubjectPool.filter((q) => q.topic.toLowerCase().includes(topic.toLowerCase()))
    : gradeSubjectPool;

  if (pool.length === 0) {
    pool = gradeSubjectPool;
  }

  // 3. Exclude already answered or seen questions
  let unplayedPool = pool.filter((q) => !combinedExcluded.has(q.id));

  // If unplayed questions are insufficient, generate fresh procedural questions on the fly!
  if (unplayedPool.length < count) {
    const needed = Math.max(count * 2, 8);
    const freshQuestions = generateProceduralQuestions(
      grade,
      subject,
      difficulty,
      needed,
      Array.from(combinedExcluded)
    );
    dynamicQuestionPool.push(...freshQuestions);
    pool.push(...freshQuestions);
    unplayedPool = [...unplayedPool, ...freshQuestions];
  }

  // 4. Fisher-Yates random shuffle to guarantee varied order every game
  const shuffledCandidates = [...unplayedPool];
  for (let i = shuffledCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledCandidates[i], shuffledCandidates[j]] = [shuffledCandidates[j], shuffledCandidates[i]];
  }

  // Sort by difficulty with randomized noise so order is varied
  shuffledCandidates.sort((a, b) => {
    const diffA = Math.abs(a.difficulty - difficulty);
    const diffB = Math.abs(b.difficulty - difficulty);
    return (diffA - diffB) + (Math.random() - 0.5) * 1.5;
  });

  const selected = shuffledCandidates.slice(0, count).map(shuffleQuestionOptions);

  // Record into session seen set so subsequent games in the same session get different questions
  selected.forEach((q) => sessionSeenQuestionIds.add(q.id));

  return {
    questions: selected,
    allNewCompleted: false,
    totalAvailableInGrade: dynamicQuestionPool.filter((q) => q.grade === grade && q.subject === subject).length,
  };
}

export function getQuestionsForGame(
  grade: GradeLevel,
  subject: SubjectId,
  difficulty: number = 1,
  count: number = 5,
  excludedIds: string[] = [],
  topic?: string
): Question[] {
  return getQuestionsForGameDetailed(grade, subject, difficulty, count, excludedIds, topic).questions;
}

/**
 * Placement Test generator:
 * Exactly 10 questions for user's grade:
 * - Câu 1–2: Dễ (difficulty 1)
 * - Câu 3–4: Cơ bản (difficulty 2)
 * - Câu 5–6: Trung bình (difficulty 3)
 * - Câu 7–8: Khá (difficulty 4)
 * - Câu 9–10: Khó (difficulty 5–6)
 * Spans across core subjects (Toán, Tiếng Anh, Tin học, Ngữ văn, Khoa học)
 */
export function getPlacementQuestions(grade: GradeLevel): Question[] {
  const subjects: SubjectId[] = ['toan', 'tieng_anh', 'tin_hoc', 'ngu_van', 'khoa_hoc'];
  const testQuestions: Question[] = [];

  // Difficulty pairs: [1, 1], [2, 2], [3, 3], [4, 4], [5, 6]
  const targetDifficulties = [1, 1, 2, 2, 3, 3, 4, 4, 5, 6];

  targetDifficulties.forEach((targetDiff, index) => {
    const subject = subjects[index % subjects.length];
    
    // Exact grade and subject
    const matches = ALL_QUESTIONS.filter(
      (q) => q.grade === grade && q.subject === subject && q.difficulty === targetDiff
    );

    let chosen: Question | undefined;
    if (matches.length > 0) {
      chosen = matches[Math.floor(Math.random() * matches.length)];
    } else {
      // Find closest difficulty within same grade and subject
      const fallbackMatches = ALL_QUESTIONS.filter(
        (q) => q.grade === grade && q.subject === subject
      ).sort((a, b) => Math.abs(a.difficulty - targetDiff) - Math.abs(b.difficulty - targetDiff));
      
      chosen = fallbackMatches[0];
    }

    if (!chosen) {
      // Any question of this grade
      const anyGradeMatch = ALL_QUESTIONS.filter((q) => q.grade === grade);
      chosen = anyGradeMatch[index % anyGradeMatch.length];
    }

    if (chosen) {
      testQuestions.push(shuffleQuestionOptions({ ...chosen, id: `placement_${chosen.id}_${index}` }));
    }
  });

  return testQuestions.slice(0, 10);
}
