export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Temporary' | 'Internship' | 'Industrial Attachment' | 'Graduate Trainee' | 'Apprenticeship' | 'Freelance' | 'Not specified';
export type Level = 'Industrial Attachment' | 'Internship' | 'Graduate' | 'Entry-level' | 'Junior' | 'Mid-level' | 'Senior' | 'Managerial' | 'Executive' | 'Not specified';
export type WorkMode = 'On-site' | 'Remote' | 'Hybrid' | 'Not specified';
export type JobStatus = 'active' | 'updated' | 'expired';

export interface Job {
  id: string;
  title: string;
  employer: string;
  category: string;
  type: JobType;
  level: Level;
  /** true when the level was inferred from the text rather than stated by the source */
  levelInferred: boolean;
  /** minimum years of experience; null = not specified */
  expMin: number | null;
  county: string;
  town: string;
  mode: WorkMode;
  salaryMin: number | null;
  salaryMax: number | null;
  /** YYYY-MM-DD, null = not specified */
  deadline: string | null;
  published: string;
  collected: string;
  lastVerified: string | null;
  source: string;
  sourceUrl: string;
  applyUrl: string;
  education: string | null;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  status: JobStatus;
  flags: string[];
}

export interface Filters {
  q: string; category: string; type: string; level: string; exp: string; county: string;
  mode: string; source: string; education: string; posted: string; closing: string; salary: string; company: string;
}
export type Sort = 'newest' | 'oldest' | 'closing' | 'relevance' | 'match';

export type AppStatus = 'Interested' | 'Saved' | 'Preparing Application' | 'Applied' | 'Interviewing' | 'Shortlisted' | 'Rejected' | 'Successful' | 'Withdrawn';
export interface AppRecord { status: AppStatus; date: string; contact: string; notes: string }
export interface SavedSearch { id: string; name: string; filters: Filters; notify?: boolean; frequency?: 'instant' | 'daily' }

export interface Prefs {
  /** show desktop notifications (they are always listed in Job Alerts) */
  notify: boolean;
  /** remind me before deadlines of saved jobs and applications in progress */
  deadlines: boolean;
  /** hour of day (0-23) for daily digests */
  digestHour: number;
  /** minutes between collections, per source overrides below */
  defaultInterval: number;
  intervals: Record<string, number>;
}
export type NoteKind = 'match' | 'deadline' | 'digest' | 'source';
export interface AppNotification { id: number; kind: NoteKind; title: string; body: string; jobId: string | null; createdAt: string; delivered: boolean; read: boolean }

export type View = 'dashboard' | 'all' | 'engineering' | 'technology' | 'internships' | 'attachments' | 'graduate' | 'saved' | 'applications' | 'alerts' | 'recent' | 'settings' | 'recommended' | 'profile';

export type UpdateState = 'dev' | 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'none' | 'error';
export interface UpdateStatus { state: UpdateState; version?: string; percent?: number; error?: string }

export interface Profile {
  hasCv: boolean; cvName: string; cvText: string; cvAnalysedAt: string | null;
  /** canonical skill names from the built-in list; the user can edit them */
  skills: string[];
  education: string;
  years: number | null;
  /** where the years figure came from: stated on the CV, estimated from dates, or entered by the user */
  yearsSource: 'stated' | 'estimated' | 'you' | '';
  categories: string[]; counties: string[]; remoteOk: boolean;
}
export interface MatchPart { key: 'skills' | 'field' | 'experience' | 'education' | 'location'; label: string; score: number | null; weight: number }
export interface MatchResult {
  /** 0-100 estimate from the parts that could be compared */
  score: number;
  /** share of the scoring weight that could be assessed (0-1); low means "based on limited information" */
  confidence: number;
  mode: 'cv' | 'preferences';
  matched: string[]; missing: string[]; notes: string[]; parts: MatchPart[];
}
