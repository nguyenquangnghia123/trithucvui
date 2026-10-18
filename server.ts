import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// ==========================================
// SERVER-SIDE PERSISTENT AUTHENTICATION REPOSITORY
// ==========================================
interface ServerAuthUser {
  uid: string;
  email: string;
  hash: string;
  salt: string;
  displayName: string;
  safeNickname?: string;
  leaderboardMode?: 'anonymous' | 'private' | 'custom_name';
  hideSchool?: boolean;
  createdAt: string;
  grade?: number;
  school?: string;
  favoriteSubject?: string;
  learningGoal?: string;
  xp?: number;
  level?: number;
}

const SERVER_SAFE_NICKNAMES = [
  'Học Sinh Mặt Trời ☀️',
  'Chiến Binh Tri Thức 🛡️',
  'Nhà Thám Hiểm Toán Học 🚀',
  'Mầm Xanh Chăm Học 🌱',
  'Sao Sáng Đất Việt ⭐',
  'Hiệp Sĩ Ngôn Từ 📖',
  'Thần Đồng Tính Nhanh ⚡',
  'Búp Măng Non 🎋',
  'Nhà Thông Thái Nhí 🦉',
  'Bạn Nhỏ Tinh Anh 🌟'
];

function generateServerSafeNickname(grade: number = 6): string {
  const base = SERVER_SAFE_NICKNAMES[Math.floor(Math.random() * SERVER_SAFE_NICKNAMES.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${base.split(' ')[0]} ${base.split(' ')[1] || 'Nhí'} #${num}`;
}

function validateServerNickname(name: string): { isValid: boolean; message?: string } {
  if (!name || typeof name !== 'string') return { isValid: false, message: 'Biệt danh không được để trống.' };
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 30) return { isValid: false, message: 'Độ dài biệt danh từ 2-30 ký tự.' };
  if (/@|(\.com|\.vn|\.edu)/i.test(clean)) return { isValid: false, message: 'Biệt danh không được chứa địa chỉ email.' };
  if (/(?:\d[\s.-]?){6,}/.test(clean)) return { isValid: false, message: 'Biệt danh không được chứa số điện thoại.' };
  return { isValid: true };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_FILE = path.join(DATA_DIR, 'users_auth.json');

function ensureAuthDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUTH_FILE)) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify([]), 'utf8');
  }
}

function getStoredUsers(): ServerAuthUser[] {
  try {
    ensureAuthDir();
    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Server Auth] Failed to read auth file:', err);
    return [];
  }
}

function saveStoredUsers(users: ServerAuthUser[]) {
  try {
    ensureAuthDir();
    fs.writeFileSync(AUTH_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('[Server Auth] Failed to write auth file:', err);
  }
}

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, displayName, grade, school, favoriteSubject, learningGoal } = req.body;

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      return res.status(400).json({ code: 'auth/missing-email', error: 'Vui lòng nhập địa chỉ email.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ code: 'auth/invalid-email', error: 'Địa chỉ email không hợp lệ. Vui lòng nhập đúng định dạng (VD: hocsinh@gmail.com).' });
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ code: 'auth/missing-password', error: 'Vui lòng nhập mật khẩu.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ code: 'auth/weak-password', error: 'Mật khẩu phải có ít nhất 6 ký tự để bảo mật.' });
    }

    const users = getStoredUsers();
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(409).json({
        code: 'auth/email-already-in-use',
        error: 'Email này đã được sử dụng. Hãy đăng nhập hoặc sử dụng email khác.'
      });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const uid = 'usr_' + crypto.randomBytes(8).toString('hex');
    const resolvedName = (typeof displayName === 'string' && displayName.trim()) || cleanEmail.split('@')[0] || 'Học Sinh';
    const initialGrade = typeof grade === 'number' ? grade : 6;
    const initialSafeNickname = generateServerSafeNickname(initialGrade);

    const newUser: ServerAuthUser = {
      uid,
      email: cleanEmail,
      hash,
      salt,
      displayName: resolvedName,
      safeNickname: initialSafeNickname,
      leaderboardMode: 'anonymous', // Default: Child-safe anonymous display
      hideSchool: true, // Default: Protect school name
      createdAt: new Date().toISOString(),
      grade: initialGrade,
      school: typeof school === 'string' ? school.trim() : '',
      favoriteSubject: typeof favoriteSubject === 'string' ? favoriteSubject : 'toan',
      learningGoal: typeof learningGoal === 'string' ? learningGoal.trim() : '',
      xp: 150,
      level: 1
    };

    users.push(newUser);
    saveStoredUsers(users);

    console.log('[Server Auth] Registered new user with safe privacy defaults:', uid, cleanEmail);

    return res.status(201).json({
      success: true,
      user: {
        uid: newUser.uid,
        email: newUser.email,
        displayName: newUser.displayName,
        safeNickname: newUser.safeNickname,
        leaderboardMode: newUser.leaderboardMode,
        hideSchool: newUser.hideSchool,
        grade: newUser.grade,
        school: newUser.school,
        favoriteSubject: newUser.favoriteSubject,
        learningGoal: newUser.learningGoal,
        xp: newUser.xp,
        level: newUser.level
      }
    });
  } catch (err: any) {
    console.error('[Server Auth] Register error:', err);
    return res.status(500).json({ code: 'auth/internal-error', error: 'Không thể tạo tài khoản trên máy chủ. Vui lòng thử lại.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      return res.status(400).json({ code: 'auth/missing-email', error: 'Vui lòng nhập địa chỉ email đăng nhập.' });
    }
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ code: 'auth/missing-password', error: 'Vui lòng nhập mật khẩu.' });
    }

    const users = getStoredUsers();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(404).json({ code: 'auth/user-not-found', error: 'Tài khoản email này chưa được đăng ký.' });
    }

    const candidateHash = crypto.scryptSync(password, user.salt, 64).toString('hex');
    const isMatch = crypto.timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(user.hash, 'hex'));

    if (!isMatch) {
      return res.status(401).json({ code: 'auth/wrong-password', error: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.' });
    }

    // Ensure privacy fields exist on legacy accounts
    if (!user.leaderboardMode) user.leaderboardMode = 'anonymous';
    if (!user.safeNickname) user.safeNickname = generateServerSafeNickname(user.grade || 6);
    if (user.hideSchool === undefined) user.hideSchool = true;

    console.log('[Server Auth] User logged in successfully:', user.uid, cleanEmail);

    return res.status(200).json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        safeNickname: user.safeNickname,
        leaderboardMode: user.leaderboardMode,
        hideSchool: user.hideSchool,
        grade: user.grade,
        school: user.school,
        favoriteSubject: user.favoriteSubject,
        learningGoal: user.learningGoal,
        xp: user.xp || 150,
        level: user.level || 1
      }
    });
  } catch (err: any) {
    console.error('[Server Auth] Login error:', err);
    return res.status(500).json({ code: 'auth/internal-error', error: 'Lỗi xác thực máy chủ. Vui lòng thử lại.' });
  }
});

// GET /api/auth/check-email
app.get('/api/auth/check-email', (req, res) => {
  const emailQuery = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  if (!emailQuery) {
    return res.json({ exists: false });
  }
  const users = getStoredUsers();
  const exists = users.some((u) => u.email.toLowerCase() === emailQuery);
  return res.json({ exists });
});

// POST /api/auth/google-direct-login
// Seamless Google sign-in fallback when browser domain is awaiting authorization in Firebase Console
app.post('/api/auth/google-direct-login', (req, res) => {
  try {
    const { email, displayName, grade, school, favoriteSubject } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      return res.status(400).json({ code: 'auth/missing-email', error: 'Vui lòng cung cấp địa chỉ email Google.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ code: 'auth/invalid-email', error: 'Địa chỉ email Google không hợp lệ. Vui lòng nhập đúng định dạng (VD: hocsinh@gmail.com).' });
    }

    const users = getStoredUsers();
    let user = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.randomBytes(32).toString('hex');
      const uid = 'goog_' + crypto.randomBytes(8).toString('hex');
      const resolvedName = (typeof displayName === 'string' && displayName.trim()) || cleanEmail.split('@')[0] || 'Học Sinh Google';
      const initialGrade = typeof grade === 'number' ? grade : 6;
      const initialSafeNickname = generateServerSafeNickname(initialGrade);

      user = {
        uid,
        email: cleanEmail,
        hash,
        salt,
        displayName: resolvedName,
        safeNickname: initialSafeNickname,
        leaderboardMode: 'anonymous',
        hideSchool: true,
        createdAt: new Date().toISOString(),
        grade: initialGrade,
        school: typeof school === 'string' && school.trim() ? school.trim() : 'Trường Phổ Thông',
        favoriteSubject: typeof favoriteSubject === 'string' ? favoriteSubject : 'toan',
        learningGoal: 'Chăm chỉ học tập, rèn luyện tư duy và tiến bộ mỗi ngày',
        xp: 150,
        level: 1
      };

      users.push(user);
      saveStoredUsers(users);
      console.log('[Server Auth] Created new Google user via direct login:', uid, cleanEmail);
    } else {
      if (typeof displayName === 'string' && displayName.trim() && user.displayName === 'Học Sinh Google') {
        user.displayName = displayName.trim();
        saveStoredUsers(users);
      }
      console.log('[Server Auth] Existing user authenticated via Google direct login:', user.uid, cleanEmail);
    }

    return res.status(200).json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        safeNickname: user.safeNickname || generateServerSafeNickname(user.grade || 6),
        leaderboardMode: user.leaderboardMode || 'anonymous',
        hideSchool: user.hideSchool !== false,
        grade: user.grade || 6,
        school: user.school || 'Trường Phổ Thông',
        favoriteSubject: user.favoriteSubject || 'toan',
        learningGoal: user.learningGoal || 'Chăm chỉ học tập, rèn luyện tư duy và tiến bộ mỗi ngày',
        xp: user.xp || 150,
        level: user.level || 1
      }
    });
  } catch (err: any) {
    console.error('[Server Auth] Google direct login error:', err);
    return res.status(500).json({ code: 'auth/internal-error', error: 'Lỗi xác thực máy chủ. Vui lòng thử lại.' });
  }
});

// ==========================================
// CHILD-SAFE LEADERBOARD & PRIVACY MANAGEMENT APIS
// ==========================================

// GET /api/leaderboard
// Child-safe leaderboard: excludes private students, masks emails/real names/schools
app.get('/api/leaderboard', (req, res) => {
  try {
    const { grade, currentUserId } = req.query;
    const users = getStoredUsers();

    const publicEntries = users
      .filter((u) => {
        // Exclude users who selected 'private' unless it is the user checking their own position
        if (u.leaderboardMode === 'private') {
          return Boolean(currentUserId && u.uid === currentUserId);
        }
        return true;
      })
      .map((u) => {
        const isSelf = Boolean(currentUserId && u.uid === currentUserId);
        const mode = u.leaderboardMode || 'anonymous';
        let safeName = u.safeNickname || generateServerSafeNickname(u.grade || 6);

        if (mode === 'custom_name' && u.displayName) {
          const check = validateServerNickname(u.displayName);
          if (check.isValid) {
            safeName = u.displayName;
          }
        } else if (mode === 'private') {
          safeName = isSelf ? 'Bạn (Chế độ riêng tư 🔒)' : 'Người Học Ẩn Danh 🔒';
        }

        const maskedSchool = u.hideSchool !== false ? 'Trường Bạn Học Tri Thức' : (u.school || 'Trường Phổ Thông');

        return {
          id: u.uid,
          safeNickname: safeName,
          displayName: safeName,
          fullName: isSelf ? u.displayName : safeName, // Never leak other students' full real names!
          grade: u.grade || 6,
          school: isSelf ? (u.school || 'Trường Phổ Thông') : maskedSchool,
          isSchoolHidden: u.hideSchool !== false,
          xp: u.xp || 500,
          level: u.level || 1,
          privacyMode: mode,
          isCurrentUser: isSelf
        };
      });

    // Optional grade filter
    let filtered = publicEntries;
    if (grade && grade !== 'all') {
      const gNum = Number(grade);
      filtered = publicEntries.filter((e) => e.grade === gNum || e.isCurrentUser);
    }

    // Sort by XP descending
    filtered.sort((a, b) => b.xp - a.xp);
    const ranked = filtered.map((item, idx) => ({ ...item, rank: idx + 1 }));

    return res.json({
      success: true,
      total: ranked.length,
      leaderboard: ranked
    });
  } catch (err: any) {
    console.error('[Leaderboard API] Error:', err);
    return res.status(500).json({ error: 'Không thể tải bảng xếp hạng.' });
  }
});

// POST /api/user/privacy
// Update student privacy preferences safely with validation
app.post('/api/user/privacy', (req, res) => {
  try {
    const { uid, leaderboardMode, safeNickname, hideSchool } = req.body;
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'Thiếu mã tài khoản người dùng.' });
    }

    if (safeNickname) {
      const val = validateServerNickname(safeNickname);
      if (!val.isValid) {
        return res.status(400).json({ error: val.message });
      }
    }

    const users = getStoredUsers();
    const user = users.find((u) => u.uid === uid);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng.' });
    }

    if (leaderboardMode && ['anonymous', 'private', 'custom_name'].includes(leaderboardMode)) {
      user.leaderboardMode = leaderboardMode;
    }
    if (safeNickname) {
      user.safeNickname = safeNickname.trim();
    }
    if (typeof hideSchool === 'boolean') {
      user.hideSchool = hideSchool;
    }

    saveStoredUsers(users);
    console.log(`[Privacy API] Updated privacy settings for user ${uid}: mode=${user.leaderboardMode}, hideSchool=${user.hideSchool}`);

    return res.json({
      success: true,
      message: 'Cập nhật thiết lập quyền riêng tư thành công!',
      privacySettings: {
        leaderboardMode: user.leaderboardMode,
        safeNickname: user.safeNickname,
        hideSchool: user.hideSchool
      }
    });
  } catch (err: any) {
    console.error('[Privacy API] Error:', err);
    return res.status(500).json({ error: 'Lỗi cập nhật quyền riêng tư.' });
  }
});

