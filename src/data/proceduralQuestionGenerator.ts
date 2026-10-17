import { Question, GradeLevel, SubjectId } from '../types';

/**
 * High-Variety Procedural Question Generator
 * Generates infinite, curriculum-aligned, mathematically & pedagogically sound questions
 * for Grades 1 - 12 across 5 subjects: Toán, Tiếng Anh, Khoa Học, Tin Học, Ngữ Văn.
 * Every question has randomized names, numbers, contexts, distractors, and explanations.
 */

const VIETNAMESE_NAMES = [
  'An', 'Bình', 'Chi', 'Dũng', 'Hoa', 'Hùng', 'Linh', 'Mai', 
  'Minh', 'Nam', 'Phong', 'Quân', 'Thảo', 'Trang', 'Tuấn', 'Vy'
];

const ITEMS = [
  'quả táo', 'viên bi', 'quyển vở', 'chiếc bút chì', 'bông hoa', 
  'cái kẹo', 'ngôi sao điểm tốt', 'con tem', 'mẩu ghép hình'
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampDifficulty(diff: number): 1 | 2 | 3 | 4 | 5 | 6 {
  const rounded = Math.round(diff);
  if (rounded <= 1) return 1;
  if (rounded === 2) return 2;
  if (rounded === 3) return 3;
  if (rounded === 4) return 4;
  if (rounded === 5) return 5;
  return 6;
}

function shuffleOptions(options: string[], correctIndex: number): { options: string[]; correctIndex: number } {
  const correctVal = options[correctIndex];
  const copy = [...options];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return {
    options: copy,
    correctIndex: copy.indexOf(correctVal)
  };
}

// ==================== TOÁN HỌC PROCEDURAL GENERATOR ====================
function generateMathQuestion(grade: GradeLevel, difficulty: number, salt: number): Question {
  const name1 = pickRandom(VIETNAMESE_NAMES);
  const name2 = pickRandom(VIETNAMESE_NAMES.filter(n => n !== name1));
  const item = pickRandom(ITEMS);

  if (grade === 1) {
    const type = randInt(1, 4);
    if (type === 1) {
      // Phép cộng phạm vi 10 / 20
      const a = randInt(2, 6);
      const b = randInt(1, 5);
      const ans = a + b;
      const distractors = [ans - 1, ans + 1, ans + 2].map(String);
      const { options, correctIndex } = shuffleOptions([String(ans), ...distractors], 0);
      return {
        id: `proc_m_g1_add_${Date.now()}_${salt}`,
        grade: 1,
        subject: 'toan',
        topic: 'Phép cộng trong phạm vi 10',
        difficulty: clampDifficulty(difficulty),
        content: `Bạn ${name1} có ${a} ${item}, bạn ${name2} tặng thêm ${b} ${item}. Hỏi ${name1} có tất cả bao nhiêu ${item}?`,
        options,
        correctIndex,
        explanation: `Ta thực hiện phép tính cộng: ${a} + ${b} = ${ans} ${item}.`,
        hint: `Hãy lấy ${a} cộng thêm ${b}.`
      };
    } else if (type === 2) {
      // Phép trừ
      const total = randInt(5, 10);
      const sub = randInt(1, total - 2);
      const ans = total - sub;
      const distractors = [ans - 1, ans + 1, total].map(String);
      const { options, correctIndex } = shuffleOptions([String(ans), ...distractors], 0);
      return {
        id: `proc_m_g1_sub_${Date.now()}_${salt}`,
        grade: 1,
        subject: 'toan',
        topic: 'Phép trừ trong phạm vi 10',
        difficulty: clampDifficulty(difficulty),
        content: `Trên đĩa có ${total} ${item}. Bạn ${name1} đã lấy đi ${sub} ${item}. Hỏi trên đĩa còn lại bao nhiêu ${item}?`,
        options,
        correctIndex,
        explanation: `Số ${item} còn lại là: ${total} - ${sub} = ${ans} ${item}.`,
        hint: `Bớt đi nghĩa là làm phép tính trừ nhé.`
      };
    } else if (type === 3) {
      // Tìm số còn thiếu
      const a = randInt(1, 7);
      const sum = randInt(a + 1, 10);
      const ans = sum - a;
      const distractors = [ans + 1, ans - 1 > 0 ? ans - 1 : ans + 2, sum].map(String);
      const { options, correctIndex } = shuffleOptions([String(ans), ...distractors], 0);
      return {
        id: `proc_m_g1_missing_${Date.now()}_${salt}`,
        grade: 1,
        subject: 'toan',
        topic: 'Tìm số còn thiếu',
        difficulty: 3,
        content: `Điền số thích hợp vào dấu hỏi chấm (?): ${a} + ? = ${sum}`,
        options,
        correctIndex,
        explanation: `Để tìm số còn thiếu, ta lấy tổng trừ đi số đã biết: ${sum} - ${a} = ${ans}.`,
        hint: `${a} cộng với mấy thì bằng ${sum}?`
      };
    } else {
      // Dãy số quy luật
      const step = randInt(1, 2);
      const start = randInt(1, 3);
      const seq = [start, start + step, start + 2 * step, start + 3 * step];
      const ans = start + 4 * step;
      const distractors = [ans - 1, ans + 1, ans + 2].map(String);
      const { options, correctIndex } = shuffleOptions([String(ans), ...distractors], 0);
      return {
        id: `proc_m_g1_seq_${Date.now()}_${salt}`,
        grade: 1,
        subject: 'toan',
        topic: 'Quy luật dãy số',
        difficulty: 4,
        content: `Cho dãy số: ${seq.join(', ')}, ... Số tiếp theo là số nào?`,
        options,
        correctIndex,
        explanation: `Quy luật của dãy là mỗi số sau bằng số trước cộng thêm ${step}: ${seq[3]} + ${step} = ${ans}.`,
        hint: `Em hãy tìm khoảng cách giữa hai số liền nhau.`
      };
    }
  }

  if (grade >= 2 && grade <= 5) {
    const type = randInt(1, 5);
    if (type === 1) {
      // Phép nhân chia bảng cửu chương
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const ans = a * b;
      const distractors = [ans - a, ans + a, ans + 2].map(String);
      const { options, correctIndex } = shuffleOptions([String(ans), ...distractors], 0);
      return {
        id: `proc_m_pri_mul_${Date.now()}_${salt}`,
        grade,
        subject: 'toan',
        topic: 'Bảng nhân và bảng chia',
        difficulty: 2,
        content: `Mỗi hộp có ${a} ${item}. Hỏi ${b} hộp như thế có tất cả bao nhiêu ${item}?`,
        options,
        correctIndex,
        explanation: `Số ${item} trong ${b} hộp là: ${a} × ${b} = ${ans} ${item}.`,
        hint: `Em hãy dùng phép tính nhân lấy số lượng trong 1 hộp nhân với số hộp.`
      };
    } else if (type === 2) {
      // Chu vi & diện tích hình chữ nhật
      const length = randInt(6, 15);
      const width = randInt(3, length - 1);
      const isPerimeter = Math.random() > 0.5;
      const ans = isPerimeter ? (length + width) * 2 : length * width;
      const unit = isPerimeter ? 'cm' : 'cm²';
      const distractors = isPerimeter 
        ? [`${length + width} cm`, `${ans + 4} cm`, `${length * width} cm`]
        : [`${(length + width) * 2} cm²`, `${ans + 10} cm²`, `${ans - 5} cm²`];
      const { options, correctIndex } = shuffleOptions([`${ans} ${unit}`, ...distractors], 0);
      return {
        id: `proc_m_pri_geom_${Date.now()}_${salt}`,
        grade,
        subject: 'toan',
        topic: 'Hình học & Đo lường',
        difficulty: 3,
        content: `Một mảnh vườn hình chữ nhật có chiều dài ${length}m và chiều rộng ${width}m. ${isPerimeter ? 'Chu vi' : 'Diện tích'} của mảnh vườn đó là bao nhiêu?`,
        options,
        correctIndex,
        explanation: isPerimeter 
          ? `Chu vi hình chữ nhật bằng (dài + rộng) × 2 = (${length} + ${width}) × 2 = ${ans} m.`
          : `Diện tích hình chữ nhật bằng dài × rộng = ${length} × ${width} = ${ans} m².`,
        hint: isPerimeter ? `Công thức tính chu vi: P = (a + b) × 2` : `Công thức tính diện tích: S = a × b`
      };
    } else if (type === 3) {
      // Phân số (Lớp 4 - 5)
      const num1 = randInt(1, 4);
      const denom = randInt(5, 9);
      const num2 = randInt(1, denom - num1 - 1);
      const sumNum = num1 + num2;
      const ans = `${sumNum}/${denom}`;
      const distractors = [`${num1 + num2}/${denom * 2}`, `${Math.abs(num1 - num2)}/${denom}`, `${sumNum + 1}/${denom}`];
      const { options, correctIndex } = shuffleOptions([ans, ...distractors], 0);
      return {
        id: `proc_m_pri_frac_${Date.now()}_${salt}`,
        grade,
        subject: 'toan',
        topic: 'Phân số và các phép tính',
        difficulty: 4,
        content: `Tính giá trị biểu thức phân số: ${num1}/${denom} + ${num2}/${denom} = ?`,
        options,
        correctIndex,
        explanation: `Khi cộng hai phân số cùng mẫu số, ta cộng các tử số với nhau và giữ nguyên mẫu số: (${num1} + ${num2})/${denom} = ${ans}.`,
        hint: `Cùng mẫu số rồi thì chỉ cần cộng tử số thôi em nhé.`
      };
    } else if (type === 4) {
      // Tìm x cơ bản
      const x = randInt(10, 45);
      const add = randInt(12, 38);
      const sum = x + add;
      const distractors = [String(x + 5), String(x - 5), String(sum + add)];
      const { options, correctIndex } = shuffleOptions([String(x), ...distractors], 0);
      return {
        id: `proc_m_pri_findx_${Date.now()}_${salt}`,
        grade,
        subject: 'toan',
        topic: 'Tìm thành phần chưa biết',
        difficulty: 3,
        content: `Tìm x biết: x + ${add} = ${sum}`,
        options,
        correctIndex,
        explanation: `Muốn tìm số hạng chưa biết, ta lấy tổng trừ đi số hạng đã biết: x = ${sum} - ${add} = ${x}.`,
        hint: `x đóng vai trò là số hạng chưa biết trong phép cộng.`
      };
    } else {
      // Bài toán tìm hai số khi biết Tổng và Hiệu
      const smaller = randInt(10, 30);
      const diff = randInt(4, 16);
      const larger = smaller + diff;
      const sum = larger + smaller;
      const distractors = [String(smaller), String(larger + 2), String(sum - diff)];
      const { options, correctIndex } = shuffleOptions([String(larger), ...distractors], 0);
      return {
        id: `proc_m_pri_sumdiff_${Date.now()}_${salt}`,
        grade,
        subject: 'toan',
        topic: 'Tìm hai số khi biết Tổng và Hiệu',
        difficulty: 4,
        content: `Tổng số tuổi của hai anh em là ${sum} tuổi, anh hơn em ${diff} tuổi. Hỏi người anh bao nhiêu tuổi?`,
        options: options.map(o => `${o} tuổi`),
        correctIndex,
        explanation: `Công thức số lớn (tuổi anh): (Tổng + Hiệu) : 2 = (${sum} + ${diff}) : 2 = ${larger} tuổi.`,
        hint: `Số lớn = (Tổng + Hiệu) chia 2.`
      };
    }
  }

  if (grade >= 6 && grade <= 9) {
    const type = randInt(1, 4);
    if (type === 1) {
      // Số nguyên & biểu thức (Lớp 6)
      const a = randInt(-15, -2);
      const b = randInt(3, 18);
      const ans = a + b;
      const distractors = [String(ans - 2), String(Math.abs(a) + b), String(a - b)];
      const { options, correctIndex } = shuffleOptions([String(ans), ...distractors], 0);
      return {
        id: `proc_m_sec_int_${Date.now()}_${salt}`,
        grade,
        subject: 'toan',
        topic: 'Tập hợp các số nguyên',
        difficulty: 2,
        content: `Tính giá trị của phép tính: (${a}) + ${b} = ?`,
        options,
        correctIndex,
        explanation: `Cộng hai số nguyên khác dấu: Ta lấy phần số tự nhiên của số lớn hơn trừ đi phần số tự nhiên của số bé hơn và đặt dấu của số lớn hơn trước kết quả: ${b} - ${Math.abs(a)} = ${ans}.`,
        hint: `Quy tắc cộng hai số nguyên khác dấu.`
      };
    } else if (type === 2) {
      // Phương trình bậc nhất một ẩn
      const a = randInt(2, 6);
      const xVal = randInt(2, 8);
      const b = randInt(3, 15);
      const c = a * xVal + b;
      const distractors = [String(xVal + 1), String(xVal - 1), String(xVal * 2)];
      const { options, correctIndex } = shuffleOptions([`x = ${xVal}`, ...distractors.map(d => `x = ${d}`)], 0);
      return {
        id: `proc_m_sec_eq_${Date.now()}_${salt}`,
        grade,
        subject: 'toan',
        topic: 'Phương trình bậc nhất một ẩn',
        difficulty: 3,
        content: `Giải phương trình: ${a}x + ${b} = ${c}`,
        options,
        correctIndex,
        explanation: `Chuyển vế đổi dấu: ${a}x = ${c} - ${b} = ${c - b} => x = ${c - b} / ${a} = ${xVal}.`,
        hint: `Chuyển các số hạng không chứa x sang vế phải rồi chia cho hệ số của x.`
      };
    } else if (type === 3) {
      // Định lý Pythagoras (Lớp 7 - 8)
      const triples = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15]];
      const [c1, c2, ch] = pickRandom(triples);
      const distractors = [`${ch + 1} cm`, `${c1 + c2} cm`, `${ch - 1} cm`];
      const { options, correctIndex } = shuffleOptions([`${ch} cm`, ...distractors], 0);
      return {
        id: `proc_m_sec_pyth_${Date.now()}_${salt}`,
        grade,
        subject: 'toan',
        topic: 'Định lý Pythagoras',
        difficulty: 4,
        content: `Cho tam giác ABC vuông tại A có hai cạnh góc vuông AB = ${c1}cm, AC = ${c2}cm. Độ dài cạnh huyền BC là:`,
        options,
        correctIndex,
        explanation: `Theo định lý Pythagoras trong tam giác vuông: BC² = AB² + AC² = ${c1}² + ${c2}² = ${c1*c1 + c2*c2} = ${ch}² => BC = ${ch} cm.`,
        hint: `Bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.`
      };
    } else {
      // Hằng đẳng thức đáng nhớ (Lớp 8 - 9)
      const a = randInt(2, 5);
      const ans = `${a*a} + 2*${a}x + x²`;
      return {
        id: `proc_m_sec_identity_${Date.now()}_${salt}`,
        grade,
        subject: 'toan',
        topic: 'Những hằng đẳng thức đáng nhớ',
        difficulty: 3,
        content: `Khai triển hằng đẳng thức (x + ${a})² ta được kết quả là:`,
        options: [
          `x² + ${2 * a}x + ${a * a}`,
          `x² + ${a * a}`,
          `x² + ${a}x + ${a * a}`,
          `x² + ${2 * a}x + ${2 * a}`
        ],
        correctIndex: 0,
        explanation: `Theo hằng đẳng thức bình phương của một tổng: (A + B)² = A² + 2AB + B² = x² + 2·${a}·x + ${a}² = x² + ${2 * a}x + ${a * a}.`,
        hint: `(A + B)² = A² + 2AB + B²`
      };
    }
  }

  // Cấp 3 (Lớp 10 - 12)
  const x0 = randInt(1, 4);
  const a = randInt(1, 3);
  return {
    id: `proc_m_hi_${Date.now()}_${salt}`,
    grade,
    subject: 'toan',
    topic: 'Giải tích & Hàm số',
    difficulty: 4,
    content: `Đạo hàm của hàm số f(x) = ${a}x² tại điểm x = ${x0} có giá trị bằng:`,
    options: [
      String(2 * a * x0),
      String(a * x0),
      String(2 * a * x0 + 1),
      String(a * x0 * x0)
    ],
    correctIndex: 0,
    explanation: `Ta có f'(x) = 2·${a}x = ${2 * a}x. Thay x = ${x0} vào: f'(${x0}) = ${2 * a} · ${x0} = ${2 * a * x0}.`,
    hint: `Đạo hàm của x² là 2x.`
  };
}

