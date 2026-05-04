/**
 * Wire-format DTOs for /support.
 */

export interface FaqEntryDto {
  id: string;
  category: 'orders' | 'payment' | 'account' | 'safety';
  question: string;
  answer: string;
  order: number;
}

export interface SupportTicketDto {
  id: string;
  category: string;
  subject: string;
  description: string;
  orderId: string | null;
  status: string;
  createdAt: string;
}

export interface DigitalDocumentDto {
  type: 'partner_id' | 'aadhaar' | 'pan' | 'driving_license' | 'rc' | 'insurance';
  title: string;
  downloadUrl: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  status: 'available' | 'pending' | 'rejected';
}
