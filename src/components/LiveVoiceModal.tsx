import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { soundManager } from '../services/sound';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  User,
  Radio,
  Settings,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Cpu
} from 'lucide-react';

interface LiveVoiceModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  initialSubject?: string;
}

type LiveVoicePreset = 'Zephyr' | 'Puck' | 'Aoede' | 'Kore' | 'Fenrir';

interface VoiceOption {
  id: LiveVoicePreset;
  name: string;
  desc: string;
  avatar: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'Zephyr', name: 'Zephyr (Ấm áp, truyền cảm)', desc: 'Giọng gia sư trung niên, từ tốn, mẫu mực', avatar: '🦉' },
  { id: 'Puck', name: 'Puck (Trẻ trung, hào hứng)', desc: 'Giọng bạn học năng động, khích lệ', avatar: '🌟' },
  { id: 'Aoede', name: 'Aoede (Dịu dàng, trong trẻo)', desc: 'Giọng cô giáo ân cần, giải thích sâu sắc', avatar: '🐱' },
  { id: 'Kore', name: 'Kore (Thanh thoát, êm dịu)', desc: 'Giọng nữ nhẹ nhàng, dễ tiếp thu', avatar: '🌸' },
  { id: 'Fenrir', name: 'Fenrir (Mạnh mẽ, tự tin)', desc: 'Giọng nam quyết đoán, giải bài sắc bén', avatar: '🤖' },
];

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  user,
  isOpen,
  onClose,
  initialSubject = 'Toán học'
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<LiveVoicePreset>('Zephyr');
  const [statusMessage, setStatusMessage] = useState<string>('Đang chuẩn bị kết nối Live API...');
  const [aiState, setAiState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [conversation, setConversation] = useState<Array<{ id: string; role: 'user' | 'model'; text: string; time: string }>>([
    {
      id: 'welcome-voice',
      role: 'model',
      text: `Xin chào ${user.username}! Mình là Gia Sư Trí Tuệ Vui chạy trên mô hình Gemini 3.1 Flash Live. Bạn có thể nói trực tiếp qua micro bất kỳ lúc nào để cùng ôn bài nhé!`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Float32Array to PCM 16kHz Base64
  const pcmToBase64 = (float32Array: Float32Array): string => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Play audio chunk at 24kHz
  const playAudioChunk = (base64Pcm: string) => {
    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
          sampleRate: 24000
        });
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const binary = atob(base64Pcm);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 32768 : 32767);
      }

      const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      setAiState('speaking');

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setAiState('listening');
        }
      };
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  };

  // Stop current playback (on interrupt)
  const stopPlayback = () => {
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setAiState('listening');
  };

  // Connect to Live API
  const startLiveSession = async () => {
    setIsConnecting(true);
    setErrorNotice(null);
    setStatusMessage('Đang xin quyền Microphone...');

    try {
      // 1. Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      mediaStreamRef.current = stream;

      // 2. Setup AudioContext for input capture at 16kHz
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const sourceNode = inputCtx.createMediaStreamSource(stream);
      // Analyser for sound wave visualizer
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 64;
      sourceNode.connect(analyser);

      // Animation loop for audio level visualizer
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(avg);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // ScriptProcessor for raw PCM
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      sourceNode.connect(processor);
      processor.connect(inputCtx.destination);

      // 3. Connect to server WebSocket (/live-ws)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live-ws`;
      setStatusMessage('Đang kết nối Gemini 3.1 Flash Live API...');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setStatusMessage('Đang trò chuyện trực tiếp (Live)');
        setAiState('listening');
        soundManager.playCorrect();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ready') {
            setStatusMessage('Gemini 3.1 Flash Live đã sẵn sàng!');
            setAiState('listening');
          } else if (msg.type === 'audio' && msg.audio) {
            playAudioChunk(msg.audio);
          } else if (msg.type === 'text' && msg.text) {
            setConversation(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'model' && last.id !== 'welcome-voice') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + ' ' + msg.text }
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: `model-${Date.now()}`,
                    role: 'model',
                    text: msg.text,
                    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  }
                ];
              }
            });
          } else if (msg.type === 'interrupted') {
            stopPlayback();
          } else if (msg.type === 'warning' || msg.type === 'error') {
            setErrorNotice(msg.message);
            setStatusMessage(msg.message);
          }
        } catch (e) {
          console.error('Error handling live message:', e);
        }
      };

      ws.onerror = (err) => {
        console.warn('Live WebSocket error:', err);
        setErrorNotice('Không thể duy trì WebSocket Live. Bạn có thể sử dụng chế độ Hỏi đáp AI thông thường.');
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setStatusMessage('Cuộc gọi Live đã kết thúc');
        setAiState('idle');
      };

      // Process audio streaming
      processor.onaudioprocess = (e) => {
        if (isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Check if there is actual sound
        let maxVal = 0;
        for (let i = 0; i < inputData.length; i++) {
          if (Math.abs(inputData[i]) > maxVal) maxVal = Math.abs(inputData[i]);
        }
        if (maxVal > 0.02) {
          setAiState('listening');
        }
        const base64Pcm = pcmToBase64(inputData);
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          audio: base64Pcm
        }));
      };

    } catch (err: any) {
      console.error('Failed to start Live session:', err);
      setIsConnecting(false);
      setErrorNotice(err?.message || 'Không thể truy cập Microphone. Vui lòng cấp quyền micro trong trình duyệt.');
      setStatusMessage('Lỗi kết nối Microphone');
    }
  };

  // Close / cleanup session
  const stopLiveSession = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }

    stopPlayback();

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setAiState('idle');
    setAudioLevel(0);
  };

  // Auto start when modal opens
  useEffect(() => {
    if (isOpen) {
      startLiveSession();
    } else {
      stopLiveSession();
    }
    return () => {
      stopLiveSession();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-500/20 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300">
              <Radio className="w-5 h-5 animate-pulse text-indigo-400" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-emerald-400 opacity-75' : 'bg-amber-400 opacity-75'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base sm:text-lg">Hội Thoại Giọng Nói Live</h3>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/30">
                  gemini-3.1-flash-live-preview
                </span>
              </div>
              <p className="text-xs text-indigo-300/80">Đàm thoại 2 chiều siêu tốc bằng giọng nói qua Live API</p>
            </div>
          </div>

          <button
            onClick={() => {
              stopLiveSession();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Đóng hội thoại"
          >
            ✕
          </button>
        </div>

        {/* Status bar */}
        <div className="px-6 py-2 bg-indigo-950/40 border-b border-indigo-500/10 flex items-center justify-between text-xs text-indigo-200">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : isConnecting ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`} />
            {statusMessage}
          </span>
          <span className="text-slate-400">Lớp {user.grade} • {initialSubject}</span>
        </div>

        {errorNotice && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}

        {/* Central interactive orb visualizer */}
        <div className="flex flex-col items-center justify-center py-8 px-6">
          <div className="relative flex items-center justify-center">
            {/* Pulsing outer rings */}
            <div
              className={`absolute rounded-full transition-all duration-300 ${
                aiState === 'speaking'
                  ? 'w-48 h-48 bg-emerald-500/15 animate-ping'
                  : aiState === 'listening'
                  ? 'w-44 h-44 bg-indigo-500/20 animate-pulse'
                  : 'w-36 h-36 bg-indigo-500/10'
              }`}
            />
            <div
              className={`absolute rounded-full transition-all duration-200 ${
                aiState === 'speaking'
                  ? 'w-40 h-40 bg-emerald-500/20'
                  : 'w-32 h-32 bg-indigo-500/25'
              }`}
              style={{
                transform: `scale(${1 + Math.min(0.35, audioLevel / 180)})`
              }}
            />

            {/* Core Orb */}
            <div
              className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                aiState === 'speaking'
                  ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 shadow-emerald-500/40 ring-4 ring-emerald-400/50'
                  : aiState === 'listening'
                  ? 'bg-gradient-to-tr from-indigo-600 via-violet-500 to-pink-500 shadow-indigo-500/40 ring-4 ring-indigo-400/50'
                  : 'bg-gradient-to-tr from-slate-700 via-slate-600 to-indigo-800 shadow-slate-900/50'
              }`}
            >
              {aiState === 'speaking' ? (
                <Volume2 className="w-12 h-12 text-white animate-bounce" />
              ) : isMuted ? (
                <MicOff className="w-12 h-12 text-rose-300" />
              ) : (
                <Mic className="w-12 h-12 text-white animate-pulse" />
              )}
            </div>
          </div>

          {/* Voice state badge */}
          <div className="mt-5 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
            <span className={`w-2 h-2 rounded-full ${aiState === 'speaking' ? 'bg-emerald-400' : aiState === 'listening' ? 'bg-indigo-400' : 'bg-slate-400'}`} />
            <span className="text-slate-200 font-medium">
              {aiState === 'speaking' ? 'AI đang nói...' : aiState === 'listening' ? (isMuted ? 'Đã tắt tiếng micro' : 'Đang lắng nghe em nói...') : 'Sẵn sàng'}
            </span>
          </div>

          {/* Sound wave equalizer bar */}
          <div className="flex items-center justify-center gap-1.5 mt-3 h-6">
            {[...Array(9)].map((_, i) => {
              const height = isMuted || !isConnected
                ? 4
                : Math.max(4, Math.min(24, Math.sin((audioLevel + i * 20) / 10) * 16 + audioLevel / 6));
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    aiState === 'speaking' ? 'bg-emerald-400' : 'bg-indigo-400'
                  }`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        </div>

        {/* Live Conversation Transcript */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3 bg-slate-950/40 border-t border-b border-indigo-500/10 min-h-[160px] max-h-[220px]">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            Bản ghi lời thoại trực tiếp:
          </div>

          {conversation.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'model' && (
                <div className="w-6 h-6 rounded-full bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center text-xs shrink-0">
                  🦉
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-xs'
                    : 'bg-slate-800/80 text-slate-200 border border-slate-700 rounded-tl-xs'
                }`}
              >
                <p>{msg.text}</p>
                <span className="text-[10px] text-slate-400 mt-1 block text-right">{msg.time}</span>
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs shrink-0 text-white">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}
          <div ref={conversationEndRef} />
        </div>

        {/* Voice Character Selection */}
        <div className="px-6 py-2.5 bg-slate-900/60 border-b border-indigo-500/10 flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 whitespace-nowrap">Giọng AI:</span>
          <div className="flex items-center gap-1.5">
            {VOICE_OPTIONS.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVoice(v.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 whitespace-nowrap ${
                  selectedVoice === v.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>{v.avatar}</span>
                <span>{v.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="px-6 py-4 bg-slate-900/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-2xl border transition-all flex items-center gap-2 ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={isMuted ? 'Bật Micro' : 'Tắt Micro'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-indigo-400" />}
              <span className="text-xs font-medium hidden sm:inline">{isMuted ? 'Đã tắt Mic' : 'Micro đang bật'}</span>
            </button>

            <button
              onClick={stopPlayback}
              className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-all flex items-center gap-2"
              title="Ngắt lời AI để nói câu mới"
            >
              <VolumeX className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-medium hidden sm:inline">Ngắt lời AI</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isConnected && !isConnecting && (
              <button
                onClick={startLiveSession}
                className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <RefreshCw className="w-4 h-4" />
                Kết nối lại
              </button>
            )}

            <button
              onClick={() => {
                stopLiveSession();
                onClose();
              }}
              className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-rose-600/30"
            >
              <PhoneOff className="w-4 h-4" />
              Kết thúc cuộc gọi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
