import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Play, RefreshCw, Send, Upload, FileAudio, Check, AlertCircle, Sparkles } from 'lucide-react';
import { soundManager } from '../services/sound';

interface AudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscribed: (text: string, autoSend?: boolean) => void;
}

export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({
  isOpen,
  onClose,
  onTranscribed
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Clean up
  const resetState = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingSeconds(0);
    setIsTranscribing(false);
    setTranscript('');
    setErrorMsg(null);
    setAudioLevel(0);
  };

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  // Start audio recording
  const startRecording = async () => {
    resetState();
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      mediaStreamRef.current = stream;

      // Visualizer
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
        setAudioLevel(sum / dataArr.length);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      loop();

      // Recorder
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      recorder.start(100);
      setIsRecording(true);
      soundManager.playClick();

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Recording start error:', err);
      setErrorMsg('Không thể mở micro. Vui lòng cấp quyền micro cho trang web.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);
    soundManager.playClick();
  };

  // Handle uploaded audio file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetState();
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
  };

  // Transcribe audio using gemini-3.5-transcribe model
  const transcribeAudio = async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    setErrorMsg(null);

    try {
      // Convert Blob to Base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          const mimeType = audioBlob.type || 'audio/webm';

          const res = await fetch('/api/transcribe-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioData: base64Data,
              mimeType
            })
          });

          if (!res.ok) {
            throw new Error(`Lỗi máy chủ (${res.status})`);
          }

          const data = await res.json();
          if (data.transcript) {
            setTranscript(data.transcript);
            soundManager.playCorrect();
          } else {
            setErrorMsg('Không thể chuyển đổi âm thanh thành văn bản.');
          }
        } catch (fetchErr: any) {
          setErrorMsg(fetchErr?.message || 'Lỗi khi gửi dữ liệu âm thanh');
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi đọc file âm thanh');
      setIsTranscribing(false);
    }
  };

  if (!isOpen) return null;

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center font-bold">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Ghi Âm & Chuyển Thành Văn Bản</h3>
              <p className="text-xs text-slate-500">Mô hình AI: gemini-3.5-transcribe</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Central Recording Widget */}
          <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-2xl border border-slate-100 p-4">
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <>
                  <div className="absolute w-24 h-24 rounded-full bg-rose-500/20 animate-ping" />
                  <div
                    className="absolute w-28 h-28 rounded-full bg-rose-500/15"
                    style={{ transform: `scale(${1 + Math.min(0.4, audioLevel / 120)})` }}
                  />
                </>
              )}

              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-95 ${
                  isRecording
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/30'
                    : 'bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/30'
                }`}
                title={isRecording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
              >
                {isRecording ? <Square className="w-7 h-7" /> : <Mic className="w-8 h-8" />}
              </button>
            </div>

            <div className="mt-4 text-center">
              <div className="text-sm font-extrabold text-slate-800">
                {isRecording ? 'Đang lắng nghe câu hỏi của em...' : audioBlob ? 'Đã ghi âm xong' : 'Nhấn nút Micro để nói'}
              </div>
              <div className="text-xs font-mono font-bold text-slate-500 mt-1">
                {formatSec(recordingSeconds)}
              </div>
            </div>

            {/* Audio Wave Visualizer */}
            {isRecording && (
              <div className="flex items-center gap-1.5 mt-3 h-6">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, Math.min(24, Math.sin((audioLevel + i * 20) / 10) * 16 + audioLevel / 5))}px`
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Audio Player and File Upload */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {audioUrl ? (
              <audio controls src={audioUrl} className="w-full sm:w-2/3 h-10" />
            ) : (
              <div className="text-slate-400 text-center sm:text-left">
                Hoặc tải lên file ghi âm có sẵn (.mp3, .wav, .webm, .m4a):
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Tải file âm thanh</span>
            </button>
          </div>

          {/* Transcribe Button */}
          {audioBlob && !transcript && (
            <button
              type="button"
              onClick={transcribeAudio}
              disabled={isTranscribing}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isTranscribing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI đang phân tích và chuyển giọng nói...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Chuyển thành văn bản (Transcribe)</span>
                </>
              )}
            </button>
          )}

          {/* Transcript Preview & Edit */}
          {transcript && (
            <div className="space-y-2 bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-amber-900 flex items-center gap-1">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Bản chép lời được nhận diện:
                </span>
                <span className="text-[11px] text-amber-700 font-medium">Có thể chỉnh sửa bên dưới</span>
              </div>

              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={3}
                className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none shadow-xs"
                placeholder="Nội dung lời nói sẽ hiện ở đây..."
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onTranscribed(transcript, false);
                    resetState();
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
                >
                  Chèn vào ô nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTranscribed(transcript, true);
                    resetState();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi luôn cho Gia Sư AI</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
