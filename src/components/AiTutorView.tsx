import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import { UserProfile, SubjectId, Question } from '../types';
import { SUBJECTS } from '../data/subjects';
import { soundManager } from '../services/sound';
import { StorageService } from '../services/storage';
import { FirebaseDataService, auth } from '../services/firebase';
import { LiveVoiceModal } from './LiveVoiceModal';
import { AudioRecorderModal } from './AudioRecorderModal';
import { AiQuestionGeneratorModal } from './AiQuestionGeneratorModal';
import { MathMarkdown } from './MathMarkdown';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  BookOpen,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Compass,
  ArrowRight,
  School,
  AlertCircle,
  Mic,
  Radio,
  Globe,
  ExternalLink,
  Cpu
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'tutor';
  text: string;
  timestamp: string;
  subject?: string;
  copied?: boolean;
  followUpSuggestions?: string[];
  groundingSources?: Array<{ title: string; url: string }>;
  usedSearch?: boolean;
  modelUsed?: string;
}

interface AiTutorViewProps {
  user: UserProfile;
  onNavigate: (tab: string, extra?: unknown) => void;
  onUserUpdate: (user: UserProfile) => void;
  initialPrompt?: string;
  initialSubject?: SubjectId | 'all';
  contextQuestion?: Question | null;
}

type TutorPersona = 'owl' | 'cat' | 'robot';

interface PersonaInfo {
  id: TutorPersona;
  name: string;
  title: string;
  avatar: string;
  tagline: string;
  bgGradient: string;
  borderColor: string;
}

const PERSONAS: PersonaInfo[] = [
  {
    id: 'owl',
    name: 'Thầy Cú Thông Thái',
    title: 'Gia Sư Bác Học',
    avatar: '🦉',
    tagline: 'Phương pháp sư phạm, giải toán & khoa học logic, bài bản',
    bgGradient: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-300'
  },
  {
    id: 'cat',
    name: 'Cô Mèo Dịu Dàng',
    title: 'Gia Sư Ân Cần',
    avatar: '🐱',
    tagline: 'Kiên nhẫn, lời giải dễ thương, ví dụ gần gũi đời thường',
    bgGradient: 'from-rose-400 to-pink-600',
    borderColor: 'border-pink-300'
  },
  {
    id: 'robot',
    name: 'Robot Trí Tuệ AI',
    title: 'Gia Sư Công Nghệ',
    avatar: '🤖',
    tagline: 'Nhanh nhạy, chính xác, mẹo tính nhẩm & thuật toán hiện đại',
    bgGradient: 'from-blue-500 to-indigo-600',
    borderColor: 'border-blue-300'
  }
];

const PROMPT_TEMPLATES: { label: string; template: string; subject: string; icon: string }[] = [
  {
    label: 'Giải bài tập từng bước',
    template: 'Em có bài toán này chưa hiểu cách làm, thầy/cô hướng dẫn từng bước giúp em với: ',
    subject: 'toan',
    icon: '📐'
  },
  {
    label: 'Soạn văn & Lập dàn ý',
    template: 'Hướng dẫn em lập dàn ý 3 phần chi tiết và cách viết mở bài ấn tượng cho đề bài: ',
    subject: 'van',
    icon: '✍️'
  },
  {
    label: 'Ngữ pháp Tiếng Anh',
    template: 'Giải thích cho em quy tắc sử dụng và dấu hiệu nhận biết của thì: ',
    subject: 'anh',
    icon: '🇬🇧'
  },
  {
    label: 'Lập trình & Thuật toán',
    template: 'Giải thích cách hoạt động và cho ví dụ bằng Python/Scratch về: ',
    subject: 'tin',
    icon: '💻'
  },
  {
    label: 'Giải thích hiện tượng',
    template: 'Tại sao lại có hiện tượng khoa học: ',
    subject: 'khoahoc',
    icon: '🔬'
  },
  {
    label: 'Mẹo tính nhẩm nhanh',
    template: 'Chỉ cho em mẹo tính nhẩm nhanh và tránh nhầm lẫn khi làm phép tính: ',
    subject: 'toan',
    icon: '⚡'
  }
];

