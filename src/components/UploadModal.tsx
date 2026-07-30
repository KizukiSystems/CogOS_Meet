import React, { useState, useRef } from 'react';
import { Upload, X, FileAudio, Check, Loader2, Users, FileText, Calendar, ListChecks, Info } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, speakers: string, options: string[]) => void;
  isUploading: boolean;
}

export function UploadModal({ isOpen, onClose, onUpload, isUploading }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [speakers, setSpeakers] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([
    'executiveSummary', 'actionItems'
  ]);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('audio/') || droppedFile.name.match(/\.(mp3|wav|m4a|ogg|aac)$/i)) {
        setFile(droppedFile);
      } else {
        alert("Please upload an audio file.");
      }
    }
  };

  const outputOptions = [
    { id: 'verbatim', label: 'Verbatim Transcript', icon: FileText },
    { id: 'detailedSummary', label: 'Detailed Summary', icon: ListChecks },
    { id: 'executiveSummary', label: 'Executive Summary', icon: Info },
    { id: 'tldl', label: 'TL;DL', icon: Loader2 }, // Or some fast forward icon
    { id: 'actionItems', label: 'Action Items', icon: Check },
    { id: 'importantDates', label: 'Important Dates', icon: Calendar },
    { id: 'decisionLog', label: 'Decision Log', icon: ListChecks },
  ];

  const toggleOption = (id: string) => {
    setSelectedOptions(prev => 
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
  };

  const handleUpload = () => {
    if (file) {
      onUpload(file, speakers, selectedOptions);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a]">
          <h2 className="text-xl font-serif text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-500" />
            Upload Recording
          </h2>
          <button 
            onClick={onClose}
            disabled={isUploading}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
          {/* File Selection */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-500">Audio File</h3>
            <div 
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                isDragging ? 'border-amber-500 bg-amber-500/10' : 
                file ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
              }`}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) setFile(e.target.files[0]);
                }}
                disabled={isUploading}
              />
              {file ? (
                <div className="flex flex-col items-center text-center gap-2">
                  <FileAudio className="w-8 h-8 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-white">{file.name}</p>
                    <p className="text-xs text-white/40">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm text-white/80">Click to select an audio file</p>
                    <p className="text-xs text-white/40 mt-1">Supports MP3, WAV, M4A up to 1 hour</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Speakers */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-500 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Speakers (Optional)
            </h3>
            <input 
              type="text" 
              value={speakers}
              onChange={(e) => setSpeakers(e.target.value)}
              placeholder="e.g. John Doe, Sarah Smith, AI Assistant"
              disabled={isUploading}
              className="w-full bg-[#121214] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-white/20"
            />
          </div>

          {/* Outputs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-500">Analysis Outputs</h3>
              <button 
                onClick={() => setSelectedOptions(outputOptions.length === selectedOptions.length ? [] : outputOptions.map(o => o.id))}
                className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                disabled={isUploading}
              >
                {outputOptions.length === selectedOptions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {outputOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedOptions.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    disabled={isUploading}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${isSelected ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' : 'bg-transparent border-white/5 text-white/60 hover:bg-white/5 hover:border-white/10'}`}
                  >
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-white/20'}`}>
                      {isSelected && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-500' : 'text-white/40'}`} />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-[#0a0a0a] flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            disabled={isUploading}
            className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleUpload}
            disabled={!file || selectedOptions.length === 0 || isUploading}
            className="flex items-center gap-2 px-8 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:hover:bg-amber-600 text-white rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors shadow-lg shadow-amber-900/20"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Audio...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Analyze Recording
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
