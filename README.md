# NewZen CRM

리드 유입부터 파이프라인 관리, 매출 분석까지 한 화면에서 처리하는 사내용 CRM 웹 애플리케이션입니다.
Next.js(App Router) + TypeScript + SQLite 로 구성되어 있으며, 데모 데이터가 포함되어 있어
`npm install` 이후 바로 실행해 전체 흐름을 확인할 수 있습니다.

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

Node.js 22.13 이상이 필요합니다 (Node에 내장된 `node:sqlite` 를 사용합니다).
`nvm` 을 쓰신다면 프로젝트 폴더에서 `nvm install && nvm use` 로 맞출 수 있습니다.
버전이 낮으면 실행 시 안내 메시지와 함께 바로 중단됩니다.

```bash
npm install
npm run dev
```

끝입니다. <http://localhost:3000> 을 열면 됩니다.
데이터베이스 파일이 없으면 첫 요청 때 `data/crm.db` 를 만들고 데모 데이터를
자동으로 채웁니다(약 0.1초). 별도의 시드 명령을 실행할 필요가 없습니다.

프로덕션으로 실행:

```bash
npm run build
npm start
```

### Docker로 실행

Node를 설치하지 않고 바로 띄우려면:

```bash
docker compose up --build
```

<http://localhost:3000> 에서 열립니다. SQLite 파일은 `crm-data` 볼륨에 보관되므로
다시 빌드해도 데이터가 유지됩니다.

### 기타 스크립트

```bash
npm run db:seed     # 데모 데이터 다시 채우기 (기존 데이터는 지워집니다)
npm run db:reset    # DB 파일 삭제 후 재생성
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

빈 상태로 시작하고 싶다면 `CRM_AUTO_SEED=0` 을 설정하세요. 스키마만 만들어지고
데모 데이터는 채우지 않습니다.

## 데이터 모델

SQLite 스키마는 `src/lib/db/schema.ts` 한 곳에 정의되어 있고, 앱 기동 시 자동으로 적용됩니다.

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
    db/               SQLite 커넥션, 스키마, 데모 데이터 생성기
    repositories/     도메인별 쿼리 계층 (leads / deals / activities / analytics / …)
    types.ts          공용 도메인 타입
scripts/seed.ts       데모 데이터 생성 CLI (생성기 본체는 src/lib/db/seed.ts)
Dockerfile            standalone 빌드 기반 컨테이너 이미지
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
| `CRM_DATABASE_PATH` | `./data/crm.db` | SQLite 파일 경로 (절대 경로 가능) |
| `CRM_SEED` | `20260829` | 데모 데이터 생성 시드 |
| `CRM_AUTO_SEED` | `1` | `0` 이면 빈 DB에 데모 데이터를 채우지 않습니다 |

## 배포 메모

현재 저장 계층은 Node.js 내장 `node:sqlite` 를 사용하는 단일 파일 DB입니다.
로컬 실행과 영구 디스크가 있는 호스팅(예: 컨테이너 + 볼륨, Fly.io, Railway, VPS)에는
동봉된 `Dockerfile` 로 그대로 배포할 수 있습니다. 빌드는 `output: "standalone"` 이라
이미지에 `node server.js` 만 있으면 됩니다.

반면 파일시스템이 유지되지 않는 서버리스 환경(Vercel 등)에 올릴 때는 `src/lib/db` 와
`src/lib/repositories` 를 관리형 데이터베이스(Postgres 등)로 교체해야 합니다.
스키마(`schema.ts`)와 쿼리가 한곳에 모여 있어 교체 범위는 이 두 디렉터리로 한정됩니다.

## 요구 사항

- Node.js 22.13 이상 (`node:sqlite` 사용) — 또는 Docker
