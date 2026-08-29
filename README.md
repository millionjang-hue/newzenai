# NewZen CRM

리드 유입부터 파이프라인 관리, 매출 분석까지 한 화면에서 처리하는 사내용 CRM 웹 애플리케이션입니다.
Next.js(App Router) + TypeScript + PostgreSQL 로 구성되어 있으며, 데모 데이터 생성기가
포함되어 있어 데이터베이스만 연결하면 바로 전체 흐름을 확인할 수 있습니다.

## 화면 구성

| 탭 | 경로 | 내용 |
|---|---|---|
| 대시보드 | `/dashboard` | 12개월 실적 요약, 매출 추이, 마감 임박 기회, 예정 업무, 담당자 실적 |
| 리드 | `/leads` | 리드 목록(검색·필터·정렬·페이지네이션), 상세 드로어, 활동 기록, 영업 기회 전환 |
| 파이프라인 | `/pipeline` | 단계별 칸반 보드(드래그 앤 드롭), 단계별 금액·가중 예측, 기회 상세, 수주/실패 처리 |
| 분석 | `/analytics` | KPI, 매출·파이프라인 추이, 전환 퍼널, 단계 체류 기간, 유입 경로/담당자 성과, 실패 사유 |
| 고객사 | `/companies` | 회사 계정별 담당자 수, 진행 중 금액, 누적 매출 |
| 연락처 | `/contacts` | 고객사 담당자 목록 |

## 실행하기

PostgreSQL 데이터베이스 하나와 Node.js 20.9 이상이 필요합니다.

### 1) Docker로 한 번에 (가장 간단)

```bash
docker compose up --build
```

PostgreSQL과 앱이 함께 뜨고 <http://localhost:3000> 에서 열립니다.
데이터는 `crm-pgdata` 볼륨에 남습니다.

### 2) 데이터베이스만 Docker로, 앱은 로컬에서

```bash
docker compose up -d db
cp .env.example .env.local          # DATABASE_URL 기본값이 이 DB를 가리킵니다
npm install
npm run dev                          # http://localhost:3000
```

### 3) 관리형 PostgreSQL 사용 (Neon·Supabase 등)

`.env.local` 에 접속 문자열만 넣으면 됩니다. Vercel 배포에 쓰는 것과 같은 URL을
그대로 쓸 수 있습니다.

```bash
echo 'DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require' > .env.local
npm install
npm run dev
```

어느 방법이든 **테이블이 비어 있으면 첫 요청 때 스키마를 만들고 데모 데이터를
자동으로 채웁니다**(약 1초). 별도의 시드 명령을 실행할 필요가 없습니다.
빈 상태로 시작하려면 `CRM_AUTO_SEED=0` 을 설정하세요.

프로덕션으로 실행:

```bash
npm run build
npm start
```

### 기타 스크립트

```bash
npm run db:seed     # 데모 데이터 다시 채우기 (기존 데이터는 지워집니다)
npm run db:reset    # 테이블을 드롭하고 스키마부터 다시 생성
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## Vercel 배포

화면에서 무엇을 누르면 되는지는 **[docs/DEPLOY.md](docs/DEPLOY.md)** 에 단계별로 정리해
두었습니다. 요약하면:

1. GitHub 저장소의 기본 브랜치를 `main` 으로 맞춥니다 (Vercel은 기본 브랜치를 배포합니다).
2. <https://vercel.com/new> 에서 저장소를 Import 합니다 — Next.js로 자동 인식되므로
   빌드 설정은 건드릴 것이 없습니다.
3. 프로젝트 → Storage → Create Database → **Neon** 을 연결합니다.
   연동이 `DATABASE_URL` 을 자동으로 주입합니다.
4. Redeploy 합니다. 첫 요청 때 스키마와 데모 데이터가 만들어집니다.

`DATABASE_URL` 이 없으면 흰 화면 대신 설정 안내 화면이 뜨므로, 무엇이 빠졌는지 바로
알 수 있습니다.

## 데이터 모델

PostgreSQL 스키마는 `src/lib/db/schema.ts` 한 곳에 정의되어 있고, 첫 요청 때 자동으로 적용됩니다.

```
users ────────┬── leads ──(전환)──┐
              ├── deals ──────────┴── deal_stage_events   (단계 이동 이력)
              └── activities                              (통화·이메일·미팅·메모·할 일)

