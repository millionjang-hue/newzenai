import { Card } from "@/components/ui/primitives";

/**
 * Shown instead of the app when `DATABASE_URL` is missing. Without this the
 * first deploy of a fresh project just returns a blank 500 and the reason is
 * only visible in the server logs.
 */
export function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card>
        <div className="flex items-start gap-3">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--status-warning)" }}
            aria-hidden="true"
          >
            !
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-ink">데이터베이스 설정이 필요합니다</h1>
            <p className="mt-1 text-sm text-ink-2">
              <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">DATABASE_URL</code> 환경
              변수가 설정되지 않았습니다. PostgreSQL 접속 문자열을 넣으면 첫 요청 때 스키마와 데모
              데이터가 자동으로 만들어집니다.
            </p>
          </div>
        </div>

        <section className="mt-5">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            Vercel에 배포한 경우
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
            <li>프로젝트 → Storage → Create Database → Neon 을 연결합니다.</li>
            <li>
              연동이 <code className="text-[12px]">DATABASE_URL</code> 을 자동으로 주입합니다.
            </li>
            <li>Deployments 에서 최신 배포를 Redeploy 합니다.</li>
          </ol>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            로컬에서 실행 중인 경우
          </h2>
          <pre className="thin-scroll overflow-x-auto rounded-lg border border-line bg-surface-2/60 p-3 text-[12px] leading-relaxed text-ink-2">
{`# 데이터베이스까지 한 번에
docker compose up --build

# 또는 .env.local 에 접속 문자열만 지정
echo 'DATABASE_URL=postgresql://user:pw@host/db' > .env.local
npm run dev`}
          </pre>
        </section>

        <p className="mt-5 text-[11px] text-ink-3">
          자세한 내용은 저장소의 <code className="text-[11px]">README.md</code> 와{" "}
          <code className="text-[11px]">docs/DEPLOY.md</code> 를 참고하세요.
        </p>
      </Card>
    </div>
  );
}
