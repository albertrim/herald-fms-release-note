import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { v4 as uuidv4 } from "uuid";
import type { JiraTicket, NoticeItem } from "@/types";

const anthropic = createAnthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AI_MODEL = anthropic(process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514");

export interface IAiTransformService {
  transformTickets(tickets: JiraTicket[]): Promise<NoticeItem[]>;
  mergeItems(items: { title: string; description: string }[]): Promise<{ title: string; description: string }>;
}

export class AiTransformService implements IAiTransformService {
  async transformTickets(tickets: JiraTicket[]): Promise<NoticeItem[]> {
    const items = await Promise.all(
      tickets.map((ticket, i) => this.transformWithFallback(ticket, i))
    );

    // 유사 항목 자동 병합
    if (items.length >= 2) {
      return this.autoMergeSimilarItems(items);
    }
    return items;
  }

  private async autoMergeSimilarItems(items: NoticeItem[]): Promise<NoticeItem[]> {
    try {
      const itemSummaries = items.map((item, i) => `${i}: ${item.title}`).join("\n");

      const { text } = await generateText({
        model: AI_MODEL,
        prompt: `아래는 JIRA 릴리즈에서 추출된 업데이트 공지 항목들의 제목 목록입니다.
제목의 유사도가 90% 이상인 항목들만 병합 그룹으로 묶어주세요.

항목 목록:
${itemSummaries}

규칙:
- 제목의 유사도가 90% 이상인 경우에만 병합하세요 (거의 동일한 제목)
- 비슷한 주제라도 제목이 다르면 절대 병합하지 마세요 — 독립 그룹으로 두세요
- 확신이 없으면 병합하지 마세요
- 병합은 극히 예외적인 경우에만 발생해야 합니다

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드 블록 없이):
{"groups": [[0, 2, 5], [1], [3, 4]]}`,
      });

      const groupsData = this.parseGroupsResponse(text);
      if (!groupsData) return items;

      // 병합이 필요한 그룹과 단독 항목 분리
      const mergePromises: Promise<NoticeItem>[] = [];
      const singleItems: NoticeItem[] = [];

      for (const group of groupsData) {
        const validIndices = group.filter((i) => i >= 0 && i < items.length);
        if (validIndices.length === 0) continue;

        if (validIndices.length === 1) {
          singleItems.push(items[validIndices[0]]);
        } else {
          const groupItems = validIndices.map((i) => items[i]);
          mergePromises.push(
            this.mergeItems(
              groupItems.map((i) => ({ title: i.title, description: i.description }))
            ).then((merged) => ({
              id: uuidv4(),
              title: merged.title,
              description: merged.description,
              categoryId: groupItems[0].categoryId,
              sortOrder: 0,
              jiraTicketId: groupItems.map((i) => i.jiraTicketId).join(", "),
              jiraTicketUrl: groupItems.map((i) => i.jiraTicketUrl).join(" | "),
              slackLink: groupItems.find((i) => i.slackLink)?.slackLink || null,
              slackAuthor: groupItems.find((i) => i.slackAuthor)?.slackAuthor || null,
              screenshots: [],
              isOriginalText: false,
            }))
          );
        }
      }

      const mergedItems = await Promise.all(mergePromises);
      const result = [...mergedItems, ...singleItems];

      // 그룹에 포함되지 않은 항목 추가
      const groupedIndices = new Set(groupsData.flat());
      for (let i = 0; i < items.length; i++) {
        if (!groupedIndices.has(i)) result.push(items[i]);
      }

      return result.map((item, i) => ({ ...item, sortOrder: i }));
    } catch (error) {
      console.error("[AI AutoMerge] Failed, returning items as-is:", error);
      return items;
    }
  }

  async mergeItems(
    items: { title: string; description: string }[]
  ): Promise<{ title: string; description: string }> {
    try {
      const itemsText = items
        .map((item, i) => `항목 ${i + 1}:\n- 제목: ${item.title}\n- 설명: ${item.description}`)
        .join("\n\n");

      const { text } = await generateText({
        model: AI_MODEL,
        prompt: `아래 여러 개의 업데이트 공지 항목은 같은 목적의 구현을 위한 관련 항목들입니다.
이 항목들을 하나의 통합된 공지 항목으로 병합해주세요.

규칙:
- 기술 용어를 사용하지 마세요
- 비개발자(물류운영팀, 영업팀, 고객만족팀)가 이해할 수 있는 언어로 작성하세요
- 중복되는 내용은 한 번만 언급하세요
- 3~4문장으로 간결하게 설명하세요
- 사용자 관점에서 "무엇이 개선/변경되었는지"와 "실무에 어떤 도움이 되는지"를 구체적으로 설명하세요
- 핵심 효과나 변경 포인트는 **볼드 표시**로 강조하세요

병합 대상 항목들:
${itemsText}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드 블록 없이):
{"title": "통합된 제목", "description": "통합된 설명"}`,
      });

      const parsed = this.parseJsonResponse(text);
      if (parsed?.title && parsed?.description) {
        return parsed;
      }
    } catch (error) {
      console.error("[AI Merge] Failed:", error);
    }

    return {
      title: items.map((i) => i.title).join(" / "),
      description: items.map((i) => i.description).join("\n\n"),
    };
  }

  private async transformWithFallback(
    ticket: JiraTicket,
    sortOrder: number
  ): Promise<NoticeItem> {
    const slackLink = ticket.slackLink;

    let transformed = await this.transformSingleTicket(ticket);
    if (!transformed) {
      transformed = await this.transformSingleTicket(ticket);
    }

    return {
      id: uuidv4(),
      title: transformed?.title ?? ticket.summary,
      description: transformed?.description ?? (ticket.description || ticket.summary),
      categoryId: transformed?.category ?? null,
      sortOrder,
      jiraTicketId: ticket.key,
      jiraTicketUrl: ticket.url,
      slackLink,
      slackAuthor: ticket.slackAuthor,
      screenshots: [],
      isOriginalText: !transformed,
    };
  }

  private async transformSingleTicket(
    ticket: JiraTicket
  ): Promise<{ title: string; description: string; category: string } | null> {
    try {
      const descriptionText = (ticket.description || "").slice(0, 3000);

      const { text } = await generateText({
        model: AI_MODEL,
        prompt: `당신은 IT 시스템 업데이트 내용을 비개발자(물류운영팀, 영업팀, 고객만족팀)가 이해할 수 있도록 변환하는 전문가입니다.

아래 JIRA 티켓 내용을 비개발자 관점의 업데이트 공지 항목으로 변환해주세요.

규칙:
- 기술 용어(API, DB, 서버, 배포, 마이그레이션, 리팩토링, 엔드포인트 등)를 사용하지 마세요
- 3~4문장으로 간결하게 설명하세요
- 첫 1문장: 무엇이 변경/개선되었는지 명확히 설명
- 중간 1~2문장: 실무자에게 어떤 도움이 되는지 구체적으로 설명 (예: "기존에는 ~해야 했지만, 이제는 ~할 수 있습니다")
- 적용 범위나 유의사항이 있다면 마지막에 간단히 안내
- 핵심 효과나 변경 포인트는 **볼드 표시**로 강조하세요 (예: **자동으로 처리됩니다**)
- 한국어로 작성하세요
- category는 반드시 다음 중 하나를 선택하세요: "기능 개선", "버그 수정", "신규 기능", "UI/UX 변경"

JIRA 티켓:
- 제목: ${ticket.summary}
- 설명: ${descriptionText || "상세 설명 없음"}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드 블록 없이, 순수 JSON만):
{"title": "변환된 제목", "description": "변환된 설명", "category": "카테고리명"}`,
      });

      const parsed = this.parseJsonResponse(text);
      if (parsed?.title && parsed?.description) {
        return { title: parsed.title, description: parsed.description, category: parsed.category || "기능 개선" };
      }
      console.error("[AI Transform] Invalid response format:", text.slice(0, 200));
      return null;
    } catch (error) {
      console.error("[AI Transform] Error for ticket", ticket.key, ":", error);
      return null;
    }
  }

  private parseJsonResponse(text: string): { title: string; description: string; category?: string } | null {
    let cleaned = text.trim();
    // 마크다운 코드 블록 제거
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.title && parsed.description) {
        return parsed;
      }
      return null;
    } catch {
      // JSON이 텍스트 안에 포함된 경우 추출 시도
      const match = cleaned.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.title && parsed.description) {
            return parsed;
          }
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private parseGroupsResponse(text: string): number[][] | null {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.groups && Array.isArray(parsed.groups)) {
        return parsed.groups;
      }
      return null;
    } catch {
      const match = cleaned.match(/\{[\s\S]*"groups"[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.groups && Array.isArray(parsed.groups)) {
            return parsed.groups;
          }
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}
