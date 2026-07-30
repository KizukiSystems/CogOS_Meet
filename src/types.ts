export interface ActionItem {
  id: string;
  task: string;
  owner: string;
  completed: boolean;
}

export type Verdict =
  | 'confirmed'
  | 'probable'
  | 'disputed'
  | 'gap'
  | 'fabricated';

export interface ClaimVerdict {
  id: string;
  claim: string;
  sourceField: string;
  verdict: Verdict;
  quote: string | null;
  reasoning: string;
}

export interface VerificationReport {
  claims: ClaimVerdict[];
  counts: Record<Verdict, number>;
  supportScore: number | null;
  flagged: boolean;
  judgeModel: string;
  verifiedAt: string;
  truncated?: boolean;
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
  perspectives?: {
    empathy: string;
    operational: string;
  };
  tags?: string[];
  verbatimTranscript?: string;
  verification?: VerificationReport;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  category?: string;
  transcript: string;
  isUploadedAudio?: boolean;
  hideTranscript?: boolean;
  analysis?: MeetingAnalysis;
}