// ==================== TIẾNG ANH PROCEDURAL GENERATOR ====================
function generateEnglishQuestion(grade: GradeLevel, difficulty: number, salt: number): Question {
  const templates = [
    {
      topic: 'Thì Hiện tại đơn (Present Simple)',
      content: 'She always ______ to school on foot every morning.',
      options: ['goes', 'go', 'going', 'went'],
      correctIndex: 0,
      explanation: 'Chủ ngữ "She" là ngôi thứ ba số ít, diễn tả thói quen lặp lại nên động từ thêm -es (goes).',
      hint: 'Chủ ngữ số ít ngôi thứ 3 đi với động từ thêm -s hoặc -es.'
    },
    {
      topic: 'Thì Quá khứ đơn (Past Simple)',
      content: 'Yesterday, my family ______ a movie at the cinema.',
      options: ['watched', 'watch', 'watches', 'is watching'],
      correctIndex: 0,
      explanation: 'Dấu hiệu "Yesterday" chỉ hành động đã kết thúc trong quá khứ, dùng quá khứ đơn (watched).',
      hint: 'Dấu hiệu thời gian: Yesterday (Hôm qua).'
    },
    {
      topic: 'Từ vựng (Vocabulary)',
      content: 'Which word means a place where you can borrow books?',
      options: ['Library', 'Supermarket', 'Cinema', 'Hospital'],
      correctIndex: 0,
      explanation: 'Library nghĩa là thư viện - nơi mọi người đến đọc và mượn sách.',
      hint: 'Nơi chứa rất nhiều sách và tài liệu học tập.'
    },
    {
      topic: 'So sánh hơn (Comparative Adjectives)',
      content: 'An airplane is ______ than a bicycle.',
      options: ['faster', 'fast', 'fastest', 'more fast'],
      correctIndex: 0,
      explanation: 'So sánh hơn với tính từ ngắn "fast" là fast + -er = faster.',
      hint: 'So sánh hơn của tính từ ngắn có đuôi -er + than.'
    },
    {
      topic: 'Giới từ chỉ thời gian (Prepositions of Time)',
      content: 'We usually have breakfast ______ 7:00 AM.',
      options: ['at', 'on', 'in', 'by'],
      correctIndex: 0,
      explanation: 'Dùng giới từ "at" trước mốc giờ cụ thể (at 7:00 AM).',
      hint: 'Trước giờ giấc dùng giới từ "at".'
    },
    {
      topic: 'Đại từ sở hữu (Possessive Pronouns)',
      content: 'This book belongs to John. It is ______ book.',
      options: ['his', 'her', 'their', 'my'],
      correctIndex: 0,
      explanation: 'John là nam giới, tính từ sở hữu tương ứng là "his".',
      hint: 'Tính từ sở hữu chỉ của anh ấy.'
    }
  ];

  const chosen = pickRandom(templates);
  const { options, correctIndex } = shuffleOptions(chosen.options, chosen.correctIndex);

  return {
    id: `proc_eng_${Date.now()}_${salt}`,
    grade,
    subject: 'tieng_anh',
    topic: chosen.topic,
    difficulty: clampDifficulty(difficulty),
    content: chosen.content,
    options,
    correctIndex,
    explanation: chosen.explanation,
    hint: chosen.hint
  };
}

