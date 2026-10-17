import { SubjectId, GradeLevel } from '../types';

export interface LessonScope {
  lessonNumber: number;
  title: string;
  coreKnowledge: string;
  allowedConcepts: string[];
  allowedFormulas: string[];
  allowedQuestionTypes: string[];
}

export interface CurriculumScopeConfig {
  id: string;
  subject: SubjectId;
  grade: GradeLevel;
  textbook: string; // Tên bộ sách giáo khoa: Kết nối tri thức, Chân trời sáng tạo, Cánh diều
  description: string;
  lessons: LessonScope[];
  disallowedTopics: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionQualityCheck {
  inScope: boolean; // 1. Nằm trong phạm vi kiến thức đã nhập
  dataConsistent: boolean; // 2. Dữ kiện đầy đủ và nhất quán
  answerAccurate: boolean; // 3. Đáp án chính xác 100%
  explanationValid: boolean; // 4. Lời giải chứng minh được đáp án
  singleCorrectOption: boolean; // 5. Đúng duy nhất 1 đáp án phù hợp
  distractorsValid: boolean; // 6. Phương án nhiễu hợp lý, không nhập nhằng
  nonDuplicate: boolean; // 7. Không trùng lặp
  gradeAppropriate: boolean; // 8. Phù hợp với lứa tuổi và trình độ học sinh
  qualityScore: number; // 0 - 100%
  overallStatus: 'PASSED' | 'FLAGGED' | 'REJECTED';
  notes: string;
}

export interface VerifiedQuestion {
  id: string;
  grade: GradeLevel;
  subject: SubjectId;
  topic: string;
  lessonName: string;
  textbook: string;
  difficulty: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
  options: string[];
  correctIndex: number;
  correctAnswerText: string;
  explanation: string;
  hint: string;
  proofSource: string;
  qualityCheck: QuestionQualityCheck;
  isApproved: boolean;
  createdAt: string;
}

export interface QuestionReport {
  id: string;
  userId: string;
  userName: string;
  questionId: string;
  questionContent: string;
  selectedOptionIndex: number;
  selectedOptionText: string;
  correctIndex: number;
  correctAnswerText: string;
  subject: SubjectId;
  grade: GradeLevel;
  reason: 'wrong_answer' | 'student_correct_marked_wrong' | 'inconsistent_data' | 'out_of_scope' | 'other';
  studentComment: string;
  status: 'PENDING' | 'RESOLVED_VALID_APPEAL' | 'RESOLVED_REJECTED';
  resolutionNotes?: string;
  compensatedXp?: number;
  compensatedCoins?: number;
  refundedHeart?: boolean;
  timestamp: number;
}

export const DEFAULT_CURRICULUM_SCOPES: CurriculumScopeConfig[] = [
  {
    id: 'scope_toan_lop6_kntt',
    subject: 'toan',
    grade: 6,
    textbook: 'Kết nối tri thức với cuộc sống (Bộ GD&ĐT)',
    description: 'Chương 1: Tập hợp các số tự nhiên - Chuẩn khung chương trình GDPT 2018',
    disallowedTopics: [
      'Số thập phân vô hạn tuần hoàn',
      'Căn bậc hai',
      'Hàm số đồ thị',
      'Hình học không gian lớp trên',
      'Bất đẳng thức Cauchy'
    ],
    lessons: [
      {
        lessonNumber: 1,
        title: 'Bài 1: Tập hợp. Phần tử của tập hợp',
        coreKnowledge: 'Khái niệm tập hợp, cách viết tập hợp bằng liệt kê hoặc chỉ ra tính chất đặc trưng, ký hiệu thuộc và không thuộc.',
        allowedConcepts: ['Tập hợp', 'Phần tử', 'Ký hiệu thuộc (∈)', 'Ký hiệu không thuộc (∉)', 'Tập rỗng (∅)', 'Liệt kê phần tử'],
        allowedFormulas: ['$x \\in A$', '$y \\notin A$', '$A = \\{x \\in \\mathbb{N} \\mid ...\\}$'],
        allowedQuestionTypes: ['Nhận biết phần tử thuộc/không thuộc', 'Viết tập hợp dưới dạng chỉ ra tính chất', 'Đếm số phần tử của tập hợp']
      },
      {
        lessonNumber: 2,
        title: 'Bài 2: Tập hợp các số tự nhiên. Ghi số tự nhiên',
        coreKnowledge: 'Tập hợp N và N*, biểu diễn số tự nhiên trên tia số, cấu tạo thập phân của số tự nhiên, chữ số La Mã.',
        allowedConcepts: ['Tập N', 'Tập N*', 'Tia số', 'Số liền trước, số liền sau', 'Hệ thập phân', 'Chữ số La Mã (I, V, X, L, C, D, M)'],
        allowedFormulas: ['$\\mathbb{N} = \\{0, 1, 2, ...\\}$', '$\\mathbb{N}^* = \\{1, 2, 3, ...\\}$', '$\\overline{ab} = 10a + b$'],
        allowedQuestionTypes: ['Đọc viết số La Mã', 'Tìm số liền trước/liền sau', 'Phân tích cấu tạo số tự nhiên']
      },
      {
        lessonNumber: 3,
        title: 'Bài 3: Phép cộng và phép trừ số tự nhiên',
        coreKnowledge: 'Tính chất giao hoán, kết hợp của phép cộng, quan hệ giữa phép cộng và trừ, tính toán thuận tiện.',
        allowedConcepts: ['Số hạng', 'Tổng', 'Số bị trừ', 'Số trừ', 'Hiệu', 'Giao hoán', 'Kết hợp'],
        allowedFormulas: ['$a + b = b + a$', '$(a + b) + c = a + (b + c)$', '$a - b = c \\Leftrightarrow a = b + c$'],
        allowedQuestionTypes: ['Tính nhanh bằng nhóm số hạng hợp lý', 'Tìm x trong phép cộng/trừ', 'Bài toán lời văn thực tế']
      },
      {
        lessonNumber: 4,
        title: 'Bài 4: Phép nhân và phép chia số tự nhiên',
        coreKnowledge: 'Tính chất giao hoán, kết hợp, phân phối của phép nhân đối với phép cộng; phép chia hết và chia có dư.',
        allowedConcepts: ['Thừa số', 'Tích', 'Số bị chia', 'Số chia', 'Thương', 'Số dư (r < b)', 'Tính chất phân phối'],
        allowedFormulas: ['$a \\cdot (b + c) = a \\cdot b + a \\cdot c$', '$a = b \\cdot q + r \\quad (0 \\le r < b)$'],
        allowedQuestionTypes: ['Tính nhanh tích các số', 'Tìm số dư trong phép chia', 'Bài toán chia đều đồ vật thực tế']
      },
      {
        lessonNumber: 5,
        title: 'Bài 5: Lũy thừa với số mũ tự nhiên',
        coreKnowledge: 'Khái niệm lũy thừa $a^n$, nhân và chia hai lũy thừa cùng cơ số, quy ước $a^0 = 1$ ($a \\neq 0$).',
        allowedConcepts: ['Cơ số', 'Số mũ', 'Bình phương ($a^2$)', 'Lập phương ($a^3$)', 'Nhân cùng cơ số', 'Chia cùng cơ số'],
        allowedFormulas: ['$a^n = a \\cdot a \\dots a$', '$a^m \\cdot a^n = a^{m+n}$', '$a^m : a^n = a^{m-n} \\quad (m \\ge n, a \\ne 0)$', '$a^1 = a$', '$a^0 = 1$'],
        allowedQuestionTypes: ['Tính giá trị lũy thừa', 'Viết gọn tích thành lũy thừa', 'Tìm x có số mũ', 'So sánh hai lũy thừa']
      }
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'scope_toan_lop3_canhdieu',
    subject: 'toan',
    grade: 3,
    textbook: 'Cánh Diều (Bộ GD&ĐT)',
    description: 'Bảng nhân chia 6, 7, 8, 9, làm quen với biểu thức và hình học cơ bản',
    disallowedTopics: ['Phân số', 'Số thập phân', 'Hình tam giác đều', 'Diện tích hình chữ nhật phức tạp'],
    lessons: [
      {
        lessonNumber: 1,
        title: 'Bài 1: Bảng nhân 6 và Bảng chia 6',
        coreKnowledge: 'Học thuộc bảng nhân và chia trong phạm vi 6, áp dụng giải toán có lời văn một bước.',
        allowedConcepts: ['Nhân 6', 'Chia 6', 'Gấp lên 6 lần', 'Giảm đi 6 lần'],
        allowedFormulas: ['$6 \\times n$', '$n : 6$'],
        allowedQuestionTypes: ['Điền số còn thiếu', 'So sánh kết quả phép tính', 'Giải toán có lời văn']
      },
      {
        lessonNumber: 2,
        title: 'Bài 2: Bảng nhân 7 và Bảng chia 7',
        coreKnowledge: 'Quy luật của bảng nhân 7, áp dụng tính chu vi và số ngày trong tuần.',
        allowedConcepts: ['Nhân 7', 'Chia 7', 'Tuần lễ (7 ngày)'],
        allowedFormulas: ['$7 \\times n$', '$n : 7$'],
        allowedQuestionTypes: ['Tính nhẩm nhanh', 'Bài toán thời gian ngày/tuần']
      },
      {
        lessonNumber: 3,
        title: 'Bài 3: Bảng nhân 8 và Bảng chia 8',
        coreKnowledge: 'Ghi nhớ bảng nhân và chia 8, vận dụng tính toán.',
        allowedConcepts: ['Nhân 8', 'Chia 8', 'Một phần tám (1/8)'],
        allowedFormulas: ['$8 \\times n$', '$n : 8$'],
        allowedQuestionTypes: ['Tính giá trị phép tính', 'Tìm một phần mấy của một số']
      },
      {
        lessonNumber: 4,
        title: 'Bài 4: Bảng nhân 9 và Bảng chia 9',
        coreKnowledge: 'Bảng nhân và chia 9, tính chất đảo ngược của phép nhân chia.',
        allowedConcepts: ['Nhân 9', 'Chia 9', 'Mẹo tính trên bàn tay'],
        allowedFormulas: ['$9 \\times n$', '$n : 9$'],
        allowedQuestionTypes: ['Điền số thích hợp', 'Bài toán thực tế chia kẹo/sách']
      },
      {
        lessonNumber: 5,
        title: 'Bài 5: Làm quen với biểu thức số',
        coreKnowledge: 'Thứ tự thực hiện phép tính trong biểu thức không có ngoặc và có ngoặc.',
        allowedConcepts: ['Biểu thức số', 'Giá trị của biểu thức', 'Thứ tự tính: nhân chia trước, cộng trừ sau'],
        allowedFormulas: ['$a + b \\times c = a + (b \\times c)$'],
        allowedQuestionTypes: ['Tính giá trị biểu thức', 'So sánh hai biểu thức']
      }
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'scope_tienganh_lop6_global',
    subject: 'tieng_anh',
    grade: 6,
    textbook: 'Global Success - Kết nối tri thức (Tiếng Anh 6)',
    description: 'Unit 1 đến Unit 5: My New School, My House, My Friends, My Neighbourhood, Natural Wonders',
    disallowedTopics: ['Thì quá khứ hoàn thành', 'Câu điều kiện loại 2, 3', 'Mệnh đề quan hệ nâng cao', 'Đảo ngữ'],
    lessons: [
      {
        lessonNumber: 1,
        title: 'Unit 1: My New School',
        coreKnowledge: 'Từ vựng đồ dùng học tập, các môn học, thì Hiện tại đơn (Present Simple) và trạng từ chỉ tần suất.',
        allowedConcepts: ['School subjects', 'School things', 'Present Simple tense', 'Adverbs of frequency (always, usually, sometimes, never)'],
        allowedFormulas: ['S + V(s/es)', 'S + do/does not + V', 'Do/Does + S + V?'],
        allowedQuestionTypes: ['Chia động từ', 'Chọn từ vựng phù hợp', 'Điền trạng từ chỉ tần suất']
      },
      {
        lessonNumber: 2,
        title: 'Unit 2: My House',
        coreKnowledge: 'Từ vựng các phòng và đồ vật trong nhà, giới từ chỉ vị trí, cấu trúc There is / There are.',
        allowedConcepts: ['Rooms in the house', 'Furniture', 'Prepositions of place (in, on, under, behind, next to)', 'There is / There are'],
        allowedFormulas: ['There is + singular noun', 'There are + plural nouns'],
        allowedQuestionTypes: ['Chọn giới từ đúng theo ngữ cảnh', 'Hoàn thành câu miêu tả căn phòng']
      },
      {
        lessonNumber: 3,
        title: 'Unit 3: My Friends',
        coreKnowledge: 'Tính từ miêu tả tính cách và ngoại hình, thì Hiện tại tiếp diễn (Present Continuous) diễn tả hành động đang diễn ra.',
        allowedConcepts: ['Personality adjectives (kind, creative, friendly, hard-working)', 'Appearance (tall, short, chubby)', 'Present Continuous'],
        allowedFormulas: ['S + am/is/are + V-ing'],
        allowedQuestionTypes: ['Phân biệt Present Simple vs Present Continuous', 'Chọn tính từ miêu tả người']
      },
      {
        lessonNumber: 4,
        title: 'Unit 4: My Neighbourhood',
        coreKnowledge: 'Chỉ đường, so sánh hơn của tính từ ngắn (Comparative adjectives).',
        allowedConcepts: ['Places in neighbourhood', 'Giving directions', 'Comparative with -er and than'],
        allowedFormulas: ['S1 + be + adj-er + than + S2'],
        allowedQuestionTypes: ['Viết câu so sánh hơn', 'Hỏi và chỉ đường']
      },
      {
        lessonNumber: 5,
        title: 'Unit 5: Natural Wonders of Viet Nam',
        coreKnowledge: 'Kỳ quan thiên nhiên, danh từ đếm được và không đếm được, modal verb must / mustn’t.',
        allowedConcepts: ['Natural wonders (caves, islands, waterfalls)', 'Countable & Uncountable nouns', 'Must / Mustn’t for rules'],
        allowedFormulas: ['S + must + V', 'S + mustn’t + V'],
        allowedQuestionTypes: ['Quy tắc bảo vệ di sản', 'Chọn must hay mustn’t']
      }
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'scope_khoahoc_lop6_kntt',
    subject: 'khoa_hoc',
    grade: 6,
    textbook: 'Khoa Học Tự Nhiên 6 - Kết nối tri thức',
    description: 'Chủ đề: Mở đầu KHTN, Đo lường cơ bản, Các thể của chất, Tế bào - Đơn vị cơ sở của sự sống',
    disallowedTopics: ['Phản ứng hóa học hữu cơ', 'Cân bằng phương trình ion', 'Quang hình học nâng cao', 'Di truyền học Mendel'],
    lessons: [
      {
        lessonNumber: 1,
        title: 'Bài 1: Giới thiệu về Khoa học tự nhiên và các phép đo cơ bản',
        coreKnowledge: 'Đối tượng nghiên cứu KHTN, quy tắc an toàn trong phòng thực hành, đo chiều dài, khối lượng và thời gian.',
        allowedConcepts: ['Khoa học tự nhiên', 'Vật sống, vật không sống', 'Đơn vị đo SI: mét (m), kilôgam (kg), giây (s)', 'Giới hạn đo (GHĐ) và Độ chia nhỏ nhất (ĐCNN)'],
        allowedFormulas: ['$1\\text{ m} = 100\\text{ cm} = 1000\\text{ mm}$', '$1\\text{ kg} = 1000\\text{ g}$'],
        allowedQuestionTypes: ['Xác định GHĐ và ĐCNN của thước/cân', 'Quy tắc an toàn trong phòng thực hành']
      },
      {
        lessonNumber: 2,
        title: 'Bài 2: Các thể của chất và sự chuyển thể',
        coreKnowledge: 'Ba thể rắn, lỏng, khí và đặc điểm hạt; các quá trình nóng chảy, đông đặc, bay hơi, ngưng tụ, sôi.',
        allowedConcepts: ['Thể rắn', 'Thể lỏng', 'Thể khí', 'Nóng chảy', 'Đông đặc', 'Bay hơi', 'Ngưng tụ', 'Nhiệt độ sôi'],
        allowedFormulas: ['Rắn $\\rightleftharpoons$ Lỏng $\\rightleftharpoons$ Khí'],
        allowedQuestionTypes: ['Nhận biết hiện tượng chuyển thể trong đời sống', 'Đặc điểm sắp xếp các hạt phân tử ở 3 thể']
      },
      {
        lessonNumber: 3,
        title: 'Bài 3: Oxygen và không khí',
        coreKnowledge: 'Tính chất của oxygen, thành phần của không khí (khoảng 78% Nitrogen, 21% Oxygen, 1% khí khác), vai trò của không khí và ô nhiễm không khí.',
        allowedConcepts: ['Oxygen (khí oxy)', 'Nitrogen (khí nitơ)', 'Duy trì sự sống và sự cháy', 'Ô nhiễm không khí và biện pháp bảo vệ'],
        allowedFormulas: ['$21\\% \\text{ Oxygen} + 78\\% \\text{ Nitrogen} + 1\\% \\text{ khí khác}$'],
        allowedQuestionTypes: ['Xác định thành phần thể tích không khí', 'Nhận biết chất khí duy trì sự cháy']
      },
      {
        lessonNumber: 4,
        title: 'Bài 4: Tế bào - Đơn vị cơ sở của sự sống',
        coreKnowledge: 'Hình dạng, kích thước của tế bào; cấu tạo tế bào nhân sơ và nhân thực (màng sinh chất, chất tế bào, nhân/vùng nhân); phân biệt tế bào động vật và thực vật (thành xenlulôzơ, lục lạp).',
        allowedConcepts: ['Tế bào', 'Màng tế bào', 'Chất tế bào', 'Nhân tế bào', 'Lục lạp', 'Tế bào thực vật', 'Tế bào động vật'],
        allowedFormulas: ['Tế bào $\\rightarrow$ Mô $\\rightarrow$ Cơ quan $\\rightarrow$ Hệ cơ quan $\\rightarrow$ Cơ thể'],
        allowedQuestionTypes: ['Nhận biết thành phần tế bào qua sơ đồ', 'Phân biệt đặc điểm tế bào động vật và thực vật']
      },
      {
        lessonNumber: 5,
        title: 'Bài 5: Cơ thể đơn bào và cơ thể đa bào',
        coreKnowledge: 'Đặc điểm cơ thể đơn bào (trùng roi, trùng giày, vi khuẩn) và cơ thể đa bào (cây xanh, con người, động vật); các cấp độ tổ chức của cơ thể đa bào.',
        allowedConcepts: ['Cơ thể đơn bào', 'Cơ thể đa bào', 'Mô', 'Cơ quan', 'Hệ cơ quan', 'Sinh vật'],
        allowedFormulas: ['Đơn bào = 1 tế bào duy nhất đảm nhiệm mọi chức năng'],
        allowedQuestionTypes: ['Phân loại sinh vật đơn bào hay đa bào', 'Sắp xếp các cấp tổ chức sống từ nhỏ đến lớn']
      }
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'scope_nguvan_lop6_kntt',
    subject: 'ngu_van',
    grade: 6,
    textbook: 'Ngữ Văn 6 - Kết nối tri thức',
    description: 'Chủ đề: Truyện truyền thuyết & cổ tích, Thơ lục bát, Biện pháp tu từ, Từ ghép và từ láy',
    disallowedTopics: ['Văn học hiện thực phê phán 1930-1945', 'Thơ Đường luật thất ngôn bát cú', 'Nghị luận xã hội phức tạp'],
    lessons: [
      {
        lessonNumber: 1,
        title: 'Bài 1: Tôi và các bạn (Truyện đồng thoại & Nhân hóa)',
        coreKnowledge: 'Đặc trưng thể loại truyện đồng thoại (Bài học đường đời đầu tiên - Dế Mèn phiêu lưu ký), biện pháp tu từ nhân hóa, so sánh.',
        allowedConcepts: ['Truyện đồng thoại', 'Nhân vật', 'Người kể chuyện ngôi thứ nhất (tôi)', 'Biện pháp nhân hóa', 'So sánh nghệ thuật'],
        allowedFormulas: ['Nhân hóa: Gán đặc điểm, hành động của người cho loài vật/đồ vật'],
        allowedQuestionTypes: ['Phát hiện biện pháp nhân hóa', 'Phân tích tính cách nhân vật Dế Mèn qua hành động']
      },
      {
        lessonNumber: 2,
        title: 'Bài 2: Gõ cửa trái tim (Thơ có yếu tố tự sự và miêu tả)',
        coreKnowledge: 'Đặc điểm thể thơ lục bát, vần nhịp, các yếu tố tình cảm gia đình, tình mẫu tử.',
        allowedConcepts: ['Thơ lục bát', 'Dòng sáu (lục), dòng tám (bát)', 'Gieo vần chân, vần lưng', 'Nhịp 2/2/2, 4/4'],
        allowedFormulas: ['Tiếng thứ 6 câu lục hiệp vần tiếng thứ 6 câu bát; tiếng thứ 8 câu bát hiệp vần tiếng thứ 6 câu lục tiếp theo'],
        allowedQuestionTypes: ['Xác định cách gieo vần trong câu lục bát', 'Cảm nhận tình cảm trong đoạn thơ ngắn']
      },
      {
        lessonNumber: 3,
        title: 'Bài 3: Yêu thương và chia sẻ (Truyện ngắn)',
        coreKnowledge: 'Cốt truyện, nhân vật, ngôi kể thứ ba, thông điệp về sự sẻ chia và lòng nhân ái.',
        allowedConcepts: ['Cốt truyện', 'Nhân vật chính', 'Lời người kể chuyện vs Lời nhân vật', 'Thông điệp nhân văn'],
        allowedFormulas: ['Ngôi thứ ba: Người kể giấu mình, gọi tên nhân vật'],
        allowedQuestionTypes: ['Xác định ngôi kể', 'Rút ra bài học ý nghĩa từ văn bản']
      },
      {
        lessonNumber: 4,
        title: 'Bài 4: Quê hương yêu dấu (Thực hành Tiếng Việt: Từ đơn, từ phức)',
        coreKnowledge: 'Phân loại từ tiếng Việt: từ đơn, từ phức (từ ghép và từ láy), tác dụng gợi hình gợi cảm của từ láy.',
        allowedConcepts: ['Từ đơn', 'Từ phức', 'Từ ghép đẳng lập', 'Từ ghép chính phụ', 'Từ láy bộ phận', 'Từ láy toàn bộ'],
        allowedFormulas: ['Từ phức = Từ ghép (các tiếng có nghĩa) + Từ láy (các tiếng lặp âm/vần)'],
        allowedQuestionTypes: ['Phân biệt từ ghép và từ láy', 'Tìm từ láy trong đoạn văn miêu tả cảnh đẹp']
      },
      {
        lessonNumber: 5,
        title: 'Bài 5: Những nẻo đường xứ sở (Văn bản ký & Du ký)',
        coreKnowledge: 'Thể loại ký, tính chân thực của sự việc và cảm xúc của người viết khi trải nghiệm các vùng miền đất nước.',
        allowedConcepts: ['Ký', 'Du ký', 'Chi tiết hiện thực', 'Cảm xúc người viết'],
        allowedFormulas: ['Ghi chép sự việc chân thực + Biểu cảm'],
        allowedQuestionTypes: ['Nhận biết đặc điểm thể ký', 'Xác định địa danh và nét đẹp văn hóa được nhắc đến']
      }
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'scope_tinhoc_lop6_kntt',
    subject: 'tin_hoc',
    grade: 6,
    textbook: 'Tin Học 6 - Kết nối tri thức',
    description: 'Thông tin và dữ liệu, Mạng máy tính, An toàn trực tuyến, Soạn thảo văn bản và Sơ đồ tư duy',
    disallowedTopics: ['Lập trình C++/Python nâng cao', 'Cơ sở dữ liệu quan hệ SQL', 'Kiến trúc vi xử lý x86'],
    lessons: [
      {
        lessonNumber: 1,
        title: 'Bài 1: Thông tin và dữ liệu',
        coreKnowledge: 'Khái niệm thông tin, dữ liệu, vật mang tin; các dạng thông tin cơ bản (văn bản, hình ảnh, âm thanh).',
        allowedConcepts: ['Thông tin (information)', 'Dữ liệu (data)', 'Vật mang tin', 'Xử lý thông tin (Đầu vào -> Xử lý -> Đầu ra)'],
        allowedFormulas: ['Dữ liệu là hình thức thể hiện của thông tin; Thông tin đem lại sự hiểu biết cho con người'],
        allowedQuestionTypes: ['Phân biệt thông tin và vật mang tin', 'Nhận biết dạng thông tin']
      },
      {
        lessonNumber: 2,
        title: 'Bài 2: Lưu trữ và trao đổi thông tin',
        coreKnowledge: 'Đơn vị đo lượng thông tin (Bit, Byte, KB, MB, GB, TB); các thiết bị lưu trữ.',
        allowedConcepts: ['Bit (0 hoặc 1)', 'Byte (8 bit)', 'KB, MB, GB, TB', 'Ổ cứng, USB, Thẻ nhớ'],
        allowedFormulas: ['$1\\text{ Byte} = 8\\text{ bit}$', '$1\\text{ KB} = 1024\\text{ B}$', '$1\\text{ MB} = 1024\\text{ KB}$', '$1\\text{ GB} = 1024\\text{ MB}$'],
        allowedQuestionTypes: ['Đổi đơn vị đo dung lượng', 'Tính số bài hát/ảnh có thể chứa trong USB']
      },
      {
        lessonNumber: 3,
        title: 'Bài 3: Mạng máy tính và Internet',
        coreKnowledge: 'Khái niệm mạng máy tính, các thành phần của mạng (thiết bị đầu cuối, thiết bị kết nối, đường truyền), mạng có dây và không dây (Wi-Fi).',
        allowedConcepts: ['Mạng máy tính', 'Máy tính để bàn, laptop, smartphone', 'Bộ định tuyến (Router), Switch', 'Cáp mạng vs Wi-Fi', 'Internet'],
        allowedFormulas: ['Mạng máy tính = Thiết bị đầu cuối + Thiết bị kết nối + Phần mềm mạng'],
        allowedQuestionTypes: ['Xác định thiết bị đầu cuối', 'Ưu điểm của mạng máy tính']
      },
      {
        lessonNumber: 4,
        title: 'Bài 4: An toàn thông tin trên Internet',
        coreKnowledge: 'Mật khẩu mạnh, thông tin cá nhân cần bảo mật, nguy cơ virus và lừa đảo trực tuyến (phishing), ứng xử văn minh trên mạng.',
        allowedConcepts: ['Mật khẩu mạnh (chữ hoa, thường, số, ký tự đặc biệt, >= 8 ký tự)', 'Thông tin cá nhân', 'Mã độc / Virus', 'Bắt nạt qua mạng (Cyberbullying)'],
        allowedFormulas: ['Không chia sẻ mật khẩu, số điện thoại, địa chỉ nhà cho người lạ trên mạng'],
        allowedQuestionTypes: ['Đánh giá độ an toàn của mật khẩu', 'Xử lý tình huống khi gặp tin nhắn độc hại']
      },
      {
        lessonNumber: 5,
        title: 'Bài 5: Sơ đồ tư duy và biểu diễn ý tưởng',
        coreKnowledge: 'Khái niệm sơ đồ tư duy (Mindmap), chủ đề trung tâm, các nhánh chính và nhánh phụ, sử dụng phần mềm tạo sơ đồ tư duy.',
        allowedConcepts: ['Sơ đồ tư duy (Mindmap)', 'Chủ đề chính (Central topic)', 'Nhánh chính (Main branch)', 'Nhánh con (Sub branch)', 'Từ khóa (Keywords)'],
        allowedFormulas: ['Ý tưởng trung tâm -> Nhánh chính -> Nhánh phụ'],
        allowedQuestionTypes: ['Nhận biết cấu trúc sơ đồ tư duy', 'Chọn từ khóa phù hợp cho nhánh']
      }
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  }
];