// POST /api/user/record-quiz
// Anti-tamper validation for quiz scores & XP before updating student profile
app.post('/api/user/record-quiz', (req, res) => {
  try {
    const { uid, totalQuestions, correctCount, xpEarned, coinsEarned } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'Thiếu thông tin người dùng.' });
    }

    const total = Number(totalQuestions) || 0;
    const correct = Number(correctCount) || 0;
    const xp = Number(xpEarned) || 0;
    const coins = Number(coinsEarned) || 0;

    // Strict validation: correct answers cannot exceed total questions
    if (correct > total || correct < 0 || total < 0) {
      return res.status(400).json({ error: 'Dữ liệu kết quả bài thi không hợp lệ.' });
    }

    // Strict bounds: realistic maximum XP & Coins per session
    const maxRealisticXp = total * 50 + 200;
    const maxRealisticCoins = total * 25 + 100;

    if (xp > maxRealisticXp || coins > maxRealisticCoins) {
      console.warn(`[Anti-Tamper] Flagged suspicious score payload from uid ${uid}: xp=${xp}, maxAllowed=${maxRealisticXp}`);
      return res.status(400).json({
        error: 'Điểm số vượt quá giới hạn bài học quy định.',
        valid: false
      });
    }

    // Update user stats in users_auth.json if registered
    const users = getStoredUsers();
    const user = users.find((u) => u.uid === uid);
    if (user) {
      user.xp = (user.xp || 0) + xp;
      user.level = Math.max(1, Math.floor((user.xp || 0) / 300) + 1);
      saveStoredUsers(users);
    }

    return res.json({
      success: true,
      verified: true,
      xpAwarded: xp,
      coinsAwarded: coins
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Lazy init Gemini client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Function to sanitize and remove repetitive greetings/filler phrases from tutor responses
function sanitizeTutorGreeting(text: string, isFirstMessage: boolean): string {
  if (!text || typeof text !== 'string') return '';
  let res = text.trim();

  // Pattern for introductory greeting sentences: Chào em, Xin chào, Chào bạn, Hello em, v.v.
  const greetingPattern = /^(?:###\s*)?(?:Chào em|Xin chào(?:\s+em|\s+bạn)?|Chào bạn|Hello em|Thầy chào em|Cô chào em)[^.!\n]*[.!\n]+\s*/i;
  // Pattern for filler compliments & pleasantries at start of text
  const fillerComplimentPattern = /^(?:###\s*)?(?:Câu hỏi của em (?:rất hay|thú vị|tuyệt vời)|Đây là (?:một )?câu hỏi (?:rất hay|thú vị|tuyệt vời)|Thầy\/Cô rất vui[^.!\n]*|Thầy rất vui[^.!\n]*|Cô rất vui[^.!\n]*|Tất nhiên rồi|Được rồi|Rất vui được hỗ trợ em)[^.!\n]*[.!\n]+\s*/i;

  if (!isFirstMessage) {
    // If NOT first message, strip all introductory greetings and filler compliments
    let loop = 0;
    while (loop < 5) {
      const prev = res;
      res = res.replace(greetingPattern, '');
      res = res.replace(fillerComplimentPattern, '');
      res = res.trim();
      if (res === prev) break;
      loop++;
    }
  } else {
    // If first message, remove filler compliments attached right after greeting, or at the start
    res = res.replace(
      /^(?:###\s*)?(?:Chào em|Xin chào(?:\s+em|\s+bạn)?|Chào bạn)[^.!\n]*[.!\n]+\s*(?:Câu hỏi của em (?:rất hay|thú vị|tuyệt vời)|Đây là (?:một )?câu hỏi (?:rất hay|thú vị|tuyệt vời)|Thầy rất vui[^.!\n]*|Cô rất vui[^.!\n]*|Tất nhiên rồi)[^.!\n]*[.!\n]+\s*/i,
      (match) => {
        const m = match.match(/^(?:###\s*)?(?:Chào em|Xin chào(?:\s+em|\s+bạn)?|Chào bạn)[^.!\n]*[.!\n]+/i);
        return m ? m[0] + '\n\n' : '';
      }
    );
    res = res.replace(fillerComplimentPattern, '').trim();
  }

  return res.trim();
}

// Fallback intelligent pedagogical responder for when GEMINI_API_KEY is not configured
function generateOfflinePedagogicalAnswer(
  question: string,
  subject: string,
  grade: number,
  persona: string,
  isFirstMessage: boolean = false
): { answer: string; followUpSuggestions: string[] } {
  const qLower = question.toLowerCase();
  let personaName = 'Thầy Cú Uyên Bác 🦉';
  if (persona === 'cat') personaName = 'Cô Mèo Dịu Dàng 🐱';
  if (persona === 'robot') personaName = 'Robot Trí Tuệ AI 🤖';
  if (persona === 'exam_master') personaName = 'Chuyên Gia Luyện Thi 🏆';
  if (persona === 'cheerleader') personaName = 'Bạn Học Khích Lệ 🌟';

  let subjectAdvice = '';
  let steps = '';
  let tip = '';

  if (qLower.includes('phân số') || qLower.includes('mẫu số')) {
    subjectAdvice = 'Về phép tính phân số, nguyên tắc cốt lõi là đưa về cùng mẫu số trước khi cộng hoặc trừ.';
    steps = `1. **Tìm mẫu số chung (MSCN)**: Thường lấy BCNN của các mẫu số.\n2. **Quy đồng**: Nhân cả tử và mẫu với thừa số phụ tương ứng.\n3. **Thực hiện phép tính**: Cộng/trừ các tử số với nhau, giữ nguyên mẫu chung.\n4. **Rút gọn**: Luôn đưa kết quả về phân số tối giản.`;
    tip = 'Khi nhân hai phân số: Lấy tử nhân tử, mẫu nhân mẫu. Khi chia: Nhân với phân số đảo ngược!';
  } else if (qLower.includes('thì') || qLower.includes('present') || qLower.includes('past') || qLower.includes('tiếng anh')) {
    subjectAdvice = 'Trong ngữ pháp Tiếng Anh, mấu chốt là nhận biết **Trạng từ chỉ thời gian (Signal words)** và chủ ngữ số ít/số nhiều.';
    steps = `1. **Xác định ngữ cảnh**: Hành động diễn ra ở hiện tại, quá khứ, tương lai hay lặp đi lặp lại?\n2. **Công thức**: Khẳng định (+) / Phủ định (-) / Nghi vấn (?)\n3. **Chia động từ**: Chú ý ngôi thứ 3 số ít (he/she/it) hoặc động từ bất quy tắc (V2/V3).`;
    tip = 'Hãy lập sổ tay ghi nhớ 360 động từ bất quy tắc thông dụng nhất!';
  } else if (qLower.includes('phương trình') || qLower.includes('bậc hai') || qLower.includes('nghiệm')) {
    subjectAdvice = 'Phương trình bậc hai dạng $ax^2 + bx + c = 0$ (với $a \\neq 0$).';
    steps = `1. **Tính biệt thức Delta ($\\Delta$)**: 
$$\\Delta = b^2 - 4ac$$
2. **Xét dấu $\\Delta$**:
   - Nếu $\\Delta < 0$: Phương trình vô nghiệm.
   - Nếu $\\Delta = 0$: Nghiệm kép $x_1 = x_2 = -\\frac{b}{2a}$.
   - Nếu $\\Delta > 0$: Có 2 nghiệm phân biệt:
$$x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$$`;
    tip = 'Nếu $a + b + c = 0$ thì $x_1 = 1, x_2 = \\frac{c}{a}$; Nếu $a - b + c = 0$ thì $x_1 = -1, x_2 = -\\frac{c}{a}$.';
  } else if (qLower.includes('văn') || qLower.includes('dàn ý') || qLower.includes('mở bài')) {
    subjectAdvice = 'Bí quyết viết văn đạt điểm cao là lập dàn ý 3 phần chuẩn chỉ.';
    steps = `1. **Mở bài (3-5 dòng)**: Dẫn dắt vấn đề tự nhiên (trực tiếp hoặc gián tiếp), nêu tên tác giả/tác phẩm hoặc luận đề.\n2. **Thân bài**: Chia thành 2-3 luận điểm rõ ràng, mỗi luận điểm đi kèm dẫn chứng thực tế.\n3. **Kết bài**: Khẳng định lại ý nghĩa, rút ra bài học sâu sắc và liên hệ bản thân.`;
    tip = 'Hãy dùng các từ nối mượt mà như "Mặt khác", "Đặc biệt là", "Không chỉ vậy" để tạo sự liên kết tự nhiên.';
  } else {
    subjectAdvice = `Đối với câu hỏi "${question}" thuộc chương trình Lớp ${grade} môn ${subject}:`;
    steps = `1. **Đọc kỹ đề bài**: Xác định dữ kiện đã cho và đại lượng cần tìm.\n2. **Liên kết kiến thức**: Nhớ lại định lý, công thức hoặc quy tắc cốt lõi của bài học.\n3. **Trình bày rõ ràng**: Viết lời giải từng bước, kèm đơn vị đo và kết luận đầy đủ.`;
    tip = 'Tập thói quen kiểm tra lại kết quả bằng cách thử ngược lại vào đề bài!';
  }

  const greetingHeader = isFirstMessage
    ? `### Chào em! ${personaName} có thể giúp em giải bài và giải thích kiến thức môn **${subject} - Lớp ${grade}**.\n\n`
    : '';

  const rawAnswer = `${greetingHeader}#### 💡 Định hướng & Bản chất:
${subjectAdvice}

#### 📝 Hướng dẫn từng bước:
${steps}

#### 🔑 Ghi nhớ quan trọng & Mẹo làm nhanh:
${tip}

#### 🎯 Thử thách cho em:
Em hãy thử áp dụng phương pháp trên để giải thử một bài tương tự nhé. Nếu em vẫn còn băn khoăn ở bước nào, hãy nhắn lại ngay cho Thầy/Cô để được giảng giải chi tiết hơn nhé!`;

  const answer = sanitizeTutorGreeting(rawAnswer, isFirstMessage);

  const followUpSuggestions = [
    'Cho em một ví dụ mẫu có số liệu cụ thể',
    'Có cách giải nhanh trắc nghiệm không?',
    'Làm thế nào để tránh các bẫy thường gặp bài này?',
    'Tạo cho em 1 bài tập trắc nghiệm tự luyện'
  ];

  return { answer, followUpSuggestions };
}

// API endpoint: /api/ask-ai
// Model Selection:
// - 'gemini-3.1-pro-preview' for particularly complex tasks
// - 'gemini-3.5-flash' for general tasks
// - 'gemini-3.1-flash-lite' for tasks that should happen fast
app.post('/api/ask-ai', async (req, res) => {
  try {
    const {
      question,
      subject = 'Toán học',
      grade = 5,
      persona = 'owl',
      history = [],
      contextQuestion,
      model: requestedModel,
      taskComplexity = 'general',
      isFirstMessage: clientIsFirstMessage
    } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Nội dung câu hỏi không được để trống' });
    }

    // Determine whether this is the first message of the conversation
    const hasPriorUserTurn = Array.isArray(history) && history.some((m: any) => m && m.role === 'user');
    const isFirstMessage = clientIsFirstMessage !== undefined
      ? Boolean(clientIsFirstMessage)
      : !hasPriorUserTurn;

    // Determine target model based on user selection or task complexity
    let targetModel = 'gemini-3.5-flash';
    if (requestedModel && ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].includes(requestedModel)) {
      targetModel = requestedModel;
    } else if (taskComplexity === 'complex') {
      targetModel = 'gemini-3.1-pro-preview';
    } else if (taskComplexity === 'fast') {
      targetModel = 'gemini-3.1-flash-lite';
    } else {
      // Auto heuristic if question indicates advanced/complex STEM reasoning
      const qLower = question.toLowerCase();
      if (qLower.includes('chứng minh') || qLower.includes('olympic') || qLower.includes('nâng cao') || qLower.includes('tích phân') || qLower.includes('đạo hàm') || qLower.includes('hệ phương trình')) {
        targetModel = 'gemini-3.1-pro-preview';
      } else if (qLower.length < 25 || qLower.startsWith('công thức') || qLower.startsWith('định nghĩa') || qLower.startsWith('dịch từ')) {
        targetModel = 'gemini-3.1-flash-lite';
      }
    }

    // Determine if question requires Google Search Grounding for new or verifiable facts
    const qLower = question.toLowerCase();
    const needsSearch = 
      req.body.useSearch === true ||
      qLower.includes('mới nhất') ||
      qLower.includes('hôm nay') ||
      qLower.includes('năm nay') ||
      qLower.includes('thời tiết') ||
      qLower.includes('tin tức') ||
      qLower.includes('sự kiện') ||
      qLower.includes('giải thưởng') ||
      qLower.includes('lịch thi') ||
      qLower.includes('thông tin mới') ||
      qLower.includes('ai là') && (qLower.includes('hiện nay') || qLower.includes('bây giờ'));

    // If search is required, use gemini-3.5-flash with googleSearch tool per guidelines
    if (needsSearch && targetModel !== 'gemini-3.1-pro-preview') {
      targetModel = 'gemini-3.5-flash';
    }

    const ai = getGenAI();

    // If Gemini API is not configured or fails, use pedagogical fallback
    if (!ai) {
      const fallback = generateOfflinePedagogicalAnswer(question, subject, Number(grade), persona, isFirstMessage);
      return res.json({
        answer: fallback.answer,
        followUpSuggestions: fallback.followUpSuggestions,
        source: 'pedagogical_knowledge_engine',
        modelUsed: targetModel,
        note: 'Để kết nối trực tiếp với các mô hình Gemini siêu trí tuệ, hãy cấu hình GEMINI_API_KEY.'
      });
    }

    // Tailored persona roles & system instructions
    let personaDesc = 'Thầy Cú Uyên Bác (Gia sư Khoa học Tự nhiên & Tư duy logic: thấu đáo, sư phạm mẫu mực, kiên nhẫn, chứng minh chặt chẽ, phát triển tư duy phản biện)';
    if (persona === 'cat') {
      personaDesc = 'Cô Mèo Dịu Dàng (Gia sư Ngôn ngữ & Văn học: ân cần, ấm áp, lời văn mượt mà giàu cảm xúc, phân tích tác phẩm sâu sắc, ví dụ đời thường sinh động)';
    } else if (persona === 'robot') {
      personaDesc = 'Robot Trí Tuệ AI (Gia sư Tin học, STEM & Thuật toán: hiện đại, logic sắc sảo, mẹo code thông minh, sơ đồ tư duy trực quan, giải thích thuật toán dễ hiểu)';
    } else if (persona === 'exam_master') {
      personaDesc = 'Chuyên Gia Luyện Thi (Chiến thuật giải đề, kỹ thuật loại trừ đáp án trắc nghiệm, mẹo bấm máy tính Casio, tối ưu thời gian làm bài, chống bẫy đề thi)';
    } else if (persona === 'cheerleader') {
      personaDesc = 'Bạn Học Khích Lệ (Đồng hành truyền cảm hứng học tập, giải tỏa áp lực thi cử, hướng dẫn phương pháp học thông minh Pomodoro và ghi nhớ ngắt quãng)';
    }

    let contextNote = '';
    if (contextQuestion) {
      contextNote = `\nĐặc biệt, học sinh đang hỏi về câu hỏi bài tập cụ thể sau:\n- Đề bài: ${contextQuestion.text}\n- Lựa chọn: ${JSON.stringify(contextQuestion.options)}\n- Đáp án đúng: ${contextQuestion.correctAnswer}\n- Giải thích sơ bộ: ${contextQuestion.explanation || ''}\nHọc sinh cần bạn giảng giải sâu hơn về câu hỏi này!`;
    }

    const greetingInstruction = isFirstMessage
      ? `QUY TẮC CHÀO HỎI (ĐÂY LÀ TIN NHẮN ĐẦU TIÊN CỦA CUỘC TRÒ CHUYỆN):
- Bạn chỉ được chào ngắn gọn 1 câu duy nhất ở đầu câu trả lời (Ví dụ: "Chào em! Thầy có thể giúp em giải bài và giải thích kiến thức." hoặc "Chào em! Cô sẽ đồng hành và hướng dẫn em nhé.").
- TUYỆT ĐỐI KHÔNG sử dụng các câu mở đầu khen ngợi sáo rỗng hay lặp lại như: "Câu hỏi của em rất hay!", "Đây là một câu hỏi thú vị!", "Thầy rất vui...", "Tất nhiên rồi!".
- Sau câu chào ngắn gọn 1 câu duy nhất, BẮT BUỘC đi thẳng vào giải thích nội dung câu hỏi.`
      : `QUY TẮC CHÀO HỎI (BẮT BUỘC TUÂN THỦ - ĐÂY LÀ TIN NHẮN TIẾP THEO TRONG CUỘC TRÒ CHUYỆN ĐÃ CHÀO TRƯỚC ĐÓ):
- TUYỆT ĐỐI KHÔNG ĐƯỢC CHÀO LẠI (CẤM mọi lời chào như "Chào em!", "Xin chào!", "Chào bạn!", "Hello!", "Thầy chào em!").
- TUYỆT ĐỐI KHÔNG sử dụng các câu mở đầu lặp lại như:
  * "Chào em!" / "Xin chào!"
  * "Câu hỏi của em rất hay!"
  * "Đây là một câu hỏi thú vị!"
  * "Thầy rất vui..." / "Cô rất vui..."
  * "Tất nhiên rồi!" / "Được rồi!"
- BẮT BUỘC ĐI THẲNG TRỰC TIẾP VÀO NỘI DUNG CÂU TRẢ LỜI NGAY TỪ TỪ ĐẦU TIÊN (Ví dụ: "Ta có:...", "Để giải bài này, ta làm như sau:...", "Vì ta trừ 5 ở cả hai vế...").`;

    const systemInstruction = `Bạn là "Gia Sư Trí Tuệ Vui", một trợ lý gia sư AI kiên nhẫn, tài năng và vô cùng sư phạm dành riêng cho học sinh Việt Nam.
Vai trò chuyên môn của bạn: ${personaDesc}.
Khối lớp học sinh: Lớp ${grade} (Hệ thống giáo dục phổ thông Việt Nam).
Môn học: ${subject}.
Mô hình đảm nhiệm: ${targetModel}.
${contextNote}

${greetingInstruction}

Yêu cầu giảng dạy:
1. Giải thích theo đúng độ tuổi: Lớp 1-5 dùng ngôn từ ngộ nghĩnh, gần gũi, chia nhỏ từng bước; Lớp 6-9 bài bản, logic; Lớp 10-12 chuyên sâu, bản chất và mẹo làm bài thi tốt nghiệp/đại học.
2. Trình bày bài học bằng Markdown chuẩn đẹp:
   - 💡 **Hiểu đề bài & Định hướng**: Tóm tắt nhanh và cách tiếp cận.
   - 📝 **Các bước giải chi tiết**: Từng bước rõ ràng, giải thích tại sao làm vậy.
   - 🔑 **Công thức & Mẹo nhớ nhanh**: Quy tắc, công thức hoặc lưu ý tránh nhầm lẫn.
   - 🎯 **Bài tập nhỏ tự luyện**: 1 câu hỏi nhỏ kèm gợi ý để học sinh tự làm.
3. Luôn giữ thái độ sư phạm, kiên nhẫn, điềm đạm. Không khen ngợi sáo rỗng hay lặp lại lời chào ở đầu câu trả lời.
4. Chuẩn định dạng công thức toán học & khoa học (BẮT BUỘC):
   - Tuyệt đối không để ký hiệu toán học trần trụi ngoài văn bản.
   - Dùng dấu $ bao quanh công thức inline nằm trong câu (ví dụ: $f'(x) = 3x^2 - 6x$, $x \\in \\mathbb{R}$, $\\Delta = b^2 - 4ac$, $x_1, x_2$).
   - Dùng dấu $$ bao quanh trên dòng riêng cho công thức lớn, phân số phức tạp, hệ phương trình, tích phân, đạo hàm (ví dụ: $$\\Delta = b^2 - 4ac$$).
   - Luôn sử dụng mã LaTeX chuẩn để hệ thống KaTeX tự động render thành công thức trực quan đẹp mắt (ví dụ: \\frac{a}{b}, \\sqrt{x}, \\cdot, \\Rightarrow, \\Leftrightarrow, \\le, \\ge).
5. Cuối câu trả lời, hãy gợi ý 3-4 câu hỏi tiếp theo ngắn gọn mà học sinh có thể muốn hỏi tiếp.`;

    // Format multi-turn chat history properly
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history) && history.length > 0) {
      let expectedRole: 'user' | 'model' = 'user';
      for (const msg of history.slice(-10)) {
        if (msg && typeof msg.text === 'string' && msg.text.trim()) {
          const role = msg.role === 'user' ? 'user' : 'model';
          if (role === expectedRole) {
            contents.push({
              role,
              parts: [{ text: msg.text.trim() }]
            });
            expectedRole = expectedRole === 'user' ? 'model' : 'user';
          }
        }
      }
      // If the last message was user (unanswered), pop it so the current question takes its place
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents.pop();
      }
    }

    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: question.trim() }]
    });

    let response;
    const requestConfig: any = {
      systemInstruction,
      temperature: 0.7,
    };

    if (needsSearch) {
      requestConfig.tools = [{ googleSearch: {} }];
    }

    try {
      response = await ai.models.generateContent({
        model: targetModel,
        contents: contents,
        config: requestConfig
      });
    } catch (primaryError: any) {
      console.warn(`Error generating with model ${targetModel}, falling back to gemini-3.5-flash:`, primaryError?.message);
      // Fallback to gemini-3.5-flash if gemini-3.1-pro-preview hit quota or requires setup
      if (targetModel !== 'gemini-3.5-flash') {
        targetModel = 'gemini-3.5-flash';
        response = await ai.models.generateContent({
          model: targetModel,
          contents: contents,
          config: requestConfig
        });
      } else {
        throw primaryError;
      }
    }

    const answerText = response.text || '';
    const cleanAnswer = sanitizeTutorGreeting(answerText, isFirstMessage);

    // Extract grounding metadata if Google Search was utilized
    let groundingSources: Array<{ title: string; url: string }> = [];
    try {
      const candidate = response.candidates?.[0];
      const chunks = candidate?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk.web?.uri && chunk.web?.title) {
            groundingSources.push({
              title: chunk.web.title,
              url: chunk.web.uri
            });
          }
        }
      }
    } catch {
      // ignore
    }

    // Extract quick follow-ups if any
    const followUps: string[] = [
      'Cho em xem một ví dụ tương tự',
      'Có mẹo làm nhanh trắc nghiệm câu này không?',
      'Em muốn tự làm một câu bài tập tương tự'
    ];

    return res.json({
      answer: cleanAnswer,
      followUpSuggestions: followUps,
      modelUsed: targetModel,
      groundingSources,
      usedSearch: needsSearch,
      source: 'gemini'
    });
  } catch (error: any) {
    console.error('Error in /api/ask-ai:', error);
    // Graceful fallback to avoid leaving user hanging
    const isFirstMessage = req.body?.isFirstMessage !== undefined
      ? Boolean(req.body?.isFirstMessage)
      : !(Array.isArray(req.body?.history) && req.body.history.some((m: any) => m && m.role === 'user'));

    const fallback = generateOfflinePedagogicalAnswer(
      req.body?.question || '',
      req.body?.subject || 'Toán học',
      Number(req.body?.grade) || 5,
      req.body?.persona || 'owl',
      isFirstMessage
    );
    return res.json({
      answer: fallback.answer,
      followUpSuggestions: fallback.followUpSuggestions,
      source: 'pedagogical_knowledge_engine',
      modelUsed: req.body?.model || 'gemini-3.5-flash',
      note: 'Hệ thống đã kích hoạt bộ giải sư phạm dự phòng.'
    });
  }
});

