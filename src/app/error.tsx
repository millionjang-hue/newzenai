"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary. Production builds strip the error message, so this
 * points at the usual causes rather than pretending to know which one it was.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid min-h-screen max-w-lg place-items-center px-6">
      <div className="w-full rounded-xl border border-line bg-surface-1 p-6 shadow-[var(--shadow-sm)]">
        <h1 className="text-base font-semibold text-ink">화면을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-ink-2">
          대부분 데이터베이스에 연결하지 못해서 생기는 문제입니다. 다음을 확인해 주세요.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>
            <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">DATABASE_URL</code> 이
            올바른지, 서버리스라면 풀링된 엔드포인트인지
          </li>
          <li>데이터베이스가 이 서버의 접속을 허용하는지 (네트워크·SSL 설정)</li>
          <li>서버 로그에 남은 자세한 오류 메시지</li>
        </ul>
        {error.digest ? (
          <p className="mt-3 text-[11px] text-ink-3">
            오류 ID: <code className="text-[11px]">{error.digest}</code>
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
