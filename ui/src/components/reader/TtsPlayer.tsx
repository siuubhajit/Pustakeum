import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Play, Pause, Square, Volume2, X, FastForward } from "lucide-react";

interface TtsWordBoundary {
  word: string;
  start_char: number;
  end_char: number;
  time_ms: number;
  duration_ms: number;
}

interface TtsAudioPayload {
  sample_rate: number;
  channels: number;
  pcm_base64: string;
  word_boundaries: TtsWordBoundary[];
  total_duration_ms: number;
}

interface TtsPlayerProps {
  readingText: string;
  onActiveWordChange?: (word: string, startChar: number, endChar: number) => void;
  onClose: () => void;
}

export const TtsPlayer: React.FC<TtsPlayerProps> = ({
  readingText,
  onActiveWordChange,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWord, setActiveWord] = useState<string>("");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>("sanskrit-vedic-neural");
  const [progressMs, setProgressMs] = useState(0);

  const payloadRef = useRef<TtsAudioPayload | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  // Generate TTS Audio on initial mount or voice change
  useEffect(() => {
    let cancelled = false;

    const generateAudio = async () => {
      try {
        const payload: TtsAudioPayload = await invoke("cmd_generate_tts_pcm", {
          text: readingText.substring(0, 1500), // Current active page text
          voiceId: selectedVoice,
        });
        if (!cancelled) {
          payloadRef.current = payload;
        }
      } catch (err) {
        console.warn("TTS generation error:", err);
      }
    };

    generateAudio();

    return () => {
      cancelled = true;
      stopAudio();
    };
  }, [readingText, selectedVoice]);

  const startAudio = () => {
    if (!payloadRef.current) return;
    setIsPlaying(true);
    startTimeRef.current = Date.now() - progressMs;

    timerRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTimeRef.current) * playbackSpeed);
      setProgressMs(elapsed);

      if (payloadRef.current) {
        const boundaries = payloadRef.current.word_boundaries;
        const currentBound = boundaries.find(
          (b) => elapsed >= b.time_ms && elapsed < b.time_ms + b.duration_ms + 40
        );

        if (currentBound) {
          setActiveWord(currentBound.word);
          onActiveWordChange?.(
            currentBound.word,
            currentBound.start_char,
            currentBound.end_char
          );
        }

        if (elapsed >= payloadRef.current.total_duration_ms) {
          stopAudio();
        }
      }
    }, 40);
  };

  const pauseAudio = () => {
    setIsPlaying(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const stopAudio = () => {
    setIsPlaying(false);
    setProgressMs(0);
    setActiveWord("");
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 70,
        right: 40,
        zIndex: 90,
        backgroundColor: "#161B22",
        color: "#E2E8F0",
        border: "1px solid #30363D",
        borderRadius: 10,
        padding: "12px 18px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Volume2 size={18} color="#E5A93C" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Neural TTS Audio</span>
      </div>

      {/* Voice Selection */}
      <select
        value={selectedVoice}
        onChange={(e) => setSelectedVoice(e.target.value)}
        style={{
          background: "#0D1117",
          color: "#E2E8F0",
          border: "1px solid #30363D",
          borderRadius: 4,
          padding: "4px 8px",
          fontSize: 12,
        }}
      >
        <option value="sanskrit-vedic-neural">Sanskrit Vedic Neural</option>
        <option value="piper-en-libritts-high">Piper English (LibriTTS)</option>
        <option value="piper-classical-narrator">Classical Narrator (Warm)</option>
      </select>

      {/* Transport Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isPlaying ? (
          <button
            onClick={pauseAudio}
            style={{
              background: "#E5A93C",
              color: "#161B22",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Pause size={16} />
          </button>
        ) : (
          <button
            onClick={startAudio}
            style={{
              background: "#E5A93C",
              color: "#161B22",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Play size={16} style={{ marginLeft: 2 }} />
          </button>
        )}

        <button
          onClick={stopAudio}
          style={{
            background: "#21262D",
            color: "#8B949E",
            border: "1px solid #30363D",
            borderRadius: 4,
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Square size={12} />
        </button>
      </div>

      {/* Speed Selector */}
      <button
        onClick={() => setPlaybackSpeed((prev) => (prev >= 1.5 ? 1.0 : prev + 0.25))}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "#21262D",
          color: "#E2E8F0",
          border: "1px solid #30363D",
          borderRadius: 4,
          padding: "4px 8px",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        <FastForward size={12} />
        <span>{playbackSpeed.toFixed(2)}x</span>
      </button>

      {/* Active Word Highlight Preview */}
      {activeWord && (
        <div
          style={{
            fontSize: 12,
            padding: "2px 8px",
            background: "rgba(229, 169, 60, 0.2)",
            color: "#E5A93C",
            borderRadius: 4,
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {activeWord}
        </div>
      )}

      {/* Close Player */}
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "#8B949E",
          cursor: "pointer",
          padding: 2,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