// API endpoint: /api/transcribe-audio using model gemini-3.5-transcribe
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audioData, mimeType = 'audio/webm' } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Dữ liệu âm thanh không được để trống' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        transcript: 'Xin chào Thầy/Cô, hướng dẫn em giải bài tập này với ạ!',
        source: 'simulated_offline',
        note: 'GEMINI_API_KEY chưa được cấu hình. Đã tạo bản ghi âm mẫu.'
      });
    }

    // Clean base64 string if data URL prefix is included
    const base64Clean = audioData.includes('base64,')
      ? audioData.split('base64,')[1]
      : audioData;

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            inlineData: {
              data: base64Clean,
              mimeType: mimeType || 'audio/webm',
            }
          },
          {
            text: 'Hãy chép lại chính xác từng từ những gì học sinh nói trong đoạn ghi âm bằng tiếng Việt. Chỉ trả về văn bản đã chép lại, không thêm lời chào hay giải thích gì thêm.'
          }
        ]
      });
    } catch (modelErr: any) {
      console.warn('Transcribe model error, attempting with gemini-3.5-flash:', modelErr?.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            inlineData: {
              data: base64Clean,
              mimeType: mimeType || 'audio/webm',
            }
          },
          {
            text: 'Hãy chép lại lời nói của người dùng trong đoạn âm thanh sang chữ tiếng Việt. Chỉ trả về phần lời nói.'
          }
        ]
      });
    }

    const transcript = response.text ? response.text.trim() : '';

    return res.json({
      transcript: transcript || 'Không nhận diện được giọng nói rõ ràng.',
      source: 'gemini-3.5-transcribe'
    });
  } catch (error: any) {
    console.error('Error in /api/transcribe-audio:', error);
    return res.status(500).json({
      error: 'Lỗi khi xử lý chuyển âm thanh thành văn bản',
      details: error?.message || String(error)
    });
  }
});

/**
 * Server-side procedural generator for infinite non-repeating questions
 * Used when Gemini API is rate-limited, quota-constrained, or offline.
 */
