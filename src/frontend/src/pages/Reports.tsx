import { FileText, GraduationCap } from "lucide-react";
import { useState } from "react";
import { PillTabs } from "../components/shared/PillTabs";
import ProgressReports from "./ProgressReports";
import ReportCards from "./ReportCards";

type ReportTab = "progress" | "cards";

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>("progress");

  return (
    <div className="space-y-5">
      {/* Pill tab navigation — inline at top of content area, not in header */}
      <PillTabs
        tabs={[
          {
            value: "progress" as const,
            label: "Progress Reports",
            icon: <FileText size={14} />,
          },
          {
            value: "cards" as const,
            label: "Report Cards",
            icon: <GraduationCap size={14} />,
          },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab panels */}
      <div role="tabpanel">
        {activeTab === "progress" ? <ProgressReports /> : <ReportCards />}
      </div>
    </div>
  );
}
