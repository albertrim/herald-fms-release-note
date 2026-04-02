/**
 * Slack 메시지에서 요청자 이름을 추출하는 서비스
 *
 * Slack 글 형식 3가지:
 * 1. "작성자\n@황상아 거점사업2팀" → "황상아 거점사업2팀"
 * 2. "[요청자]\n@김대진 성장기획팀" → "김대진 성장기획팀"
 * 3. 위 패턴이 없으면 → 글 작성자 이름 사용
 */

interface SlackMessageResult {
  authorName: string | null;
}

export class SlackService {
  private token: string;

  constructor() {
    this.token = process.env.SLACK_BOT_TOKEN || "";
  }

  async getRequesterFromMessage(slackUrl: string): Promise<SlackMessageResult> {
    if (!this.token) {
      console.log("[Slack API] No SLACK_BOT_TOKEN configured");
      return { authorName: null };
    }

    const parsed = this.parseSlackUrl(slackUrl);
    if (!parsed) return { authorName: null };

    try {
      // 메시지 조회
      const message = await this.fetchMessage(parsed.channelId, parsed.timestamp);
      if (!message) return { authorName: null };

      // 패턴 A: "작성자" 또는 "[요청자]" 뒤에 <@USERID|이름> (이름 포함)
      // 실제 Slack 텍스트: *작성자*\n<@U0ABMH4KRD0|홍길동> 또는 *[요청자]*\n<@U0ABJ4XKX37|홍길동>
      const namedMentionMatch = message.text.match(
        /\*?\[?(?:작성자|요청자)\]?\*?\s*\n?\s*<@[A-Z0-9]+\|([^>]+)>/
      );
      if (namedMentionMatch) {
        const name = this.cleanName(namedMentionMatch[1]);
        console.log(`[Slack API] Found named mention: ${name}`);
        return { authorName: name };
      }

      // 패턴 B: "작성자" 또는 "[요청자]" 뒤에 <@USERID> (이름 없음 → API로 조회)
      // 실제 Slack 텍스트: *작성자*\n<@U0ABMH4KRD0> 또는 *[요청자]*\n<@U0ABJ4XKX37>
      const idOnlyMentionMatch = message.text.match(
        /\*?\[?(?:작성자|요청자)\]?\*?\s*\n?\s*<@([A-Z0-9]+)>/
      );
      if (idOnlyMentionMatch) {
        const userId = idOnlyMentionMatch[1];
        console.log(`[Slack API] Pattern B matched userId=${userId}`);
        const userName = await this.getUserName(userId);
        if (userName) {
          const cleaned = this.cleanName(userName);
          console.log(`[Slack API] Resolved user ${userId} → ${cleaned}`);
          return { authorName: cleaned };
        }
        console.log(`[Slack API] getUserName returned null for ${userId}`);
      } else {
        console.log(`[Slack API] No pattern A/B match. text(0..80): ${JSON.stringify(message.text.slice(0, 80))}`);
      }

      // 패턴 C: 위 패턴 없음 → 글 작성자의 프로필 이름 사용
      if (message.userId) {
        const userName = await this.getUserName(message.userId);
        if (userName) {
          const cleaned = this.cleanName(userName);
          console.log(`[Slack API] Using message author: ${cleaned}`);
          return { authorName: cleaned };
        }
      }

      console.log(`[Slack API] All patterns failed, returning null`);
      return { authorName: null };
    } catch (error) {
      console.error("[Slack API] Error:", error);
      return { authorName: null };
    }
  }

  private parseSlackUrl(url: string): { channelId: string; timestamp: string } | null {
    // https://fassto.slack.com/archives/C020DH6F3LY/p1774404382039739
    const match = url.match(/archives\/([A-Z0-9]+)\/p(\d+)/);
    if (!match) return null;

    // Slack 타임스탬프: p1774404382039739 → 1774404382.039739
    const rawTs = match[2];
    const timestamp = rawTs.slice(0, 10) + "." + rawTs.slice(10);

    return { channelId: match[1], timestamp };
  }

  private async fetchMessage(channelId: string, timestamp: string, retried = false): Promise<{ text: string; userId: string | null } | null> {
    const res = await fetch(
      `https://slack.com/api/conversations.history?channel=${channelId}&latest=${timestamp}&inclusive=true&limit=1`,
      { headers: { Authorization: `Bearer ${this.token}` }, cache: "no-store" as RequestCache }
    );

    const data = await res.json();

    if (!data.ok && data.error === "not_in_channel" && !retried) {
      console.log(`[Slack API] Bot not in channel ${channelId}, joining...`);
      const joinRes = await fetch("https://slack.com/api/conversations.join", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channelId }),
        cache: "no-store" as RequestCache,
      });
      const joinData = await joinRes.json();
      console.log(`[Slack API] Join result: ok=${joinData.ok} error=${joinData.error || "none"}`);
      return this.fetchMessage(channelId, timestamp, true);
    }

    if (!data.ok || !data.messages || data.messages.length === 0) {
      console.log(`[Slack API] Failed to fetch message:`, data.error || "no messages");
      return null;
    }

    const msg = data.messages[0];
    return { text: msg.text || "", userId: msg.user || null };
  }

  private async getUserName(userId: string): Promise<string | null> {
    const res = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      { headers: { Authorization: `Bearer ${this.token}` }, cache: "no-store" as RequestCache }
    );

    const data = await res.json();
    if (!data.ok || !data.user) return null;

    // real_name (풀네임) 우선, 없으면 profile.real_name, 없으면 display_name
    return data.user.real_name
      || data.user.profile?.real_name
      || data.user.profile?.display_name
      || data.user.name
      || null;
  }

  async postDeployNotice(slackUrls: (string | null)[]): Promise<void> {
    if (!this.token) return;

    const { formatKoreanDate } = await import("@/lib/utils");
    const message = [
      `:rocket: *운영 배포 완료 안내*`,
      ``,
      `안녕하세요! 요청 사항이 *${formatKoreanDate()}* 운영 환경에 배포 완료되었습니다.`,
      `자세한 내용은 :email: 업데이트 공지 메일을 확인해주시기 바랍니다.`,
      ``,
      `감사합니다 :pray:`,
    ].join("\n");

    const uniqueUrls = [...new Set(slackUrls.filter((u): u is string => !!u))];

    await Promise.all(
      uniqueUrls.map(async (url) => {
        const parsed = this.parseSlackUrl(url);
        if (!parsed) return;

        try {
          const res = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              channel: parsed.channelId,
              thread_ts: parsed.timestamp,
              text: message,
            }),
            cache: "no-store" as RequestCache,
          });
          const data = await res.json();
          if (data.ok) {
            console.log(`[Slack API] Posted deploy notice to ${url}`);
          } else {
            console.error(`[Slack API] Failed to post notice: ${data.error}`);
          }
        } catch (error) {
          console.error(`[Slack API] Error posting notice to ${url}:`, error);
        }
      })
    );
  }

  private cleanName(raw: string): string {
    // "이지원 SCM기획팀 / 택배운영지원, 변상, 정산" → "이지원 SCM기획팀"
    // "@이충환 스마트센터팀 / 팀장" → "이충환 스마트센터팀"
    return raw.replace(/^@/, "").replace(/\s*[/,]\s*.*$/, "").trim();
  }
}
