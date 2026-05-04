import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { supportController } from './controller.js';
import { CreateTicketSchema, FaqQuerySchema } from './schemas.js';

export const supportRouter: Router = Router();

// Auth-required routes
const guarded = Router();
guarded.use(authMiddleware);
guarded.get('/faq', validate({ query: FaqQuerySchema }), asyncHandler(supportController.listFaqs));
guarded.post('/ticket', validate({ body: CreateTicketSchema }), asyncHandler(supportController.createTicket));
guarded.get('/documents', asyncHandler(supportController.getDocuments));

// Public legal pages — no auth (spec §5.11).
supportRouter.get('/privacy-policy', supportController.getPrivacyPolicy);
supportRouter.get('/terms', supportController.getTermsOfService);
supportRouter.use(guarded);
