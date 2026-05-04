import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { kycController } from './controller.js';
import {
  CategorySchema,
  DisabledSchema,
  DocumentsSchema,
  PersonalSchema,
  PresignQuerySchema,
  StudentSchema,
} from './schemas.js';

export const kycRouter: Router = Router();
kycRouter.use(authMiddleware);

kycRouter.get('/status', asyncHandler(kycController.getStatus));
kycRouter.post('/category', validate({ body: CategorySchema }), asyncHandler(kycController.setCategory));
kycRouter.post('/personal', validate({ body: PersonalSchema }), asyncHandler(kycController.setPersonal));
kycRouter.post('/documents', validate({ body: DocumentsSchema }), asyncHandler(kycController.setDocuments));
kycRouter.post('/student', validate({ body: StudentSchema }), asyncHandler(kycController.setStudent));
kycRouter.post('/disabled', validate({ body: DisabledSchema }), asyncHandler(kycController.setDisabled));
kycRouter.get(
  '/s3-presigned-url',
  validate({ query: PresignQuerySchema }),
  asyncHandler(kycController.getPresignedUpload),
);
kycRouter.post('/finalize', asyncHandler(kycController.finalize));