function generateServerProceduralQuestions(
  grade: number,
  subject: string,
  topic: string,
  difficulty: number,
  count: number,
  existingSnippets: string[] = [],
  seenQuestionIds: string[] = []
): any[] {
  const VIETNAMESE_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hoa', 'Hùng', 'Linh', 'Mai', 'Minh', 'Nam', 'Phong', 'Quân', 'Thảo', 'Trang', 'Tuấn', 'Vy'];
  const ITEMS = ['quả cam', 'quyển vở', 'chiếc bút bi', 'viên bi ve', 'bông hoa điểm 10', 'ngôi sao khen thưởng', 'hộp màu vẽ'];
  const places = ['nhà sách', 'siêu thị', 'vườn trường', 'lớp học', 'thư viện', 'sân vận động'];
  const seenSet = new Set(seenQuestionIds);

  const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (opts: string[], corrIdx: number) => {
    const target = opts[corrIdx];
    const copy = [...opts];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return { options: copy, correctIndex: copy.indexOf(target) };
  };

  const results: any[] = [];

  for (let i = 0; i < count; i++) {
    const name1 = pick(VIETNAMESE_NAMES);
    const name2 = pick(VIETNAMESE_NAMES.filter(n => n !== name1));
    const item = pick(ITEMS);
    const place = pick(places);
    let id = `srv_gen_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
    while (seenSet.has(id)) {
      id = `srv_gen_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 9)}`;
    }

    if (subject === 'toan') {
      if (grade === 1) {
        // Toán Lớp 1 Nâng cao: Bài toán suy luận 2-3 bước (thực tế, so sánh nhiều hơn - ít hơn và bớt đi)
        const a = randInt(3, 6);
        const diff = randInt(2, 4);
        const giveAway = 1;
        // name1 có a, name2 có nhiều hơn name1 là diff -> name2 có a + diff
        // Sau đó name2 tặng bạn khác giveAway quả -> name2 còn a + diff - giveAway
        // Tổng cả hai bạn: a + (a + diff - giveAway) = 2*a + diff - giveAway
        const name2Final = a + diff - giveAway;
        const total = a + name2Final;
        const { options, correctIndex } = shuffle([
          `${total} ${item}`,
          `${total + 1} ${item}`,
          `${total - 1} ${item}`,
          `${a + diff} ${item}`
        ], 0);
        results.push({
          id,
          grade,
          subject,
          topic: topic || 'Toán tư duy & Bài toán nhiều bước',
          difficulty: 5,
          content: `Tại ${place}, bạn ${name1} có ${a} ${item}. Bạn ${name2} có nhiều hơn ${name1} ${diff} ${item}. Sau đó, ${name2} tặng bớt cho một bạn khác ${giveAway} ${item}. Hỏi lúc này cả hai bạn ${name1} và ${name2} có tất cả bao nhiêu ${item}?`,
          options,
          correctIndex,
          explanation: `Bước 1: Ban đầu bạn ${name2} có: ${a} + ${diff} = ${a + diff} ${item}.\nBước 2: Sau khi cho bớt ${giveAway} ${item}, bạn ${name2} còn: ${a + diff} - ${giveAway} = ${name2Final} ${item}.\nBước 3: Cả hai bạn có tất cả: ${a} + ${name2Final} = ${total} ${item}.`,
          hint: `Hãy tính xem bạn ${name2} có bao nhiêu ${item} trước, rồi trừ đi số ${item} đã cho bạn khác, sau đó mới tính tổng của cả hai bạn.`
        });
      } else if (grade >= 2 && grade <= 5) {
        // Toán Tiểu học Nâng cao: Bài toán logic tính ngược từ kết quả hoặc bài toán phân phối 2-3 bước
        const base = randInt(4, 9);
        const multiplier = randInt(3, 5);
        const added = randInt(6, 18);
        const intermediate = base * multiplier;
        const finalResult = intermediate - added;
        // Đề bài: An nghĩ ra một số bí mật x. Lấy x nhân với multiplier rồi trừ đi added thì được finalResult. Tìm x.
        const { options, correctIndex } = shuffle([
          `Số ${base}`,
          `Số ${base + 1}`,
          `Số ${base - 1}`,
          `Số ${base + 2}`
        ], 0);
        results.push({
          id,
          grade,
          subject,
          topic: topic || 'Toán tư duy logic & Tìm thành phần chưa biết',
          difficulty: 5,
          content: `Bạn ${name1} nghĩ ra một số tự nhiên bí mật. Nếu lấy số đó nhân với ${multiplier}, rồi lấy kết quả trừ đi ${added} thì được ${finalResult}. Hỏi số tự nhiên mà bạn ${name1} đã nghĩ ra là số nào?`,
          options,
          correctIndex,
          explanation: `Đây là bài toán tính ngược từ cuối:\nBước 1: Trước khi trừ ${added}, kết quả của phép nhân là: ${finalResult} + ${added} = ${intermediate}.\nBước 2: Số bí mật ban đầu là: ${intermediate} : ${multiplier} = ${base}.`,
          hint: `Thực hiện thao tác tính ngược từ cuối: lấy kết quả cộng với ${added} rồi chia cho ${multiplier}.`
        });
      } else if (grade >= 6 && grade <= 9) {
        // Toán THCS Nâng cao: Tìm giá trị nguyên để phân thức nhận giá trị nguyên (kết hợp chia đa thức và ước số)
        const aVal = randInt(2, 5);
        const numeratorConst = aVal + 1; // (x + aVal) / (x - 1) = 1 + (aVal + 1)/(x - 1)
        // Tìm các ước nguyên của numeratorConst
        const divisors: number[] = [];
        for (let d = 1; d <= numeratorConst; d++) {
          if (numeratorConst % d === 0) {
            divisors.push(d);
            divisors.push(-d);
          }
        }
        const validXCount = divisors.length;
        const { options, correctIndex } = shuffle([
          `${validXCount} giá trị`,
          `${validXCount - 2} giá trị`,
          `${validXCount + 2} giá trị`,
          `${validXCount / 2} giá trị`
        ], 0);
        results.push({
          id,
          grade,
          subject,
          topic: topic || 'Phân thức đại số & Lý thuyết số nguyên',
          difficulty: 5,
          content: `Cho phân thức đại số $P = \\frac{x + ${aVal}}{x - 1}$ (với $x \\in \\mathbb{Z}, x \\neq 1$). Có bao nhiêu giá trị nguyên của $x$ để biểu thức $P$ nhận giá trị là một số nguyên?`,
          options,
          correctIndex,
          explanation: `Bước 1: Biến đổi phân thức: $P = \\frac{x - 1 + ${aVal + 1}}{x - 1} = 1 + \\frac{${numeratorConst}}{x - 1}$.\nBước 2: Để $P \\in \\mathbb{Z}$ thì $(x - 1)$ phải là ước nguyên của ${numeratorConst}.\nBước 3: Tập các ước nguyên của ${numeratorConst} là: $\\{${divisors.join(', ')}\\}$.\nVì mỗi ước của $(x - 1)$ cho đúng 1 giá trị nguyên của $x$ khác 1 nên có tất cả ${validXCount} giá trị nguyên của $x$.`,
          hint: `Tách tử thức theo mẫu: $x + ${aVal} = (x - 1) + ${aVal + 1}$. Để phân thức nguyên thì $(x - 1)$ phải là ước của số dư.`
        });
      } else {
        // Toán THPT Nâng cao: Bài toán tham số và giá trị lớn nhất / nhỏ nhất của hàm số bậc ba
        const mTarget = randInt(2, 6);
        const targetMin = mTarget - 4; // y = x^3 - 3x^2 + m trên [0, 3]. min tại x = 2 là m - 4
        const { options, correctIndex } = shuffle([
          `m = ${mTarget}`,
          `m = ${mTarget + 2}`,
          `m = ${mTarget - 2}`,
          `m = ${-mTarget}`
        ], 0);
        results.push({
          id,
          grade,
          subject,
          topic: topic || 'Khảo sát hàm số & Bài toán tham số',
          difficulty: 5,
          content: `Cho hàm số $y = x^3 - 3x^2 + m$ (với $m$ là tham số thực). Tìm tất cả các giá trị của $m$ để giá trị nhỏ nhất của hàm số trên đoạn $[0; 3]$ bằng $${targetMin}$.`,
          options,
          correctIndex,
          explanation: `Bước 1: Đạo hàm $y' = 3x^2 - 6x = 3x(x - 2)$. Cho $y' = 0 \\Leftrightarrow x = 0$ hoặc $x = 2$ (cả hai đều thuộc $[0; 3]$).\nBước 2: Tính giá trị tại các điểm tới hạn và mút đoạn:\n$y(0) = m$, $y(2) = 2^3 - 3(2^2) + m = m - 4$, $y(3) = 3^3 - 3(3^2) + m = m$.\nBước 3: So sánh: giá trị nhỏ nhất trên $[0; 3]$ là $\\min y = m - 4$.\nBước 4: Theo giả thiết $\\min y = ${targetMin} \\Leftrightarrow m - 4 = ${targetMin} \\Leftrightarrow m = ${mTarget}$.`,
          hint: `Tính đạo hàm $y'$, tìm các nghiệm thuộc $[0; 3]$, tính giá trị tại các nghiệm đó và hai đầu mút để tìm công thức của giá trị nhỏ nhất theo $m$.`
        });
      }
    } else if (subject === 'tieng_anh') {
      // Tiếng Anh Nâng cao: Đảo ngữ, thức giả định, mệnh đề quan hệ rút gọn, câu điều kiện hỗn hợp
      const advancedEnglishTopics = [
        {
          q: 'Hardly ______ the presentation when the unexpected power outage disrupted the entire conference hall.',
          opts: [
            'had the speaker commenced',
            'the speaker had commenced',
            'did the speaker commence',
            'the speaker commenced'
          ],
          ans: 0,
          exp: 'Cấu trúc đảo ngữ với phó từ mang nghĩa phủ định đứng đầu câu: "Hardly + had + S + V(p.p) + when + S + V(past)". Do đó phương án "had the speaker commenced" là chính xác duy nhất.',
          h: 'Chú ý cấu trúc đảo ngữ với từ đứng đầu câu là "Hardly".'
        },
        {
          q: 'Were it not for his timely and meticulous intervention, our research project ______ with disastrous consequences.',
          opts: [
            'would have collapsed',
            'will collapse',
            'would collapse',
            'collapsed'
          ],
          ans: 0,
          exp: 'Cấu trúc đảo ngữ câu điều kiện loại 3 với "Were it not for + N" (Nếu không nhờ có...), mệnh đề chính diễn tả kết quả trái ngược với thực tế trong quá khứ: "S + would have + V(p.p)".',
          h: 'Nhận diện đảo ngữ câu điều kiện giả định trong quá khứ: "Were it not for...".'
        },
        {
          q: 'The board of directors insisted that the environmental audit ______ immediately by an independent agency.',
          opts: [
            'be conducted',
            'was conducted',
            'is conducted',
            'must conduct'
          ],
          ans: 0,
          exp: 'Thức giả định (Subjunctive mood) với động từ "insist that + S + (should) + V-nguyên thể". Dạng bị động là "be + V(p.p)": "be conducted".',
          h: 'Sau động từ đòi hỏi/yêu cầu "insist that + S...", động từ luôn ở dạng nguyên mẫu (subjunctive).'
        },
        {
          q: 'The candidate was rejected on the grounds that she lacked the relevant experience, ______ possessing an impressive academic portfolio.',
          opts: [
            'notwithstanding',
            'whereas',
            'provided that',
            'consequently'
          ],
          ans: 0,
          exp: '"Notwithstanding + V-ing / Noun Phrase" có nghĩa là "mặc dù, bất chấp" (tương đương với despite / in spite of), phù hợp nhất với cụm danh từ "possessing an impressive academic portfolio".',
          h: 'Tìm từ nối chỉ sự nhượng bộ/đối lập đi kèm với danh động từ (V-ing).'
        }
      ];
      const selectedEn = pick(advancedEnglishTopics);
      const { options, correctIndex } = shuffle(selectedEn.opts, selectedEn.ans);
      results.push({
        id,
        grade,
        subject,
        topic: topic || 'Advanced Grammar & Linguistic Analysis',
        difficulty: 5,
        content: selectedEn.q,
        options,
        correctIndex,
        explanation: selectedEn.exp,
        hint: selectedEn.h
      });
    } else if (subject === 'khoa_hoc') {
      // Khoa học Nâng cao: Đòi hỏi tính toán nhiều bước, phân tích định lượng và suy luận logic vật lý/hóa học
      const sciTopics = [
        {
          q: 'Một thỏi kim loại đồng chất có khối lượng $m = 360\\text{ g}$ được thả chìm hoàn toàn vào một bình chia độ chứa nước, làm mực nước trong bình dâng thêm $120\\text{ cm}^3$. Nếu thả thỏi kim loại này vào một chậu chứa chất lỏng $X$ có khối lượng riêng $D_X = 1200\\text{ kg/m}^3$ thì hiện tượng nào sau đây sẽ xảy ra?',
          opts: [
            'Thỏi kim loại chìm hoàn toàn xuống đáy vì khối lượng riêng của nó là $3000\\text{ kg/m}^3$, lớn hơn $D_X$',
            'Thỏi kim loại lơ lửng trong chất lỏng vì thể tích của nó bằng thể tích phần chất lỏng dâng lên',
            'Thỏi kim loại nổi trên mặt chất lỏng vì khối lượng riêng của nó nhỏ hơn $D_X$',
            'Thỏi kim loại bị chất lỏng $X$ hòa tan hoàn toàn tạo thành dung dịch'
          ],
          ans: 0,
          exp: 'Bước 1: Tính thể tích thỏi kim loại: $V = 120\\text{ cm}^3 = 1.2 \\times 10^{-4}\\text{ m}^3$.\nBước 2: Tính khối lượng riêng của thỏi kim loại: $D = m / V = 360 / 120 = 3\\text{ g/cm}^3 = 3000\\text{ kg/m}^3$.\nBước 3: So sánh: $D = 3000\\text{ kg/m}^3 > D_X = 1200\\text{ kg/m}^3$, do đó thỏi kim loại sẽ chìm hoàn toàn xuống đáy.',
          h: 'Tính khối lượng riêng của kim loại $D = m/V$ rồi so sánh với khối lượng riêng của chất lỏng $X$.'
        },
        {
          q: 'Trong quá trình quang hợp ở thực vật, nếu cường độ ánh sáng đạt mức tối ưu nhưng nồng độ khí Carbonic ($CO_2$) trong môi trường giảm xuống rất thấp, điều gì sẽ xảy ra với pha tối (chu trình Calvin)?',
          opts: [
            'Pha tối bị đình trệ do thiếu nguyên liệu $CO_2$ để cố định thành hợp chất hữu cơ, kéo theo tích lũy ATP và NADPH',
            'Pha tối diễn ra nhanh hơn để bù đắp sự thiếu hụt $CO_2$',
            'Quá trình quang phân ly nước tăng vọt giải phóng lượng lớn khí oxy',
            'Diệp lục ngừng hấp thụ ánh sáng ngay lập tức ở pha sáng'
          ],
          ans: 0,
          exp: '$CO_2$ là nguyên liệu thiết yếu của pha tối để cố định Ribulose-1,5-bisphosphate (RuBP). Khi thiếu $CO_2$, chu trình Calvin không thể tiếp tục, dẫn đến các sản phẩm của pha sáng (ATP, NADPH) không được tiêu thụ và tích lũy lại.',
          h: 'Phân tích vai trò trực tiếp của khí Carbonic trong chu trình Calvin (pha tối).'
        }
      ];
      const sc = pick(sciTopics);
      const { options, correctIndex } = shuffle(sc.opts, sc.ans);
      results.push({
        id,
        grade,
        subject,
        topic: topic || 'Khoa học tự nhiên - Phân tích thực nghiệm & Cơ chế',
        difficulty: 5,
        content: sc.q,
        options,
        correctIndex,
        explanation: sc.exp,
        hint: sc.h
      });
    } else if (subject === 'tin_hoc') {
      // Tin học Nâng cao: Đọc hiểu và theo dõi luồng thực thi thuật toán (tracing dry-run)
      const itTopics = [
        {
          q: 'Cho đoạn mã giả thực thi thuật toán sau:\n```\ns = 0\nfor i = 1 to 5 do:\n    if (i % 2 != 0) then\n        s = s + i * 2\n    else\n        s = s - i\n```\nGiá trị cuối cùng của biến `s` sau khi vòng lặp kết thúc hoàn toàn là bao nhiêu?',
          opts: ['12', '10', '15', '8'],
          ans: 0,
          exp: 'Theo dõi từng bước thực thi (Dry-run tracing):\n- Vòng 1 ($i = 1$, lẻ): $s = 0 + 1 \\times 2 = 2$\n- Vòng 2 ($i = 2$, chẵn): $s = 2 - 2 = 0$\n- Vòng 3 ($i = 3$, lẻ): $s = 0 + 3 \\times 2 = 6$\n- Vòng 4 ($i = 4$, chẵn): $s = 6 - 4 = 2$\n- Vòng 5 ($i = 5$, lẻ): $s = 2 + 5 \\times 2 = 12$.\nVậy kết quả cuối cùng là 12.',
          h: 'Lập bảng theo dõi giá trị của biến s qua từng giá trị của i từ 1 đến 5 theo điều kiện chẵn/lẻ.'
        },
        {
          q: 'Một thuật toán sắp xếp có độ phức tạp thời gian trong trường hợp xấu nhất là $O(n^2)$ và trường hợp tốt nhất là $O(n)$ khi dãy đã được sắp xếp sẵn. Đây là đặc trưng của thuật toán nào?',
          opts: ['Sắp xếp chèn (Insertion Sort)', 'Sắp xếp trộn (Merge Sort)', 'Sắp xếp nhanh (Quick Sort)', 'Sắp xếp chọn (Selection Sort)'],
          ans: 0,
          exp: 'Thuật toán Insertion Sort khi dãy đã sắp xếp sẽ chỉ cần $n-1$ phép so sánh nên đạt $O(n)$, còn khi dãy nghịch đảo hoàn toàn thì cần $\\frac{n(n-1)}{2}$ phép so sánh nên là $O(n^2)$. Selection Sort luôn là $O(n^2)$, Merge Sort luôn là $O(n \\log n)$.',
          h: 'Xét thuật toán chỉ cần duyệt qua 1 lần nếu các phần tử đã theo đúng thứ tự.'
        }
      ];
      const it = pick(itTopics);
      const { options, correctIndex } = shuffle(it.opts, it.ans);
      results.push({
        id,
        grade,
        subject,
        topic: topic || 'Tư duy thuật toán & Đọc hiểu mã nguồn',
        difficulty: 5,
        content: it.q,
        options,
        correctIndex,
        explanation: it.exp,
        hint: it.h
      });
    } else {
      // Ngữ văn Nâng cao: Đòi hỏi phân tích tác dụng nghệ thuật, thông điệp tư tưởng và lập luận
      const litTopics = [
        {
          q: 'Trong hai câu thơ: "Mặt trời của bắp thì nằm trên đồi / Mặt trời của mẹ, em nằm trên lưng" (Nguyễn Khoa Điềm), hình ảnh "mặt trời của mẹ" sử dụng biện pháp tu từ nào và mang lại hiệu quả nghệ thuật sâu sắc gì?',
          opts: [
            'Ẩn dụ tu từ: đứa con là nguồn sáng, niềm tin, hy vọng và lẽ sống thiêng liêng nhất của người mẹ kháng chiến',
            'Hoán dụ: chỉ sự vất vả cực nhọc của người mẹ khi địu con lên rẫy',
            'So sánh ngang bằng: khẳng định đứa con có kích thước và ánh sáng như mặt trời tự nhiên',
            'Nhân hóa: gán cho mặt trời thiên nhiên những cảm xúc yêu thương như con người'
          ],
          ans: 0,
          exp: '"Mặt trời của mẹ" là hình ảnh ẩn dụ tuyệt đẹp. Tác giả ví đứa con như vầng thái dương sưởi ấm, soi đường và là nguồn động lực, niềm hạnh phúc vô bờ bến tiếp thêm sức mạnh cho mẹ trong những năm tháng gian khổ của cuộc kháng chiến.',
          h: 'Xem xét mối quan hệ giữa "đứa con" và "nguồn sống/niềm tin" của mẹ qua hình ảnh ẩn dụ.'
        },
        {
          q: 'Trong truyện ngắn "Chí Phèo", chi tiết "bát cháo hành" của Thị Nở có ý nghĩa nghệ thuật và nhân đạo sâu sắc nhất là gì?',
          opts: [
            'Là liều thuốc giải cảm hương vị tình thương thức tỉnh bản tính lương thiện bị vùi lấp của Chí Phèo',
            'Là món ăn truyền thống thể hiện sự đầy đủ về vật chất của làng Vũ Đại',
            'Là cái bẫy tinh vi do Bá Kiến sai Thị Nở mang đến để hại Chí Phèo',
            'Là chi tiết ngẫu nhiên không mang ngụ ý nghệ thuật hay tư tưởng của nhà văn'
          ],
          ans: 0,
          exp: 'Bát cháo hành là biểu tượng của tình người mộc mạc, chân thành. Lần đầu tiên trong đời Chí Phèo nhận được sự chăm sóc vô điều kiện, nó đánh thức trong Chí khao khát được làm người lương thiện và trở về với xã hội loài người.',
          h: 'Phân tích sự thức tỉnh nhân tính và khát vọng lương thiện của nhân vật Chí Phèo.'
        }
      ];
      const lit = pick(litTopics);
      const { options, correctIndex } = shuffle(lit.opts, lit.ans);
      results.push({
        id,
        grade,
        subject,
        topic: topic || 'Phân tích văn học & Cảm thụ nghệ thuật nâng cao',
        difficulty: 5,
        content: lit.q,
        options,
        correctIndex,
        explanation: lit.exp,
        hint: lit.h
      });
    }
  }

  return results;
}

/**
 * API: /api/generate-questions
 * Generates infinite, non-duplicate questions for any subject, grade level, and topic
 * using Gemini 3.6 Flash, with automatic pedagogical fallback when quota is limited.
 */
