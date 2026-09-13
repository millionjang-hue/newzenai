/**
 * Fails fast on an unsupported runtime instead of surfacing a confusing error
 * from deep inside the Next.js build.
 */
const REQUIRED = [20, 9, 0];

const current = process.versions.node.split(".").map(Number);
const ok =
  current[0] > REQUIRED[0] ||
  (current[0] === REQUIRED[0] &&
    (current[1] > REQUIRED[1] || (current[1] === REQUIRED[1] && current[2] >= REQUIRED[2])));

if (!ok) {
  console.error(
    [
      "",
      `  ✗ Node.js ${REQUIRED.join(".")} 이상이 필요합니다. 현재 버전: ${process.versions.node}`,
      "",
      "    nvm 을 쓰신다면 프로젝트 폴더에서:",
      "",
      "      nvm install && nvm use",
      "",
      "    그 외에는 https://nodejs.org 에서 22 LTS 를 설치해 주세요.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
