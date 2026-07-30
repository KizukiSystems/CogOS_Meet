export interface ActionItem {
  id: string;
  task: string;
  owner: string;
  completed: boolean;
}

export interface MeetingAnalysis {
  summary?: string;
  executiveSummary?: string;
  detailedSummary?: string;
  tldl?: string;
  actionItems?: ActionItem[];
  importantDates?: string[];
  decisionLog?: string[];
  sentiment?: 'Positive' | 'Neutral' | 'Negative';
  sentimentScore?: number;
  epistemicConfidence?: number;
  perspectives?: {
    empathy: string;
    operational: string;
  };
  tags?: string[];
  verbatimTranscript?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  transcript: string;
  isUploadedAudio?: boolean;
  analysis?: MeetingAnalysis;
}
