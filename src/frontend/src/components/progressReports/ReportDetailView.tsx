import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Edit,
  GraduationCap,
  MessageSquare,
  Printer,
  Star,
  UserCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AttendanceStatus, BehaviorSeverity } from "../../backend";
import {
  useAllAssessments,
  useAllAssignments,
  useBehaviorLogs,
  useGetAllStudents,
} from "../../hooks/useQueries";
import { useUpdateReport } from "../../lib/progressReportStore";
import type { ProgressReport } from "../../lib/progressReportTypes";
import CommentBankPanel from "../reports/CommentBankPanel";

interface ReportDetailViewProps {
  report: ProgressReport;
  onBack: () => void;
  onEdit: (id: number) => void;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCorrespondenceDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: ProgressReport["status"] }) {
  if (status === "final") {
    return (
      <Badge
        className="text-xs font-semibold px-2.5 py-0.5"
        style={{
          backgroundColor: "var(--color-success-subtle)",
          color: "oklch(0.35 0.14 145)",
          border: "1px solid oklch(0.75 0.12 145)",
        }}
      >
        <CheckCircle2 size={11} className="mr-1" />
        Final
      </Badge>
    );
  }
  return (
    <Badge
      className="text-xs font-semibold px-2.5 py-0.5"
      style={{
        backgroundColor: "var(--color-warning-subtle)",
        color: "oklch(0.45 0.14 75)",
        border: "1px solid oklch(0.82 0.14 75)",
      }}
    >
      <Edit size={11} className="mr-1" />
      Draft
    </Badge>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "var(--color-primary-subtle)" }}
      >
        <Icon size={14} className="text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg px-4 py-3 min-w-[80px]"
      style={{
        backgroundColor: highlight
          ? "var(--color-primary-subtle)"
          : "var(--color-surface)",
        border: `1px solid ${
          highlight ? "oklch(0.8 0.08 290)" : "var(--color-border)"
        }`,
      }}
    >
      <span
        className="text-xl font-bold"
        style={{
          color: highlight ? "var(--color-primary)" : "var(--color-foreground)",
        }}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground mt-0.5 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

