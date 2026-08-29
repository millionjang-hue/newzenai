import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { listContacts } from "@/lib/repositories/companies";
import { formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "연락처" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q ?? "";
  const contacts = listContacts(search);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="연락처"
        description={`${formatNumber(contacts.length)}명의 고객사 담당자`}
        actions={
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={search}
              placeholder="이름, 이메일, 회사 검색"
              aria-label="연락처 검색"
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

      {contacts.length === 0 ? (
        <EmptyState title="검색 결과가 없습니다" description="다른 검색어를 입력해 보세요." />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="border-b border-line bg-surface-2/60">
                <tr className="text-left text-[11px] text-ink-3">
                  <th className="px-4 py-2.5 font-medium">이름</th>
                  <th className="px-4 py-2.5 font-medium">회사</th>
                  <th className="px-4 py-2.5 font-medium">직함</th>
                  <th className="px-4 py-2.5 font-medium">이메일</th>
                  <th className="px-4 py-2.5 font-medium">연락처</th>
                  <th className="px-4 py-2.5 text-right font-medium">진행 중</th>
                  <th className="px-4 py-2.5 font-medium">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="transition-colors hover:bg-surface-2/60">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <Avatar
                          name={`${contact.last_name}${contact.first_name}`}
                          color="var(--border-strong)"
                          size={24}
                        />
                        <span className="font-medium text-ink">
                          {contact.last_name}
                          {contact.first_name}
                        </span>
                        {contact.is_primary ? <Badge tone="accent">주 담당</Badge> : null}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{contact.company_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-2">{contact.title ?? "—"}</td>
                    <td className="tabular px-4 py-2.5 text-ink-3">{contact.email}</td>
                    <td className="tabular px-4 py-2.5 text-ink-3">{contact.phone ?? "—"}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-2">
                      {contact.open_deal_count}
                    </td>
                    <td className="px-4 py-2.5 text-ink-3">{formatDate(contact.created_at)}</td>
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
