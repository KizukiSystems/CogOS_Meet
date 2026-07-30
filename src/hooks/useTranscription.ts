import { useState, useEffect, useRef, useCallback } from 'react';

export function useTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + final + ' ');
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone permissions.');
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we are supposed to be recording
      if (recognitionRef.current && isRecording) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Failed to restart recognition", e);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
         recognitionRef.current.stop();
      }
    };
  }, []);

  // Update onend whenever isRecording changes so the closure has fresh state
  useEffect(() => {
      if (recognitionRef.current) {
          recognitionRef.current.onend = () => {
             if (isRecording) {
                try {
                  recognitionRef.current.start();
                } catch (e) {
                  // ignore
                }
             }
          };
      }
  }, [isRecording]);


  const startRecording = useCallback(() => {
    setError(null);
    if (recognitionRef.current && !isRecording) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Failed to start recording:", e);
      }
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      setIsRecording(false);
      recognitionRef.current.stop();
      setInterimTranscript('');
    }
  }, [isRecording]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isRecording,
    transcript,
    interimTranscript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
    setTranscript
  };
}
