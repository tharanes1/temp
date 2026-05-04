/**
 * Support service — wraps /api/v1/support/*.
 */
import apiClient from '../client';

export const SUPPORT_ENDPOINTS = {
  FAQ: '/api/v1/support/faq',
  TICKET: '/api/v1/support/ticket',
  DOCUMENTS: '/api/v1/support/documents',
  PRIVACY: '/api/v1/support/privacy-policy',
  TERMS: '/api/v1/support/terms',
} as const;

export interface FaqEntry {
  id: string;
  category: 'orders' | 'payment' | 'account' | 'safety';
  question: string;
  answer: string;
  order: number;
}

export interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  description: string;
  orderId: string | null;
  status: string;
  createdAt: string;
}

export interface DigitalDocument {
  type: 'partner_id' | 'aadhaar' | 'pan' | 'driving_license' | 'rc' | 'insurance';
  title: string;
  downloadUrl: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  status: 'available' | 'pending' | 'rejected';
}

interface Envelope<T> {
  success: true;
  data: T;
}

export const supportService = {
  async listFaq(category: 'orders' | 'payment' | 'account' | 'safety' | 'all' = 'all'): Promise<FaqEntry[]> {
    const { data } = await apiClient.get<Envelope<FaqEntry[]>>(SUPPORT_ENDPOINTS.FAQ, { params: { category } });
    return data.data;
  },
  async createTicket(body: {
    category: 'order' | 'payment' | 'account' | 'safety' | 'other';
    subject: string;
    description: string;
    orderId?: string;
  }): Promise<SupportTicket> {
    const { data } = await apiClient.post<Envelope<SupportTicket>>(SUPPORT_ENDPOINTS.TICKET, body);
    return data.data;
  },
  async listDocuments(): Promise<DigitalDocument[]> {
    const { data } = await apiClient.get<Envelope<DigitalDocument[]>>(SUPPORT_ENDPOINTS.DOCUMENTS);
    return data.data;
  },
  async getPrivacyPolicy(): Promise<string> {
    const { data } = await apiClient.get<Envelope<{ content: string }>>(SUPPORT_ENDPOINTS.PRIVACY);
    return data.data.content;
  },
  async getTermsOfService(): Promise<string> {
    const { data } = await apiClient.get<Envelope<{ content: string }>>(SUPPORT_ENDPOINTS.TERMS);
    return data.data.content;
  },
};