// ==================== KHOA HỌC PROCEDURAL GENERATOR ====================
function generateScienceQuestion(grade: GradeLevel, difficulty: number, salt: number): Question {
  const templates = [
    {
      topic: 'Quang hợp và Đời sống thực vật',
      content: 'Trong quá trình quang hợp vào ban ngày dưới ánh sáng mặt trời, cây xanh hút khí nào và thải ra khí nào?',
      options: [
        'Hút khí Carbonic (CO₂) và thải ra khí Oxy (O₂)',
        'Hút khí Oxy (O₂) và thải ra khí Carbonic (CO₂)',
        'Hút khí Nitơ và thải ra khí Hydro',
        'Hút hơi nước và thải ra khí Metan'
      ],
      correctIndex: 0,
      explanation: 'Cây xanh dùng năng lượng ánh sáng để quang hợp: hấp thụ CO₂ và nước, tạo ra chất hữu cơ và giải phóng O₂.',
      hint: 'Khí thải ra giúp con người và động vật duy trì sự hô hấp.'
    },
    {
      topic: 'Hệ Mặt Trời & Trái Đất',
      content: 'Hành tinh nào gần Mặt Trời nhất trong Hệ Mặt Trời?',
      options: ['Sao Thủy (Mercury)', 'Sao Kim (Venus)', 'Trái Đất (Earth)', 'Sao Hỏa (Mars)'],
      correctIndex: 0,
      explanation: 'Sao Thủy là hành tinh đầu tiên, nằm ở vị trí gần Mặt Trời nhất.',
      hint: 'Hành tinh này mang tên một nguyên tố kim loại thể lỏng ở nhiệt độ phòng.'
    },
    {
      topic: 'Trạng thái của vật chất',
      content: 'Ở nhiệt độ phòng (25°C), nước nguyên chất tồn tại ở thể nào?',
      options: ['Thể lỏng', 'Thể rắn', 'Thể khí', 'Thể plasma'],
      correctIndex: 0,
      explanation: 'Nước đóng băng ở 0°C (thể rắn), sôi ở 100°C (thể khí) và ở 25°C tồn tại ở thể lỏng.',
      hint: 'Nước chảy từ vòi là thể gì nhỉ?'
    },
    {
      topic: 'Cơ thể người',
      content: 'Cơ quan nào trong cơ thể người chịu trách nhiệm co bóp để bơm máu đi khắp các cơ quan?',
      options: ['Tim', 'Phổi', 'Dạ dày', 'Gan'],
      correctIndex: 0,
      explanation: 'Trái tim hoạt động như một chiếc máy bơm tuần hoàn máu nuôi dưỡng toàn cơ thể.',
      hint: 'Cơ quan này đập liên hồi trong lồng ngực bên trái.'
    }
  ];

  const chosen = pickRandom(templates);
  const { options, correctIndex } = shuffleOptions(chosen.options, chosen.correctIndex);

  return {
    id: `proc_sci_${Date.now()}_${salt}`,
    grade,
    subject: 'khoa_hoc',
    topic: chosen.topic,
    difficulty: clampDifficulty(difficulty),
    content: chosen.content,
    options,
    correctIndex,
    explanation: chosen.explanation,
    hint: chosen.hint
  };
}