companies ── contacts
pipelines ── stages                                       (단계와 성공 확률은 데이터로 관리)
```

설계상의 요점:

- **단계는 하드코딩하지 않습니다.** `pipelines` / `stages` 테이블로 관리되므로 보드 UI와
  확률 가중치가 데이터에 따라 바뀝니다. 기본으로 `신규 영업`, `업셀 / 갱신` 두 개가 생성됩니다.
- **모든 단계 이동은 `deal_stage_events` 에 기록됩니다.** 현재 상태만 보고 추정하지 않기 때문에
  전환 퍼널·단계별 체류 기간을 이미 종료된 기회까지 포함해 정확히 계산할 수 있습니다.
- **리드 전환은 하나의 트랜잭션입니다.** 회사·연락처를 생성(또는 재사용)하고, 기본 파이프라인의
  첫 단계에 기회를 만들고, 리드에 쌓인 활동 이력을 기회로 옮긴 뒤 리드를 `converted` 로 마감합니다.

## 프로젝트 구조

```
src/
  app/
    (app)/            대시보드·리드·파이프라인·분석·고객사·연락처 페이지 (서버 컴포넌트)
    api/              REST 엔드포인트
  components/
    charts/           차트 (SVG 직접 렌더링, 외부 차트 라이브러리 없음)
    leads/            리드 워크스페이스·드로어·등록 폼
    pipeline/         칸반 보드·기회 드로어·등록 폼
    ui/               카드, 배지, 아바타 등 공통 요소
  lib/
    db/               PostgreSQL 풀, 스키마, 데모 데이터 생성기
    repositories/     도메인별 쿼리 계층 (leads / deals / activities / analytics / …)
    types.ts          공용 도메인 타입
scripts/seed.ts       데모 데이터 생성 CLI (생성기 본체는 src/lib/db/seed.ts)
scripts/reset.ts      테이블 드롭 → 스키마 재생성 → 재시드
Dockerfile            standalone 빌드 기반 컨테이너 이미지
docker-compose.yml    PostgreSQL + 앱
```

UI 레이어는 `repositories/` 를 통해서만 DB에 접근합니다. 다른 데이터베이스로 옮길 때
바꿔야 할 곳은 `src/lib/db` 와 이 계층뿐입니다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` / `POST` | `/api/leads` | 목록(검색·필터·정렬·페이징) / 생성 |
| `GET` / `PATCH` / `DELETE` | `/api/leads/:id` | 조회 / 수정 / 삭제 |
| `POST` | `/api/leads/:id/convert` | 리드를 영업 기회로 전환 |
| `GET` / `POST` | `/api/leads/:id/activities` | 활동 이력 조회 / 기록 |
| `GET` / `POST` | `/api/deals` | 목록 / 생성 |
| `GET` / `PATCH` / `DELETE` | `/api/deals/:id` | 조회 / 수정 / 삭제 |
| `POST` | `/api/deals/:id/move` | 단계 이동 + 보드 정렬 반영 |
| `GET` / `POST` | `/api/deals/:id/activities` | 활동 이력 조회 / 기록 |
| `GET` | `/api/pipelines`, `/api/pipelines/:id/stages` | 파이프라인·단계 |
| `GET` | `/api/analytics?months=12` | 분석 탭과 동일한 지표를 JSON으로 |

## 데모 데이터

`src/lib/db/seed.ts` 는 결정적(seed 고정) 생성기입니다. 앱이 처음 뜰 때 자동으로,
또는 `npm run db:seed` 로 직접 호출됩니다. 오늘 기준 27개월 구간에 대해
사용자 8명, 고객사 48곳, 연락처 약 130명, 리드 560건, 영업 기회 약 410건,
단계 이동 이력 약 1,400건, 활동 약 3,800건을 만듭니다.

숫자가 서로 앞뒤가 맞도록 생성됩니다. 기회는 이전 단계를 거친 뒤에만 종료되고,
활동량은 기회 규모를 따라가며, 담당자마다 성과 편차가 있어 분석 탭의 순위가 의미를 갖습니다.

다른 데이터셋이 필요하면 시드 값을 바꾸세요:

```bash
CRM_SEED=1234 npm run db:reset
```

## 설정

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL 접속 문자열. **필수** |
| `CRM_AUTO_SEED` | `1` | `0` 이면 빈 DB에 데모 데이터를 채우지 않습니다 |
| `CRM_SEED` | `20260829` | 데모 데이터 생성 시드 |
| `PGPOOL_MAX` | Vercel `1`, 그 외 `10` | 인스턴스당 커넥션 수 |

## 배포 메모

- **Vercel**: 위의 "Vercel 배포" 절차를 따르면 됩니다. 서버리스 환경에서는 인스턴스마다
  커넥션 풀이 따로 생기므로 `PGPOOL_MAX` 기본값이 `1` 이고, 풀링된 엔드포인트 사용을
  권장합니다.
- **컨테이너 (Fly.io, Railway, VPS 등)**: `Dockerfile` 로 바로 배포할 수 있습니다.
  빌드가 `output: "standalone"` 이라 이미지에 `node server.js` 만 있으면 되고,
  이미지 자체는 상태를 갖지 않습니다 — 데이터는 전부 `DATABASE_URL` 쪽에 있습니다.
- **데이터 계층 교체**: SQL은 `src/lib/db/schema.ts` 와 `src/lib/repositories/` 안에만
  있습니다. 다른 데이터베이스로 옮기더라도 이 두 곳 밖은 손댈 일이 없습니다.

## 요구 사항

- Node.js 20.9 이상 (`.nvmrc` 는 22 LTS)
- PostgreSQL 14 이상 — 또는 Docker
