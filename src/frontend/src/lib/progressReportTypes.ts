export type ReportPeriod =
  | "Q1"
  | "Q2"
  | "Q3"
  | "Q4"
  | "Semester 1"
  | "Semester 2"
  | "Full Year"
  | "Custom";

export type ReportStatus = "draft" | "final";

export interface ProgressReport {
  id: number;
  studentId: string;
  studentName: string;
  gradeLevel: string;
  period: ReportPeriod;
  customStartDate?: string;
  customEndDate?: string;
  status: ReportStatus;
  includeSections: {
    attendance: boolean;
    behavior: boolean;
    academic: boolean;
    standards: boolean;
    comments: boolean;
  };
  comments: {
    attendance: string;
    behavior: string;
    academic: string;
    standards: string;
    general: string;
  };
  generatedAt: number;
  updatedAt: number;
}
