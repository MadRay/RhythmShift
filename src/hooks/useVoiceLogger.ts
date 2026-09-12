import { useCallback, useEffect, useRef, useState } from 'react';
import {
  extractEventFromTranscript,
  extractMinutesAgo,
  type ParsedVoiceEvent,
} from '../utils/voiceEventParser';

export type { ParsedVoiceEvent } from '../utils/voiceEventParser';
export { extractEventFromTranscript, formatLagLabel } from '../utils/voiceEventParser';

export type AiParseFn = (transcript: string) => Promise<ParsedVoiceEvent | null>;

interface SpeechRecognitionResultLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultListLike;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function describeSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
      return 'Microphone permission blocked. Allow mic access for this site in browser settings, then try again.';
    case 'service-not-allowed':
      return 'Speech service blocked for this page. Try Chrome/Edge on http://127.0.0.1 (not a private/embedded browser).';
    case 'network':
      return 'Speech recognition needs network access (Chrome uses an online speech service). Check connectivity.';
    case 'audio-capture':
      return 'No microphone found, or another app is using it.';
    case 'no-speech':
      return "Didn't catch any speech — tap the mic and try again.";
    case 'aborted':
      return '';
    default:
      return `Dictation error: ${code}`;
  }
}

export interface UseVoiceLoggerOptions {
  onParsed?: (event: ParsedVoiceEvent, raw: string) => void;
  aiParse?: AiParseFn;
  lang?: string;
}

export interface UseVoiceLoggerResult {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  lastParsed: ParsedVoiceEvent | null;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  parseTranscript: (text: string) => Promise<ParsedVoiceEvent>;
  clearError: () => void;
  clearTranscript: () => void;
}

export function useVoiceLogger(options: UseVoiceLoggerOptions = {}): UseVoiceLoggerResult {
  const { onParsed, aiParse, lang = 'en-US' } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastParsed, setLastParsed] = useState<ParsedVoiceEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const onParsedRef = useRef(onParsed);
  const aiParseRef = useRef(aiParse);
  const langRef = useRef(lang);

  const isSupported = Boolean(getSpeechRecognitionCtor());

  useEffect(() => {
    onParsedRef.current = onParsed;
  }, [onParsed]);

  useEffect(() => {
    aiParseRef.current = aiParse;
  }, [aiParse]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      const active = recognitionRef.current;
      recognitionRef.current = null;
      if (active) {
        active.onstart = null;
        active.onresult = null;
        active.onerror = null;
        active.onend = null;
        try {
          active.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const parseTranscript = useCallback(async (text: string): Promise<ParsedVoiceEvent> => {
    if (aiParseRef.current) {
      try {
        const aiResult = await aiParseRef.current(text);
        if (aiResult) {
          const lag = extractMinutesAgo(text);
          return {
            ...aiResult,
            minutesAgo: aiResult.minutesAgo ?? lag.minutesAgo,
            occurredAt: aiResult.occurredAt ?? lag.occurredAt,
            durationMinutes:
              aiResult.durationMinutes ?? extractEventFromTranscript(text).durationMinutes,
          };
        }
      } catch {
        // Fall through to local rules
      }
    }
    return extractEventFromTranscript(text);
  }, []);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    const active = recognitionRef.current;
    if (active) {
      try {
        active.stop();
      } catch {
        try {
          active.abort();
        } catch {
          /* ignore */
        }
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    setError(null);

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError(
        'Speech recognition is not supported in this browser. Use Chrome/Edge, or the quick-log buttons.',
      );
      return;
    }

    if (recognitionRef.current) {
      wantListeningRef.current = false;
      const prev = recognitionRef.current;
      recognitionRef.current = null;
      prev.onstart = null;
      prev.onresult = null;
      prev.onerror = null;
      prev.onend = null;
      try {
        prev.abort();
      } catch {
        /* ignore */
      }
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = langRef.current;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalChunk = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? '';
        if (result.isFinal) finalChunk += piece;
        else interim += piece;
      }
      if (interim) setInterimTranscript(interim);
      if (finalChunk) {
        const trimmed = finalChunk.trim();
        if (!trimmed) return;
        setTranscript(trimmed);
        setInterimTranscript('');
        wantListeningRef.current = false;
        void parseTranscript(trimmed).then((parsed) => {
          setLastParsed(parsed);
          onParsedRef.current?.(parsed, trimmed);
        });
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }
    };

    recognition.onerror = (event) => {
      const message = describeSpeechError(event.error);
      if (message) setError(message);
      if (event.error !== 'no-speech') {
        wantListeningRef.current = false;
      }
    };

    recognition.onend = () => {
      if (wantListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          wantListeningRef.current = false;
        }
      }
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    wantListeningRef.current = true;
    setTranscript('');
    setInterimTranscript('');
    setLastParsed(null);
    setIsListening(true);

    const begin = () => {
      try {
        recognition.start();
      } catch (err) {
        wantListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
        const detail = err instanceof Error ? err.message : 'Could not start microphone.';
        setError(
          detail.includes('already started')
            ? 'Dictation was already running — tap again.'
            : 'Could not start microphone. Check browser permissions and try Chrome/Edge.',
        );
      }
    };

    if (navigator.mediaDevices?.getUserMedia) {
      void navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
          if (!wantListeningRef.current || recognitionRef.current !== recognition) return;
          begin();
        })
        .catch(() => {
          wantListeningRef.current = false;
          setIsListening(false);
          recognitionRef.current = null;
          setError(
            'Microphone permission denied. Click the lock icon in the address bar → allow Microphone, then retry.',
          );
        });
    } else {
      begin();
    }
  }, [parseTranscript]);

  const clearError = useCallback(() => setError(null), []);
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setLastParsed(null);
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    lastParsed,
    error,
    startListening,
    stopListening,
    parseTranscript,
    clearError,
    clearTranscript,
  };
}
