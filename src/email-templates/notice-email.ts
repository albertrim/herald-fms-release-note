import { renderBoldMarkdown } from "@/lib/utils";
import { EMAIL_GREETING, EMAIL_GREETING_SUB } from "@/lib/category-styles";

interface NoticeEmailItem {
  title: string;
  description: string;
  categoryName: string | null;
  screenshots: string[];
  slackLink: string | null;
  slackAuthor: string | null;
}

interface NoticeEmailProps {
  title: string;
  senderName: string;
  items: NoticeEmailItem[];
}

const CATEGORY_COLORS: Record<string, { dot: string; bg: string; bgLight: string }> = {
  "신규 기능": { dot: "#a855f7", bg: "#9333ea", bgLight: "#faf5ff" },
  "기능 개선": { dot: "#3b82f6", bg: "#2563eb", bgLight: "#eff6ff" },
  "UI/UX 변경": { dot: "#10b981", bg: "#059669", bgLight: "#ecfdf5" },
  "버그 수정": { dot: "#ef4444", bg: "#dc2626", bgLight: "#fef2f2" },
};
const DEFAULT_COLOR = { dot: "#9ca3af", bg: "#4b5563", bgLight: "#f9fafb" };

export function buildNoticeHtml({ title, senderName, items }: NoticeEmailProps): string {
  const grouped = new Map<string, NoticeEmailItem[]>();
  for (const item of items) {
    const key = item.categoryName || "기타";
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }

  const itemSections = Array.from(grouped.entries())
    .map(([category, categoryItems]) => {
      const color = CATEGORY_COLORS[category] || DEFAULT_COLOR;

      return categoryItems.map((item) => {
        const screenshotsHtml = item.screenshots.length > 0
          ? `<div style="margin-top:16px;">${item.screenshots.map((url) =>
              `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin-top:6px;border:1px solid #e5e7eb;" />`
            ).join("")}</div>`
          : "";

        const slackHtml = item.slackLink
          ? `<p style="margin:10px 0 0 0;font-size:13px;"><a href="${item.slackLink}" style="color:#2563eb;text-decoration:none;font-weight:500;">Slack${item.slackAuthor ? ` (${item.slackAuthor})` : ""} →</a></p>`
          : "";

        return `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
          <tr>
            <td style="background:${color.bgLight};border-radius:16px;padding:28px 24px;">
              <!--[if mso]><table cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-right:8px;"><![endif]-->
              <div style="margin-bottom:16px;">
                <span style="display:inline-block;padding:5px 16px;border-radius:20px;background:${color.bg};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;line-height:1.4;">${category}</span>
              </div>
              <!--[if mso]></td></tr></table><![endif]-->
              <h3 style="margin:0 0 10px 0;font-size:18px;font-weight:700;color:#111827;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${item.title}</h3>
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${renderBoldMarkdown(item.description)}</p>
              ${slackHtml}
              ${screenshotsHtml}
            </td>
          </tr>
        </table>`;
      }).join("");
    })
    .join("");

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: 'Segoe UI', Tahoma, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #9333ea 100%);padding:36px 32px;">
              <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${title}</h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.75);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">발신: ${senderName}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <!-- Greeting -->
              <p style="margin:0 0 28px 0;font-size:16px;color:#374151;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                ${EMAIL_GREETING}<br/>${EMAIL_GREETING_SUB}
              </p>

              <!-- Items -->
              ${itemSections}

              <!-- Footer -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;border-top:2px solid #f3f4f6;padding-top:28px;">
                <tr>
                  <td style="background:linear-gradient(135deg, #eff6ff, #faf5ff);border-radius:16px;padding:24px;border:1px solid #dbeafe;">
                    <p style="margin:0;font-size:12px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      본 메일은 발신 전용입니다. 더 궁금하신 사항은 정경환 담당께 슬랙 DM주세요.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:20px;">
                    <p style="margin:0;font-size:11px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">© 2026 FASSTO. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
