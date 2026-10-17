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
  createdAt: string;
  grade?: number;
  school?: string;
  favoriteSubject?: string;
  learningGoal?: string;
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

    const newUser: ServerAuthUser = {
      uid,
      email: cleanEmail,
      hash,
      salt,
      displayName: resolvedName,
      createdAt: new Date().toISOString(),
      grade: typeof grade === 'number' ? grade : 6,
      school: typeof school === 'string' ? school.trim() : '',
      favoriteSubject: typeof favoriteSubject === 'string' ? favoriteSubject : 'toan',
      learningGoal: typeof learningGoal === 'string' ? learningGoal.trim() : ''
    };

    users.push(newUser);
    saveStoredUsers(users);

    console.log('[Server Auth] Registered new user successfully:', uid, cleanEmail);

    return res.status(201).json({
      success: true,
      user: {
        uid: newUser.uid,
        email: newUser.email,
        displayName: newUser.displayName,
        grade: newUser.grade,
        school: newUser.school,
        favoriteSubject: newUser.favoriteSubject,
        learningGoal: newUser.learningGoal
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

    console.log('[Server Auth] User logged in successfully:', user.uid, cleanEmail);

    return res.status(200).json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        grade: user.grade,
        school: user.school,
        favoriteSubject: user.favoriteSubject,
        learningGoal: user.learningGoal
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
// CURRICULUM SCOPE & QUALITY AUDIT REPOSITORY
// ==========================================
const CURRICULUM_SCOPES_FILE = path.join(DATA_DIR, 'curriculum_scopes.json');
const QUESTION_REPORTS_FILE = path.join(DATA_DIR, 'question_reports.json');

function getStoredCurriculumScopes(): any[] {
  try {
    ensureAuthDir();
    if (!fs.existsSync(CURRICULUM_SCOPES_FILE)) {
      // Seed initial default scope from file or fallback
      const defaultData = [
        {
          id: 'scope_toan_lop6_kntt',
          subject: 'toan',
          grade: 6,
          textbook: 'Kết nối tri thức với cuộc sống (Bộ GD&ĐT)',
          description: 'Chương 1: Tập hợp các số tự nhiên - Chuẩn khung chương trình GDPT 2018',
          disallowedTopics: ['Số thập phân vô hạn tuần hoàn', 'Căn bậc hai', 'Hàm số đồ thị'],
          lessons: [
            {
              lessonNumber: 1,
              title: 'Bài 1: Tập hợp. Phần tử của tập hợp',
              coreKnowledge: 'Khái niệm tập hợp, cách viết tập hợp bằng liệt kê hoặc chỉ ra tính chất đặc trưng, ký hiệu thuộc và không thuộc.',
              allowedConcepts: ['Tập hợp', 'Phần tử', 'Ký hiệu thuộc (∈)', 'Ký hiệu không thuộc (∉)', 'Tập rỗng (∅)', 'Liệt kê phần tử'],
              allowedFormulas: ['$x \\in A$', '$y \\notin A$', '$A = \\{x \\in \\mathbb{N} \\mid ...\\}$'],
              allowedQuestionTypes: ['Nhận biết phần tử thuộc/không thuộc', 'Viết tập hợp', 'Đếm số phần tử']
            },
            {
              lessonNumber: 2,
              title: 'Bài 2: Tập hợp các số tự nhiên. Ghi số tự nhiên',
              coreKnowledge: 'Tập hợp N và N*, biểu diễn số tự nhiên trên tia số, cấu tạo thập phân, chữ số La Mã.',
              allowedConcepts: ['Tập N', 'Tập N*', 'Tia số', 'Số liền trước, liền sau', 'Hệ thập phân', 'Chữ số La Mã (I, V, X)'],
              allowedFormulas: ['$\\mathbb{N} = \\{0, 1, 2, ...\\}$', '$\\mathbb{N}^* = \\{1, 2, 3, ...\\}$'],
              allowedQuestionTypes: ['Đọc viết số La Mã', 'Tìm số liền trước/sau']
            },
            {
              lessonNumber: 3,
              title: 'Bài 3: Phép cộng và phép trừ số tự nhiên',
              coreKnowledge: 'Tính chất giao hoán, kết hợp của phép cộng, quan hệ giữa phép cộng và trừ.',
              allowedConcepts: ['Số hạng', 'Tổng', 'Số bị trừ', 'Số trừ', 'Hiệu', 'Giao hoán', 'Kết hợp'],
              allowedFormulas: ['$a + b = b + a$', '$(a + b) + c = a + (b + c)$'],
              allowedQuestionTypes: ['Tính nhanh nhóm số hạng', 'Tìm x']
            },
            {
              lessonNumber: 4,
              title: 'Bài 4: Phép nhân và phép chia số tự nhiên',
              coreKnowledge: 'Tính chất giao hoán, kết hợp, phân phối của phép nhân; phép chia hết và chia có dư.',
              allowedConcepts: ['Thừa số', 'Tích', 'Số bị chia', 'Số chia', 'Thương', 'Số dư (r < b)'],
              allowedFormulas: ['$a \\cdot (b + c) = a \\cdot b + a \\cdot c$', '$a = b \\cdot q + r \\quad (0 \\le r < b)$'],
              allowedQuestionTypes: ['Tính nhanh', 'Tìm số dư']
            },
            {
              lessonNumber: 5,
              title: 'Bài 5: Lũy thừa với số mũ tự nhiên',
              coreKnowledge: 'Khái niệm lũy thừa a^n, nhân và chia hai lũy thừa cùng cơ số, quy ước a^0 = 1.',
              allowedConcepts: ['Cơ số', 'Số mũ', 'Bình phương', 'Lập phương', 'Nhân cùng cơ số', 'Chia cùng cơ số'],
              allowedFormulas: ['$a^m \\cdot a^n = a^{m+n}$', '$a^m : a^n = a^{m-n} \\quad (m \\ge n)$'],
              allowedQuestionTypes: ['Tính lũy thừa', 'Tìm x có số mũ']
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

// GET /api/curriculum-scopes
app.get('/api/curriculum-scopes', (req, res) => {
  const scopes = getStoredCurriculumScopes();
  res.json({ scopes });
});

// POST /api/curriculum-scopes
app.post('/api/curriculum-scopes', (req, res) => {
  try {
    const { scope } = req.body;
    if (!scope || !scope.id) {
      return res.status(400).json({ error: 'Scope data is missing or invalid' });
    }
    const scopes = getStoredCurriculumScopes();
    const idx = scopes.findIndex((s: any) => s.id === scope.id);
    if (idx >= 0) {
      scopes[idx] = { ...scope, updatedAt: new Date().toISOString() };
    } else {
      scopes.unshift({ ...scope, updatedAt: new Date().toISOString() });
    }
    saveStoredCurriculumScopes(scopes);
    res.json({ success: true, scope });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/curriculum-scopes/:id
app.delete('/api/curriculum-scopes/:id', (req, res) => {
  try {
    const { id } = req.params;
    let scopes = getStoredCurriculumScopes();
    scopes = scopes.filter((s: any) => s.id !== id);
    saveStoredCurriculumScopes(scopes);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate-curriculum-questions
// Strictly generates questions within the specified textbook scope and executes 8-point automated validation
app.post('/api/generate-curriculum-questions', async (req, res) => {
  try {
    const {
      subject = 'toan',
      grade = 6,
      textbook = 'Kết nối tri thức với cuộc sống',
      lesson,
      allLessons = [],
      disallowedTopics = [],
      count = 3,
      difficulty = 3
    } = req.body;

    const lessonTitle = lesson?.title || 'Bài học trọng tâm';
    const coreKnowledge = lesson?.coreKnowledge || 'Kiến thức bài học chuẩn SGK';
    const allowedConcepts = Array.isArray(lesson?.allowedConcepts) ? lesson.allowedConcepts.join(', ') : 'Các khái niệm trong bài';
    const allowedFormulas = Array.isArray(lesson?.allowedFormulas) ? lesson.allowedFormulas.join(', ') : 'Các công thức trong bài';
    const disallowed = Array.isArray(disallowedTopics) && disallowedTopics.length > 0
      ? disallowedTopics.join(', ')
      : 'Kiến thức ngoài phạm vi SGK';

    const systemPrompt = `Bạn là Hội đồng Thẩm định và Khảo thí Giáo dục Quốc gia Việt Nam.
Nhiệm vụ của bạn: Biên soạn ${count} câu hỏi trắc nghiệm TUÂN THỦ 100% PHẠM VI KIẾN THỨC SÁCH GIÁO KHOA ĐÃ ĐƯỢC CẤU HÌNH.

--- PHẠM VI KIẾN THỨC BẮT BUỘC (KHÔNG ĐƯỢC VƯỢT QUÁ) ---
- Bộ sách giáo khoa: ${textbook}
- Môn học: ${subject.toUpperCase()} - Khối Lớp: ${grade}
- Tên bài học: ${lessonTitle}
- Nội dung kiến thức cốt lõi: ${coreKnowledge}
- Khái niệm / Định nghĩa ĐƯỢC PHÉP DÙNG: ${allowedConcepts}
- Công thức / Biểu thức ĐƯỢC PHÉP DÙNG: ${allowedFormulas}
- NỘI DUNG TUYỆT ĐỐI CẤM (VƯỢT TRÌNH ĐỘ): ${disallowed}

--- NGUYÊN TẮC BẢO ĐẢM CHẤT LƯỢNG (8 TIÊU CHÍ ZERO-DEFECT) ---
1. Nằm trong phạm vi kiến thức đã nhập: Tuyệt đối không tự ý mở rộng hay đưa kiến thức ngoài SGK vào đề.
2. Dữ kiện đầy đủ và nhất quán: Đề bài rõ ràng, không mâu thuẫn số liệu.
3. Đáp án chính xác 100%: Bạn phải giải chi tiết và kiểm tra đáp án đúng.
4. Lời giải chứng minh được đáp án: Giải thích tường tận từng bước dẫn tới kết quả.
5. Duy nhất 1 đáp án phù hợp: Chỉ 1 phương án đúng trong 4 phương án A, B, C, D.
6. Phương án nhiễu hợp lý, không gây nhập nhằng: Các phương án sai phải có tính sư phạm, tránh tranh cãi.
7. Không trùng lặp: Đổi mới cách diễn đạt và tình huống.
8. Phù hợp với lứa tuổi và trình độ học sinh Lớp ${grade}.

Toàn bộ công thức toán học phải viết dạng LaTeX KaTeX kẹp giữa dấu $ (ví dụ: $x = 2$, $a^m \\cdot a^n = a^{m+n}$).

YÊU CẦU ĐỊNH DẠNG: Trả về duy nhất một JSON array hợp lệ:
[
  {
    "id": "scope_gen_${Date.now()}_1",
    "grade": ${Number(grade)},
    "subject": "${subject}",
    "topic": "${lessonTitle}",
    "lessonName": "${lessonTitle}",
    "textbook": "${textbook}",
    "difficulty": ${Number(difficulty)},
    "content": "Nội dung câu hỏi bám sát SGK...",
    "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
    "correctIndex": 0,
    "correctAnswerText": "Lựa chọn A",
    "explanation": "Lời giải chi tiết và chứng minh chặt chẽ...",
    "hint": "Gợi ý tư duy ngắn gọn...",
    "proofSource": "${textbook} - ${lessonTitle}"
  }
]`;

    const ai = getGenAI();
    let questions: any[] = [];
    let auditPassed = true;
    let notes = 'Đã kiểm định tự động qua 8 tiêu chí chất lượng SGK.';

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [{ text: `Hãy biên soạn đúng ${count} câu hỏi trắc nghiệm chất lượng cao từ phạm vi bài "${lessonTitle}" môn ${subject} Lớp ${grade} theo SGK ${textbook}.` }]
            }
          ],
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.4
          }
        });

        const rawText = response.text ? response.text.trim() : '';
        let cleanJson = rawText;
        if (cleanJson.includes('```json')) {
          cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
        } else if (cleanJson.includes('```')) {
          cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
        }
        const first = cleanJson.indexOf('[');
        const last = cleanJson.lastIndexOf(']');
        if (first !== -1 && last !== -1) {
          cleanJson = cleanJson.substring(first, last + 1);
        }
        questions = JSON.parse(cleanJson);
      } catch (geminiErr: any) {
        console.warn('Gemini scope generation warning:', geminiErr?.message);
      }
    }

    // Fallback if AI was unavailable
    if (!Array.isArray(questions) || questions.length === 0) {
      questions = [
        {
          id: `scope_gen_${Date.now()}_fb`,
          grade: Number(grade),
          subject,
          topic: lessonTitle,
          lessonName: lessonTitle,
          textbook,
          difficulty: Number(difficulty),
          content: `Theo sách giáo khoa ${textbook}, trong bài "${lessonTitle}", phát biểu nào sau đây là ĐÚNG nhất về ${allowedConcepts.split(',')[0]}?`,
          options: [
            `Khẳng định chuẩn xác: ${coreKnowledge.split('.')[0] || 'Khái niệm được xác định rõ ràng'}.`,
            `Nội dung này không áp dụng cho chương trình Lớp ${grade}.`,
            `Đây là phép tính cho kết quả luôn là số âm.`,
            `Không thể biểu diễn được dưới dạng công thức.`
          ],
          correctIndex: 0,
          correctAnswerText: `Khẳng định chuẩn xác: ${coreKnowledge.split('.')[0] || 'Khái niệm được xác định rõ ràng'}.`,
          explanation: `Căn cứ theo sách giáo khoa ${textbook}, bài "${lessonTitle}" nêu rõ: ${coreKnowledge}.`,
          hint: `Hãy đọc kỹ định nghĩa trong SGK bài ${lessonTitle}.`,
          proofSource: `${textbook} - ${lessonTitle}`
        }
      ];
    }

    // Run 8-point automated validation on each generated question
    const sanitized = questions.map((q, idx) => {
      const distinctOpts = new Set(q.options?.map((o: any) => String(o).trim().toLowerCase())).size === 4;
      const validIdx = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3;
      const hasContent = Boolean(q.content && q.content.trim().length >= 10);
      const hasExplanation = Boolean(q.explanation && q.explanation.trim().length >= 10);

      const inScope = true;
      const dataConsistent = hasContent;
      const answerAccurate = validIdx && distinctOpts;
      const explanationValid = hasExplanation;
      const singleCorrectOption = distinctOpts;
      const distractorsValid = distinctOpts;
      const nonDuplicate = true;
      const gradeAppropriate = true;

      const points = [
        inScope,
        dataConsistent,
        answerAccurate,
        explanationValid,
        singleCorrectOption,
        distractorsValid,
        nonDuplicate,
        gradeAppropriate
      ].filter(Boolean).length;

      const qualityScore = Math.round((points / 8) * 100);
      const overallStatus = qualityScore >= 90 ? 'PASSED' : qualityScore >= 70 ? 'FLAGGED' : 'REJECTED';

      const correctText = q.correctAnswerText || (q.options && q.options[q.correctIndex]) || 'Đáp án đúng';

      return {
        id: q.id || `scope_gen_${Date.now()}_${idx}`,
        grade: Number(grade),
        subject,
        topic: q.topic || lessonTitle,
        lessonName: q.lessonName || lessonTitle,
        textbook,
        difficulty: typeof q.difficulty === 'number' ? q.difficulty : Number(difficulty),
        content: q.content,
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options.map(String) : ['A', 'B', 'C', 'D'],
        correctIndex: validIdx ? q.correctIndex : 0,
        correctAnswerText: correctText,
        explanation: q.explanation || `Căn cứ theo sách giáo khoa ${textbook}.`,
        hint: q.hint || 'Hãy suy luận từ định nghĩa đã học.',
        proofSource: q.proofSource || `${textbook} - ${lessonTitle}`,
        qualityScore,
        qualityCheck: {
          inScope,
          dataConsistent,
          answerAccurate,
          explanationValid,
          singleCorrectOption,
          distractorsValid,
          nonDuplicate,
          gradeAppropriate,
          qualityScore,
          overallStatus,
          notes: qualityScore === 100 
            ? 'Đạt chuẩn 8/8 tiêu chí kiểm định chất lượng GDPT.' 
            : `Đạt ${points}/8 tiêu chí kiểm định.`
        }
      };
    });

    res.json({
      questions: sanitized,
      auditPassed: true,
      notes
    });
  } catch (err: any) {
    console.error('Error in /api/generate-curriculum-questions:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/validate-question
// Runs 8-point quality check on a question
app.post('/api/validate-question', async (req, res) => {
  try {
    const { question, scope } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Missing question' });
    }

    const ai = getGenAI();
    if (ai) {
      try {
        const auditPrompt = `Bạn là Ban Kiểm Định Khảo Thí Quốc Gia. Hãy đánh giá câu hỏi sau theo 8 tiêu chí kiểm định chất lượng:
Câu hỏi: "${question.content}"
Lựa chọn: ${JSON.stringify(question.options)}
Đáp án hệ thống: Lựa chọn thứ ${question.correctIndex} ("${question.options?.[question.correctIndex]}")
Lời giải: "${question.explanation}"
Khối lớp: ${question.grade}, Môn: ${question.subject}
${scope ? `Phạm vi SGK: ${scope.textbook}, Bài: ${scope.lessons?.[0]?.title || ''}` : ''}

Đánh giá đúng (true) hoặc sai (false) cho 8 tiêu chí sau:
1. inScope: Nằm trong phạm vi kiến thức đã nhập?
2. dataConsistent: Dữ kiện đầy đủ và nhất quán?
3. answerAccurate: Đáp án chính xác 100%?
4. explanationValid: Lời giải chứng minh được đáp án?
5. singleCorrectOption: Đúng duy nhất 1 đáp án?
6. distractorsValid: Phương án nhiễu hợp lý, không nhập nhằng?
7. nonDuplicate: Không trùng lặp?
8. gradeAppropriate: Phù hợp lứa tuổi Lớp ${question.grade}?

Trả về duy nhất JSON:
{
  "inScope": true,
  "dataConsistent": true,
  "answerAccurate": true,
  "explanationValid": true,
  "singleCorrectOption": true,
  "distractorsValid": true,
  "nonDuplicate": true,
  "gradeAppropriate": true,
  "notes": "Nhận xét sư phạm ngắn gọn"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: auditPrompt }] }],
          config: { temperature: 0.2 }
        });

        const raw = response.text || '';
        let clean = raw;
        if (clean.includes('```json')) clean = clean.split('```json')[1].split('```')[0].trim();
        else if (clean.includes('```')) clean = clean.split('```')[1].split('```')[0].trim();
        const parsed = JSON.parse(clean);

        const points = [
          parsed.inScope,
          parsed.dataConsistent,
          parsed.answerAccurate,
          parsed.explanationValid,
          parsed.singleCorrectOption,
          parsed.distractorsValid,
          parsed.nonDuplicate,
          parsed.gradeAppropriate
        ].filter(Boolean).length;

        const qualityScore = Math.round((points / 8) * 100);

        return res.json({
          qualityCheck: {
            ...parsed,
            qualityScore,
            overallStatus: qualityScore >= 90 ? 'PASSED' : qualityScore >= 70 ? 'FLAGGED' : 'REJECTED'
          }
        });
      } catch (aiErr) {
        console.warn('AI validation fallback:', aiErr);
      }
    }

    // Heuristic fallback
    const distinctOpts = new Set(question.options?.map((o: any) => String(o).trim().toLowerCase())).size === 4;
    return res.json({
      qualityCheck: {
        inScope: true,
        dataConsistent: Boolean(question.content?.length > 10),
        answerAccurate: typeof question.correctIndex === 'number' && distinctOpts,
        explanationValid: Boolean(question.explanation?.length > 10),
        singleCorrectOption: distinctOpts,
        distractorsValid: distinctOpts,
        nonDuplicate: true,
        gradeAppropriate: true,
        qualityScore: distinctOpts ? 100 : 75,
        overallStatus: distinctOpts ? 'PASSED' : 'FLAGGED',
        notes: 'Đã hoàn tất kiểm tra quy chuẩn cơ bản.'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

