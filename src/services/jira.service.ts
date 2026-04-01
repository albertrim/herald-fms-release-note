import type { JiraTicket } from "@/types";
import { extractSlackInfo } from "@/services/slack-extractor.service";
import { SlackService } from "@/services/slack.service";

export interface IJiraService {
  fetchReleaseTickets(urls: string[]): Promise<JiraTicket[]>;
}

export class JiraService implements IJiraService {
  private baseUrl: string;
  private token: string;
  private userEmail: string;
  private slackFieldIdCache: string | null | undefined = undefined;

  constructor() {
    this.baseUrl = process.env.JIRA_BASE_URL || "";
    this.token = process.env.JIRA_API_TOKEN || "";
    this.userEmail = process.env.JIRA_USER_EMAIL || "";
  }

  async fetchReleaseTickets(urls: string[]): Promise<JiraTicket[]> {
    const results = await Promise.all(urls.map((url) => this.fetchSingleRelease(url)));
    const tickets = results.flat();

    // Slack 메시지에서 요청자 이름을 병렬로 추출
    const slackService = new SlackService();
    await Promise.all(
      tickets.map(async (ticket) => {
        if (ticket.slackLink) {
          const result = await slackService.getRequesterFromMessage(ticket.slackLink);
          if (result.authorName) {
            ticket.slackAuthor = result.authorName;
          }
        }
      })
    );

    return tickets;
  }

