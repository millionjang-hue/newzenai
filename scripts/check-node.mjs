/**
 * The app stores data through Node's built-in `node:sqlite`, which is only
 * available without a flag from Node 22.13. Fail loudly and early rather than
 * with a confusing "Cannot find module 'node:sqlite'" halfway through a build.
 */
const REQUIRED = [22, 13, 0];

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
      "    이 앱은 Node에 내장된 node:sqlite 를 사용합니다.",
      "    nvm 을 쓰신다면 프로젝트 폴더에서:",
      "",
      "      nvm install && nvm use",
      "",
      "    그 외에는 https://nodejs.org 에서 22 LTS 이상을 설치해 주세요.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
