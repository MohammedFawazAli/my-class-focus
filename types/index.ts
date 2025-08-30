export interface Session {
  id: string;
  day: string;
  start_time: string;
  duration_slots: number;
  subject_name: string;
  session_type?: string;
  room?: string;
  lecturer?: string;
  groups: string[];
  notes: string;
  attendance_marked: 'present' | 'absent' | 'off' | 'mixed' | null;
}

export interface Subject {
  subject_id: string;
  name: string;
  attended_classes: number;
  missed_classes: number;
  total_classes: number;
  percentage: number;
}

export interface TimetableData {
  days: string[];
  timeslots: string[];
  sessions: Session[];
  subjects: { [key: string]: Subject };
  lastImported?: string;
  importMetadata?: {
    filename: string;
    parsedSessions: number;
    unparsedCells: number;
    confidence: 'high' | 'medium' | 'low';
  };
}

export interface ParsedCell {
  subject_name: string;
  session_type?: string;
  room_or_code?: string;
  lecturer?: string;
  groups: string[];
  raw_text: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ImportPreview {
  sessions: Session[];
  unparsedCells: { row: number; col: number; content: string }[];
  metadata: {
    totalCells: number;
    parsedCells: number;
    confidence: 'high' | 'medium' | 'low';
  };
}