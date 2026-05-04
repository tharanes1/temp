import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { emergencyController } from './controller.js';
import {
  ContactIdParam,
  CreateContactSchema,
  SosTriggerSchema,
  UpdateContactSchema,
  UpdateMedicalSchema,
} from './schemas.js';

export const emergencyRouter: Router = Router();
emergencyRouter.use(authMiddleware);

// Contacts
emergencyRouter.get('/contacts', asyncHandler(emergencyController.listContacts));
emergencyRouter.post('/contacts', validate({ body: CreateContactSchema }), asyncHandler(emergencyController.createContact));
emergencyRouter.put(
  '/contacts/:contactId',
  validate({ params: ContactIdParam, body: UpdateContactSchema }),
  asyncHandler(emergencyController.updateContact),
);
emergencyRouter.delete(
  '/contacts/:contactId',
  validate({ params: ContactIdParam }),
  asyncHandler(emergencyController.deleteContact),
);

// Medical
emergencyRouter.get('/medical', asyncHandler(emergencyController.getMedical));
emergencyRouter.put('/medical', validate({ body: UpdateMedicalSchema }), asyncHandler(emergencyController.updateMedical));

// SOS — fire-and-forget; ops pager kicks in via BullMQ.
emergencyRouter.post('/sos', validate({ body: SosTriggerSchema }), asyncHandler(emergencyController.triggerSos));
