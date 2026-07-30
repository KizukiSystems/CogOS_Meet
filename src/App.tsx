import React, { useState, useEffect, useRef } from 'react';
import { Mic, Play, Square, Loader2, AlertCircle, Sparkles, FileText, Menu, CheckCircle2, History, Brain, ShieldCheck, Activity, Target, Users, Upload, Edit3, Save, X, Download, FileDown } from 'lucide-react';
import { useTranscription } from './hooks/useTranscription';
import { Meeting, MeetingAnalysis } from './types';
import { UploadModal } from './components/UploadModal';
import { exportToMarkdown, exportToWord } from './utils/export';
import { TranscriptRenderer } from './components/TranscriptRenderer';
import { VerificationPanel } from './components/VerificationPanel';

export default function App() {
  const {
    isRecording,
    transcript,
    interimTranscript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
    setTranscript
  } = useTranscription();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscriptText, setEditedTranscriptText] = useState('');

  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load meetings from local storage
    const saved = localStorage.getItem('meetily_meetings');
    if (saved) {
      try {
        setMeetings(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved meetings");
      }
    }
  }, []);

  useEffect(() => {
    // Save meetings to local storage
    if (meetings.length > 0) {
      localStorage.setItem('meetily_meetings', JSON.stringify(meetings));
    }
  }, [meetings]);

  useEffect(() => {
    // Scroll to bottom of transcript when it updates
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  const handleStartNewMeeting = () => {
    clearTranscript();
    setActiveMeetingId(null);
  };

  const handleSaveCurrentMeeting = () => {
    if (!transcript.trim()) return;

    const newMeeting: Meeting = {
      id: Date.now().toString(),
      title: `Meeting on ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      transcript,
    };

    setMeetings((prev) => [newMeeting, ...prev]);
    setActiveMeetingId(newMeeting.id);
  };

  
  const handleVerify = async (transcript: string, analysis: MeetingAnalysis, meetingId: string) => {
    if (!transcript || !transcript.trim()) {
      setMeetings(prev => prev.map(m => 
        m.id === meetingId ? { ...m, verificationStatus: 'skipped' } : m
      ));
      return;
    }
    
    setMeetings(prev => prev.map(m => 
      m.id === meetingId ? { ...m, verificationStatus: 'pending' } : m
    ));
    
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, analysis }),
      });
      const data = await response.json();
      if (data.verification) {
        setMeetings(prev => prev.map(m => 
          m.id === meetingId ? { ...m, analysis: { ...m.analysis, verification: data.verification }, verificationStatus: 'complete' } : m
        ));
      } else {
        setMeetings(prev => prev.map(m => 
          m.id === meetingId ? { ...m, verificationStatus: 'unavailable' } : m
        ));
      }
    } catch (err) {
      console.error("Verification failed", err);
      setMeetings(prev => prev.map(m => 
        m.id === meetingId ? { ...m, verificationStatus: 'unavailable' } : m
      ));
    }
  };

  const handleAnalyze = async (id: string, textToAnalyze: string) => {
    if (!textToAnalyze.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: textToAnalyze }),
      });
      
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(response.status === 413 ? "File too large (server limit)" : `Server error: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }
      
      if (data.analysis) {
        setMeetings((prev) => 
          prev.map((m) => m.id === id ? { ...m, analysis: data.analysis } : m)
        );
        handleVerify(textToAnalyze, data.analysis, id);
      }
    } catch (err) {
      console.error("Analysis failed", err);
      alert(err instanceof Error ? err.message : "Failed to analyze transcript.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (file: File, speakers: string, options: string[]) => {
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('speakers', speakers);
    formData.append('options', JSON.stringify(options));

    try {
      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });
      
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(response.status === 413 ? "File too large (server limit)" : `Server error: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.analysis) {
        const newMeeting: Meeting = {
          id: Date.now().toString(),
          title: `Uploaded: ${file.name}`,
          date: new Date().toISOString(),
          transcript: data.analysis.verbatimTranscript || "",
          isUploadedAudio: true,
          hideTranscript: !data.verbatimRequested,
          analysis: data.analysis
        };

        setMeetings(prev => [newMeeting, ...prev]);
        setActiveMeetingId(newMeeting.id);
        setUploadModalOpen(false);
        handleVerify(newMeeting.transcript, data.analysis, newMeeting.id);
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert(err instanceof Error ? err.message : "Failed to analyze audio recording.");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleActionItem = (meetingId: string, actionId: string) => {
    setMeetings(prev => prev.map(m => {
      if (m.id === meetingId && m.analysis && m.analysis.actionItems) {
        return {
          ...m,
          analysis: {
            ...m.analysis,
            actionItems: m.analysis.actionItems.map(a => a.id === actionId ? { ...a, completed: !a.completed } : a)
          }
        };
      }
      return m;
    }));
  };

  const activeMeeting = activeMeetingId ? meetings.find(m => m.id === activeMeetingId) : null;
  const displayTranscript = activeMeeting ? (activeMeeting.hideTranscript ? "Source transcript is hidden because verbatim was not requested." : activeMeeting.transcript) : transcript;

  const scrollToQuote = (quote: string) => {
    if (!transcriptRef.current) return;
    const walker = document.createTreeWalker(transcriptRef.current, NodeFilter.SHOW_TEXT, null);
    let node;
    while (node = walker.nextNode()) {
      if (node.nodeValue?.includes(quote)) {
        const span = document.createElement('span');
        span.className = 'bg-amber-500/30 text-amber-50';
        span.textContent = quote;
        const parent = node.parentNode;
        if (parent) {
          const split = node.nodeValue.split(quote);
          const frag = document.createDocumentFragment();
          frag.appendChild(document.createTextNode(split[0]));
          frag.appendChild(span);
          frag.appendChild(document.createTextNode(split[1]));
          parent.replaceChild(frag, node);
          span.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            parent.replaceChild(document.createTextNode(node.nodeValue!), frag);
          }, 3000);
          break;
        }
      }
    }
  };

  const handleEditTranscript = () => {
    setEditedTranscriptText(displayTranscript);
    setIsEditingTranscript(true);
  };

  const handleSaveTranscript = () => {
    if (activeMeeting) {
      setMeetings(prev => prev.map(m => 
        m.id === activeMeeting.id ? { ...m, transcript: editedTranscriptText } : m
      ));
    } else {
      setTranscript(editedTranscriptText);
    }
    setIsEditingTranscript(false);
  };

  const handleCancelEditTranscript = () => {
    setIsEditingTranscript(false);
  };

  const handleRenameSpeaker = (oldName: string, newName: string) => {
    const replacePattern = new RegExp(`^(\\*\\*)?${oldName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(\\*\\*)?:`, 'gm');
    const newTranscript = displayTranscript.replace(replacePattern, `$1${newName}$2:`);

    if (activeMeeting) {
      setMeetings(prev => prev.map(m => 
        m.id === activeMeeting.id ? { ...m, transcript: newTranscript } : m
      ));
    } else {
      setTranscript(newTranscript);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#080808] text-[#e0e0e0] font-sans overflow-hidden">
      <UploadModal 
        isOpen={uploadModalOpen} 
        onClose={() => setUploadModalOpen(false)} 
        onUpload={handleFileUpload}
        isUploading={isUploading}
      />
      {/* Sidebar */}
      <div className={`flex flex-col bg-[#0c0c0c] border-r border-white/10 transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-0 opacity-0'} overflow-hidden shrink-0`}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-amber-500 rounded-sm flex items-center justify-center text-black font-bold tracking-tighter">CM</div>
            <h1 className="text-xl font-serif italic tracking-wide text-white">CogMeet</h1>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex gap-2">
            <button 
              onClick={handleStartNewMeeting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 rounded-full hover:bg-amber-500/20 transition-colors border border-amber-500/20"
            >
              <Play className="w-3 h-3" />
              New
            </button>
            <button 
              onClick={() => setUploadModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-widest bg-white/5 text-white/80 rounded-full hover:bg-white/10 transition-colors border border-white/10"
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
          </div>
          
          <div className="pt-6 pb-2 text-[11px] uppercase tracking-[0.2em] text-white/40 px-2">
            Recent Meetings
          </div>
          
          {meetings.length === 0 ? (
            <div className="px-2 py-8 text-sm text-white/40 text-center flex flex-col items-center gap-3">
              <History className="w-8 h-8 opacity-50" />
              <p>No meetings yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {meetings.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMeetingId(m.id)}
                  className={`w-full flex flex-col text-left px-4 py-3 rounded-xl transition-colors border ${activeMeetingId === m.id ? 'bg-white/5 border-white/10' : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'}`}
                >
                  <span className="text-sm font-medium truncate mb-1">{m.title}</span>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-mono text-amber-500/70">{new Date(m.date).toLocaleDateString()}</span>
                    {m.analysis?.tags && m.analysis.tags.length > 0 && (
                      <div className="flex gap-1">
                        {m.analysis.tags.slice(0, 2).map((tag, i) => (
                          <span key={i} className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/20 truncate max-w-[60px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-white/10 bg-[#0a0a0a] flex items-center px-8 justify-between z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 text-white/60 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="h-4 w-px bg-white/20 mx-2"></div>
            {activeMeeting ? (
              <h2 className="text-sm font-medium text-white/80 flex items-center gap-3 max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-xl">
                <FileText className="w-4 h-4 text-white/40 shrink-0" />
                <span className="truncate">{activeMeeting.title}</span>
                {activeMeeting.analysis?.tags && activeMeeting.analysis.tags.length > 0 && (
                  <div className="flex gap-1 shrink-0 ml-2 hidden sm:flex">
                    {activeMeeting.analysis.tags.map((tag, i) => (
                      <span key={i} className="text-[9px] uppercase tracking-widest px-2 py-0.5 bg-white/5 text-white/60 rounded border border-white/10">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </h2>
            ) : (
              <h2 className="text-sm font-medium text-white/80 flex items-center gap-2">
                Active Session
              </h2>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {!activeMeeting && (
              <div className="flex items-center gap-2">
                {!isRecording ? (
                  <button 
                    onClick={startRecording}
                    className="flex items-center gap-2 px-6 py-2 text-[11px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-full hover:bg-amber-500/20 transition-colors"
                  >
                    <Mic className="w-4 h-4" />
                    Start
                  </button>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-red-500">Live Transcribing</span>
                    </div>
                    <button 
                      onClick={stopRecording}
                      className="flex items-center gap-2 px-6 py-2 text-[11px] font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      End Meeting
                    </button>
                  </div>
                )}
                
                {transcript && !isRecording && (
                  <button 
                    onClick={handleSaveCurrentMeeting}
                    className="flex items-center gap-2 px-6 py-2 text-[11px] font-bold uppercase tracking-widest text-white/80 bg-zinc-900 border border-white/10 rounded-full hover:text-white transition-colors ml-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Save
                  </button>
                )}
              </div>
            )}
            {activeMeeting && (
              <div className="relative">
                <button 
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  className="flex items-center gap-2 px-6 py-2 text-[11px] font-bold uppercase tracking-widest text-white/80 bg-zinc-900 border border-white/10 rounded-full hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                
                {exportMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#121214] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                    <div className="py-1">
                      <button 
                        onClick={() => {
                          exportToWord(activeMeeting);
                          setExportMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors text-left"
                      >
                        <FileDown className="w-4 h-4" />
                        Word (.docx)
                      </button>
                      <button 
                        onClick={() => {
                          exportToMarkdown(activeMeeting);
                          setExportMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors text-left"
                      >
                        <FileText className="w-4 h-4" />
                        Markdown (.md)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Transcript Panel */}
          <div className={`flex-1 flex flex-col min-w-[50%] h-full`}>
            {error && (
              <div className="m-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-start gap-2">
                <span>{error}</span>
              </div>
            )}
            
            <div 
              ref={transcriptRef}
              className="flex-1 overflow-y-auto p-8 md:p-12 scroll-smooth"
            >
              {!displayTranscript && !interimTranscript ? (
                <div className="h-full flex flex-col items-center justify-center text-white/40 gap-6 opacity-60">
                  <div className="w-24 h-24 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
                    <Mic className="w-10 h-10 text-white/30" />
                  </div>
                  <p className="text-sm font-light tracking-wide">Ready to transcribe.</p>
                </div>
              ) : (
                <div className="max-w-4xl space-y-6">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-serif text-white leading-none">Transcript</h2>
                    {!isRecording && !isEditingTranscript && (
                      <button 
                        onClick={handleEditTranscript}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Transcript
                      </button>
                    )}
                    {isEditingTranscript && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleCancelEditTranscript}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/5"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveTranscript}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-full transition-colors"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {isEditingTranscript ? (
                    <textarea
                      value={editedTranscriptText}
                      onChange={(e) => setEditedTranscriptText(e.target.value)}
                      className="w-full min-h-[300px] md:min-h-[500px] bg-[#121214] border border-white/10 rounded-xl p-6 text-lg leading-relaxed font-light text-white focus:outline-none focus:border-amber-500/50 transition-colors resize-y"
                    />
                  ) : (
                    <TranscriptRenderer 
                      transcript={displayTranscript} 
                      interimTranscript={interimTranscript} 
                      onRenameSpeaker={handleRenameSpeaker}
                    />
                  )}
                </div>
              )}
            </div>
            
            {activeMeeting && !activeMeeting.analysis && (
              <div className="p-6 border-t border-white/10 bg-[#0a0a0a] shrink-0 flex justify-center">
                <button
                  onClick={() => handleAnalyze(activeMeeting.id, activeMeeting.transcript)}
                  disabled={isAnalyzing}
                  className="flex items-center gap-3 px-8 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors shadow-lg shadow-amber-900/20"
                >
                  {isAnalyzing || isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isAnalyzing ? 'Analyzing Meeting...' : 'Generate AI Summary'}
                </button>
              </div>
            )}
          </div>

          {/* Analysis Panel */}
          {activeMeeting?.analysis && (
            <div className="w-80 lg:w-[450px] bg-[#0c0c0c] border-l border-white/10 flex flex-col shrink-0">
              <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Brain className="w-4 h-4 text-amber-500" />
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40">Analysis</h3>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span className="text-[9px] uppercase tracking-widest text-emerald-500/80">Verified Pass</span>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Metrics */}
                {activeMeeting.verificationStatus === 'pending' && (
                  <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying claims against transcript...
                  </div>
                )}
                {activeMeeting.verificationStatus === 'unavailable' && (
                  <div className="flex flex-col gap-2 p-4 bg-white/5 border border-white/10 rounded-xl text-white/60 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Not verified. This analysis has not been checked against the transcript.
                    </div>
                    <button 
                      onClick={() => handleVerify(activeMeeting.transcript, activeMeeting.analysis!, activeMeeting.id)}
                      className="self-start px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {activeMeeting.verificationStatus === 'skipped' && (
                  <div className="flex items-center gap-2 p-4 bg-white/5 border border-white/10 rounded-xl text-white/60 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Not verified. No source transcript was available.
                  </div>
                )}
                {activeMeeting.verificationStatus === 'complete' && activeMeeting.analysis.verification && (
                  <VerificationPanel 
                    verification={activeMeeting.analysis.verification} 
                    onQuoteClick={scrollToQuote} 
                  />
                )}
                {activeMeeting.analysis.sentiment && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] uppercase tracking-widest text-white/40">Sentiment</span>
                      </div>
                      <div className="text-xl font-serif text-white">{activeMeeting.analysis.sentiment}</div>
                    </div>
                  </div>
                )}

                {/* Executive Summary */}
                {activeMeeting.analysis.executiveSummary && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-amber-500 mb-3 tracking-widest">Executive Summary</h4>
                    <p className="text-sm text-white/80 leading-relaxed font-light">{activeMeeting.analysis.executiveSummary}</p>
                  </div>
                )}

                {/* General Summary */}
                {activeMeeting.analysis.summary && !activeMeeting.analysis.executiveSummary && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-amber-500 mb-3 tracking-widest">Meeting Summary</h4>
                    <p className="text-sm text-white/80 leading-relaxed font-light">{activeMeeting.analysis.summary}</p>
                  </div>
                )}
                
                {/* Detailed Summary */}
                {activeMeeting.analysis.detailedSummary && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-amber-500 mb-3 tracking-widest">Detailed Summary</h4>
                    <p className="text-sm text-white/80 leading-relaxed font-light whitespace-pre-wrap">{activeMeeting.analysis.detailedSummary}</p>
                  </div>
                )}

                {/* TL;DL */}
                {activeMeeting.analysis.tldl && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <h4 className="text-[10px] font-bold uppercase text-amber-500 mb-2 tracking-widest">TL;DL</h4>
                    <p className="text-sm text-amber-100/90 leading-relaxed font-light">{activeMeeting.analysis.tldl}</p>
                  </div>
                )}

                {/* Important Dates */}
                {activeMeeting.analysis.importantDates && activeMeeting.analysis.importantDates.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-amber-500 mb-3 tracking-widest">Important Dates</h4>
                    <ul className="space-y-2">
                      {activeMeeting.analysis.importantDates.map((date, idx) => (
                        <li key={idx} className="flex gap-3 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></div>
                          <span className="text-sm text-white/80 leading-snug">{date}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Decision Log */}
                {activeMeeting.analysis.decisionLog && activeMeeting.analysis.decisionLog.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-amber-500 mb-3 tracking-widest">Decision Log</h4>
                    <ul className="space-y-3">
                      {activeMeeting.analysis.decisionLog.map((decision, idx) => (
                        <li key={idx} className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <span className="text-sm font-light text-white/80 leading-snug">{decision}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {activeMeeting.analysis.actionItems && activeMeeting.analysis.actionItems.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-amber-500 mb-3 tracking-widest">Action Items</h4>
                    <ul className="space-y-3">
                      {activeMeeting.analysis.actionItems.map(item => (
                        <li key={item.id} className="flex gap-3 items-start group cursor-pointer" onClick={() => toggleActionItem(activeMeeting.id, item.id)}>
                          <div className={`w-4 h-4 rounded border mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${item.completed ? 'bg-amber-500 border-amber-500' : 'border-amber-500/50 group-hover:border-amber-500'}`}>
                            {item.completed && <CheckCircle2 className="w-3 h-3 text-black" />}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-sm leading-snug ${item.completed ? 'text-white/40 line-through' : 'text-white/80'}`}>{item.task}</span>
                            <span className="text-[10px] text-amber-500/70 mt-1 uppercase tracking-wider">{item.owner}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Perspectives */}
                {activeMeeting.analysis.perspectives && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase text-amber-500 mb-3 tracking-widest">Multi-Perspective Synth</h4>
                    
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[10px] uppercase tracking-widest text-amber-500/70">Operational</span>
                        </div>
                        <p className="text-xs font-light text-amber-100/70 leading-relaxed">{activeMeeting.analysis.perspectives.operational}</p>
                    </div>

                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[10px] uppercase tracking-widest text-indigo-400/70">Empathy</span>
                        </div>
                        <p className="text-xs font-light text-indigo-100/70 leading-relaxed">{activeMeeting.analysis.perspectives.empathy}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
