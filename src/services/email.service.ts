import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import type { SendEmailRequest } from "@/types";
import { buildNoticeHtml } from "@/email-templates/notice-email";

export interface IEmailService {
  sendNotice(
    request: SendEmailRequest,
    userId: string
  ): Promise<{ historyId: string; status: "SUCCESS" | "FAILED" }>;
}

export class EmailService implements IEmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendNotice(
    request: SendEmailRequest,
    userId: string
  ): Promise<{ historyId: string; status: "SUCCESS" | "FAILED" }> {
    const html = buildNoticeHtml({
      title: request.title,
      senderName: request.senderName,
      items: request.items,
    });

    let status: "SUCCESS" | "FAILED" = "FAILED";

    try {
      await this.transporter.sendMail({
        from: `${request.senderName} <${process.env.SMTP_USER}>`,
        to: request.recipients.join(", "),
        subject: request.title,
        html,
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
