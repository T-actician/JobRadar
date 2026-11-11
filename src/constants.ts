import type { AppStatus, Prefs, Profile } from './types';

export const CATEGORIES = ['Electrical Engineering', 'Electronics Engineering', 'Civil Engineering', 'Mechanical Engineering', 'Software Engineering', 'Information Technology', 'Cybersecurity', 'Data Science', 'Networking', 'Telecommunications', 'Business and Finance', 'Accounting', 'Administration', 'Human Resources', 'Healthcare', 'Education', 'Science and Research', 'Manufacturing', 'Construction', 'Procurement', 'Logistics', 'Marketing', 'Sales', 'Agriculture', 'Hospitality', 'Government', 'NGOs', 'Other'];
export const ENGINEERING = CATEGORIES.slice(0, 4);
export const TECH = ['Software Engineering', 'Information Technology', 'Cybersecurity', 'Data Science', 'Networking', 'Telecommunications'];
export const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Industrial Attachment', 'Graduate Trainee', 'Apprenticeship', 'Freelance'];
export const LEVELS = ['Industrial Attachment', 'Internship', 'Graduate', 'Entry-level', 'Junior', 'Mid-level', 'Senior', 'Managerial', 'Executive'];
export const MODES = ['On-site', 'Remote', 'Hybrid'];
export const EDUCATION = ['Certificate', 'Diploma', "Bachelor's degree", "Master's degree", 'PhD'];
export const COUNTIES = ['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'];

export const EXP_BUCKETS: Record<string, [number, number]> = {
  'No experience': [0, 0], '0–1 years': [0, 1], '1–2 years': [1, 2], '2–3 years': [2, 3],
  '3–5 years': [3, 5], '5–7 years': [5, 7], '7+ years': [7, 99],
};
export const POSTED: [string, string][] = [['today', 'Today'], ['24h', 'Last 24 hours'], ['3d', 'Last 3 days'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']];
export const CLOSING: [string, string][] = [['week', 'Within 7 days'], ['month', 'Within 30 days']];
export const SALARY: [string, string][] = [['20000', 'KES 20,000+'], ['50000', 'KES 50,000+'], ['100000', 'KES 100,000+'], ['200000', 'KES 200,000+']];
export const APP_STATUSES: AppStatus[] = ['Interested', 'Saved', 'Preparing Application', 'Applied', 'Interviewing', 'Shortlisted', 'Rejected', 'Successful', 'Withdrawn'];

export const SOURCES: Record<string, string> = {
  'LinkedIn Jobs': 'https://www.linkedin.com/jobs/',
  'MyJobMag Kenya': 'https://www.myjobmag.co.ke/',
  'BrighterMonday Kenya': 'https://www.brightermonday.co.ke/',
  'Fuzu Kenya': 'https://www.fuzu.com/kenya',
  'Career Point Kenya': 'https://www.careerpointkenya.co.ke/',
  'PSC Kenya': 'https://www.psckjobs.go.ke/',
  'UN Jobs': 'https://unjobs.org/duty_stations/kenya',
};

export const DEFAULT_PREFS: Prefs = { notify: true, deadlines: true, digestHour: 8, defaultInterval: 60, intervals: {} };
export const INTERVALS: [string, string][] = [['15', 'Every 15 min'], ['30', 'Every 30 min'], ['60', 'Every hour'], ['120', 'Every 2 hours'], ['360', 'Every 6 hours'], ['720', 'Every 12 hours']];
/** Applications in these states still need action, so deadline reminders apply. */
export const OPEN_APP_STATUSES: AppStatus[] = ['Interested', 'Saved', 'Preparing Application'];

export const DEFAULT_PROFILE: Profile = { hasCv: false, cvName: '', cvText: '', cvAnalysedAt: null, skills: [], education: '', years: null, yearsSource: '', categories: [], counties: [], remoteOk: false };
/** 1 = Certificate ... 5 = PhD; 0 = unknown */
export const eduRank = (e: string | null | undefined): number => (e ? EDUCATION.indexOf(e) + 1 : 0);
