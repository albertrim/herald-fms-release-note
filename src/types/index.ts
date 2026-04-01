export interface NoticeItem {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  sortOrder: number;
  jiraTicketId: string;
  jiraTicketUrl: string;
  slackLink: string | null;
  slackAuthor: string | null;
  screenshots: string[];
  isOriginalText: boolean;
}

export interface DraftNotice {
  sourceUrls: string[];
  items: NoticeItem[];
  createdAt: Date;
}

export interface JiraTicket {
  id: string;
  key: string;
  url: string;
  summary: string;
  description: string;
  slackLink: string | null;
  slackAuthor: string | null;
}

export interface AnalyzeRequest {
  urls: string[];
}

export interface AnalyzeResponse {
  items: NoticeItem[];
}

export interface SendEmailRequest {
  title: string;
  senderName: string;
  recipients: string[];
  items: {
    title: string;
    description: string;
    categoryName: string | null;
    screenshots: string[];
    slackLink: string | null;
    slackAuthor: string | null;
  }[];
  sourceUrls: string[];
}

export interface SendEmailResponse {
  historyId: string;
  status: "SUCCESS" | "FAILED";
  message: string;
}

export interface RecipientSuggestion {
  email: string;
  usedCount: number;
}

export interface SendHistoryListItem {
  id: string;
  title: string;
  senderName: string;
  recipientCount: number;
  status: "SUCCESS" | "FAILED";
  sentAt: string;
}

export interface SendHistoryDetail {
  id: string;
  title: string;
  senderName: string;
  recipients: string[];
  status: "SUCCESS" | "FAILED";
  sentAt: string;
  sourceUrls: string[];
  contentSnapshot: SendEmailRequest["items"];
}

export interface CategoryItem {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: string[];
}