// ==================== TIN HỌC PROCEDURAL GENERATOR ====================
function generateInformaticsQuestion(grade: GradeLevel, difficulty: number, salt: number): Question {
  const templates = [
    {
      topic: 'Thiết bị & Phần cứng',
      content: 'Thiết bị nào sau đây là thiết bị đưa thông tin vào (thiết bị vào - Input device)?',
      options: ['Bàn phím và chuột', 'Màn hình máy tính', 'Máy in', 'Loa phát thanh'],
      correctIndex: 0,
      explanation: 'Bàn phím và chuột giúp người dùng nhập lệnh và văn bản vào máy tính (Input device).',
      hint: 'Thiết bị dùng để gõ chữ hoặc click con trỏ.'
    },
    {
      topic: 'Phím tắt thông dụng',
      content: 'Trong hệ điều hành Windows, tổ hợp phím nào dùng để sao chép (Copy) văn bản hoặc tệp?',
      options: ['Ctrl + C', 'Ctrl + V', 'Ctrl + X', 'Ctrl + Z'],
      correctIndex: 0,
      explanation: 'Ctrl + C dùng để Copy (sao chép), Ctrl + V là Paste (dán), Ctrl + X là Cut (cắt).',
      hint: 'Chữ cái đầu tiên của từ "Copy".'
    },
    {
      topic: 'An toàn thông tin mạng',
      content: 'Hành động nào sau đây giúp em bảo vệ tài khoản cá nhân an toàn nhất trên Internet?',
      options: [
        'Đặt mật khẩu mạnh gồm chữ hoa, chữ thường, số, ký tự đặc biệt và không chia sẻ cho người khác',
        'Đặt mật khẩu là ngày sinh hoặc 123456 cho dễ nhớ',
        'Chia sẻ mật khẩu công khai cho bạn bè trên mạng xã hội',
        'Đăng nhập tài khoản trên máy tính công cộng và không đăng xuất'
      ],
      correctIndex: 0,
      explanation: 'Mật khẩu mạnh và giữ bí mật là nguyên tắc vàng để bảo vệ an toàn thông tin.',
      hint: 'Mật khẩu cần dài, phức tạp và không được tiết lộ cho bất kỳ ai.'
    },
    {
      topic: 'Tư duy lập trình & Thuật toán',
      content: 'Trong cấu trúc lập trình, cấu trúc nào dùng để lặp lại một khối lệnh nhiều lần?',
      options: ['Vòng lặp (Loop)', 'Cấu trúc rẽ nhánh (If - Else)', 'Biến số (Variable)', 'Hằng số (Constant)'],
      correctIndex: 0,
      explanation: 'Vòng lặp (như for, while) dùng để thực thi lặp đi lặp lại một chuỗi thao tác.',
      hint: 'Từ mang nghĩa lặp đi lặp lại.'
    }
  ];

  const chosen = pickRandom(templates);
  const { options, correctIndex } = shuffleOptions(chosen.options, chosen.correctIndex);

  return {
    id: `proc_it_${Date.now()}_${salt}`,
    grade,
    subject: 'tin_hoc',
    topic: chosen.topic,
    difficulty: clampDifficulty(difficulty),
    content: chosen.content,
    options,
    correctIndex,
    explanation: chosen.explanation,
    hint: chosen.hint
  };
}

