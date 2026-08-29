import { Badge, Card, EmptyState, MiniBar, PageHeader } from "@/components/ui/primitives";
import { listCompanies } from "@/lib/repositories/companies";
import { formatCompactCurrency, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "고객사" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q ?? "";
  const companies = listCompanies(search);
  const maxValue = Math.max(1, ...companies.map((company) => company.won_value + company.open_value));
  const totalWon = companies.reduce((sum, company) => sum + company.won_value, 0);
  const totalOpen = companies.reduce((sum, company) => sum + company.open_value, 0);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="고객사"
        description={`${formatNumber(companies.length)}개 계정 · 확정 ${formatCompactCurrency(totalWon)} · 진행 중 ${formatCompactCurrency(totalOpen)}`}
        actions={
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={search}
              placeholder="회사명, 산업군 검색"
              aria-label="고객사 검색"
              className="rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:text-ink"
            >
              검색
            </button>
          </form>
        }
      />

      {companies.length === 0 ? (
        <EmptyState title="검색 결과가 없습니다" description="다른 검색어를 입력해 보세요." />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="border-b border-line bg-surface-2/60">
                <tr className="text-left text-[11px] text-ink-3">
                  <th className="px-4 py-2.5 font-medium">회사</th>
                  <th className="px-4 py-2.5 font-medium">산업군</th>
                  <th className="px-4 py-2.5 font-medium">규모</th>
                  <th className="px-4 py-2.5 font-medium">국가</th>
                  <th className="px-4 py-2.5 text-right font-medium">담당자</th>
                  <th className="px-4 py-2.5 text-right font-medium">진행 중</th>
                  <th className="px-4 py-2.5 font-medium">누적 매출</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {companies.map((company) => (
                  <tr key={company.id} className="transition-colors hover:bg-surface-2/60">
                    <td className="px-4 py-2.5">
                      <span className="block font-medium text-ink">{company.name}</span>
                      <span className="block truncate text-[11px] text-ink-3">
                        {company.domain ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{company.industry}</td>
                    <td className="px-4 py-2.5">
                      <Badge>{company.size}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{company.country}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-2">
                      {company.contact_count}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-2">
                      {formatCompactCurrency(company.open_value)}
                      <span className="ml-1 text-[10px] text-ink-3">
                        ({company.open_deal_count}건)
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="tabular mb-1 block font-semibold text-ink">
                        {formatCompactCurrency(company.won_value)}
                      </span>
                      <span className="block w-28">
                        <MiniBar value={company.won_value} max={maxValue} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
