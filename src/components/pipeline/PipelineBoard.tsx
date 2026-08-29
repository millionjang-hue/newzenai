"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Badge, cx } from "@/components/ui/primitives";
import { DealDrawer } from "@/components/pipeline/DealDrawer";
import { NewDealDialog } from "@/components/pipeline/NewDealDialog";
import { formatCompactCurrency, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import type { Company, DealWithRelations, Pipeline, Stage, User } from "@/lib/types";

export function PipelineBoard({
  pipelines,
  pipeline,
  stages,
  initialDeals,
  users,
  companies,
}: {
  pipelines: Pipeline[];
  pipeline: Pipeline;
  stages: Stage[];
  initialDeals: DealWithRelations[];
  users: User[];
  companies: Company[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [activePipeline, setActivePipeline] = useState(pipeline.id);
  const [activeStages, setActiveStages] = useState(stages);
  const [owner, setOwner] = useState("all");
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const requestId = useRef(0);

  const load = useCallback(
    async (pipelineId: string) => {
      const id = ++requestId.current;
      setPending(true);
      try {
        const [dealsResponse, stagesResponse] = await Promise.all([
          fetch(`/api/deals?pipeline=${pipelineId}`),
          fetch(`/api/pipelines/${pipelineId}/stages`),
        ]);
        const dealsPayload = (await dealsResponse.json()) as { data: DealWithRelations[] };
        const stagesPayload = (await stagesResponse.json()) as { data: Stage[] };
        if (id !== requestId.current) return;
        setDeals(dealsPayload.data ?? []);
        setActiveStages(stagesPayload.data ?? []);
      } catch {
        if (id === requestId.current) setError("보드를 불러오지 못했습니다.");
      } finally {
        if (id === requestId.current) setPending(false);
      }
    },
    [],
  );

  const refresh = useCallback(() => void load(activePipeline), [load, activePipeline]);

  const switchPipeline = (pipelineId: string) => {
    setActivePipeline(pipelineId);
    void load(pipelineId);
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals.filter((deal) => {
      if (owner !== "all" && deal.owner_id !== owner) return false;
      if (!term) return true;
      return (
        deal.title.toLowerCase().includes(term) ||
        (deal.company_name ?? "").toLowerCase().includes(term) ||
        (deal.contact_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [deals, owner, search]);

  const columns = useMemo(
    () =>
      activeStages.map((stage) => {
        const columnDeals = visible
          .filter((deal) => deal.stage_id === stage.id)
          .sort((a, b) => a.position - b.position);
        return {
          stage,
          deals: columnDeals,
          total: columnDeals.reduce((sum, deal) => sum + deal.amount, 0),
          weighted: columnDeals.reduce((sum, deal) => sum + deal.amount * deal.probability, 0),
        };
      }),
    [activeStages, visible],
  );

  const openTotal = columns
    .filter((column) => column.stage.kind === "open")
    .reduce((sum, column) => sum + column.total, 0);
  const weightedTotal = columns
    .filter((column) => column.stage.kind === "open")
    .reduce((sum, column) => sum + column.weighted, 0);

  const moveDeal = async (dealId: string, stageId: string) => {
    const deal = deals.find((item) => item.id === dealId);
    const stage = activeStages.find((item) => item.id === stageId);
    if (!deal || !stage || deal.stage_id === stageId) return;

    const previous = deals;
    const orderedIds = [
      ...visible.filter((item) => item.stage_id === stageId).map((item) => item.id),
      dealId,
    ];

    // Optimistic: repaint the board first, reconcile with the server after.
    setDeals((current) =>
      current.map((item) =>
        item.id === dealId
          ? {
              ...item,
              stage_id: stage.id,
              stage_name: stage.name,
              stage_kind: stage.kind,
              stage_position: stage.position,
              status: stage.kind,
              probability: stage.kind === "won" ? 1 : stage.kind === "lost" ? 0 : stage.probability,
              position: orderedIds.length * 1000,
            }
          : item,
      ),
    );
    setError(null);

    try {
      const response = await fetch(`/api/deals/${dealId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId, ordered_ids: orderedIds }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "이동 실패");
      refresh();
    } catch (cause) {
      setDeals(previous);
      setError(cause instanceof Error ? cause.message : "이동에 실패했습니다.");
    }
  };

  const selectedDeal = deals.find((deal) => deal.id === selected) ?? null;
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-surface-1 p-0.5" role="tablist">
          {pipelines.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activePipeline === item.id}
              onClick={() => switchPipeline(item.id)}
              className={cx(
                "rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors",
                activePipeline === item.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "text-ink-3 hover:text-ink",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="기회명, 고객사 검색"
          aria-label="영업 기회 검색"
          className="min-w-[160px] flex-1 rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-xs"
        />

        <label className="relative">
          <span className="sr-only">담당자 필터</span>
          <select
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            className="rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs text-ink-2"
          >
            <option value="all">전체 담당자</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          + 신규 기회
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-line bg-surface-1 px-4 py-3 text-xs shadow-[var(--shadow-sm)]">
        <span className="text-ink-2">
          진행 중 합계{" "}
          <strong className="tabular ml-1 text-sm text-ink">
            {formatCompactCurrency(openTotal)}
          </strong>
        </span>
        <span className="text-ink-2">
          가중 예측{" "}
          <strong className="tabular ml-1 text-sm text-ink">
            {formatCompactCurrency(weightedTotal)}
          </strong>
        </span>
        <span className="text-ink-3">
          {formatNumber(visible.filter((deal) => deal.status === "open").length)}건 진행 중 · 전체{" "}
          {formatNumber(visible.length)}건
        </span>
        {pending ? <span className="text-ink-3">동기화 중…</span> : null}
        {error ? <span className="text-[var(--status-critical)]">{error}</span> : null}
      </div>

      <div className="thin-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
        {columns.map((column) => {
          const isDropTarget = dropTarget === column.stage.id;
          return (
            <section
              key={column.stage.id}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(column.stage.id);
              }}
              onDragLeave={() => setDropTarget((current) => (current === column.stage.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setDropTarget(null);
                const dealId = event.dataTransfer.getData("text/plain") || dragging;
                if (dealId) void moveDeal(dealId, column.stage.id);
                setDragging(null);
              }}
              className={cx(
                "flex w-[272px] shrink-0 flex-col rounded-xl border bg-surface-2/50 transition-colors",
                isDropTarget ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line",
              )}
            >
              <header className="border-b border-line px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: stageColor(column.stage) }}
                      aria-hidden="true"
                    />
                    {column.stage.name}
                  </span>
                  <span className="tabular rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-ink-2">
                    {column.deals.length}
                  </span>
                </div>
                <p className="tabular mt-1 text-[11px] text-ink-2">
                  {formatCompactCurrency(column.total)}
                  {column.stage.kind === "open" ? (
                    <span className="ml-1.5 text-ink-3">
                      가중 {formatCompactCurrency(column.weighted)}
                    </span>
                  ) : null}
                </p>
              </header>

              <ul className="thin-scroll flex max-h-[calc(100vh-330px)] flex-col gap-2 overflow-y-auto p-2">
                {column.deals.map((deal) => {
                  const overdue =
                    deal.status === "open" &&
                    !!deal.expected_close_date &&
                    deal.expected_close_date < today;
                  return (
                    <li key={deal.id}>
                      <article
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", deal.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDragging(deal.id);
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setDropTarget(null);
                        }}
                        onClick={() => setSelected(deal.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") setSelected(deal.id);
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${deal.title}, ${column.stage.name}`}
                        className={cx(
                          "group cursor-grab rounded-lg border border-line bg-surface-1 p-2.5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
                          dragging === deal.id && "opacity-40",
                        )}
                      >
                        <p className="line-clamp-2 text-xs font-medium leading-snug text-ink">
                          {deal.title}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-ink-3">
                          {deal.contact_name ?? deal.company_name ?? "담당자 미지정"}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="tabular text-xs font-semibold text-ink">
                            {formatCompactCurrency(deal.amount)}
                          </span>
                          {deal.owner_name ? (
                            <Avatar
                              name={deal.owner_name}
                              color={deal.owner_color}
                              size={20}
                              title={deal.owner_name}
                            />
                          ) : null}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                          <span className="tabular text-[10px] text-ink-3">
                            {deal.status === "open"
                              ? `${formatPercent(deal.probability, 0)} · ${formatRelative(deal.expected_close_date)}`
                              : formatRelative(deal.closed_at)}
                          </span>
                          {overdue ? <Badge tone="critical">지연</Badge> : null}
                        </div>

                        <label
                          className="relative block h-0 overflow-hidden opacity-0 transition-all group-hover:mt-2 group-hover:h-7 group-hover:opacity-100 group-focus-within:mt-2 group-focus-within:h-7 group-focus-within:opacity-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span className="sr-only">{deal.title} 단계 변경</span>
                          <select
                            value={deal.stage_id}
                            onChange={(event) => void moveDeal(deal.id, event.target.value)}
                            className="w-full rounded-md border border-line bg-surface-2 px-1.5 py-1 text-[10px] text-ink-2"
                          >
                            {activeStages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}(으)로 이동
                              </option>
                            ))}
                          </select>
                        </label>
                      </article>
                    </li>
                  );
                })}

                {column.deals.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[11px] text-ink-3">
                    카드를 여기로 끌어다 놓으세요
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      {selectedDeal ? (
        <DealDrawer
          deal={selectedDeal}
          stages={activeStages}
          users={users}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      ) : null}

      {creating ? (
        <NewDealDialog
          stages={activeStages}
          pipelineId={activePipeline}
          users={users}
          companies={companies}
          onClose={() => setCreating(false)}
          onCreated={refresh}
        />
      ) : null}
    </>
  );
}

function stageColor(stage: Stage): string {
  if (stage.kind === "won") return "var(--status-good)";
  if (stage.kind === "lost") return "var(--status-critical)";
  const ramp = ["var(--seq-650)", "var(--seq-550)", "var(--seq-450)", "var(--seq-350)"];
  return ramp[stage.position % ramp.length]!;
}