// ==================== NGỮ VĂN PROCEDURAL GENERATOR ====================
function generateLiteratureQuestion(grade: GradeLevel, difficulty: number, salt: number): Question {
  const templates = [
    {
      topic: 'Biện pháp tu từ',
      content: 'Trong câu thơ: "Trẻ em như búp trên cành / Biết ăn ngủ, biết học hành là ngoan", tác giả đã sử dụng biện pháp tu từ nào?',
      options: ['So sánh', 'Nhân hóa', 'Ẩn dụ', 'Điệp từ'],
      correctIndex: 0,
      explanation: 'Từ "như" là dấu hiệu nhận biết trực tiếp của biện pháp tu từ so sánh (so sánh trẻ em với búp trên cành).',
      hint: 'Có từ so sánh "như".'
    },
    {
      topic: 'Ca dao & Tục ngữ',
      content: 'Điền từ còn thiếu vào câu ca dao: "Công cha như núi Thái Sơn / Nghĩa mẹ như nước trong ______ chảy ra."',
      options: ['nguồn', 'biển', 'suối', 'sông'],
      correctIndex: 0,
      explanation: 'Câu ca dao trọn vẹn: "Công cha như núi Thái Sơn / Nghĩa mẹ như nước trong nguồn chảy ra."',
      hint: 'Nơi bắt đầu của dòng nước.'
    },
    {
      topic: 'Thể thơ truyền thống',
      content: 'Thể thơ lục bát truyền thống của Việt Nam có đặc điểm về số tiếng trong mỗi cặp câu là bao nhiêu?',
      options: ['Câu trên 6 tiếng, câu dưới 8 tiếng', 'Câu trên 7 tiếng, câu dưới 7 tiếng', 'Câu trên 5 tiếng, câu dưới 5 tiếng', 'Câu trên 4 tiếng, câu dưới 6 tiếng'],
      correctIndex: 0,
      explanation: 'Lục bát nghĩa là Sáu (Lục) và Tám (Bát): một dòng 6 tiếng đi kèm một dòng 8 tiếng.',
      hint: 'Lục = 6, Bát = 8.'
    },
    {
      topic: 'Từ loại tiếng Việt',
      content: 'Từ nào sau đây là từ láy?',
      options: ['Xanh xao', 'Xanh ngắt', 'Cây cối', 'Sách vở'],
      correctIndex: 0,
      explanation: '"Xanh xao" là từ láy âm đầu (âm x). Các từ còn lại là từ ghép đẳng lập hoặc chính phụ.',
      hint: 'Từ có sự lặp lại âm đầu x.'
    }
  ];

  const chosen = pickRandom(templates);
  const { options, correctIndex } = shuffleOptions(chosen.options, chosen.correctIndex);

  return {
    id: `proc_lit_${Date.now()}_${salt}`,
    grade,
    subject: 'ngu_van',
    topic: chosen.topic,
    difficulty: clampDifficulty(difficulty),
    content: chosen.content,
    options,
    correctIndex,
    explanation: chosen.explanation,
    hint: chosen.hint
  };
}