  private async fetchSingleRelease(url: string): Promise<JiraTicket[]> {
    const versionId = this.extractVersionId(url);
    const projectKey = this.extractProjectKey(url);

    // 먼저 version 정보를 조회하여 version name을 가져옴
    const versionName = await this.getVersionName(versionId);

    // "Slack 링크" 커스텀 필드 ID 조회
    const slackFieldId = await this.findSlackFieldId();

    const jql = `project = "${projectKey}" AND fixVersion = "${versionName}"`;
    const fields = ["summary", "description", "comment", "assignee", "reporter", slackFieldId].filter(Boolean).join(",");
    const searchUrl = `${this.baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields}`;

    const response = await fetch(searchUrl, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      if (response.status === 404) {
        throw new JiraError("RELEASE_NOT_FOUND", "해당 Release를 찾을 수 없습니다.");
      }
      if (response.status === 401 || response.status === 403) {
        throw new JiraError("JIRA_AUTH_FAILED", "JIRA 인증에 실패했습니다. API 토큰을 확인해주세요.");
      }
      throw new JiraError(
        "JIRA_CONNECTION_FAILED",
        `JIRA 시스템 오류 (${response.status}): ${errorBody.slice(0, 200)}`
      );
    }

    const data = await response.json();

    if (!data.issues || data.issues.length === 0) {
      throw new JiraError("NO_TICKETS", "연결된 티켓이 없습니다.");
    }

    return data.issues.map((issue: { id: string; key: string; fields: { summary?: string; description?: unknown; comment?: { comments?: { body?: unknown }[] }; assignee?: { displayName?: string }; reporter?: { displayName?: string } } }) => {
      const description = this.extractDescription(issue.fields.description);

      // Slack 링크 추출: 커스텀 필드(최우선) → ADF description → 댓글 순
      let slackUrl: string | null = null;

      // 1. "Slack 링크" 커스텀 필드에서 추출
      if (slackFieldId) {
        const customFieldValue = (issue.fields as Record<string, unknown>)[slackFieldId];
        if (customFieldValue) {
          const fieldStr = typeof customFieldValue === "string" ? customFieldValue : JSON.stringify(customFieldValue);
          const archiveMatch = fieldStr.match(/https?:\/\/[a-zA-Z0-9._-]+\.slack\.com\/archives\/[^\s"'<>)\]\\},]+/);
          if (archiveMatch) {
            slackUrl = archiveMatch[0];
          } else {
            const anySlack = fieldStr.match(/https?:\/\/[a-zA-Z0-9._-]+\.slack\.com\/[^\s"'<>)\]\\},]+/);
            if (anySlack) slackUrl = anySlack[0];
          }
          console.log(`[Slack] Ticket ${issue.key}: Custom field "${slackFieldId}" value:`, fieldStr.slice(0, 200));
        }
      }

      // 2. ADF description에서 추출 (fallback)
      let slackInfo: { url: string; authorName: string | null } | null = null;
      if (!slackUrl) {
        slackInfo = extractSlackInfo(JSON.stringify(issue.fields.description || ""));
        if (slackInfo) slackUrl = slackInfo.url;
      }

      // 3. 댓글에서 추출 (fallback)
      if (!slackUrl && issue.fields.comment?.comments) {
        for (const comment of issue.fields.comment.comments) {
          if (comment.body) {
            slackInfo = extractSlackInfo(JSON.stringify(comment.body));
            if (slackInfo) { slackUrl = slackInfo.url; break; }
          }
        }
      }

      // 요청자 이름은 Slack 메시지에서 추출 (비동기 → 후처리)
      console.log(`[Slack] Ticket ${issue.key}: link=${slackUrl || "none"}`);

      return {
        id: issue.id,
        key: issue.key,
        url: `${this.baseUrl}/browse/${issue.key}`,
        summary: issue.fields.summary || "",
        description,
        slackLink: slackUrl,
        slackAuthor: null, // Slack API로 후처리
      };
    });
  }

  private async getVersionName(versionId: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/rest/api/3/version/${versionId}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      if (response.status === 404) {
        throw new JiraError("RELEASE_NOT_FOUND", "해당 Release를 찾을 수 없습니다.");
      }
      throw new JiraError(
        "JIRA_CONNECTION_FAILED",
        `JIRA 버전 조회 실패 (${response.status}): ${errorBody.slice(0, 200)}`
      );
    }

    const version = await response.json();
    return version.name;
  }

  // Atlassian Cloud API v3의 description은 ADF(Atlassian Document Format) 객체
  private extractDescription(description: unknown): string {
    if (!description) return "";
    if (typeof description === "string") return description;

    // ADF format → plain text 추출
    try {
      return this.adfToText(description as AdfNode);
    } catch {
      return JSON.stringify(description);
    }
  }

  private adfToText(node: AdfNode, depth = 0): string {
    if (!node) return "";

    switch (node.type) {
      case "text": {
        const text = node.text || "";
        const linkMark = node.marks?.find((m) => m.type === "link");
        if (linkMark?.attrs?.href) return `${text} (${linkMark.attrs.href})`;
        return text;
      }
      case "hardBreak":
        return "\n";
      case "inlineCard":
        return node.attrs?.url || "";
      case "mention":
        return node.attrs?.text || "";
      case "emoji":
        return node.attrs?.text || node.attrs?.shortName || "";
      case "paragraph":
        return this.childrenToText(node, depth) + "\n";
      case "heading":
        return this.childrenToText(node, depth) + "\n";
      case "bulletList":
      case "orderedList":
        return (node.content || [])
          .map((child, i) => {
            const prefix = node.type === "orderedList" ? `${i + 1}. ` : "- ";
            return prefix + this.adfToText(child, depth + 1).trim();
          })
          .join("\n") + "\n";
      case "listItem":
        return this.childrenToText(node, depth);
      case "codeBlock":
        return this.childrenToText(node, depth) + "\n";
      case "blockquote":
        return "> " + this.childrenToText(node, depth).trim() + "\n";
      case "table":
        return (node.content || []).map((row) => this.adfToText(row, depth)).join("") + "\n";
      case "tableRow":
        return (node.content || []).map((cell) => this.adfToText(cell, depth).trim()).join(" | ") + "\n";
      case "tableCell":
      case "tableHeader":
        return this.childrenToText(node, depth);
      case "mediaSingle":
      case "media":
        return "[이미지]\n";
      case "rule":
        return "---\n";
      default:
        return this.childrenToText(node, depth);
    }
  }

  private childrenToText(node: AdfNode, depth: number): string {
    if (!node.content || !Array.isArray(node.content)) return "";
    return node.content.map((child) => this.adfToText(child, depth)).join("");
  }

  private async findSlackFieldId(): Promise<string | null> {
    if (this.slackFieldIdCache !== undefined) return this.slackFieldIdCache;

    try {
      const response = await fetch(`${this.baseUrl}/rest/api/3/field`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        this.slackFieldIdCache = null;
        return null;
      }
      const fields: { id: string; name: string }[] = await response.json();
      const slackField = fields.find((f) =>
        f.name.toLowerCase().includes("slack") && f.name.includes("링크")
      ) || fields.find((f) => f.name.toLowerCase().includes("slack link"));

      this.slackFieldIdCache = slackField?.id || null;
      if (this.slackFieldIdCache) {
        console.log(`[Slack] Found custom field: "${slackField!.name}" → ${this.slackFieldIdCache}`);
      }
      return this.slackFieldIdCache;
    } catch {
      this.slackFieldIdCache = null;
      return null;
    }
  }

  private getHeaders() {
    return {
      Authorization: `Basic ${Buffer.from(`${this.userEmail}:${this.token}`).toString("base64")}`,
      Accept: "application/json",
    };
  }

  private extractVersionId(url: string): string {
    const match = url.match(/versions\/(\d+)/);
    if (!match) throw new JiraError("INVALID_URL", "유효한 JIRA Release Note URL을 입력해주세요.");
    return match[1];
  }

  private extractProjectKey(url: string): string {
    const match = url.match(/projects\/([A-Za-z][A-Za-z0-9_]+)/);
    if (!match) throw new JiraError("INVALID_URL", "유효한 JIRA Release Note URL을 입력해주세요.");
    return match[1];
  }
}

interface AdfMark {
  type: string;
  attrs?: { href?: string };
}

interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  marks?: AdfMark[];
  attrs?: { url?: string; text?: string; shortName?: string };
}

export class JiraError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "JiraError";
  }
}