export default function ReportDetailView({
  report,
  onBack,
  onEdit,
}: ReportDetailViewProps) {
  const { data: students = [] } = useGetAllStudents();
  const { data: behaviorLogs = [] } = useBehaviorLogs();
  const { data: allAssignments = [] } = useAllAssignments();
  const { data: allAssessments = [] } = useAllAssessments();
  const updateReport = useUpdateReport();

  const [printPreview, setPrintPreview] = useState(false);

  const student = students.find(
    (s) =>
      `${s.givenNames} ${s.familyName}`.toLowerCase() ===
        report.studentName.toLowerCase() ||
      (s.preferredName &&
        `${s.preferredName} ${s.familyName}`.toLowerCase() ===
          report.studentName.toLowerCase()),
  );

  // ─── Parent correspondence ─────────────────────────────────────────────────
  type CorrespondenceEntry = {
    date: string;
    guardianName: string;
    contactMethod: string;
    summary: string;
  };

  const rawCorrespondence: CorrespondenceEntry[] =
    (student as unknown as { parentCorrespondence?: CorrespondenceEntry[] })
      ?.parentCorrespondence ?? [];

  const recentCorrespondence = [...rawCorrespondence]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // ─── Attendance stats ──────────────────────────────────────────────────────
  const attendanceRecords = student?.attendanceRecords ?? [];
  const totalRecords = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(
    (r) => r.status === AttendanceStatus.present,
  ).length;
  const absentCount = attendanceRecords.filter(
    (r) => r.status === AttendanceStatus.absent,
  ).length;
  const tardyCount = attendanceRecords.filter(
    (r) => r.status === AttendanceStatus.tardy,
  ).length;
  const excusedCount = attendanceRecords.filter(
    (r) => r.status === AttendanceStatus.excused,
  ).length;
  const attendanceRate =
    totalRecords > 0
      ? Math.round(((presentCount + excusedCount) / totalRecords) * 100)
      : null;

  // ─── Behavior stats ────────────────────────────────────────────────────────
  const studentBehaviorLogs = behaviorLogs.filter(
    (log) => log.studentName.toLowerCase() === report.studentName.toLowerCase(),
  );
  const incidentCount = studentBehaviorLogs.filter(
    (l) => l.entryType === "incident",
  ).length;
  const praiseCount = studentBehaviorLogs.filter(
    (l) => l.entryType === "praise",
  ).length;
  const followUpCount = studentBehaviorLogs.filter(
    (l) => l.followUpNeeded,
  ).length;
  const hasMajorIncident = studentBehaviorLogs.some(
    (l) => l.severity === BehaviorSeverity.major,
  );

  // ─── Academic rows ─────────────────────────────────────────────────────────
  type AcademicRow = {
    id: string;
    title: string;
    type: string;
    points: number;
    dueDate: string;
  };

  const academicRows: AcademicRow[] = [
    ...allAssignments.map((a) => ({
      id: `assign-${a.id}`,
      title: a.title,
      type: a.assignmentType,
      points: a.pointsPossible ?? a.points,
      dueDate: a.dueDate,
    })),
    ...allAssessments.map((a) => ({
      id: `assess-${a.id}`,
      title: a.title,
      type: a.assessmentType,
      points: a.totalPoints,
      dueDate: a.dueDate ?? "",
    })),
  ];

  // ─── Standards mastery ─────────────────────────────────────────────────────
  const allStandards = Array.from(
    new Set([
      ...allAssignments.flatMap((a) => a.standards),
      ...allAssessments.flatMap((a) => a.standards),
    ]),
  ).sort();

  // ─── Comments autosave ─────────────────────────────────────────────────────
  const [comments, setComments] = useState({ ...report.comments });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openCommentBank, setOpenCommentBank] = useState<string | null>(null);

  const scheduleCommentSave = useCallback(
    (updated: typeof comments) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateReport.mutate({ id: report.id, comments: updated });
      }, 1500);
    },
    [report.id, updateReport],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function handleCommentChange(key: keyof typeof comments, value: string) {
    const updated = { ...comments, [key]: value };
    setComments(updated);
    scheduleCommentSave(updated);
  }

  function handlePrint() {
    window.print();
  }

  // ─── Print preview mode ────────────────────────────────────────────────────
  if (printPreview) {
    return (
      <div className="space-y-0">
        {/* Print preview toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-amber-50 border-b border-amber-200 print:hidden">
          <div className="flex items-center gap-2">
            <Printer size={15} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Print Preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-amber-600 text-white hover:bg-amber-700"
              data-ocid="progress_reports.detail.print_button"
            >
              <Printer size={13} className="mr-1.5" />
              Print
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPrintPreview(false)}
              className="text-amber-700"
              data-ocid="progress_reports.detail.close_preview.button"
            >
              Exit Preview
            </Button>
          </div>
        </div>

        {/* Print-optimized report layout */}
        <div
          className="mx-auto max-w-3xl px-8 py-10 bg-white"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Header */}
          <div className="text-center border-b-2 border-gray-800 pb-6 mb-8">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
              School Name
            </p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Progress Report
            </h1>
            <p className="text-base text-gray-600 mt-1">{report.period}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Generated {formatDate(report.generatedAt)}
            </p>
          </div>

          {/* Student info */}
          <div
            className="grid grid-cols-2 gap-x-8 gap-y-2 mb-8 text-sm"
            style={{ pageBreakInside: "avoid" }}
          >
            <div>
              <span className="font-semibold text-gray-700">Student:</span>{" "}
              <span className="text-gray-900">{report.studentName}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Grade Level:</span>{" "}
              <span className="text-gray-900">{report.gradeLevel}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">
                Report Period:
              </span>{" "}
              <span className="text-gray-900">{report.period}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Status:</span>{" "}
              <span className="text-gray-900 capitalize">{report.status}</span>
            </div>
          </div>

          {/* Attendance */}
          {report.includeSections.attendance && totalRecords > 0 && (
            <div className="mb-8" style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-base font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Attendance Summary
              </h2>
              <div className="grid grid-cols-5 gap-3 text-center text-sm">
                {[
                  ["Total Days", totalRecords],
                  ["Present", presentCount],
                  ["Absent", absentCount],
                  ["Tardy", tardyCount],
                  [
                    "Rate",
                    attendanceRate !== null ? `${attendanceRate}%` : "--",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="border border-gray-200 rounded p-2"
                  >
                    <div className="font-bold text-gray-900 text-lg">
                      {value}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          {report.includeSections.comments && (
            <div className="mb-8" style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-base font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Teacher Comments
              </h2>
              {(
                [
                  { key: "general" as const, label: "General" },
                  { key: "academic" as const, label: "Academic" },
                  { key: "attendance" as const, label: "Attendance" },
                  { key: "behavior" as const, label: "Behavior" },
                ] as Array<{ key: keyof typeof comments; label: string }>
              ).map(({ key, label }) =>
                comments[key] ? (
                  <div key={key} className="mb-3">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      {label}
                    </p>
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {comments[key]}
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          )}

          {/* Parent Correspondence (print) */}
          <div className="mb-8" style={{ pageBreakInside: "avoid" }}>
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3">
              Parent Correspondence
            </h2>
            {recentCorrespondence.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No parent correspondence on record.
              </p>
            ) : (
              <div className="space-y-3">
                {recentCorrespondence.map((entry) => (
                  <div
                    key={`${entry.date}-${entry.guardianName}`}
                    className="border border-gray-200 rounded p-3 text-sm"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-gray-700">
                        {formatCorrespondenceDate(entry.date)}
                      </span>
                      <span className="text-gray-600">
                        {entry.guardianName}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                        {entry.contactMethod}
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      {entry.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="border-t border-gray-300 pt-6 mt-8"
            style={{ pageBreakInside: "avoid" }}
          >
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div>
                <p className="text-gray-700 font-semibold mb-4">
                  Parent / Guardian Signature:
                </p>
                <div className="border-b border-gray-400 mt-8" />
                <p className="text-xs text-gray-500 mt-1">Date</p>
              </div>
              <div>
                <p className="text-gray-700 font-semibold mb-4">
                  Teacher Signature:
                </p>
                <div className="border-b border-gray-400 mt-8" />
                <p className="text-xs text-gray-500 mt-1">Date</p>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @media print {
            .print\\:hidden { display: none !important; }
            body { background: white !important; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
      </div>
    );
  }

  // ─── Normal view ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-0 print:space-y-4">
      {/* Sticky action bar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-card border-b border-border print:hidden"
        style={{ boxShadow: "var(--shadow-xs)" }}
      >
        {/* Breadcrumb */}
        <nav
          className="flex items-center gap-1.5 text-sm"
          aria-label="Breadcrumb"
        >
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-ocid="progress_reports.detail.back_button"
          >
            Progress Reports
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {report.studentName}
          </span>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPrintPreview(true)}
            className="text-sm"
            data-ocid="progress_reports.detail.print_preview.button"
          >
            <Printer size={14} className="mr-1.5" />
            Print Preview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(report.id)}
            className="text-sm"
            data-ocid="progress_reports.detail.edit_button"
          >
            <Edit size={14} className="mr-1.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-sm"
            data-ocid="progress_reports.detail.export_button"
          >
            <Download size={14} className="mr-1.5" />
            Export PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground text-sm"
            data-ocid="progress_reports.detail.back_button"
          >
            <ArrowLeft size={14} className="mr-1.5" />
            Back
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="px-6 py-6 space-y-0">
        {/* Student header */}
        <div className="pb-6 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {report.studentName}
              </h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  Grade {report.gradeLevel}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-sm text-muted-foreground">
                  {report.period}
                </span>
                {report.period === "Custom" &&
                  report.customStartDate &&
                  report.customEndDate && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-sm text-muted-foreground">
                        {report.customStartDate} – {report.customEndDate}
                      </span>
                    </>
                  )}
                <span className="text-muted-foreground/40">·</span>
                <span className="text-sm text-muted-foreground">
                  Generated {formatDate(report.generatedAt)}
                </span>
              </div>
            </div>
            <StatusBadge status={report.status} />
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-0 divide-y divide-border">
          {/* Attendance Summary */}
          {report.includeSections.attendance && (
            <div className="py-6">
              <SectionHeader icon={UserCheck} title="Attendance Summary" />
              {totalRecords === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No attendance records on file for this student.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <StatCard label="Total Days" value={totalRecords} />
                  <StatCard
                    label="Present"
                    value={presentCount}
                    highlight={presentCount > 0}
                  />
                  <StatCard label="Absent" value={absentCount} />
                  <StatCard label="Tardy" value={tardyCount} />
                  <StatCard label="Excused" value={excusedCount} />
                  {attendanceRate !== null && (
                    <StatCard
                      label="Attendance Rate"
                      value={`${attendanceRate}%`}
                      highlight
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Behavior Summary */}
          {report.includeSections.behavior && (
            <div className="py-6">
              <SectionHeader icon={AlertTriangle} title="Behavior Summary" />
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <StatCard
                    label="Total Logged"
                    value={studentBehaviorLogs.length}
                  />
                  <StatCard label="Incidents" value={incidentCount} />
                  <StatCard
                    label="Praise"
                    value={praiseCount}
                    highlight={praiseCount > 0}
                  />
                  <StatCard label="Follow-ups" value={followUpCount} />
                </div>
                {hasMajorIncident && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
                    style={{
                      backgroundColor: "var(--color-destructive-subtle)",
                      color: "var(--color-destructive)",
                      border: "1px solid oklch(0.78 0.14 25)",
                    }}
                  >
                    <AlertTriangle size={14} />
                    Serious incident on record — refer to behavior log for
                    details
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Parent Correspondence */}
          <div
            className="py-6"
            data-ocid="progress_reports.detail.correspondence.section"
          >
            <SectionHeader icon={MessageSquare} title="Parent Correspondence" />
            {recentCorrespondence.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No parent correspondence on record.
              </p>
            ) : (
              <div className="space-y-3">
                {recentCorrespondence.map((entry, idx) => (
                  <div
                    key={`${entry.date}-${entry.guardianName}`}
                    className="rounded-lg border border-border bg-card px-4 py-3"
                    data-ocid={`progress_reports.detail.correspondence.item.${idx + 1}`}
                  >
                    <div className="flex items-center gap-3 flex-wrap mb-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatCorrespondenceDate(entry.date)}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {entry.guardianName}
                      </span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {entry.contactMethod}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {entry.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Academic Progress */}
          {report.includeSections.academic && (
            <div className="py-6">
              <SectionHeader icon={GraduationCap} title="Academic Progress" />
              {academicRows.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No assignments or assessments on record.
                </p>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <table
                    className="w-full text-sm"
                    data-ocid="progress_reports.detail.table"
                  >
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Title
                        </th>
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Type
                        </th>
                        <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Pts Possible
                        </th>
                        <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Pts Earned
                        </th>
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Due Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {academicRows.map((row, i) => (
                        <tr
                          key={row.id}
                          className={`border-b border-border last:border-0 ${
                            i % 2 === 0 ? "bg-card" : "bg-muted/20"
                          }`}
                        >
                          <td className="py-2.5 px-4 font-medium text-foreground">
                            {row.title}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge
                              variant="secondary"
                              className="text-xs capitalize"
                            >
                              {row.type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-right text-foreground">
                            {row.points}
                          </td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground">
                            --
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {row.dueDate
                              ? new Date(
                                  `${row.dueDate}T12:00:00`,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td
                          colSpan={3}
                          className="py-2.5 px-4 font-semibold text-foreground"
                        >
                          Overall Grade
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-muted-foreground">
                          --
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground italic">
                          Grade entry not yet available
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Standards Mastery */}
          {report.includeSections.standards && (
            <div className="py-6">
              <SectionHeader icon={BookOpen} title="Standards Mastery" />
              {allStandards.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No standards tagged in current assignments or assessments.
                </p>
              ) : (
                <div className="space-y-2">
                  {allStandards.map((std) => (
                    <div
                      key={std}
                      className="flex items-center justify-between py-2 px-3 rounded-md"
                      style={{ backgroundColor: "var(--color-surface)" }}
                    >
                      <span className="text-sm text-foreground font-mono">
                        {std}
                      </span>
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: "var(--color-success-subtle)",
                          color: "oklch(0.35 0.14 145)",
                          border: "1px solid oklch(0.75 0.12 145)",
                        }}
                      >
                        <Star size={10} className="mr-1" />
                        Covered
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Teacher Comments */}
          {report.includeSections.comments && (
            <div className="py-6">
              <SectionHeader icon={ClipboardList} title="Teacher Comments" />
              <div className="space-y-5">
                {(
                  [
                    {
                      key: "attendance" as const,
                      label: "Attendance Comments",
                    },
                    { key: "behavior" as const, label: "Behavior Comments" },
                    { key: "academic" as const, label: "Academic Comments" },
                    { key: "standards" as const, label: "Standards Comments" },
                    { key: "general" as const, label: "General Comments" },
                  ] as Array<{ key: keyof typeof comments; label: string }>
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={`comment-${key}`}
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        {label}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCommentBank(
                            openCommentBank === key ? null : key,
                          )
                        }
                        className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        data-ocid={`progress_reports.detail.comment_bank.${key}.button`}
                      >
                        Comment Bank
                        {openCommentBank === key ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    <Textarea
                      id={`comment-${key}`}
                      value={comments[key]}
                      onChange={(e) => handleCommentChange(key, e.target.value)}
                      placeholder={`Add ${label.toLowerCase()}…`}
                      rows={3}
                      className="text-sm resize-y min-h-[80px]"
                      data-ocid="progress_reports.detail.comments.textarea"
                    />
                    {openCommentBank === key && (
                      <CommentBankPanel
                        onInsert={(text) => {
                          handleCommentChange(key, text);
                          setOpenCommentBank(null);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
