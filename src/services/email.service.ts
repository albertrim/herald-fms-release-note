import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { buildNoticeHtml } from "@/email-templates/notice-email";
import type { SendEmailRequest } from "@/types";

const BCC_ALWAYS = "albert.rim@fassto.com";
export const REAUTH_REQUIRED = "REAUTH_REQUIRED";

type GoogleOAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export interface IEmailService {
  sendNotice(
    request: SendEmailRequest,
    userId: string
  ): Promise<{ historyId: string; status: "SUCCESS" | "FAILED" }>;
}

function buildMimeMessage({
  from,
  to,
  bcc,
  subject,
  html,
}: {
  from: string;
  to: string;
  bcc: string;
  subject: string;
  html: string;
}): string {
  const encodedFrom = from.replace(
    /^(.+?)(\s*<[^>]+>)$/,
    (_, name, addr) => `=?UTF-8?B?${Buffer.from(name).toString("base64")}?=${addr}`
  );
  const lines = [
    `From: ${encodedFrom}`,
    `To: ${to}`,
    `Bcc: ${bcc}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html).toString("base64"),
  ];
  return lines.join("\r\n");
}

async function ensureValidToken(
  account: {
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    expires_at: number | null;
  },
  oauth2Client: GoogleOAuth2Client
): Promise<void> {
  if (!account.access_token) throw new Error(REAUTH_REQUIRED);

  const isExpired =
    account.expires_at !== null && account.expires_at * 1000 < Date.now();

  if (!isExpired) {
    oauth2Client.setCredentials({ access_token: account.access_token });
    return;
  }

  if (!account.refresh_token) throw new Error(REAUTH_REQUIRED);

  oauth2Client.setCredentials({ refresh_token: account.refresh_token });
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    if (!credentials.access_token) throw new Error(REAUTH_REQUIRED);

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date
          ? Math.floor(credentials.expiry_date / 1000)
          : null,
      },
    });

    oauth2Client.setCredentials({ access_token: credentials.access_token });
  } catch {
    throw new Error(REAUTH_REQUIRED);
  }
}

export class EmailService implements IEmailService {
  async sendNotice(
    request: SendEmailRequest,
    userId: string
  ): Promise<{ historyId: string; status: "SUCCESS" | "FAILED" }> {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "google" },
      include: { user: { select: { email: true } } },
    });

    if (!account) throw new Error(REAUTH_REQUIRED);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    await ensureValidToken(account, oauth2Client);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const senderEmail = account.user?.email ?? "";

    const html = buildNoticeHtml({
      title: request.title,
      senderName: request.senderName,
      items: request.items,
    });

    const mime = buildMimeMessage({
      from: `${request.senderName} <${senderEmail}>`,
      to: request.recipients.join(", "),
      bcc: BCC_ALWAYS,
      subject: request.title,
      html,
    });

    let status: "SUCCESS" | "FAILED" = "FAILED";
    try {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: Buffer.from(mime).toString("base64url") },
      });
      status = "SUCCESS";
    } catch {
      status = "FAILED";
    }

    const history = await prisma.sendHistory.create({
      data: {
        userId,
        title: request.title,
        senderName: request.senderName,
        recipients: JSON.stringify(request.recipients),
        status,
        contentSnapshot: JSON.stringify(request.items),
        sourceUrls: JSON.stringify(request.sourceUrls),
      },
    });

    if (status === "SUCCESS") {
      await Promise.all(
        request.recipients.map((email) =>
          prisma.recipientHistory.upsert({
            where: { email },
            update: { lastUsedAt: new Date(), usedCount: { increment: 1 } },
            create: { email, lastUsedAt: new Date(), usedCount: 1 },
          })
        )
      );
    }

    return { historyId: history.id, status };
  }
}