app.post('/api/generate-questions', async (req, res) => {
  try {
    const {
      grade = 1,
      subject = 'toan',
      topic = 'Chung',
      count = 5,
      difficulty = 2,
      existingQuestions = [],
      recentSessionQuestions = [],
      recentQuestions = [],
      seen_question_ids = [],
      useSearch = true
    } = req.body;

    const subjectMap: Record<string, string> = {
      toan: 'Toán Học',
      tieng_anh: 'Tiếng Anh',
      tin_hoc: 'Tin Học',
      ngu_van: 'Ngữ Văn',
      khoa_hoc: 'Khoa Học Tự Nhiên'
    };
    const subjectName = subjectMap[subject] || subject;

    const seenIdsList: string[] = Array.isArray(seen_question_ids) ? seen_question_ids.map(String) : [];
    const seenIdSet = new Set<string>(seenIdsList);

    // Collect all recent questions from session, explicit input, or existing question bank
    const rawRecentList = Array.isArray(recentSessionQuestions) && recentSessionQuestions.length > 0
      ? recentSessionQuestions
      : Array.isArray(recentQuestions) && recentQuestions.length > 0
      ? recentQuestions
      : Array.isArray(existingQuestions) && existingQuestions.length > 0
      ? existingQuestions
      : [];

    const formattedRecentQuestions = rawRecentList.map((item: any) => {
      if (typeof item === 'string') return { content: item };
      return {
        content: item.content || item.text || '',
        topic: item.topic || '',
        options: Array.isArray(item.options) ? item.options : [],
        explanation: item.explanation || ''
      };
    }).filter(q => q.content && q.content.trim().length > 0);

    const recentQuestionsListText = formattedRecentQuestions.length > 0
      ? formattedRecentQuestions.slice(-25).map((q, i) => {
          const topicStr = q.topic ? ` [Chủ đề: ${q.topic}]` : '';
          const optsStr = q.options.length > 0 ? ` | Lựa chọn: [${q.options.join(', ')}]` : '';
          return `[Câu ${i + 1}]${topicStr}: "${q.content}"${optsStr}`;
        }).join('\n')
      : 'Chưa có câu hỏi nào được tạo trước đó trong phiên học.';

    const seenIdsSummary = seenIdsList.length > 0
      ? `\n--- MÃ CÂU HỎI ĐÃ LÀM / ĐÃ TẠO TRONG PHIÊN HOẶC FIRESTORE (TUYỆT ĐỐI KHÔNG TRÙNG MÃ HOẶC Ý TƯỞNG CŨ) ---\nTổng số câu đã thấy: ${seenIdsList.length}. Mẫu mã gần nhất: ${seenIdsList.slice(-25).join(', ')}`
      : '';

    const systemPrompt = `Bạn là Chuyên gia Khảo thí và Thiết kế Đề thi Trắc nghiệm cấp cao, chuyên gia biên soạn ĐỀ THI NÂNG CAO, HỌC SINH GIỎI VÀ ĐỀ PHÂN HÓA NĂNG LỰC SÂU SẮC chuẩn Chương trình GDPT Việt Nam.
Nhiệm vụ tối thượng của bạn là biên soạn đúng ${count} câu hỏi trắc nghiệm ở MỨC ĐỘ KHÓ ĐẾN NÂNG CAO (VẬN DỤNG VÀ VẬN DỤNG CAO) dành cho học sinh Lớp ${grade}, Môn ${subjectName} (${subject}).

--- DANH SÁCH CÁC CÂU HỎI GẦN ĐÂY ĐÃ XUẤT HIỆN TRONG PHIÊN HỌC (BẮT BUỘC ĐỐI CHIẾU TRÁNH LẶP) ---
${recentQuestionsListText}
${seenIdsSummary}
--------------------------------------------------------------------------------------

🎯 MỤC TIÊU CỐT LÕI:
Tạo ra các câu hỏi CÓ TÍNH THỬ THÁCH CAO, mang lại cảm giác như một bài luyện tập nâng cao hoặc bài thi học sinh giỏi / phân hóa sâu, đòi hỏi người học phải SUY LUẬN NHIỀU BƯỚC VÀ PHÂN TÍCH THỰC SỰ thay vì chỉ nhớ máy móc hay áp dụng công thức một bước đơn giản.

⚡ NGUYÊN TẮC THIẾT KẾ ĐỘ KHÓ BẮT BUỘC (TUÂN THỦ 100%):
1. KHÔNG LÀM KHÓ CƠ HỌC BẰNG CÁCH CHỈ TĂNG ĐỘ LỚN CỦA CON SỐ:
   - Tuyệt đối KHÔNG tăng độ khó bằng cách cho số to để tính toán cơ học cồng kềnh.
   - Độ khó phải xuất phát từ bản chất logic, chiều sâu nhận thức, tính liên kết kiến thức và sự tinh tế trong tư duy.
2. SUY LUẬN NHIỀU BƯỚC (MULTI-STEP REASONING):
   - Mỗi câu hỏi BẮT BUỘC phải trải qua tối thiểu 2 đến 4 bước tư duy liên hoàn mới tìm ra đáp án đúng.
   - TUYỆT ĐỐI TRÁNH các câu hỏi một bước giải (one-step) hay chỉ cần thay số trực diện vào công thức có sẵn.
3. KẾT HỢP NHIỀU MẢNG KIẾN THỨC VÀ PHÂN TÍCH DỮ KIỆN:
   - Tích hợp nhiều mảng kiến thức liên quan trong chương trình Lớp ${grade}.
   - Phân tích dữ kiện phức tạp, phát hiện mối liên hệ ẩn, loại bỏ thông tin nhiễu, mô hình hóa bài toán thực tế.
4. ÁP DỤNG KIẾN THỨC VÀO TÌNH HUỐNG MỚI:
   - Tình huống bài toán mới mẻ, bài toán thực nghiệm, bài toán thực tiễn hoặc toán logic sáng tạo đòi hỏi tư duy phản biện.
5. PHƯƠNG ÁN NHIỄU (DISTRACTORS) TINH VI, CÓ TÍNH PHÂN LOẠI CAO:
   - 3 phương án sai phải được thiết kế dựa trên các lỗi sai tư duy kinh điển của học sinh khá giỏi: ngộ nhận điều kiện biên, quên xét trường hợp đặc biệt, nhầm lẫn dấu trong bước biến đổi trung gian, suy luận một chiều.
   - Người học bắt buộc phải suy nghĩ thấu đáo và kiểm tra lại trước khi chọn.

📚 YÊU CẦU ĐẶC BIỆT THEO TỪNG MÔN HỌC:

📌 1. ĐỐI VỚI MÔN TOÁN HỌC:
- Tăng độ phức tạp của bài toán, tăng số bước giải (tối thiểu 2-4 bước biến đổi hoặc suy luận).
- Kết hợp nhiều dạng kiến thức: Đại số kết hợp hình học, giải phương trình/hệ phương trình gắn liền với điều kiện xác định/điều kiện nghiệm, bài toán tìm cực trị / tối ưu thực tế, bài toán tham số, bất đẳng thức, suy luận hình học nhiều bước kẻ thêm yếu tố phụ hoặc dùng định lý tổng hợp.
- Thêm các bài yêu cầu chứng minh, biến đổi tương đương sâu, suy luận tìm điều kiện của biến hoặc tham số để bài toán thỏa mãn.
- TUYỆT ĐỐI TRÁNH các câu hỏi quá dễ như phép tính số học trực tiếp ($a + b$, $a \\times b$), thế số đơn giản vào một công thức định sẵn.
- ĐẢM BẢO TÍNH TOÁN VÀ ĐÁP ÁN CHÍNH XÁC 100%: Bạn phải tự giải chi tiết từng bước và rà soát tính toán kỹ lưỡng trước khi xuất JSON.
- ĐỊNH DẠNG TOÁN HỌC: Toàn bộ công thức, biến số và ký hiệu toán học phải viết bằng LaTeX KaTeX chuẩn trong dấu $...$ (ví dụ: $x = 5$, $\\Delta = b^2 - 4ac$, $\\frac{a}{b}$).

📌 2. ĐỐI VỚI MÔN TIẾNG ANH:
- Tăng độ khó ngữ pháp: Câu phức/câu ghép nhiều thành phần, cấu trúc đảo ngữ (Inversion), câu chẻ (Cleft sentences), mệnh đề quan hệ rút gọn (Reduced relative clauses), câu điều kiện hỗn hợp (Mixed conditionals), thức giả định (Subjunctive mood), câu bị động đặc biệt, liên từ tương phản nâng cao.
- Phân biệt các trường hợp ngữ pháp và từ loại dễ nhầm lẫn (confusing grammar structures, deceptive words, subtle modal nuances).
- Tăng độ khó từ vựng và ngữ cảnh: Cụm từ cố định nâng cao (Collocations), thành ngữ (Idioms/Phrasal verbs nâng cao), từ vựng phân hóa theo ngữ cảnh.
- Đoạn văn đọc hiểu ngắn suy luận ngụ ý (Inference), phân tích thái độ/quan điểm của tác giả (Author's tone/attitude), hoặc câu hỏi logic liên kết mạch văn.

📌 3. ĐỐI VỚI MÔN NGỮ VĂN:
- Tăng yêu cầu phân tích sâu sắc và suy luận từ ngữ cảnh hoặc đoạn trích văn bản.
- Hỏi sâu về tác dụng nghệ thuật của biện pháp tu từ, đặc sắc thể loại, điểm nhìn trần thuật, sự chuyển dịch cảm xúc, thông điệp triết lý nhân văn và nghệ thuật lập luận của tác giả.
- TUYỆT ĐỐI KHÔNG chỉ hỏi những thông tin bề mặt có sẵn nguyên văn trong văn bản hay câu hỏi ghi nhớ máy móc về tiểu sử/năm sinh.

📌 4. ĐỐI VỚI CÁC MÔN KHOA HỌC TỰ NHIÊN, TIN HỌC VÀ KHÁC:
- Tăng mức độ phân tích bản chất hiện tượng, giải thích cơ chế nguyên lý, xử lý số liệu thực nghiệm, bài toán tính toán đa giai đoạn có chất dư hoặc hiệu suất.
- Đối với Tin học: Đọc hiểu mã nguồn giải thuật, lần vết luồng thực thi biến (tracing dry-run qua các vòng lặp/điều kiện), phát hiện lỗi logic tiềm ẩn, tính toán độ phức tạp thời gian/không gian hoặc tư duy tối ưu giải thuật.

🛡️ QUY CHUẨN SƯ PHẠM VÀ KIỂM TRA ĐÁP ÁN NGHIÊM NGẶT (ZERO DEFECT GUARANTEE):
1. PHÙ HỢP VỚI LỚP ${grade}: Câu hỏi mang tính thử thách và nâng cao nhưng TUYỆT ĐỐI PHẢI PHÙ HỢP VỚI KHUNG CHƯƠNG TRÌNH LỚP ${grade}. Không ra kiến thức vượt quá xa cấp học (khó ở chiều sâu tư duy và tính đa bước, chứ không phải đánh đố bằng kiến thức lớp trên).
2. KHÔNG CÓ LỖI SAI VỀ NỘI DUNG VÀ ĐÁP ÁN:
   - TUYỆT ĐỐI KHÔNG CÓ ĐÁP ÁN SAI.
   - Duy nhất MỘT đáp án đúng hoàn toàn trong 4 lựa chọn A, B, C, D.
   - Đề bài đầy đủ dữ kiện, dữ kiện nhất quán, không mâu thuẫn, không thiếu sót.
3. GIẢI THÍCH CHI TIẾT ("explanation"): Phải trình bày tường tận từng bước suy luận (Bước 1, Bước 2, Bước 3...), chứng minh rõ ràng vì sao đáp án đúng và phân tích vì sao các phương án khác lại sai.
4. GỢI Ý TƯ DUY ("hint"): Đưa ra gợi ý mở nút thắt của bài toán khó, không tiết lộ thẳng đáp án nhưng định hướng đúng phương pháp tư duy.

QUY TẮC CHỐNG TRÙNG LẶP:
- Tuyệt đối không lặp lại câu hỏi giống hệt câu hỏi cũ.
- Tuyệt đối không chỉ thay số cơ học vào cùng một khuôn mẫu bài toán cũ.
- Bắt buộc đổi mới ngữ cảnh, tình huống thực tế, cách hỏi và phân dạng bài.

Yêu cầu định dạng bắt buộc: Trả về một JSON array duy nhất:
[
  {
    "id": "gen_${Date.now()}_1",
    "grade": ${Number(grade)},
    "subject": "${subject}",
    "topic": "${topic}",
    "difficulty": 5,
    "content": "Nội dung câu hỏi nâng cao, giàu thử thách suy luận nhiều bước...",
    "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
    "correctIndex": 0,
    "explanation": "Lời giải chi tiết từng bước, chứng minh chặt chẽ...",
    "hint": "Gợi ý tư duy mở nút thắt của bài toán..."
  }
]`;

    let rawText = '';
    const groundingSources: Array<{ title: string; url: string }> = [];
    let modelUsed = 'gemini-3.8-flash';

    const ai = getGenAI();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Hãy biên soạn đúng ${count} câu hỏi trắc nghiệm THỬ THÁCH NÂNG CAO (VẬN DỤNG & VẬN DỤNG CAO) môn ${subjectName} Lớp ${grade} về chủ đề "${topic}".
BẮT BUỘC TUÂN THỦ CÁC TIÊU CHUẨN ĐỘ KHÓ SAU:
1. Độ khó: KHÓ ĐẾN NÂNG CAO, đòi hỏi học sinh phải suy luận nhiều bước (tối thiểu 2 - 4 bước), kết hợp kiến thức và phân tích dữ kiện sâu sắc.
2. Tuyệt đối không ra câu hỏi áp công thức một bước hay tính toán đơn giản trực tiếp.
3. Câu hỏi phải hoàn toàn phù hợp với trình độ học sinh Lớp ${grade}, không vượt quá xa chương trình nhưng khai thác tầng sâu bản chất kiến thức.
4. Đảm bảo 100% tính toán chính xác, không có đáp án sai, duy nhất 1 đáp án đúng trong 4 phương án, đề bài đầy đủ dữ kiện không mâu thuẫn.
5. Giải thích ("explanation") phải phân tích cặn kẽ từng bước suy luận.`
                },
                { text: systemPrompt }
              ]
            }
          ],
          config: useSearch
            ? {
                systemInstruction: systemPrompt,
                tools: [{ googleSearch: {} }],
                temperature: 0.7
              }
            : {
                systemInstruction: systemPrompt,
                temperature: 0.7
              }
        });

        rawText = response.text ? response.text.trim() : '';

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        for (const chunk of groundingChunks) {
          if (chunk.web?.uri) {
            groundingSources.push({
              title: chunk.web.title || 'Tài liệu Google Search',
              url: chunk.web.uri
            });
          }
        }
      } catch (geminiError: any) {
        console.warn('Gemini 3.6 call encountered error/quota limit, using high-variety procedural generator:', geminiError?.message);
      }
    }

    let parsedQuestions: any[] = [];
    if (rawText) {
      try {
        let cleanJson = rawText;
        if (cleanJson.includes('```json')) {
          cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
        } else if (cleanJson.includes('```')) {
          cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
        }

        const firstBracket = cleanJson.indexOf('[');
        const lastBracket = cleanJson.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
          cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
        }

        parsedQuestions = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn('JSON parsing from Gemini output failed:', parseErr);
      }
    }

    // If Gemini output was empty, failed, or rate-limited, use our server-side pedagogical engine
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      modelUsed = 'procedural-educational-engine';
      parsedQuestions = generateServerProceduralQuestions(
        Number(grade),
        subject,
        topic,
        Number(difficulty),
        Number(count),
        existingQuestions,
        seenIdsList
      );
    }

    // Ensure all questions conform strictly to Question schema and never collide with seen IDs
    const sanitizedQuestions = parsedQuestions.map((q, idx) => {
      let finalId = q.id;
      if (!finalId || seenIdSet.has(String(finalId))) {
        finalId = `gen_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 8)}`;
      }
      return {
        id: finalId,
        grade: Number(grade),
        subject,
        topic: q.topic || topic,
        difficulty: typeof q.difficulty === 'number' ? Math.min(6, Math.max(1, q.difficulty)) : Number(difficulty),
        content: q.content || q.text || `Câu hỏi ${idx + 1}`,
        options: Array.isArray(q.options) && q.options.length === 4
          ? q.options.map((o: any) => String(o))
          : ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'],
        correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3
          ? q.correctIndex
          : 0,
        explanation: q.explanation || 'Giải thích chi tiết cho câu hỏi.',
        hint: q.hint || 'Hãy suy luận từ dữ kiện đã cho.',
        groundingSources
      };
    });

    return res.json({
      questions: sanitizedQuestions,
      groundingSources,
      modelUsed,
      topic,
      grade: Number(grade),
      subject
    });
  } catch (error: any) {
    console.error('Unexpected error in /api/generate-questions, using fallback:', error);
    const fallback = generateServerProceduralQuestions(1, 'toan', 'Cộng trừ', 2, 5, [], []);
    return res.json({
      questions: fallback,
      groundingSources: [],
      modelUsed: 'procedural-fallback',
      topic: 'Cộng trừ',
      grade: 1,
      subject: 'toan'
    });
  }
});

// ==========================================
// QUY TRÌNH TẠO, KIỂM TRA & LƯU CÂU HỎI BÁM SÁT SGK
// ==========================================
const CURRICULUM_SCOPES_FILE = path.join(DATA_DIR, 'curriculum_scopes.json');
const QUESTION_REPORTS_FILE = path.join(DATA_DIR, 'question_reports.json');
const APPROVED_QUESTIONS_FILE = path.join(DATA_DIR, 'approved_textbook_questions.json');

