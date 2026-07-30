import React, { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';

interface TranscriptRendererProps {
  transcript: string;
  interimTranscript?: string;
  onRenameSpeaker: (oldName: string, newName: string) => void;
}

export function TranscriptRenderer({ transcript, interimTranscript, onRenameSpeaker }: TranscriptRendererProps) {
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');

  const parseTranscript = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Match patterns like "Speaker Name: text" or "**Speaker Name:** text"
      const match = line.match(/^(?:\*\*)?([^:]+?)(?:\*\*)?:\s*(.*)$/);
      if (match) {
        return {
          id: index,
          speaker: match[1].trim(),
          text: match[2],
          originalLine: line
        };
      }
      return { id: index, speaker: null, text: line, originalLine: line };
    });
  };

  const parsedLines = parseTranscript(transcript);

  const startEditing = (speaker: string) => {
    setEditingSpeaker(speaker);
    setNewSpeakerName(speaker);
  };

  const saveRename = () => {
    if (editingSpeaker && newSpeakerName.trim() && editingSpeaker !== newSpeakerName.trim()) {
      onRenameSpeaker(editingSpeaker, newSpeakerName.trim());
    }
    setEditingSpeaker(null);
  };

  return (
    <div className="space-y-4 text-lg leading-relaxed font-light text-white">
      {parsedLines.map((line) => (
        <div key={line.id} className="min-h-[1.5em]">
          {line.speaker ? (
            <span className="block mb-1 mt-4">
              {editingSpeaker === line.speaker ? (
                <span className="inline-flex items-center gap-2 bg-[#1a1a1a] rounded px-2 py-1 border border-amber-500/30">
                  <input
                    type="text"
                    value={newSpeakerName}
                    onChange={(e) => setNewSpeakerName(e.target.value)}
                    className="bg-transparent text-amber-500 text-sm font-bold uppercase tracking-wider outline-none w-32"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename();
                      if (e.key === 'Escape') setEditingSpeaker(null);
                    }}
                  />
                  <button onClick={saveRename} className="text-emerald-500 hover:text-emerald-400">
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={() => setEditingSpeaker(null)} className="text-white/40 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : (
                <span 
                  className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-500 cursor-pointer hover:bg-amber-500/10 px-2 py-0.5 rounded -ml-2 transition-colors group"
                  onClick={() => startEditing(line.speaker!)}
                >
                  {line.speaker}
                  <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500/50" />
                </span>
              )}
              <span className="block text-white/90">{line.text}</span>
            </span>
          ) : (
            <span className="text-white/90 whitespace-pre-wrap">{line.text}</span>
          )}
        </div>
      ))}
      {interimTranscript && (
        <span className="text-amber-100/90 italic ml-1 block mt-2">
          {interimTranscript}
        </span>
      )}
    </div>
  );
}
