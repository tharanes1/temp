/**
 * Support service.
 *
 *   • /faq                Redis-cached 1h.
 *   • /ticket             Insert SupportTicket row.
 *   • /documents          Compose Rider + KYC + Vehicle into the spec's
 *                          flattened documents list.
 *   • /privacy-policy     Static markdown content (no auth).
 *   • /terms              Static markdown content (no auth).
 */
import { cacheAside, prefixKey } from '@cravix/shared-redis';

import { supportRepository } from './repository.js';
import type { CreateTicketInput, FaqQuery } from './schemas.js';
import type { DigitalDocumentDto, FaqEntryDto, SupportTicketDto } from './types.js';

const FAQ_CACHE_TTL = 60 * 60;

const PRIVACY_POLICY_MD = `# Cravix Privacy Policy

Last updated: 2026-05-01

This policy describes how Cravix collects, uses, and protects rider data...

## Data we collect
- Identity & contact (phone, name, email)
- Location (during active shifts)
- Documents (KYC, vehicle)
- Wallet & bank details (for payouts)

## Data we share
- Operations team for SOS response.
- Payment partners for settlement.
- Regulators when legally required.

## Your rights
- Access, correction, deletion (DPDPA 2023).
- Contact privacy@cravix.in for any request.`;

const TERMS_OF_SERVICE_MD = `# Cravix Terms of Service

Last updated: 2026-05-01

By using the Cravix Rider app you agree to these terms...

1. Eligibility — verified KYC + valid vehicle documents.
2. Earnings — credited after delivery completion + reconciliation.
3. Conduct — riders must follow safety rules and respect customers.
4. Suspension — for repeated cancellations, fraud, or unsafe behaviour.
5. Disputes — Bengaluru jurisdiction.`;

// ─── Public API ─────────────────────────────────────────────────

export const supportService = {
  async listFaqs(query: FaqQuery): Promise<FaqEntryDto[]> {
    const cacheKey = prefixKey(`cache:faq:${query.category}`);
    return cacheAside(cacheKey, FAQ_CACHE_TTL, async () => {
      const rows = await supportRepository.listFaqs(query.category === 'all' ? undefined : query.category);
      return rows.map((r) => ({
        id: r.id,
        category: r.category as FaqEntryDto['category'],
        question: r.question,
        answer: r.answer,
        order: r.order,
      }));
    });
  },

  async createTicket(riderId: string, input: CreateTicketInput): Promise<SupportTicketDto> {
    const row = await supportRepository.createTicket({
      riderId,
      category: input.category,
      subject: input.subject,
      description: input.description,
      ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
    });
    return {
      id: row.id,
      category: row.category,
      subject: row.subject,
      description: row.description,
      orderId: row.orderId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  },

  async getDocuments(riderId: string): Promise<DigitalDocumentDto[]> {
    const { rider, kyc, vehicle } = await supportRepository.getDocuments(riderId);
    const out: DigitalDocumentDto[] = [];

    // Always present a Partner ID Card — issued from the rider creation date,
    // marked `available` only if KYC is verified.
    if (rider) {
      out.push({
        type: 'partner_id',
        title: 'Partner ID Card',
        downloadUrl: null,
        issuedAt: rider.kycStatus === 'VERIFIED' ? rider.createdAt.toISOString().slice(0, 10) : null,
        expiresAt: null,
        status: rider.kycStatus === 'VERIFIED' ? 'available' : 'pending',
      });
    }

    if (kyc) {
      const kycIssued = kyc.reviewedAt?.toISOString().slice(0, 10) ?? null;
      const kycStatus: 'available' | 'pending' = rider?.kycStatus === 'VERIFIED' ? 'available' : 'pending';
      if (kyc.aadhaarFront) {
        out.push({
          type: 'aadhaar',
          title: 'Aadhaar (verified)',
          downloadUrl: kyc.aadhaarFront,
          issuedAt: kycIssued,
          expiresAt: null,
          status: kycStatus,
        });
      }
      if (kyc.panCard) {
        out.push({
          type: 'pan',
          title: 'PAN (verified)',
          downloadUrl: kyc.panCard,
          issuedAt: kycIssued,
          expiresAt: null,
          status: kycStatus,
        });
      }
      if (kyc.drivingLicense) {
        out.push({
          type: 'driving_license',
          title: 'Driving Licence (verified)',
          downloadUrl: kyc.drivingLicense,
          issuedAt: kycIssued,
          expiresAt: null,
          status: kycStatus,
        });
      }
    }

    if (vehicle) {
      if (vehicle.rcImage) {
        out.push({
          type: 'rc',
          title: 'Vehicle RC',
          downloadUrl: vehicle.rcImage,
          issuedAt: null,
          expiresAt: null,
          status: 'available',
        });
      }
      if (vehicle.insurancePolicy) {
        out.push({
          type: 'insurance',
          title: 'Insurance Policy',
          downloadUrl: vehicle.insurancePolicy,
          issuedAt: null,
          expiresAt: vehicle.insuranceExpiry?.toISOString().slice(0, 10) ?? null,
          status: 'available',
        });
      }
    }

    return out;
  },

  getPrivacyPolicy(): string {
    return PRIVACY_POLICY_MD;
  },

  getTermsOfService(): string {
    return TERMS_OF_SERVICE_MD;
  },
};
