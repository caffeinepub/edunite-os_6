import { Button } from "@/components/ui/button";
import { useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Megaphone,
  MessageSquare,
  Send,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import AnnouncementsView from "../components/communication/AnnouncementsView";
import MessagesView from "../components/communication/MessagesView";
import { PillTabs } from "../components/shared/PillTabs";

type CommTab = "messages" | "announcements" | "digest";

function getTabFromSearch(search: unknown): CommTab {
  const params = new URLSearchParams(String(search ?? ""));
  const t = params.get("tab");
  if (t === "announcements") return "announcements";
  if (t === "digest") return "digest";
  return "messages";
}

// ─── Weekly Digest helpers ────────────────────────────────────────────────────

function getWeekDates(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { start: mon, end: fri, label: `${fmt(mon)} – ${fmt(fri)}` };
}

function isThisWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const { start, end } = getWeekDates();
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

function WeeklyDigestView() {
  const week = getWeekDates();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // ── Pull data from localStorage ──
  const _courses = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("edunite_courses") ?? "[]",
      ) as Array<{
        id: number;
        title: string;
      }>;
    } catch {
      return [];
    }
  })();

  const allAssignments = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("edunite_assignments") ?? "[]",
      ) as Array<{
        id: number;
        title: string;
        dueDate: string;
        moduleId: number;
      }>;
    } catch {
      return [];
    }
  })();

  const allAssessments = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("edunite_assessments") ?? "[]",
      ) as Array<{
        id: number;
        title: string;
        dueDate: string;
        moduleId: number;
      }>;
    } catch {
      return [];
    }
  })();

  const students = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("edunite_students") ?? "[]",
      ) as Array<{
        id: number;
        firstName: string;
        attendanceRecords?: Array<{ date: string; status: string }>;
      }>;
    } catch {
      return [];
    }
  })();

  const behaviorEntries = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("edunite_behavior") ?? "[]",
      ) as Array<{ id: number; date: string; type: string; category: string }>;
    } catch {
      return [];
    }
  })();

  const announcements = (() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("edunite_announcements") ?? "[]",
      ) as Array<{
        id: number;
        title: string;
        body: string;
        pinned: boolean;
        status: string;
      }>;
      return stored.filter((a) => a.pinned && a.status !== "archived");
    } catch {
      return [];
    }
  })();

  // ── Derived ──
  const upcomingAssignments = allAssignments.filter((a) =>
    isThisWeek(a.dueDate),
  );
  const upcomingAssessments = allAssessments.filter((a) =>
    isThisWeek(a.dueDate),
  );
  const totalUpcoming = upcomingAssignments.length + upcomingAssessments.length;

  const praiseThisWeek = behaviorEntries.filter(
    (b) => b.type === "Praise" && isThisWeek(b.date),
  );

  // ── Attendance this week ──
  let presentCount = 0;
  let absentCount = 0;
  for (const s of students) {
    for (const r of s.attendanceRecords ?? []) {
      if (isThisWeek(r.date)) {
        if (r.status === "present") presentCount++;
        else if (r.status === "absent") absentCount++;
      }
    }
  }

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      toast.success("Weekly Digest sent to all parents");
    }, 1200);
  };

  // ── Seed defaults if nothing in localStorage ──
  const seedUpcoming =
    totalUpcoming === 0
      ? [
          {
            title: "Rhetorical Analysis Essay Draft",
            type: "assignment",
            dueDate: "Due Tue",
          },
          {
            title: "Unit 3 Vocabulary Quiz",
            type: "assessment",
            dueDate: "Due Wed",
          },
          {
            title: "Independent Reading Response #4",
            type: "assignment",
            dueDate: "Due Thu",
          },
        ]
      : [
          ...upcomingAssignments.map((a) => ({
            title: a.title,
            type: "assignment",
            dueDate: a.dueDate
              ? `Due ${new Date(a.dueDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
              : "",
          })),
          ...upcomingAssessments.map((a) => ({
            title: a.title,
            type: "assessment",
            dueDate: a.dueDate
              ? `Due ${new Date(a.dueDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
              : "",
          })),
        ];

  const seedAnnouncements =
    announcements.length === 0
      ? [
          {
            title: "Parent-Teacher Conferences",
            body: "Scheduled for next Wednesday 4–7 PM. Sign up via the school portal.",
          },
          {
            title: "Field Trip Permission Slip",
            body: "Due by Friday for the Literary Walk on March 20.",
          },
        ]
      : announcements.map((a) => ({ title: a.title, body: a.body }));

  const attendanceSummary =
    presentCount + absentCount === 0
      ? { present: 143, absent: 7, rate: "95%" }
      : {
          present: presentCount,
          absent: absentCount,
          rate: `${Math.round((presentCount / (presentCount + absentCount)) * 100)}%`,
        };

  const praiseCount = praiseThisWeek.length || 6;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">
            Weekly Digest
          </p>
          <h2 className="text-xl font-bold text-foreground">
            Week of {week.label}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Summary sent to {students.length || 28} parent/guardian contacts
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            className="gap-1.5"
            data-ocid="digest.preview_button"
          >
            <BookOpen size={14} />
            {showPreview ? "Hide Preview" : "Preview Email"}
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || sent}
            className="gap-1.5 bg-violet-700 hover:bg-violet-800 text-white"
            data-ocid="digest.send.primary_button"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : sent ? (
              <CheckCircle2 size={14} />
            ) : (
              <Send size={14} />
            )}
            {sent ? "Sent!" : "Send to All Parents"}
          </Button>
        </div>
      </div>

      {/* Email preview */}
      {showPreview && (
        <div
          className="border border-border rounded-xl bg-white overflow-hidden"
          data-ocid="digest.preview.panel"
        >
          <div className="px-6 py-4 bg-violet-700 text-white">
            <p className="text-xs font-medium opacity-75">
              EdUnite OS — English 10
            </p>
            <h3 className="text-lg font-bold mt-0.5">
              Weekly Update · {week.label}
            </h3>
          </div>
          <div className="px-6 py-5 space-y-5 text-sm text-gray-800">
            <div>
              <p className="font-semibold text-gray-900 mb-2">
                📅 Upcoming This Week
              </p>
              <ul className="space-y-1">
                {seedUpcoming.slice(0, 4).map((item, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: ordered preview list
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 shrink-0 ${
                        item.type === "assessment"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {item.type === "assessment" ? "Quiz" : "Assignment"}
                    </span>
                    <span>{item.title}</span>
                    <span className="text-gray-500 ml-auto shrink-0">
                      {item.dueDate}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">
                📊 Attendance This Week
              </p>
              <p>
                {attendanceSummary.present} days present ·{" "}
                {attendanceSummary.absent} absences ·{" "}
                <strong>{attendanceSummary.rate}</strong> attendance rate
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">
                📌 Announcements
              </p>
              {seedAnnouncements.slice(0, 2).map((a, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: ordered preview list
                <div key={i} className="mb-2">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-gray-600">{a.body}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">
                🌟 Behavior Highlights
              </p>
              <p>
                {praiseCount} praise entries logged this week. Keep up the great
                work!
              </p>
            </div>
          </div>
          <div className="px-6 py-3 bg-muted/40 border-t border-border text-xs text-muted-foreground">
            Sent via EdUnite OS · To unsubscribe, reply STOP
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Upcoming */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          data-ocid="digest.upcoming.card"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <CalendarDays size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Upcoming This Week
              </p>
              <p className="text-xs text-muted-foreground">
                {seedUpcoming.length} due items
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {seedUpcoming.slice(0, 4).map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0"
              >
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    item.type === "assessment"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {item.type === "assessment" ? "Quiz" : "Hw"}
                </span>
                <span className="text-xs text-foreground flex-1 truncate">
                  {item.title}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {item.dueDate}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          data-ocid="digest.attendance.card"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <Users size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Attendance Summary
              </p>
              <p className="text-xs text-muted-foreground">This week</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Days Present
              </span>
              <span className="text-sm font-semibold text-green-700">
                {attendanceSummary.present}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Absences</span>
              <span className="text-sm font-semibold text-red-600">
                {attendanceSummary.absent}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-xs font-medium text-foreground">
                Attendance Rate
              </span>
              <span className="text-sm font-bold text-foreground">
                {attendanceSummary.rate}
              </span>
            </div>
          </div>
        </div>

        {/* Announcements */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          data-ocid="digest.announcements.card"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Megaphone size={16} className="text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Announcements
              </p>
              <p className="text-xs text-muted-foreground">
                {seedAnnouncements.length} pinned
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {seedAnnouncements.slice(0, 3).map((a) => (
              <div
                key={a.title}
                className="py-1 border-b border-border/30 last:border-0"
              >
                <p className="text-xs font-medium text-foreground">{a.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {a.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Behavior Highlights */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          data-ocid="digest.behavior.card"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Star size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Behavior Highlights
              </p>
              <p className="text-xs text-muted-foreground">
                Praise entries this week
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Praise Logged
              </span>
              <span className="text-2xl font-bold text-amber-600">
                {praiseCount}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {praiseCount >= 5
                ? "Great week — lots of positive recognition! 🌟"
                : "A few highlights logged this week."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Communication() {
  const routerState = useRouterState();

  const [activeTab, setActiveTab] = useState<CommTab>(() =>
    getTabFromSearch(routerState.location.search),
  );

  useEffect(() => {
    setActiveTab(getTabFromSearch(routerState.location.search));
  }, [routerState.location.search]);

  return (
    <div className="space-y-5">
      <PillTabs
        tabs={[
          {
            value: "messages" as const,
            label: "Messages",
            icon: <MessageSquare size={14} />,
          },
          {
            value: "announcements" as const,
            label: "Announcements",
            icon: <Megaphone size={14} />,
          },
          {
            value: "digest" as const,
            label: "Weekly Digest",
            icon: <CalendarDays size={14} />,
          },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "messages" && <MessagesView />}
      {activeTab === "announcements" && <AnnouncementsView />}
      {activeTab === "digest" && <WeeklyDigestView />}
    </div>
  );
}