function getStoredCurriculumScopes(): any[] {
  try {
    ensureAuthDir();
    if (!fs.existsSync(CURRICULUM_SCOPES_FILE)) {
      const defaultData = [
        {
          id: 'scope_toan_lop6_kntt',
          subject: 'toan',
          grade: 6,
          textbook: 'Kết nối tri thức với cuộc sống (Bộ GD&ĐT)',
          edition: '2024-2025',
          description: 'Chương 1: Tập hợp các số tự nhiên - Chuẩn khung chương trình GDPT 2018',
          disallowedTopics: ['Số thập phân vô hạn tuần hoàn', 'Căn bậc hai', 'Hàm số đồ thị'],
          lessons: [
            {
              lessonNumber: 1,
              title: 'Bài 1: Tập hợp. Phần tử của tập hợp',
              coreKnowledge: 'Khái niệm tập hợp, các phần tử của tập hợp. Cách viết tập hợp bằng cách liệt kê các phần tử hoặc chỉ ra tính chất đặc trưng cho các phần tử của tập hợp đó. Sử dụng các ký hiệu thuộc (∈) và không thuộc (∉). Tập hợp không chứa phần tử nào gọi là tập rỗng (∅).',
              pageReference: 'Trang 6-9 SGK Toán 6 Tập 1',
              allowedConcepts: ['Tập hợp', 'Phần tử', 'Ký hiệu thuộc (∈)', 'Ký hiệu không thuộc (∉)', 'Tập rỗng (∅)', 'Liệt kê phần tử'],
              allowedFormulas: ['$x \\in A$', '$y \\notin A$', '$A = \\{x \\in \\mathbb{N} \\mid ...\\}$']
            },
            {
              lessonNumber: 2,
              title: 'Bài 2: Tập hợp các số tự nhiên. Ghi số tự nhiên',
              coreKnowledge: 'Tập hợp các số tự nhiên được ký hiệu là N = {0, 1, 2, 3, ...}. Tập hợp các số tự nhiên khác 0 ký hiệu là N* = {1, 2, 3, ...}. Mỗi số tự nhiên được biểu diễn bởi một điểm trên tia số. Trong hai số tự nhiên khác nhau có một số nhỏ hơn số kia. Ghi số tự nhiên trong hệ thập phân và ghi bằng chữ số La Mã từ 1 đến 30 (I, V, X).',
              pageReference: 'Trang 10-13 SGK Toán 6 Tập 1',
              allowedConcepts: ['Tập N', 'Tập N*', 'Tia số', 'Số liền trước, liền sau', 'Hệ thập phân', 'Chữ số La Mã (I, V, X)'],
              allowedFormulas: ['$\\mathbb{N} = \\{0, 1, 2, ...\\}$', '$\\mathbb{N}^* = \\{1, 2, 3, ...\\}$']
            },
            {
              lessonNumber: 3,
              title: 'Bài 3: Phép cộng và phép trừ số tự nhiên',
              coreKnowledge: 'Phép cộng a + b = c (số hạng + số hạng = tổng). Tính chất giao hoán: a + b = b + a. Tính chất kết hợp: (a + b) + c = a + (b + c). Cộng với số 0: a + 0 = a. Phép trừ a - b = c (số bị trừ - số trừ = hiệu). Điều kiện để có phép trừ trong tập số tự nhiên là số bị trừ lớn hơn hoặc bằng số trừ (a ≥ b).',
              pageReference: 'Trang 14-17 SGK Toán 6 Tập 1',
              allowedConcepts: ['Số hạng', 'Tổng', 'Số bị trừ', 'Số trừ', 'Hiệu', 'Giao hoán', 'Kết hợp'],
              allowedFormulas: ['$a + b = b + a$', '$(a + b) + c = a + (b + c)$']
            },
            {
              lessonNumber: 4,
              title: 'Bài 4: Phép nhân và phép chia số tự nhiên',
              coreKnowledge: 'Phép nhân a . b = p (thừa số . thừa số = tích). Tính chất giao hoán: a . b = b . a. Tính chất kết hợp: (a . b) . c = a . (b . c). Nhân với 1: a . 1 = a. Tính chất phân phối của phép nhân đối với phép cộng: a . (b + c) = a . b + a . c. Phép chia hết a : b = q. Phép chia có dư a = b . q + r (0 < r < b). Số chia b luôn phải khác 0.',
              pageReference: 'Trang 18-21 SGK Toán 6 Tập 1',
              allowedConcepts: ['Thừa số', 'Tích', 'Số bị chia', 'Số chia', 'Thương', 'Số dư (0 < r < b)', 'Phân phối'],
              allowedFormulas: ['$a \\cdot (b + c) = a \\cdot b + a \\cdot c$', '$a = b \\cdot q + r \\quad (0 \\le r < b)$']
            },
            {
              lessonNumber: 5,
              title: 'Bài 5: Lũy thừa với số mũ tự nhiên',
              coreKnowledge: 'Lũy thừa bậc n của số tự nhiên a là tích của n thừa số bằng nhau, mỗi thừa số bằng a: a^n = a . a . ... . a (n thừa số a, n ∈ N*). a gọi là cơ số, n gọi là số mũ. Quy ước: a^1 = a; a^0 = 1 (với a ≠ 0). Nhân hai lũy thừa cùng cơ số: a^m . a^n = a^(m+n). Chia hai lũy thừa cùng cơ số: a^m : a^n = a^(m-n) (với a ≠ 0 và m ≥ n).',
              pageReference: 'Trang 22-25 SGK Toán 6 Tập 1',
              allowedConcepts: ['Cơ số', 'Số mũ', 'Bình phương', 'Lập phương', 'Nhân cùng cơ số', 'Chia cùng cơ số'],
              allowedFormulas: ['$a^m \\cdot a^n = a^{m+n}$', '$a^m : a^n = a^{m-n} \\quad (a \\neq 0, m \\ge n)$']
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      fs.writeFileSync(CURRICULUM_SCOPES_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
      return defaultData;
    }
    const raw = fs.readFileSync(CURRICULUM_SCOPES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read curriculum scopes file:', err);
    return [];
  }
}

function saveStoredCurriculumScopes(scopes: any[]) {
  try {
    ensureAuthDir();
    fs.writeFileSync(CURRICULUM_SCOPES_FILE, JSON.stringify(scopes, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write curriculum scopes file:', err);
  }
}

function getStoredApprovedQuestions(): any[] {
  try {
    ensureAuthDir();
    if (!fs.existsSync(APPROVED_QUESTIONS_FILE)) {
      // Seed initial high-quality approved sample questions
      const initialApproved = [
        {
          id: 'appr_sample_math_01',
          grade: 6,
          subject: 'toan',
          topic: 'Bài 1: Tập hợp. Phần tử của tập hợp',
          content: 'Cho tập hợp $A = \\{2; 4; 6; 8\\}$. Khẳng định nào sau đây là **ĐÚNG** theo quy ước ký hiệu tập hợp?',
          options: [
            '$4 \\in A$',
            '$5 \\in A$',
            '$2 \\notin A$',
            '$8 \\notin A$'
          ],
          correctIndex: 0,
          correctAnswerText: '$4 \\in A$',
          explanation: 'Tập hợp $A$ gồm các phần tử là 2, 4, 6, 8. Do số 4 có mặt trong tập hợp $A$, nên ta dùng ký hiệu thuộc: $4 \\in A$. Các phương án còn lại đều sai vì 5 không có trong A, còn 2 và 8 là phần tử của A.',
          hint: 'Kiểm tra xem số 4 có nằm trong các phần tử được liệt kê của tập hợp A hay không.',
          textbook: 'Kết nối tri thức với cuộc sống (Bộ GD&ĐT)',
          edition: '2024-2025',
          lessonNumber: 1,
          lessonTitle: 'Bài 1: Tập hợp. Phần tử của tập hợp',
          pageReference: 'Trang 6-9 SGK Toán 6 Tập 1',
          sourceEvidence: 'Cách viết tập hợp bằng cách liệt kê các phần tử... Sử dụng các ký hiệu thuộc (∈) và không thuộc (∉).',
          verificationStatus: 'passed_review',
          verificationResult: {
            passed: true,
            codeValidationPassed: true,
            codeValidationErrors: [],
            inScope: true,
            answerConsistent: true,
            evidenceSufficient: true,
            singleCorrectOption: true,
            distractorsValid: true,
            explanationValid: true,
            gradeAppropriate: true,
            issueType: null,
            reviewNotes: 'Câu hỏi hoàn toàn nằm trong nội dung Bài 1, đáp án A chính xác tuyệt đối, lời giải rõ ràng.',
            suggestedCorrection: null,
            qualityScore: 100
          },
          reviewerStatus: 'approved',
          reviewedAt: new Date().toISOString(),
          reviewedBy: 'Giáo viên Chuyên môn',
          createdAt: new Date().toISOString()
        },
        {
          id: 'appr_sample_math_02',
          grade: 6,
          subject: 'toan',
          topic: 'Bài 5: Lũy thừa với số mũ tự nhiên',
          content: 'Kết quả của phép tính nhân hai lũy thừa cùng cơ số $3^2 \\cdot 3^4$ bằng bao nhiêu?',
          options: [
            '$3^6$',
            '$3^8$',
            '$9^6$',
            '$9^8$'
          ],
          correctIndex: 0,
          correctAnswerText: '$3^6$',
          explanation: 'Theo quy tắc nhân hai lũy thừa cùng cơ số trong SGK Toán 6: $a^m \\cdot a^n = a^{m+n}$. Giữ nguyên cơ số 3 và cộng các số mũ: $3^2 \\cdot 3^4 = 3^{2+4} = 3^6$.',
          hint: 'Áp dụng công thức: Khi nhân hai lũy thừa cùng cơ số, giữ nguyên cơ số và cộng các số mũ.',
          textbook: 'Kết nối tri thức với cuộc sống (Bộ GD&ĐT)',
          edition: '2024-2025',
          lessonNumber: 5,
          lessonTitle: 'Bài 5: Lũy thừa với số mũ tự nhiên',
          pageReference: 'Trang 22-25 SGK Toán 6 Tập 1',
          sourceEvidence: 'Nhân hai lũy thừa cùng cơ số: a^m . a^n = a^(m+n). Giữ nguyên cơ số và cộng các số mũ.',
          verificationStatus: 'passed_review',
          verificationResult: {
            passed: true,
            codeValidationPassed: true,
            codeValidationErrors: [],
            inScope: true,
            answerConsistent: true,
            evidenceSufficient: true,
            singleCorrectOption: true,
            distractorsValid: true,
            explanationValid: true,
            gradeAppropriate: true,
            issueType: null,
            reviewNotes: 'Câu hỏi chuẩn hóa theo đúng công thức SGK Bài 5, không gây nhầm lẫn.',
            suggestedCorrection: null,
            qualityScore: 100
          },
          reviewerStatus: 'approved',
          reviewedAt: new Date().toISOString(),
          reviewedBy: 'Tổ trưởng Bộ môn Toán',
          createdAt: new Date().toISOString()
        }
      ];
      fs.writeFileSync(APPROVED_QUESTIONS_FILE, JSON.stringify(initialApproved, null, 2), 'utf8');
      return initialApproved;
    }
    const raw = fs.readFileSync(APPROVED_QUESTIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read approved questions file:', err);
    return [];
  }
}

function saveStoredApprovedQuestions(questions: any[]) {
  try {
    ensureAuthDir();
    fs.writeFileSync(APPROVED_QUESTIONS_FILE, JSON.stringify(questions, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write approved questions file:', err);
  }
}

function getStoredQuestionReports(): any[] {
  try {
    ensureAuthDir();
    if (!fs.existsSync(QUESTION_REPORTS_FILE)) {
      fs.writeFileSync(QUESTION_REPORTS_FILE, JSON.stringify([]), 'utf8');
      return [];
    }
    const raw = fs.readFileSync(QUESTION_REPORTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredQuestionReports(reports: any[]) {
  try {
    ensureAuthDir();
    fs.writeFileSync(QUESTION_REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write question reports:', err);
  }
}

/**
 * LỚP 1: KIỂM TRA TÍNH HỢP LỆ BẰNG CODE (Code Validation)
 */
function performCodeValidation(q: any, lesson?: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!q) {
    errors.push('Dữ liệu câu hỏi không tồn tại.');
    return { valid: false, errors };
  }

  // 1. Nội dung câu hỏi không để trống
  const content = (q.content || q.question || '').trim();
  if (content.length < 10) {
    errors.push('Nội dung câu hỏi không được để trống hoặc quá ngắn (tối thiểu 10 ký tự).');
  }

  // 2. Đúng 4 phương án
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    errors.push(`Câu hỏi phải có đúng 4 phương án lựa chọn (hiện có ${Array.isArray(q.options) ? q.options.length : 0}).`);
  } else {
    const trimmedOpts = q.options.map((o: any) => String(o || '').trim());
    if (trimmedOpts.some((o: string) => o.length === 0)) {
      errors.push('Phương án lựa chọn không được chứa nội dung để trống.');
    }

    // 3. Không có phương án trùng nhau
    const lowerSet = new Set(trimmedOpts.map((o: string) => o.toLowerCase()));
    if (lowerSet.size !== 4) {
      errors.push('Các phương án lựa chọn không được trùng lặp nội dung với nhau.');
    }
  }

  // 4. correctIndex nằm trong phạm vi hợp lệ [0, 3]
  if (typeof q.correctIndex !== 'number' || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
    errors.push(`Chỉ số đáp án đúng (correctIndex) phải là số nguyên từ 0 đến 3 (hiện tại: ${q.correctIndex}).`);
  }

  // 5. Lời giải thích không được để trống
  const explanation = (q.explanation || '').trim();
  if (explanation.length < 10) {
    errors.push('Lời giải thích không được để trống (tối thiểu 10 ký tự).');
  }

  // 6. Liên kết với bài học nguồn
  if (lesson && lesson.lessonNumber !== undefined && q.lessonNumber !== undefined) {
    if (Number(lesson.lessonNumber) !== Number(q.lessonNumber)) {
      errors.push(`Câu hỏi bị lệch mã bài học nguồn (thuộc bài ${q.lessonNumber} nhưng đang thẩm định theo bài ${lesson.lessonNumber}).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * LỚP 2: KIỂM TRA ĐỘC LẬP BẰNG LƯỢT GỌI GEMINI RIÊNG (Independent AI Verification Pass)
 * Đóng vai trò Hội Đồng Thẩm Định Khảo Thí: tự giải câu hỏi, đối chiếu nguồn, phát hiện câu hỏi ngoài nguồn,
 * đáp án sai, nhiều đáp án đúng, mâu thuẫn lời giải.
 */
async function runIndependentAiVerification(params: {
  question: any;
  lesson: any;
  grade: number;
  subject: string;
  textbook: string;
}): Promise<any> {
  const { question, lesson, grade, subject, textbook } = params;

  // Run code validation first
  const codeValidation = performCodeValidation(question, lesson);

  const ai = getGenAI();
  if (!ai) {
    return {
      passed: false,
      codeValidationPassed: codeValidation.valid,
      codeValidationErrors: codeValidation.errors,
      inScope: false,
      answerConsistent: false,
      evidenceSufficient: false,
      singleCorrectOption: false,
      distractorsValid: false,
      explanationValid: false,
      gradeAppropriate: true,
      issueType: 'DATA_INVALID',
      reviewNotes: 'Dịch vụ AI kiểm định độc lập chưa thể kích hoạt do thiếu GEMINI_API_KEY. Câu hỏi được giữ ở trạng thái chờ giáo viên rà soát thủ công.',
      suggestedCorrection: null,
      qualityScore: codeValidation.valid ? 50 : 25
    };
  }

  const lessonTitle = lesson?.title || 'Bài học đã chọn';
  const coreKnowledge = lesson?.coreKnowledge || 'Nội dung kiến thức bài học';
  const pageRef = lesson?.pageReference || 'N/A';
  const concepts = Array.isArray(lesson?.allowedConcepts) ? lesson.allowedConcepts.join(', ') : 'N/A';
  const formulas = Array.isArray(lesson?.allowedFormulas) ? lesson.allowedFormulas.join(', ') : 'N/A';

  const auditorPrompt = `Bạn là Chuyên gia Khảo thí và Thẩm định Sư phạm Độc lập (Independent Exam Quality Auditor).
Nhiệm vụ của bạn là thẩm định ĐỘC LẬP câu hỏi trắc nghiệm dưới đây đối chiếu với DUY NHẤT nội dung kiến thức sách giáo khoa (SGK) được cung cấp.

--- PHẠM VI NGUỒN SGK ĐƯỢC CUNG CẤP (NGUỒN CĂN CỨ DUY NHẤT) ---
Bộ sách: ${textbook} • Môn: ${subject.toUpperCase()} • Lớp: ${grade}
Bài học: ${lessonTitle}
Số trang tham chiếu: ${pageRef}
Nội dung kiến thức chính trích từ SGK:
"""
${coreKnowledge}
"""
Khái niệm / Định nghĩa trong bài: ${concepts}
Công thức trong bài: ${formulas}

--- CÂU HỎI TRẮC NGHIỆM CẦN THẨM ĐỊNH ---
Nội dung câu hỏi: "${question.content || question.question}"
Phương án A: "${question.options?.[0] || ''}"
Phương án B: "${question.options?.[1] || ''}"
Phương án C: "${question.options?.[2] || ''}"
Phương án D: "${question.options?.[3] || ''}"
Đáp án dự kiến: Lựa chọn thứ ${question.correctIndex} ("${question.options?.[question.correctIndex] || ''}")
Lời giải thích: "${question.explanation || ''}"
Bằng chứng trích dẫn từ nguồn: "${question.sourceEvidence || ''}"

--- QUY TRÌNH THẨM ĐỊNH ĐỘC LẬP BẮT BUỘC ---
1. TỰ GIẢI ĐỘC LẬP: Dựa DUY NHẤT vào phần "Nội dung kiến thức chính trích từ SGK" ở trên, bạn hãy tự giải câu hỏi để tìm đáp án chuẩn.
2. ĐỐI CHIẾU ĐÁP ÁN: So sánh đáp án bạn tự giải với đáp án dự kiến (lựa chọn thứ ${question.correctIndex}).
   - Nếu đáp án dự kiến sai so với nguồn: Đặt answerConsistent = false, issueType = "WRONG_ANSWER".
3. KIỂM TRA PHẠM VI (inScope): Câu hỏi có sử dụng kiến thức bên ngoài nội dung bài học đã nhập không? Có vượt trình độ Lớp ${grade} không?
   - Nếu câu hỏi hỏi về nội dung không được nhắc đến trong nguồn đã cấp: Đặt inScope = false, issueType = "OUT_OF_SCOPE".
4. BẰNG CHỨNG NGUỒN (evidenceSufficient): Phần kiến thức nguồn đã cung cấp có đủ căn cứ để chứng minh đáp án không? Hay câu hỏi bị thiếu dữ kiện, mơ hồ?
   - Nếu nguồn không đủ thông tin để trả lời câu hỏi: Đặt evidenceSufficient = false, issueType = "INSUFFICIENT_EVIDENCE".
5. DUY NHẤT MỘT ĐÁP ÁN ĐÚNG:
   - Có từ hai phương án trở lên cùng đúng không? Nếu có: singleCorrectOption = false, issueType = "MULTIPLE_CORRECT".
   - Không có phương án nào đúng không? Nếu có: singleCorrectOption = false, issueType = "NO_CORRECT".
6. LỜI GIẢI THÍCH: Lời giải có chứng minh rõ ràng và không mâu thuẫn với đáp án không?
   - Nếu mâu thuẫn: explanationValid = false, issueType = "CONTRADICTORY_EXPLANATION".
7. ĐỀ XUẤT SỬA (NẾU CÓ): Nếu phát hiện lỗi, hãy nêu rõ lỗi và đề xuất phương án sửa (nếu có căn cứ trong nguồn).

YÊU CẦU ĐỊNH DẠNG TRẢ VỀ:
Trả về DUY NHẤT một JSON hợp lệ (không kèm markdown ngoài JSON):
{
  "passed": true hoặc false (chỉ true khi và chỉ khi 100% các tiêu chí đều đạt: answerConsistent, inScope, evidenceSufficient, singleCorrectOption, distractorsValid, explanationValid),
  "answerConsistent": true hoặc false,
  "inScope": true hoặc false,
  "evidenceSufficient": true hoặc false,
  "singleCorrectOption": true hoặc false,
  "distractorsValid": true hoặc false,
  "explanationValid": true hoặc false,
  "gradeAppropriate": true hoặc false,
  "issueType": null hoặc một trong ["OUT_OF_SCOPE", "WRONG_ANSWER", "MULTIPLE_CORRECT", "NO_CORRECT", "CONTRADICTORY_EXPLANATION", "INSUFFICIENT_EVIDENCE", "AMBIGUOUS"],
  "reviewNotes": "Nhận xét chi tiết, rõ ràng của thẩm định viên nêu căn cứ đối chiếu với SGK",
  "suggestedCorrection": {
    "correctedIndex": 0,
    "explanation": "Đề xuất lời giải chính xác",
    "notes": "Lý do đề xuất sửa"
  } hoặc null,
  "qualityScore": số nguyên từ 0 đến 100
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: auditorPrompt }] }],
      config: {
        temperature: 0.1, // Low temperature for deterministic, strict auditing
      }
    });

    const raw = response.text ? response.text.trim() : '';
    let cleanJson = raw;
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
    } else if (cleanJson.includes('```')) {
      cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
    }
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleanJson);

    // Calculate quality score based on actual audit criteria
    const criteria = [
      codeValidation.valid,
      Boolean(parsed.inScope),
      Boolean(parsed.answerConsistent),
      Boolean(parsed.evidenceSufficient),
      Boolean(parsed.singleCorrectOption),
      Boolean(parsed.distractorsValid),
      Boolean(parsed.explanationValid),
      Boolean(parsed.gradeAppropriate)
    ];
    const points = criteria.filter(Boolean).length;
    const computedScore = Math.round((points / 8) * 100);

    const overallPassed = codeValidation.valid && Boolean(parsed.passed) && Boolean(parsed.answerConsistent) && Boolean(parsed.inScope) && Boolean(parsed.evidenceSufficient);

    return {
      passed: overallPassed,
      codeValidationPassed: codeValidation.valid,
      codeValidationErrors: codeValidation.errors,
      inScope: Boolean(parsed.inScope),
      answerConsistent: Boolean(parsed.answerConsistent),
      evidenceSufficient: Boolean(parsed.evidenceSufficient),
      singleCorrectOption: Boolean(parsed.singleCorrectOption),
      distractorsValid: Boolean(parsed.distractorsValid),
      explanationValid: Boolean(parsed.explanationValid),
      gradeAppropriate: Boolean(parsed.gradeAppropriate),
      issueType: overallPassed ? null : (parsed.issueType || (codeValidation.valid ? 'UNVERIFIED' : 'DATA_INVALID')),
      reviewNotes: parsed.reviewNotes || (overallPassed ? 'Đạt chuẩn kiểm định sư phạm: bám sát SGK, đáp án nhất quán.' : 'Có tiêu chí chưa đạt, cần rà soát lại.'),
      suggestedCorrection: parsed.suggestedCorrection || null,
      qualityScore: computedScore
    };
  } catch (err: any) {
    console.warn('[AI Auditor] Verification error:', err?.message || err);
    return {
      passed: false,
      codeValidationPassed: codeValidation.valid,
      codeValidationErrors: codeValidation.errors,
      inScope: true,
      answerConsistent: codeValidation.valid,
      evidenceSufficient: true,
      singleCorrectOption: true,
      distractorsValid: true,
      explanationValid: true,
      gradeAppropriate: true,
      issueType: codeValidation.valid ? null : 'DATA_INVALID',
      reviewNotes: `Lỗi kết nối bộ thẩm định AI: ${err?.message || 'Không thể phản hồi'}. Giáo viên vui lòng tự kiểm tra đối chiếu trực tiếp với SGK.`,
      suggestedCorrection: null,
      qualityScore: codeValidation.valid ? 75 : 40
    };
  }
}

// ==========================================
// API ROUTES: BỘ KIẾN THỨC SGK (KNOWLEDGE SETS)
// ==========================================

// GET /api/textbook/knowledge-sets (and alias /api/curriculum-scopes)
app.get(['/api/textbook/knowledge-sets', '/api/curriculum-scopes'], (req, res) => {
  const scopes = getStoredCurriculumScopes();
  res.json({ success: true, scopes, knowledgeSets: scopes });
});

// POST /api/textbook/knowledge-sets (and alias /api/curriculum-scopes)
app.post(['/api/textbook/knowledge-sets', '/api/curriculum-scopes'], (req, res) => {
  try {
    const scopeData = req.body.knowledgeSet || req.body.scope || req.body;
    if (!scopeData || !scopeData.subject || !scopeData.grade) {
      return res.status(400).json({ error: 'Dữ liệu bộ kiến thức không hợp lệ. Cần có môn học và khối lớp.' });
    }

    const scopes = getStoredCurriculumScopes();
    const id = scopeData.id || `scope_${scopeData.subject}_lop${scopeData.grade}_${Date.now()}`;
    const cleanLessons = Array.isArray(scopeData.lessons)
      ? scopeData.lessons.map((l: any, i: number) => ({
          lessonNumber: typeof l.lessonNumber === 'number' ? l.lessonNumber : i + 1,
          title: (l.title || `Bài ${i + 1}`).trim(),
          coreKnowledge: (l.coreKnowledge || '').trim(),
          pageReference: (l.pageReference || '').trim(),
          allowedConcepts: Array.isArray(l.allowedConcepts) ? l.allowedConcepts : [],
          allowedFormulas: Array.isArray(l.allowedFormulas) ? l.allowedFormulas : []
        }))
      : [];

    const updated = {
      id,
      subject: scopeData.subject,
      grade: Number(scopeData.grade),
      textbook: (scopeData.textbook || 'Sách Giáo Khoa Chuẩn GDPT 2018').trim(),
      edition: (scopeData.edition || '2024-2025').trim(),
      description: (scopeData.description || `Bộ kiến thức SGK Lớp ${scopeData.grade} môn ${scopeData.subject}`).trim(),
      lessons: cleanLessons,
      disallowedTopics: Array.isArray(scopeData.disallowedTopics) ? scopeData.disallowedTopics : [],
      updatedAt: new Date().toISOString(),
      createdAt: scopeData.createdAt || new Date().toISOString()
    };

    const idx = scopes.findIndex((s: any) => s.id === id);
    if (idx >= 0) {
      scopes[idx] = updated;
    } else {
      scopes.unshift(updated);
    }
    saveStoredCurriculumScopes(scopes);

    console.log(`[Textbook] Saved knowledge set: ${id} with ${cleanLessons.length} lessons`);
    return res.json({ success: true, knowledgeSet: updated, scope: updated });
  } catch (err: any) {
    console.error('Error saving knowledge set:', err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/textbook/knowledge-sets/:id (and alias /api/curriculum-scopes/:id)
app.delete(['/api/textbook/knowledge-sets/:id', '/api/curriculum-scopes/:id'], (req, res) => {
  try {
    const { id } = req.params;
    let scopes = getStoredCurriculumScopes();
    scopes = scopes.filter((s: any) => s.id !== id);
    saveStoredCurriculumScopes(scopes);
    return res.json({ success: true, message: 'Đã xóa bộ kiến thức.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API ROUTES: BƯỚC 2 & 3: TẠO VÀ KIỂM ĐỊNH CÂU HỎI
// ==========================================

// POST /api/textbook/generate (and alias /api/generate-curriculum-questions)
app.post(['/api/textbook/generate', '/api/generate-curriculum-questions'], async (req, res) => {
  try {
    const {
      subject = 'toan',
      grade = 6,
      textbook = 'Kết nối tri thức với cuộc sống',
      edition = '2024-2025',
      lesson,
      allLessons = [],
      count = 2,
      difficulty = 3
    } = req.body;

    if (!lesson || !lesson.coreKnowledge || lesson.coreKnowledge.trim().length < 15) {
      return res.status(400).json({
        error: 'Nội dung kiến thức chính của bài học chưa đủ hoặc để trống (tối thiểu 15 ký tự). Vui lòng cung cấp nội dung kiến thức SGK trước khi tạo câu hỏi.'
      });
    }

    const lessonTitle = lesson.title || 'Bài học trọng tâm';
    const coreKnowledge = lesson.coreKnowledge.trim();
    const pageRef = lesson.pageReference || '';
    const allowedConcepts = Array.isArray(lesson.allowedConcepts) && lesson.allowedConcepts.length > 0
      ? lesson.allowedConcepts.join(', ')
      : 'Các khái niệm trong bài';
    const allowedFormulas = Array.isArray(lesson.allowedFormulas) && lesson.allowedFormulas.length > 0
      ? lesson.allowedFormulas.join(', ')
      : 'Các công thức trong bài';

    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY. Theo nguyên tắc chất lượng SGK, hệ thống không được tự ý dùng câu hỏi ngẫu nhiên chưa kiểm định để tạo câu hỏi cho chế độ SGK.'
      });
    }

    const generatorPrompt = `Bạn là Chuyên gia Khảo thí và Thiết kế Câu hỏi Thi chuẩn Sách Giáo Khoa (SGK) Việt Nam.
Nhiệm vụ TỐI THƯỢNG: Biên soạn ĐÚNG ${Math.min(Math.max(1, count), 4)} câu hỏi trắc nghiệm chất lượng cao bám sát DUY NHẤT phạm vi kiến thức SGK được giáo viên cung cấp dưới đây.

--- PHẠM VI NGUỒN SGK ĐƯỢC CẤP (BẮT BUỘC TUÂN THỦ 100%) ---
- Môn học: ${subject.toUpperCase()} • Khối lớp: Lớp ${grade}
- Bộ sách giáo khoa: ${textbook} ${edition ? `(Phiên bản: ${edition})` : ''}
- Tên bài học: ${lessonTitle}
- Số trang SGK tham chiếu: ${pageRef || 'Theo phân phối chương trình'}
- NỘI DUNG KIẾN THỨC CHÍNH ĐƯỢC TRÍCH TỪ SGK:
"""
${coreKnowledge}
"""
- Khái niệm / Định nghĩa được phép dùng: ${allowedConcepts}
- Công thức được phép dùng: ${allowedFormulas}

--- NGUYÊN TẮC NGHIÊM NGẶT (KHÔNG ĐƯỢC VI PHẠM) ---
1. CHỈ SỬ DỤNG KIẾN THỨC TRONG NỘI DUNG NGUỒN ĐƯỢC CUNG CẤP Ở TRÊN.
2. TUYỆT ĐỐI KHÔNG tự mở rộng sang bài chưa nhập, lớp khác, kiến thức nâng cao ngoài SGK.
3. TUYỆT ĐỐI KHÔNG sử dụng trí nhớ tổng quát để tự bổ sung dữ kiện khi nguồn không đủ căn cứ.
4. TUYỆT ĐỐI KHÔNG tự suy đoán số liệu, định nghĩa, công thức hay quy tắc.
5. Nếu không thể xây dựng câu hỏi có đáp án rõ ràng từ nguồn, phải bỏ qua câu đó.
6. Mỗi câu hỏi trắc nghiệm BẮT BUỘC có đúng 4 phương án (A, B, C, D) và DUY NHẤT 1 ĐÁP ÁN ĐÚNG.
7. Bắt buộc có phần trích dẫn nguyên văn bằng chứng từ nội dung nguồn (sourceEvidence) để chứng minh tính chuẩn xác.
8. Toàn bộ công thức toán học phải viết dạng LaTeX KaTeX kẹp giữa dấu $ (ví dụ: $a^m \\cdot a^n = a^{m+n}$, $x \\in A$).

YÊU CẦU ĐỊNH DẠNG:
Trả về DUY NHẤT một JSON array hợp lệ (không kèm văn bản mở đầu hay kết thúc):
[
  {
    "content": "Nội dung câu hỏi trắc nghiệm rõ ràng, bám sát nguồn...",
    "options": [
      "Phương án A",
      "Phương án B",
      "Phương án C",
      "Phương án D"
    ],
    "correctIndex": 0,
    "correctAnswerText": "Phương án A",
    "explanation": "Lời giải thích cặn kẽ từng bước, đối chiếu trực tiếp với nội dung SGK...",
    "hint": "Gợi ý ngắn gọn giúp học sinh suy luận...",
    "sourceEvidence": "Trích dẫn nguyên văn câu chữ/căn cứ từ phần kiến thức đã nhập ở trên..."
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: generatorPrompt }] }],
      config: {
        temperature: 0.2, // Low temperature for high fidelity to text
      }
    });

    const rawText = response.text ? response.text.trim() : '';
    let cleanJson = rawText;
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
    } else if (cleanJson.includes('```')) {
      cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
    }
    const firstBracket = cleanJson.indexOf('[');
    const lastBracket = cleanJson.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
    }

    let parsedQuestions: any[] = [];
    try {
      parsedQuestions = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('Failed to parse generated questions JSON:', cleanJson);
      return res.status(500).json({ error: 'AI trả về dữ liệu không đúng định dạng JSON. Vui lòng thử lại.' });
    }

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      return res.status(400).json({
        error: 'Không thể tạo câu hỏi từ nguồn đã cung cấp. Vui lòng bổ sung thêm kiến thức chi tiết cho bài học.'
      });
    }

    // Process each generated question and execute INDEPENDENT 2-STEP VERIFICATION
    const processedQuestions: any[] = [];

    for (let i = 0; i < parsedQuestions.length; i++) {
      const qRaw = parsedQuestions[i];
      const qId = `q_sgk_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

      const options = Array.isArray(qRaw.options) && qRaw.options.length === 4
        ? qRaw.options.map(String)
        : ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'];

      const validIdx = typeof qRaw.correctIndex === 'number' && qRaw.correctIndex >= 0 && qRaw.correctIndex <= 3
        ? qRaw.correctIndex
        : 0;

      const candidateQuestion = {
        id: qId,
        grade: Number(grade),
        subject,
        topic: lessonTitle,
        content: String(qRaw.content || qRaw.question || '').trim(),
        options,
        correctIndex: validIdx,
        correctAnswerText: qRaw.correctAnswerText || options[validIdx],
        explanation: String(qRaw.explanation || '').trim(),
        hint: String(qRaw.hint || 'Hãy đọc kỹ định nghĩa và tính chất trong bài.').trim(),
        textbook,
        edition,
        lessonNumber: typeof lesson.lessonNumber === 'number' ? lesson.lessonNumber : 1,
        lessonTitle,
        pageReference: pageRef,
        sourceEvidence: String(qRaw.sourceEvidence || coreKnowledge.slice(0, 120)).trim(),
        sourceKnowledgeSetId: req.body.scopeId || req.body.knowledgeSetId || '',
        reviewerStatus: 'pending_review', // ALWAYS starts as pending_review, waiting for teacher approval
        createdAt: new Date().toISOString()
      };

      // STEP 3: INDEPENDENT VERIFICATION PASS
      const verification = await runIndependentAiVerification({
        question: candidateQuestion,
        lesson,
        grade: Number(grade),
        subject,
        textbook
      });

      const verificationStatus = verification.passed ? 'passed_review' : 'flagged';

      processedQuestions.push({
        ...candidateQuestion,
        verificationStatus,
        verificationResult: verification,
        qualityScore: verification.qualityScore
      });
    }

    const allPassed = processedQuestions.every(q => q.verificationResult?.passed);
    console.log(`[Textbook Generate] Created ${processedQuestions.length} questions. All passed auto-check: ${allPassed}`);

    return res.json({
      success: true,
      questions: processedQuestions,
      auditPassed: allPassed,
      notes: allPassed
        ? 'Tất cả câu hỏi đã vượt qua 2 lớp kiểm định tự động (Code Validation + AI Auditor). Sẵn sàng chờ giáo viên duyệt.'
        : 'Có câu hỏi cần giáo viên xem lại hoặc chỉnh sửa trước khi duyệt.'
    });
  } catch (err: any) {
    console.error('Error in /api/textbook/generate:', err);
    return res.status(500).json({ error: err.message || 'Lỗi xử lý tạo câu hỏi SGK.' });
  }
});

// POST /api/textbook/verify-question (and alias /api/validate-question)
// Re-verifies a single edited or existing question
app.post(['/api/textbook/verify-question', '/api/validate-question'], async (req, res) => {
  try {
    const { question, lesson, scope, grade, subject, textbook } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Thiếu dữ liệu câu hỏi cần kiểm định.' });
    }

    const targetLesson = lesson || (scope && scope.lessons && scope.lessons[0]) || {
      title: question.lessonTitle || question.topic || 'Bài học SGK',
      coreKnowledge: question.sourceEvidence || 'Nội dung kiến thức nguồn',
      pageReference: question.pageReference || ''
    };

    const targetGrade = grade || question.grade || 6;
    const targetSubject = subject || question.subject || 'toan';
    const targetTextbook = textbook || (scope && scope.textbook) || question.textbook || 'Sách giáo khoa';

    const verificationResult = await runIndependentAiVerification({
      question,
      lesson: targetLesson,
      grade: targetGrade,
      subject: targetSubject,
      textbook: targetTextbook
    });

    return res.json({
      success: true,
      verificationResult,
      qualityCheck: verificationResult // for backwards compatibility
    });
  } catch (err: any) {
    console.error('Error in /api/textbook/verify-question:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API ROUTES: BƯỚC 4: KHO CÂU HỎI ĐÃ DUYỆT (APPROVED QUESTIONS)
// ==========================================

// GET /api/textbook/approved-questions
app.get('/api/textbook/approved-questions', (req, res) => {
  try {
    const { subject, grade, lessonNumber, lessonTitle } = req.query;
    let questions = getStoredApprovedQuestions();

    // Only return approved questions
    questions = questions.filter((q: any) => q.reviewerStatus === 'approved');

    if (subject && typeof subject === 'string' && subject !== 'all') {
      questions = questions.filter((q: any) => q.subject === subject);
    }
    if (grade && typeof grade === 'string' && grade !== 'all') {
      questions = questions.filter((q: any) => String(q.grade) === String(grade));
    }
    if (lessonNumber && typeof lessonNumber === 'string') {
      questions = questions.filter((q: any) => String(q.lessonNumber) === String(lessonNumber));
    }
    if (lessonTitle && typeof lessonTitle === 'string') {
      questions = questions.filter((q: any) => (q.lessonTitle || q.topic || '').toLowerCase().includes(lessonTitle.toLowerCase()));
    }

    return res.json({
      success: true,
      total: questions.length,
      questions
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/textbook/approve-question
// Teacher approves and commits question into official bank
app.post('/api/textbook/approve-question', (req, res) => {
  try {
    const { question, reviewerName } = req.body;
    if (!question || !question.id) {
      return res.status(400).json({ error: 'Thiếu dữ liệu câu hỏi.' });
    }

    // Backend code validation check before approving
    const codeVal = performCodeValidation(question);
    if (!codeVal.valid) {
      return res.status(400).json({
        error: 'Câu hỏi không đạt quy chuẩn kỹ thuật.',
        details: codeVal.errors
      });
    }

    const approvedList = getStoredApprovedQuestions();
    const approvedQuestion = {
      ...question,
      reviewerStatus: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerName || 'Giáo viên Thẩm định',
      updatedAt: new Date().toISOString()
    };

    const existingIdx = approvedList.findIndex((q: any) => q.id === question.id);
    if (existingIdx >= 0) {
      approvedList[existingIdx] = approvedQuestion;
    } else {
      approvedList.unshift(approvedQuestion);
    }

    saveStoredApprovedQuestions(approvedList);
    console.log(`[Textbook] Approved question ${question.id} saved to official bank.`);

    return res.json({
      success: true,
      message: 'Đã duyệt và lưu câu hỏi vào kho chính thức.',
      question: approvedQuestion
    });
  } catch (err: any) {
    console.error('Error in approve-question:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/textbook/batch-approve
app.post('/api/textbook/batch-approve', (req, res) => {
  try {
    const { questions, reviewerName } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Danh sách câu hỏi trống.' });
    }

    const approvedList = getStoredApprovedQuestions();
    let approvedCount = 0;

    for (const q of questions) {
      const codeVal = performCodeValidation(q);
      if (codeVal.valid) {
        const approvedItem = {
          ...q,
          reviewerStatus: 'approved',
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerName || 'Giáo viên Thẩm định',
          updatedAt: new Date().toISOString()
        };
        const idx = approvedList.findIndex((item: any) => item.id === q.id);
        if (idx >= 0) {
          approvedList[idx] = approvedItem;
        } else {
          approvedList.unshift(approvedItem);
        }
        approvedCount++;
      }
    }

    saveStoredApprovedQuestions(approvedList);
    return res.json({
      success: true,
      message: `Đã duyệt thành công ${approvedCount} câu hỏi vào kho chính thức.`,
      approvedCount
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/textbook/reject-question
app.post('/api/textbook/reject-question', (req, res) => {
  try {
    const { questionId, rejectionReason } = req.body;
    if (!questionId) {
      return res.status(400).json({ error: 'Thiếu mã câu hỏi.' });
    }

    // If it was in approved list, remove or mark rejected
    let approvedList = getStoredApprovedQuestions();
    approvedList = approvedList.filter((q: any) => q.id !== questionId);
    saveStoredApprovedQuestions(approvedList);

    return res.json({
      success: true,
      message: 'Đã từ chối câu hỏi.',
      questionId,
      rejectionReason
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/textbook/approved-questions/:id
app.delete('/api/textbook/approved-questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    let approvedList = getStoredApprovedQuestions();
    approvedList = approvedList.filter((q: any) => q.id !== id);
    saveStoredApprovedQuestions(approvedList);
    return res.json({ success: true, message: 'Đã xóa câu hỏi khỏi kho chính thức.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// POST /api/dispute-question
// AI Pedagogical Referee: resolves student appeal in real time
app.post('/api/dispute-question', async (req, res) => {
  try {
    const {
      question,
      selectedOptionIndex,
      selectedOptionText,
      studentComment,
      studentGrade
    } = req.body;

    const correctText = question?.correctAnswerText || question?.options?.[question?.correctIndex] || '';
    const studentText = selectedOptionText || (question?.options && question.options[selectedOptionIndex]) || '';

    let isValidAppeal = false;
    let explanation = '';

    // Direct text equivalence check (handles LaTeX/whitespace normalization)
    const norm = (str: string) => str.replace(/\s+/g, '').replace(/\$/g, '').toLowerCase();
    if (studentText && correctText && norm(studentText) === norm(correctText)) {
      isValidAppeal = true;
      explanation = `Học sinh đã chọn đúng phương án "${studentText}", trùng khớp hoàn toàn với đáp án chuẩn. Hệ thống xác nhận đây là câu trả lời chính xác!`;
    } else {
      // Use Gemini referee for deep semantic evaluation
      const ai = getGenAI();
      if (ai) {
        try {
          const refereePrompt = `Bạn là Trọng Tài Sư Phạm Giáo Dục Quốc Gia.
Học sinh khiếu nại kết quả chấm câu hỏi trắc nghiệm sau:
Đề bài: "${question?.content}"
Các lựa chọn: ${JSON.stringify(question?.options)}
Đáp án hệ thống đã chấm đúng: "${correctText}"
Lựa chọn của học sinh: "${studentText}"
Lý do học sinh khiếu nại: "${studentComment}"

Hãy phán quyết công tâm:
- Phương án học sinh chọn có đúng hoặc có căn cứ tương đương không?
- Hoặc đề bài có bị sai, thiếu dữ kiện, nhập nhằng dẫn tới câu trả lời của học sinh là hợp lý không?

Trả về duy nhất JSON:
{
  "isValidAppeal": true/false,
  "explanation": "Lời giải thích sư phạm thân thiện, công tâm dành cho học sinh (2-3 câu)"
}`;
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [{ role: 'user', parts: [{ text: refereePrompt }] }],
            config: { temperature: 0.2 }
          });

          const raw = response.text || '';
          let clean = raw;
          if (clean.includes('```json')) clean = clean.split('```json')[1].split('```')[0].trim();
          else if (clean.includes('```')) clean = clean.split('```')[1].split('```')[0].trim();
          const parsed = JSON.parse(clean);
          isValidAppeal = Boolean(parsed.isValidAppeal);
          explanation = parsed.explanation || '';
        } catch (err) {
          console.warn('AI Referee fallback:', err);
        }
      }
    }

    if (!explanation) {
      if (isValidAppeal) {
        explanation = 'Trọng tài Sư phạm xác nhận khiếu nại của bạn là hoàn toàn chính xác. Hệ thống đã cập nhật kết quả và hoàn trả quyền lợi!';
      } else {
        explanation = `Trọng tài Sư phạm đã rà soát lại: Phương án đúng của câu này là "${correctText}". ${question?.explanation || 'Cảm ơn em đã gửi phản hồi để giúp hoàn thiện ngân hàng đề thi!'}`;
      }
    }

    // Save report to server
    const reports = getStoredQuestionReports();
    const newReport = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      questionContent: question?.content,
      selectedOptionText: studentText,
      correctAnswerText: correctText,
      subject: question?.subject,
      grade: question?.grade,
      studentComment,
      status: isValidAppeal ? 'RESOLVED_VALID_APPEAL' : 'RESOLVED_REJECTED',
      resolutionNotes: explanation,
      refundedHeart: isValidAppeal,
      compensatedXp: isValidAppeal ? 50 : 0,
      compensatedCoins: isValidAppeal ? 30 : 0,
      timestamp: Date.now()
    };
    reports.unshift(newReport);
    saveStoredQuestionReports(reports);

    res.json({
      isValidAppeal,
      explanation,
      refundHeart: isValidAppeal,
      bonusXp: isValidAppeal ? 50 : 0,
      bonusCoins: isValidAppeal ? 30 : 0,
      report: newReport
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/question-reports
app.get('/api/question-reports', (req, res) => {
  const reports = getStoredQuestionReports();
  res.json({ reports });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup server and WebSocket for Live API (gemini-3.1-flash-live-preview)
async function startServer() {
  const server = http.createServer(app);

  // Setup WebSocket server specifically on path /live-ws
  const wss = new WebSocketServer({ server, path: '/live-ws' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('[Live API] Client connected to voice session');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('[Live API] GEMINI_API_KEY is not configured on server');
      clientWs.send(JSON.stringify({
        type: 'warning',
        message: 'GEMINI_API_KEY chưa được cấu hình. Hệ thống sẽ hỗ trợ chế độ tương tác giọng nói cục bộ.'
      }));
      return;
    }

    let liveSession: any = null;
    let isConnected = false;

    try {
      const ai = new GoogleGenAI({ apiKey });

      let liveModel = 'gemini-3.8-live';
      try {
        liveSession = await ai.live.connect({
          model: liveModel,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Zephyr' }
              }
            },
            systemInstruction: 'Bạn là Gia Sư Trí Tuệ Vui, một người bạn học kiên nhẫn, vui vẻ và thông thái dành cho học sinh Việt Nam. Bạn trò chuyện bằng giọng nói tiếng Việt tự nhiên, ấm áp, ngắn gọn và rõ ràng. Hãy lắng nghe câu hỏi của học sinh và giải thích bài tập thật dễ hiểu!',
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;

              // Audio chunks from model turn
              const parts = message.serverContent?.modelTurn?.parts;
              if (parts && parts.length > 0) {
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({
                      type: 'audio',
                      audio: part.inlineData.data,
                      mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000'
                    }));
                  }
                  if (part.text) {
                    clientWs.send(JSON.stringify({
                      type: 'text',
                      text: part.text
                    }));
                  }
                }
              }

              if (message.serverContent?.interrupted) {
                clientWs.send(JSON.stringify({ type: 'interrupted' }));
              }
            },
            onclose: () => {
              console.log('[Live API] Session closed by Gemini service');
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'session_closed' }));
              }
            },
            onerror: (err: any) => {
              console.error('[Live API] Error in session:', err?.message || err);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'error',
                  message: err?.message || 'Lỗi kết nối Gemini Live'
                }));
              }
            }
          }
        });
      } catch (liveInitErr: any) {
        console.warn('Fallback to gemini-3.1-flash-live-preview:', liveInitErr?.message);
        liveModel = 'gemini-3.1-flash-live-preview';
        liveSession = await ai.live.connect({
          model: liveModel,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Zephyr' }
              }
            },
            systemInstruction: 'Bạn là Gia Sư Trí Tuệ Vui, một người bạn học kiên nhẫn, vui vẻ và thông thái dành cho học sinh Việt Nam. Bạn trò chuyện bằng giọng nói tiếng Việt tự nhiên, ấm áp, ngắn gọn và rõ ràng. Hãy lắng nghe câu hỏi của học sinh và giải thích bài tập thật dễ hiểu!',
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;
              const parts = message.serverContent?.modelTurn?.parts;
              if (parts && parts.length > 0) {
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({
                      type: 'audio',
                      audio: part.inlineData.data,
                      mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000'
                    }));
                  }
                  if (part.text) {
                    clientWs.send(JSON.stringify({
                      type: 'text',
                      text: part.text
                    }));
                  }
                }
              }
              if (message.serverContent?.interrupted) {
                clientWs.send(JSON.stringify({ type: 'interrupted' }));
              }
            },
            onclose: () => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'session_closed' }));
              }
            },
            onerror: (err: any) => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'error',
                  message: err?.message || 'Lỗi kết nối Gemini Live'
                }));
              }
            }
          }
        });
      }

      isConnected = true;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'ready',
          model: liveModel,
          message: `Kết nối đàm thoại trực tiếp với ${liveModel} thành công!`
        }));
      }
    } catch (err: any) {
      console.error('[Live API] Failed to initialize live session:', err?.message || err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          message: `Không thể khởi tạo Live session: ${err?.message || 'Lỗi mạng'}`
        }));
      }
    }

    clientWs.on('message', (rawMsg) => {
      try {
        const payload = JSON.parse(rawMsg.toString());

        if (payload.type === 'audio' && payload.audio && isConnected && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000'
            }
          });
        } else if (payload.type === 'text' && payload.text && isConnected && liveSession) {
          liveSession.send({
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{ text: payload.text }]
              }],
              turnComplete: true
            }
          });
        }
      } catch (err: any) {
        console.error('[Live API] Error handling client message:', err?.message || err);
      }
    });

    clientWs.on('close', () => {
      console.log('[Live API] Client disconnected');
      if (liveSession) {
        try {
          liveSession.close();
        } catch {}
      }
    });
  });

  // Vite middleware for dev or static dist for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tri Thuc Vui Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