// Helper to sanitize greetings and prevent repetitive phrases
function sanitizeTutorGreeting(text: string, isFirstMessage: boolean): string {
  if (!text || typeof text !== 'string') return '';
  let res = text.trim();

  const greetingPattern = /^(?:###\s*)?(?:Chào em|Xin chào(?:\s+em|\s+bạn)?|Chào bạn|Hello em|Thầy chào em|Cô chào em)[^.!\n]*[.!\n]+\s*/i;
  const fillerComplimentPattern = /^(?:###\s*)?(?:Câu hỏi của em (?:rất hay|thú vị|tuyệt vời)|Đây là (?:một )?câu hỏi (?:rất hay|thú vị|tuyệt vời)|Thầy\/Cô rất vui[^.!\n]*|Thầy rất vui[^.!\n]*|Cô rất vui[^.!\n]*|Tất nhiên rồi|Được rồi|Rất vui được hỗ trợ em)[^.!\n]*[.!\n]+\s*/i;

  if (!isFirstMessage) {
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

/**
 * Memoized Chat Bubble Item to prevent re-rendering historical messages
 * when typing or when new messages arrive.
 */
interface ChatMessageItemProps {
  msg: ChatMessage;
  userAvatar: string;
  username: string;
  personaAvatar: string;
  personaName: string;
  personaBgGradient: string;
  isCopied: boolean;
  isSpeaking: boolean;
  onCopy: (id: string, text: string) => void;
  onSpeak: (id: string, text: string) => void;
  onSelectFollowUp: (suggestion: string) => void;
}

const ChatMessageItem = React.memo<ChatMessageItemProps>(
  ({
    msg,
    userAvatar,
    username,
    personaAvatar,
    personaName,
    personaBgGradient,
    isCopied,
    isSpeaking,
    onCopy,
    onSpeak,
    onSelectFollowUp
  }) => {
    const isUser = msg.role === 'user';

    return (
      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 shadow-xs font-bold ${
            isUser
              ? 'bg-amber-500 text-white'
              : `bg-gradient-to-br ${personaBgGradient} text-white`
          }`}
        >
          {isUser ? userAvatar : personaAvatar}
        </div>

        {/* Bubble */}
        <div className="max-w-[85%] sm:max-w-[78%] space-y-2">
          <div
            className={`flex items-center gap-2 text-[11px] font-semibold text-slate-400 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            <span>{isUser ? username : personaName}</span>
            <span>•</span>
            <span>{msg.timestamp}</span>
            {msg.subject && (
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px]">
                {msg.subject}
              </span>
            )}
          </div>

          <div
            className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
              isUser
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-tr-xs font-medium'
                : 'bg-slate-50 border border-slate-200/90 text-slate-800 rounded-tl-xs'
            }`}
          >
            {isUser ? (
              <div className="math-user-bubble text-white">
                <MathMarkdown content={msg.text} className="text-white" />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none prose-slate space-y-2">
                <MathMarkdown content={msg.text} />
              </div>
            )}
          </div>

          {/* Grounding sources if web search was used */}
          {!isUser && msg.groundingSources && msg.groundingSources.length > 0 && (
            <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-blue-900 text-[11px]">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Nguồn đối chiếu thông tin thời gian thực (Google Search Grounding):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {msg.groundingSources.map((source, sIdx) => (
                  <a
                    key={sIdx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors"
                  >
                    <span className="truncate max-w-[180px]">{source.title}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions for Tutor Bubble */}
          {!isUser && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => onCopy(msg.id, msg.text)}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                title="Sao chép câu trả lời"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">Đã chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSpeak(msg.id, msg.text)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                  isSpeaking
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
                title="Đọc to lời giải"
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-3 h-3 text-amber-600 animate-pulse" />
                    <span>Dừng đọc</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" />
                    <span>Đọc to</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Quick follow-up buttons */}
          {!isUser && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-1.5">
              {msg.followUpSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectFollowUp(suggestion)}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>💬 {suggestion}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);
ChatMessageItem.displayName = 'ChatMessageItem';

/**
 * Isolated Chat Input Bar component.
 * Ensures typing updates only its own local state and NEVER re-renders the parent AiTutorView
 * or the chat history / KaTeX / Markdown.
 */
export interface ChatInputBarHandle {
  setValue: (value: string) => void;
  focus: () => void;
}

interface ChatInputBarProps {
  isLoading: boolean;
  currentPersonaName: string;
  useSearchGrounding: boolean;
  onToggleSearchGrounding: () => void;
  onRecordClick: () => void;
  onSend: (text: string) => void;
  initialPrompt?: string;
  statusNote?: string | null;
}

const ChatInputBar = React.forwardRef<ChatInputBarHandle, ChatInputBarProps>(
  (
    {
      isLoading,
      currentPersonaName,
      useSearchGrounding,
      onToggleSearchGrounding,
      onRecordClick,
      onSend,
      initialPrompt = '',
      statusNote
    },
    ref
  ) => {
    const [inputText, setInputText] = useState(initialPrompt);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      setValue: (val: string) => {
        setInputText(val);
      },
      focus: () => {
        textareaRef.current?.focus();
      }
    }));

    useEffect(() => {
      if (initialPrompt && initialPrompt.trim().length > 0) {
        setInputText(initialPrompt);
        textareaRef.current?.focus();
      }
    }, [initialPrompt]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = inputText.trim();
        if (trimmed && !isLoading) {
          setInputText('');
          onSend(trimmed);
        }
      }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputText.trim();
      if (trimmed && !isLoading) {
        setInputText('');
        onSend(trimmed);
      }
    };

    return (
      <div className="p-3 sm:p-4 bg-white border-t border-slate-200/80">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              id="ai-tutor-input-textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Nhắn câu hỏi cho ${currentPersonaName}... (Nhấn Enter để gửi, Shift+Enter xuống dòng)`}
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all resize-none shadow-inner"
            />
            <div className="absolute right-3 bottom-2.5 flex items-center gap-2">
              {/* Toggle Google Search Grounding */}
              <button
                type="button"
                onClick={onToggleSearchGrounding}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  useSearchGrounding
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                }`}
                title="Bật/Tắt tìm kiếm thông tin mới nhất trên Google (Search Grounding)"
              >
                <Globe className="w-3 h-3" />
                <span>Google Search</span>
              </button>

              {/* Quick Mic button inside input bar */}
              <button
                type="button"
                onClick={onRecordClick}
                className="p-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors cursor-pointer"
                title="Nói câu hỏi (chuyển giọng nói sang chữ)"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Enter ↵ gửi
              </span>
            </div>
          </div>

          <button
            type="submit"
            id="ai-tutor-submit-btn"
            disabled={isLoading || !inputText.trim()}
            className="p-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-2xl shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
            title="Gửi câu hỏi cho Gia sư AI"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        {statusNote && (
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
            <span>{statusNote}</span>
          </div>
        )}
      </div>
    );
  }
);
ChatInputBar.displayName = 'ChatInputBar';

export const AiTutorView: React.FC<AiTutorViewProps> = ({
  user,
  onNavigate,
  onUserUpdate,
  initialPrompt = '',
  initialSubject = 'all',
  contextQuestion = null
}) => {
  const [selectedPersona, setSelectedPersona] = useState<TutorPersona>('owl');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId | 'all'>(initialSubject);
  const [selectedGrade, setSelectedGrade] = useState<number>(user.grade);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isQuestionGenModalOpen, setIsQuestionGenModalOpen] = useState(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);

  const chatInputRef = useRef<ChatInputBarHandle>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Storage key for chat messages
  const chatStorageKey = `ai_tutor_messages_${user.id}`;

  // Track whether tutor has already greeted in current conversation session
  const [hasGreeted, setHasGreeted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.some((m: ChatMessage) => m.role === 'user');
        }
      }
    } catch {
      // fallback
    }
    return false;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }

    // Default welcome message
    return [
      {
        id: 'welcome-msg',
        role: 'tutor',
        text: `Chào bạn **${user.username}**! 👋

Thầy là **Thầy Cú Thông Thái 🦉** - Gia Sư AI riêng của em tại **Tri Thức Vui**!

Em đang gặp khó khăn ở bài tập nào hay muốn hiểu sâu môn gì cứ nhắn trực tiếp cho Thầy nhé:
- 📐 **Toán học**: Giải phương trình, phân số, hình học, mẹo tính nhẩm.
- 🇬🇧 **Tiếng Anh**: Ngữ pháp, từ vựng, viết đoạn văn, phát âm.
- ✍️ **Ngữ văn**: Lập dàn ý, phân tích tác phẩm, viết đoạn văn cảm thụ.
- 💻 **Tin học**: Thuật toán, lập trình Python, Scratch, kiến thức máy tính.
- 🔬 **Khoa học & Đời sống**: Giải thích hiện tượng tự nhiên thú vị.

Em hãy gõ câu hỏi vào ô bên dưới hoặc chọn các mẫu gợi ý nhé! 🚀`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        followUpSuggestions: [
          'Giải thích cách cộng hai phân số khác mẫu',
          'Cách nhận biết thì hiện tại hoàn thành',
          'Lập dàn ý bài văn tả cảnh thiên nhiên',
          'Tại sao ban ngày trời lại sáng còn ban đêm lại tối?'
        ]
      }
    ];
  });

  // Save messages to local storage
  useEffect(() => {
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, chatStorageKey]);

  // Load chat history from Firestore if user is authenticated
  useEffect(() => {
    let isMounted = true;
    async function loadFirestoreChat() {
      if (!auth.currentUser) return;
      try {
        const firestoreRecords = await FirebaseDataService.getChatHistory(auth.currentUser.uid, 40);
        if (firestoreRecords && firestoreRecords.length > 0 && isMounted) {
          const mapped: ChatMessage[] = firestoreRecords.map(rec => ({
            id: rec.id || `fs-${rec.timestamp}`,
            role: rec.role === 'user' ? 'user' : 'tutor',
            text: rec.text,
            timestamp: new Date(rec.timestamp || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            subject: rec.subject,
            modelUsed: rec.modelUsed,
            groundingSources: rec.groundingSources || [],
            usedSearch: Array.isArray(rec.groundingSources) && rec.groundingSources.length > 0
          }));
          if (mapped.some(rec => rec.role === 'user')) {
            setHasGreeted(true);
          }
          // Ensure we don't overwrite if local messages are much newer, or merge intelligently
          setMessages(mapped);
        }
      } catch (e) {
        console.warn('Could not load chat from Firestore, fallback to local', e);
      }
    }
    loadFirestoreChat();
    return () => {
      isMounted = false;
    };
  }, [user.id]);

  // Scroll to bottom of message container smoothly and cleanly without triggering page jumps
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  // Only scroll when message count changes or when tutor finishes/starts thinking
  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, isLoading, scrollToBottom]);

  // Initial scroll on mount
  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  // Stop speaking when unmounted
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const currentPersona = PERSONAS.find(p => p.id === selectedPersona) || PERSONAS[0];

  // Send message - memoized to prevent re-render cascade
  const handleSendMessage = useCallback(async (textToSend: string) => {
    const query = (textToSend || '').trim();
    if (!query || isLoading) return;

    soundManager.playClick();

    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: timeStr,
      subject: selectedSubject !== 'all' ? selectedSubject : undefined
    };

    // Determine whether this is the first user question of the conversation session
    // Once greeted or after any user question exists, subsequent questions are never greeted again
    const isFirst = !hasGreeted && !messages.some(m => m.role === 'user');
    if (isFirst) {
      setHasGreeted(true);
    }

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setStatusNote(null);

    // Give user XP for active questioning (+10 XP)
    try {
      const updatedUser = StorageService.addXp(10);
      if (updatedUser) {
        onUserUpdate(updatedUser);
      }
    } catch {
      // ignore
    }

    try {
      const historyPayload = messages
        .filter(m => m.id !== 'welcome-msg' && m.id !== 'welcome-new')
        .slice(-8)
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          text: m.text
        }));

      const subjectName = selectedSubject === 'all'
        ? 'Tất cả các môn'
        : (SUBJECTS.find(s => s.id === selectedSubject)?.name || 'Toán học');

      const response = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query,
          subject: subjectName,
          grade: selectedGrade,
          persona: selectedPersona,
          history: historyPayload,
          contextQuestion: contextQuestion || undefined,
          useSearch: useSearchGrounding,
          isFirstMessage: isFirst
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const data = await response.json();

      soundManager.playCorrect();

      const rawAnswer = data.answer || 'Thầy/Cô đã nhận được câu hỏi. Em có thể nói rõ hơn yêu cầu bài toán được không?';
      const cleanAnswer = sanitizeTutorGreeting(rawAnswer, isFirst);

      const tutorMessage: ChatMessage = {
        id: `tutor-${Date.now()}`,
        role: 'tutor',
        text: cleanAnswer,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        followUpSuggestions: data.followUpSuggestions || [],
        groundingSources: data.groundingSources || [],
        usedSearch: data.usedSearch || false,
        modelUsed: data.modelUsed
      };

      setMessages(prev => [...prev, tutorMessage]);
      if (data.note) {
        setStatusNote(data.note);
      }

      // Persist to Firebase Firestore if user is authenticated
      if (auth.currentUser) {
        FirebaseDataService.saveChatMessage(
          auth.currentUser.uid,
          'user',
          query,
          subjectName,
          selectedPersona
        ).catch(() => {});

        FirebaseDataService.saveChatMessage(
          auth.currentUser.uid,
          'tutor',
          tutorMessage.text,
          subjectName,
          selectedPersona,
          data.modelUsed,
          data.groundingSources
        ).catch(() => {});
      }
    } catch (err: any) {
      console.error('Error contacting AI Tutor:', err);
      soundManager.playIncorrect();

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'tutor',
        text: `Ôi, kết nối tới gia sư bị gián đoạn một chút! 
Em kiểm tra lại mạng hoặc thử hỏi lại một lần nữa nhé. Nếu cần giải gấp, em có thể xem các mẹo giải có sẵn trong phần **🔍 Tìm Câu Hỏi**!`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    selectedSubject,
    hasGreeted,
    messages,
    onUserUpdate,
    selectedGrade,
    selectedPersona,
    contextQuestion,
    useSearchGrounding
  ]);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleSpeak = useCallback((id: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt của bạn chưa hỗ trợ phát giọng nói.');
      return;
    }

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean text and math formulas for natural speech
    const cleanText = text
      .replace(/\\\[([\s\S]*?)\\\]/g, ' công thức ')
      .replace(/\\\(([\s\S]*?)\\\)/g, ' công thức ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' công thức toán ')
      .replace(/\$[^\$]+?\$/g, ' công thức ')
      .replace(/[*#`_\[\]()]/g, ' ')
      .replace(/\\(?:frac|sqrt|Rightarrow|Leftarrow|cdot)/g, ' ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.95;

    utterance.onend = () => {
      setSpeakingId(null);
    };
    utterance.onerror = () => {
      setSpeakingId(null);
    };

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  const handleClearHistory = () => {
    if (window.confirm('Em có chắc chắn muốn xóa toàn bộ lịch sử hỏi gia sư để bắt đầu chủ đề mới?')) {
      localStorage.removeItem(chatStorageKey);
      setHasGreeted(false);
      setMessages([
        {
          id: 'welcome-new',
          role: 'tutor',
          text: `Đã làm mới cuộc trò chuyện! Thầy/Cô đã sẵn sàng cho câu hỏi mới từ em. Hãy bắt đầu nhé! 🌟`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* 1. HEADER & TUTOR PERSONA CARDS */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentPersona.bgGradient} text-white flex items-center justify-center text-2xl shadow-md shrink-0`}>
              {currentPersona.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900">
                  Gia Sư Riêng AI - Tri Thức Vui
                </h1>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Trực tuyến
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Hỏi đáp 1-1 không giới hạn • Giải bài tập từng bước • Phù hợp Lớp 1 - 12
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Generate Infinite Questions with Gemini & Google Search */}
            <button
              id="ai-tutor-generate-questions-btn"
              type="button"
              onClick={() => {
                soundManager.playClick();
                setIsQuestionGenModalOpen(true);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
              title="Dùng Gemini và Google Search để tạo vô hạn câu hỏi không trùng lặp cho từng môn, lớp"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Tạo Câu Hỏi Vô Hạn (Google Search)</span>
            </button>

            {/* Live Voice API Conversation button */}
            <button
              id="ai-tutor-live-voice-btn"
              type="button"
              onClick={() => {
                soundManager.playClick();
                setIsLiveModalOpen(true);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
              title="Đàm thoại trực tiếp 2 chiều với Gemini Live API"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Đàm Thoại Trực Tiếp (Live)</span>
            </button>

            {/* Audio Recorder & Transcribe button */}
            <button
              id="ai-tutor-record-audio-btn"
              type="button"
              onClick={() => {
                soundManager.playClick();
                setIsRecordModalOpen(true);
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
              title="Ghi âm câu hỏi để chuyển thành văn bản (gemini-3.5-transcribe)"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Ghi Âm Câu Hỏi</span>
            </button>

            {/* Subject Selector */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value as SubjectId | 'all')}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="all">📚 Tất cả các môn</option>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>

            {/* Grade Selector */}
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Lớp {g}
                </option>
              ))}
            </select>

            <button
              onClick={handleClearHistory}
              className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Xóa lịch sử chat để bắt đầu phiên mới"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Làm mới
            </button>
          </div>
        </div>

        {/* Persona Switcher Bar */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Chọn phong cách gia sư đồng hành:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PERSONAS.map((persona) => {
              const isSelected = selectedPersona === persona.id;
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => {
                    setSelectedPersona(persona.id);
                    soundManager.playClick();
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? `bg-slate-50 ${persona.borderColor} ring-2 ring-amber-400/40 shadow-xs`
                      : 'bg-white border-slate-200/80 hover:bg-slate-50/60'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${persona.bgGradient} text-white flex items-center justify-center text-xl shrink-0 shadow-xs`}>
                    {persona.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-xs text-slate-900 truncate">
                        {persona.name}
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {persona.tagline}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Context Question Banner if referred from Question Bank */}
      {contextQuestion && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs">
              <div className="font-bold text-amber-900">
                Đang hỏi về câu hỏi trong ngân hàng đề:
              </div>
              <p className="text-amber-800 line-clamp-2 mt-0.5">
                {contextQuestion.content}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('search')}
            className="text-[11px] font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap"
          >
            Đổi câu hỏi →
          </button>
        </div>
      )}

      {/* 2. CHAT FEED CONTAINER */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col h-[560px] sm:h-[620px] overflow-hidden">
        {/* Messages Stream */}
        <div ref={messagesContainerRef} className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              msg={msg}
              userAvatar={user.avatar || '🎓'}
              username={user.username}
              personaAvatar={currentPersona.avatar}
              personaName={currentPersona.name}
              personaBgGradient={currentPersona.bgGradient}
              isCopied={copiedId === msg.id}
              isSpeaking={speakingId === msg.id}
              onCopy={handleCopy}
              onSpeak={handleSpeak}
              onSelectFollowUp={handleSendMessage}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${currentPersona.bgGradient} text-white flex items-center justify-center text-base shrink-0 shadow-xs animate-bounce`}>
                {currentPersona.avatar}
              </div>
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl rounded-tl-xs p-4 space-y-2 shadow-xs max-w-[80%]">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                  <span>{currentPersona.name} đang suy nghĩ và chuẩn bị bài giảng...</span>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse delay-100" />
                  <div className="w-2 h-2 rounded-full bg-amber-600 animate-pulse delay-200" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Starters Carousel */}
        <div className="px-3 sm:px-6 py-2 bg-slate-50/80 border-t border-slate-200/60 overflow-x-auto no-scrollbar flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-500" /> Mẫu hỏi nhanh:
          </span>
          {PROMPT_TEMPLATES.map((tpl, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                chatInputRef.current?.setValue(tpl.template);
                chatInputRef.current?.focus();
              }}
              className="px-2.5 py-1 bg-white hover:bg-amber-50 hover:border-amber-300 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
            >
              <span>{tpl.icon}</span>
              <span>{tpl.label}</span>
            </button>
          ))}
        </div>

        {/* 3. INPUT FORM - Isolated & Optimized */}
        <ChatInputBar
          ref={chatInputRef}
          isLoading={isLoading}
          currentPersonaName={currentPersona.name}
          useSearchGrounding={useSearchGrounding}
          onToggleSearchGrounding={() => {
            setUseSearchGrounding(prev => !prev);
            soundManager.playClick();
          }}
          onRecordClick={() => {
            soundManager.playClick();
            setIsRecordModalOpen(true);
          }}
          onSend={handleSendMessage}
          initialPrompt={initialPrompt}
          statusNote={statusNote}
        />
      </div>

      {/* Live Voice API Modal */}
      <LiveVoiceModal
        user={user}
        isOpen={isLiveModalOpen}
        onClose={() => setIsLiveModalOpen(false)}
        initialSubject={selectedSubject === 'all' ? 'Toán học' : selectedSubject}
      />

      {/* Audio Recorder & Transcribe Modal */}
      <AudioRecorderModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onTranscribed={(transcribedText, autoSend) => {
          chatInputRef.current?.setValue(transcribedText);
          if (autoSend) {
            handleSendMessage(transcribedText);
          } else {
            chatInputRef.current?.focus();
          }
        }}
      />

      {/* Infinite Question Generator Modal using Gemini & Google Search Grounding */}
      <AiQuestionGeneratorModal
        user={user}
        isOpen={isQuestionGenModalOpen}
        onClose={() => setIsQuestionGenModalOpen(false)}
        onStartPracticeWithQuestions={(questions, subject, topic) => {
          // Navigate to practice / arena game with custom generated question bank
          onNavigate('games', { customQuestions: questions, subject, topic });
        }}
      />
    </div>
  );
};
