export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Temporary' | 'Internship' | 'Industrial Attachment' | 'Graduate Trainee' | 'Apprenticeship' | 'Freelance';
export type Level = 'Industrial Attachment' | 'Internship' | 'Graduate' | 'Entry-level' | 'Junior' | 'Mid-level' | 'Senior' | 'Managerial' | 'Executive';
export type WorkMode = 'On-site' | 'Remote' | 'Hybrid';
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
export type Sort = 'newest' | 'oldest' | 'closing' | 'relevance';

export type AppStatus = 'Interested' | 'Saved' | 'Preparing Application' | 'Applied' | 'Interviewing' | 'Shortlisted' | 'Rejected' | 'Successful' | 'Withdrawn';
export interface AppRecord { status: AppStatus; date: string; contact: string; notes: string }
export interface SavedSearch { id: string; name: string; filters: Filters }

export type View = 'dashboard' | 'all' | 'engineering' | 'technology' | 'internships' | 'attachments' | 'graduate' | 'saved' | 'applications' | 'alerts' | 'recent' | 'settings';
