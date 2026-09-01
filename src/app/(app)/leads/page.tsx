import { PageHeader } from "@/components/ui/primitives";
import { LeadsWorkspace } from "@/components/leads/LeadsWorkspace";
import { countLeads, leadStatusCounts, listLeads } from "@/lib/repositories/leads";
import { listUsers } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "리드" };

export default async function LeadsPage() {
  const [leads, total, statusCounts, users] = await Promise.all([
    listLeads({ limit: 25 }),
    countLeads(),
    leadStatusCounts(),
    listUsers(),
  ]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="리드"
        description="유입된 잠재 고객을 검증하고 영업 기회로 전환합니다."
      />
      <LeadsWorkspace
        initialLeads={leads}
        initialTotal={total}
        statusCounts={statusCounts}
        users={users}
      />
    </div>
  );
}
