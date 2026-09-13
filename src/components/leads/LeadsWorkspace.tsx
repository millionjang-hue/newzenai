"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Badge, Card, EmptyState, MiniBar, cx } from "@/components/ui/primitives";
import { CompositionBar } from "@/components/charts/CompositionBar";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { NewLeadDialog } from "@/components/leads/NewLeadDialog";
import { STATUS_COLOR, STATUS_LABEL, STATUS_TONE } from "@/components/leads/constants";
import {
  formatCompactCurrency,
  formatNumber,
  formatPercent,
  formatRelative,
} from "@/lib/format";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadStatus,
  type LeadWithOwner,
  type User,
} from "@/lib/types";

type Sort = "created_desc" | "created_asc" | "score_desc" | "value_desc" | "touch_asc";

const SORT_LABEL: Record<Sort, string> = {
  created_desc: "최신 등록순",
  created_asc: "오래된 순",
  score_desc: "점수 높은 순",
  value_desc: "예상 규모 순",
  touch_asc: "오래 방치된 순",
};

export function LeadsWorkspace({
  initialLeads,
  initialTotal,
  statusCounts,
  users,
}: {
  initialLeads: LeadWithOwner[];
  initialTotal: number;
  statusCounts: Record<string, number>;
  users: User[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [total, setTotal] = useState(initialTotal);
  const [counts, setCounts] = useState(statusCounts);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [owner, setOwner] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<Sort>("created_desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Debounced so typing in the search box does not fire a request per keystroke.
  const debounced = useDebounced(search, 250);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: debounced,
        status,
        owner,
        source,
        sort,
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      const response = await fetch(`/api/leads?${params}`);
      const payload = (await response.json()) as {
        data: LeadWithOwner[];
        total: number;
        counts: Record<string, number>;
      };
      if (id !== requestId.current) return;
      setLeads(payload.data ?? []);
      setTotal(payload.total ?? 0);
      setCounts(payload.counts ?? {});
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [debounced, status, owner, source, sort, page, pageSize]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void refresh();
  }, [refresh]);

  // Any filter change invalidates the current page offset.
  const filterKey = `${debounced}|${status}|${owner}|${source}|${sort}|${pageSize}`;
  const lastFilterKey = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    setPage(0);
  }, [filterKey]);

  const selectedLead = leads.find((lead) => lead.id === selected) ?? null;
  const filtered = status === "all";

  const summary = useMemo(() => {
    const counted = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const qualified = counts.qualified ?? 0;
    const converted = counts.converted ?? 0;
    return {
      // Value is page-scoped; counts come from the server for the whole filter.
      pipelineValue: leads.reduce((sum, lead) => sum + lead.estimated_value, 0),
      qualified,
      converted,
      conversion: counted > 0 ? converted / counted : 0,
      avgScore:
        leads.length > 0 ? leads.reduce((sum, lead) => sum + lead.score, 0) / leads.length : 0,
    };
  }, [leads, counts]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="조회된 리드"
          value={formatNumber(total)}
          hint={filtered ? "전체 기준" : "필터 적용 기준"}
        />
        <Metric
          label="현재 페이지 예상 규모"
          value={formatCompactCurrency(summary.pipelineValue)}
          hint={`${formatNumber(leads.length)}건 합계`}
        />
        <Metric
          label="검증 완료"
          value={formatNumber(summary.qualified)}
          hint={`전환 ${formatNumber(summary.converted)}건`}
        />
        <Metric
          label="전환율"
          value={formatPercent(summary.conversion)}
          hint={`평균 점수 ${summary.avgScore.toFixed(0)}점`}
        />
      </div>

      <Card className="mt-4">
        <div className="mb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold text-ink">상태 분포</h2>
            <span className="text-[11px] text-ink-3">필터가 적용된 전체 결과 기준</span>
          </div>
          <CompositionBar
            format={formatNumber}
            segments={LEAD_STATUSES.map((value) => ({
              label: STATUS_LABEL[value],
              value: counts[value] ?? 0,
              color: STATUS_COLOR[value],
            }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="이름, 회사, 이메일 검색"
            aria-label="리드 검색"
            className="min-w-[180px] flex-1 rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-xs"
          />
          <FilterSelect
            label="상태"
            value={status}
            onChange={(value) => setStatus(value as LeadStatus | "all")}
            options={[
              { value: "all", label: "전체 상태" },
              ...LEAD_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] })),
            ]}
          />
          <FilterSelect
            label="담당자"
            value={owner}
            onChange={setOwner}
            options={[
              { value: "all", label: "전체 담당자" },
              ...users.map((user) => ({ value: user.id, label: user.name })),
            ]}
          />
          <FilterSelect
            label="유입 경로"
            value={source}
            onChange={setSource}
            options={[
              { value: "all", label: "전체 경로" },
              ...LEAD_SOURCES.map((value) => ({ value, label: value })),
            ]}
          />
          <FilterSelect
            label="정렬"
            value={sort}
            onChange={(value) => setSort(value as Sort)}
            options={(Object.keys(SORT_LABEL) as Sort[]).map((value) => ({
              value,
              label: SORT_LABEL[value],
            }))}
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            + 신규 리드
          </button>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden" padded={false}>
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="border-b border-line bg-surface-2/60">
              <tr className="text-left text-[11px] text-ink-3">
                <th className="px-4 py-2.5 font-medium">리드</th>
                <th className="px-4 py-2.5 font-medium">회사</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
                <th className="px-4 py-2.5 font-medium">경로</th>
                <th className="px-4 py-2.5 font-medium">점수</th>
                <th className="px-4 py-2.5 text-right font-medium">예상 규모</th>
                <th className="px-4 py-2.5 font-medium">담당자</th>
                <th className="px-4 py-2.5 font-medium">최근 접촉</th>
              </tr>
            </thead>
            <tbody className={cx("divide-y divide-[var(--border)]", loading && "opacity-60")}>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => setSelected(lead.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(lead.id);
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-surface-2/70 focus:bg-surface-2 focus:outline-none"
                >
                  <td className="px-4 py-2.5">
                    <span className="block font-medium text-ink">
                      {lead.last_name}
                      {lead.first_name}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3">{lead.email}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block truncate text-ink-2">{lead.company_name}</span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {lead.title ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{lead.source}</td>
                  <td className="px-4 py-2.5">
                    <span className="tabular mb-1 block font-semibold text-ink">{lead.score}</span>
                    <span className="block w-14">
                      <MiniBar
                        value={lead.score}
                        max={100}
                        color={
                          lead.score >= 70
                            ? "var(--series-3)"
                            : lead.score >= 45
                              ? "var(--series-4)"
                              : "var(--series-8)"
                        }
                      />
                    </span>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right font-medium text-ink">
                    {formatCompactCurrency(lead.estimated_value)}
                  </td>
                  <td className="px-4 py-2.5">
                    {lead.owner_name ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar name={lead.owner_name} color={lead.owner_color} size={20} />
                        <span className="truncate text-ink-2">{lead.owner_name}</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">미지정</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-3">
                    {formatRelative(lead.last_touch_at ?? lead.created_at)}
                    <span className="ml-1.5 text-[10px]">· 활동 {lead.activity_count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs">
          <span className="text-ink-3">
            {total === 0
              ? "결과 없음"
              : `${formatNumber(page * pageSize + 1)}–${formatNumber(
                  Math.min(total, page * pageSize + leads.length),
                )} / ${formatNumber(total)}건`}
          </span>
          <div className="flex items-center gap-2">
            <label className="relative flex items-center gap-1.5">
              <span className="text-ink-3">페이지당</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-line bg-surface-1 px-2 py-1 text-xs text-ink-2"
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="rounded-lg border border-line px-2.5 py-1 text-ink-2 disabled:opacity-40 hover:text-ink"
            >
              이전
            </button>
            <span className="tabular text-ink-3">
              {page + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page + 1 >= pageCount || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-line px-2.5 py-1 text-ink-2 disabled:opacity-40 hover:text-ink"
            >
              다음
            </button>
          </div>
        </div>

        {leads.length === 0 && !loading ? (
          <div className="p-4">
            <EmptyState
              title="조건에 맞는 리드가 없습니다"
              description="검색어나 필터를 조정하거나 새 리드를 등록해 보세요."
            />
          </div>
        ) : null}
      </Card>

      {selectedLead ? (
        <LeadDrawer
          lead={selectedLead}
          users={users}
          onClose={() => setSelected(null)}
          onChanged={() => void refresh()}
        />
      ) : null}

      {creating ? (
        <NewLeadDialog
          users={users}
          onClose={() => setCreating(false)}
          onCreated={() => void refresh()}
        />
      ) : null}
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4 shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{label}</p>
      <p className="tabular mt-1.5 text-xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-3">{hint}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs text-ink-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
