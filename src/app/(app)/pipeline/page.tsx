import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { listDeals } from "@/lib/repositories/deals";
import { defaultPipeline, listPipelines, listStages } from "@/lib/repositories/pipelines";
import { listUsers } from "@/lib/repositories/users";
import { listCompanies } from "@/lib/repositories/companies";

export const dynamic = "force-dynamic";
export const metadata = { title: "파이프라인" };

export default async function PipelinePage() {
  const pipeline = await defaultPipeline();

  if (!pipeline) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <PageHeader title="파이프라인" />
        <EmptyState
          title="파이프라인이 없습니다"
          description="npm run db:seed 를 실행해 기본 파이프라인과 데모 데이터를 생성하세요."
        />
      </div>
    );
  }

  const [pipelines, stages, deals, users, companies] = await Promise.all([
    listPipelines(),
    listStages(pipeline.id),
    listDeals({ pipelineId: pipeline.id }),
    listUsers(),
    listCompanies(),
  ]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="파이프라인"
        description="카드를 끌어다 놓아 단계를 이동하거나, 카드 하단 선택 상자로 이동할 수 있습니다."
      />
      <PipelineBoard
        pipelines={pipelines}
        pipeline={pipeline}
        stages={stages}
        initialDeals={deals}
        users={users}
        companies={companies}
      />
    </div>
  );
}
