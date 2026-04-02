import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { EmailService } from "@/services/email.service";
import { SlackService } from "@/services/slack.service";
import { isValidEmail } from "@/lib/utils";
import type { SendEmailRequest } from "@/types";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const body: SendEmailRequest = await request.json();

    if (!body.title || !body.senderName || !body.recipients?.length || !body.items?.length) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const invalidEmails = body.recipients.filter((e) => !isValidEmail(e));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: "INVALID_EMAIL", message: "잘못된 이메일 주소가 포함되어 있습니다.", details: invalidEmails },
        { status: 400 }
      );
    }

    const emailService = new EmailService();
    const result = await emailService.sendNotice(body, session.user.id);

    if (result.status === "FAILED") {
      return NextResponse.json(
        { historyId: result.historyId, status: "FAILED", error: "EMAIL_SEND_FAILED", message: "이메일 발송에 실패했습니다. 수신자 주소를 확인해주세요." },
        { status: 500 }
      );
    }

    if (!body.isResend && !body.skipSlack) {
      const slackUrls = body.items.map((item) => item.slackLink);
      after(async () => {
        const slackService = new SlackService();
        await slackService.postDeployNotice(slackUrls);
      });
    }

    return NextResponse.json({
      historyId: result.historyId,
      status: "SUCCESS",
      message: "이메일이 성공적으로 발송되었습니다.",
    });
  } catch {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