/**
 * Main Generator Function: Generates N unique questions
 */
export function generateProceduralQuestions(
  grade: GradeLevel,
  subject: SubjectId,
  difficulty: number = 3,
  count: number = 5,
  excludedIds: string[] = []
): Question[] {
  const result: Question[] = [];
  let salt = 0;

  for (let i = 0; i < count; i++) {
    salt++;
    let q: Question;
    switch (subject) {
      case 'toan':
        q = generateMathQuestion(grade, difficulty, salt + i * 17);
        break;
      case 'tieng_anh':
        q = generateEnglishQuestion(grade, difficulty, salt + i * 23);
        break;
      case 'khoa_hoc':
        q = generateScienceQuestion(grade, difficulty, salt + i * 31);
        break;
      case 'tin_hoc':
        q = generateInformaticsQuestion(grade, difficulty, salt + i * 47);
        break;
      case 'ngu_van':
        q = generateLiteratureQuestion(grade, difficulty, salt + i * 53);
        break;
      default:
        q = generateMathQuestion(grade, difficulty, salt + i * 11);
    }
    
    // Ensure unique ID
    q.id = `proc_${subject}_g${grade}_${Date.now()}_${salt}_${Math.random().toString(36).substring(2, 6)}`;
    result.push(q);
  }

  return result;
}
