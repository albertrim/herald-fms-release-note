// 모든 slack.com URL을 매칭 (webhook만 제외)
const SLACK_URL_PATTERN =
  /https?:\/\/[a-zA-Z0-9._-]+\.slack\.com\/[^\s"'<>)\]\\}]+/g;

const EXCLUDED_PATHS = ["hooks.slack.com"];

export interface SlackInfo {
  url: string;
  authorName: string | null;
}

/**
 * ADF JSON 문자열에서 Slack 링크와 연결된 사용자 이름을 추출
 * ADF 구조: {"type":"text","text":"@이충환 ...","marks":[{"type":"link","attrs":{"href":"https://fassto.slack.com/team/..."}}]}
 */
export function extractSlackInfo(adfJson: string): SlackInfo | null {
  if (!adfJson) return null;

  // ADF에서 link mark가 있는 text 노드를 찾아 slack URL + 텍스트를 추출
  const linkPattern = /"text"\s*:\s*"([^"]+)"\s*,\s*"marks"\s*:\s*\[\s*\{\s*"type"\s*:\s*"link"\s*,\s*"attrs"\s*:\s*\{\s*"href"\s*:\s*"(https?:\/\/[^"]*slack\.com\/[^"]+)"/g;

  let match;
  while ((match = linkPattern.exec(adfJson)) !== null) {
    const text = match[1];
    const url = match[2];

    if (EXCLUDED_PATHS.some((p) => url.includes(p))) continue;

    // 텍스트에서 풀네임 추출: "@이충환 스마트센터팀 / 팀장" → "이충환 스마트센터팀"
    const cleaned = text.replace(/^@/, "").replace(/\s*\/\s*.*$/, "").trim();
    return { url, authorName: cleaned || null };
  }

  // fallback: 일반 URL 매칭
  const regex = new RegExp(SLACK_URL_PATTERN.source, SLACK_URL_PATTERN.flags);
  const matches = adfJson.match(regex);
  if (!matches) return null;

  const validLinks = matches.filter(
    (url) => !EXCLUDED_PATHS.some((path) => url.includes(path))
  );

  if (validLinks.length === 0) return null;
  return { url: validLinks[0], authorName: null };
}

/** 단순 URL 추출 (하위 호환) */
export function extractSlackLink(text: string): string | null {
  const info = extractSlackInfo(text);
  return info?.url || null;
}
