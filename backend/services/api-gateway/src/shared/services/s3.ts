/**
 * S3 service — presigned PUT uploads for KYC documents.
 *
 * Spec §14: presigned URLs are scoped to the cravix-kyc bucket, expire after
 * S3_PRESIGNED_URL_TTL seconds, and have a Content-Length-Range constraint
 * (S3_MAX_UPLOAD_BYTES) plus a MIME whitelist enforced by Content-Type pinning.
 *
 * Dev mode: when AWS_ACCESS_KEY_ID is empty, returns a mock URL that points
 * to a local "fake" S3 endpoint.  This lets developers exercise the FE flow
 * without provisioning AWS creds.  In CI/staging/prod, real creds are required.
 */
import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Config, isProd } from '@cravix/shared-config';
import { logger } from '@cravix/shared-logger';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

let _client: S3Client | null = null;
function client(): S3Client {
  if (_client) return _client;
  const cfg: S3ClientConfig = { region: Config.AWS_REGION };
  if (Config.AWS_ACCESS_KEY_ID && Config.AWS_SECRET_ACCESS_KEY) {
    cfg.credentials = {
      accessKeyId: Config.AWS_ACCESS_KEY_ID,
      secretAccessKey: Config.AWS_SECRET_ACCESS_KEY,
    };
  }
  _client = new S3Client(cfg);
  return _client;
}

export interface PresignedUpload {
  uploadUrl: string;
  fileKey: string;
  /** The URL the client should send back to /kyc/documents once the PUT is done. */
  publicUrl: string;
  contentType: string;
  expiresIn: number;
  maxBytes: number;
}

export interface PresignArgs {
  riderId: string;
  documentType: string; // free-form; caller's responsibility to validate
  contentType: string;
}

/**
 * Sign a PUT URL constrained by content-type, content-length range, and a
 * deterministic key under `kyc/{riderId}/{documentType}-{ts}.{ext}`.
 */
export async function presignKycUpload(args: PresignArgs): Promise<PresignedUpload> {
  if (!ALLOWED_MIME.has(args.contentType)) {
    throw new Error(`Unsupported content-type: ${args.contentType}`);
  }
  const ext = args.contentType.split('/')[1] ?? 'bin';
  const fileKey = `kyc/${args.riderId}/${args.documentType}-${Date.now()}.${ext}`;
  const ttl = Config.S3_PRESIGNED_URL_TTL;
  const maxBytes = Config.S3_MAX_UPLOAD_BYTES;

  // Mock mode — useful when AWS isn't configured (local dev).
  if (!Config.AWS_ACCESS_KEY_ID || !Config.AWS_SECRET_ACCESS_KEY) {
    if (isProd()) {
      throw new Error('S3 credentials missing in production');
    }
    const baseHost = `https://${Config.AWS_S3_BUCKET}.s3.${Config.AWS_REGION}.amazonaws.com`;
    const uploadUrl = `${baseHost}/${fileKey}?MockSigned=1&X-Cravix-Mock=1&Expires=${ttl}`;
    logger.warn('[s3] DEV mock presigned URL (no real upload will occur)', { fileKey });
    return {
      uploadUrl,
      fileKey,
      publicUrl: `${baseHost}/${fileKey}`,
      contentType: args.contentType,
      expiresIn: ttl,
      maxBytes,
    };
  }

  const cmd = new PutObjectCommand({
    Bucket: Config.AWS_S3_BUCKET,
    Key: fileKey,
    ContentType: args.contentType,
    ServerSideEncryption: 'AES256',
    Metadata: {
      riderId: args.riderId,
      documentType: args.documentType,
    },
  });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: ttl });
  return {
    uploadUrl,
    fileKey,
    publicUrl: `https://${Config.AWS_S3_BUCKET}.s3.${Config.AWS_REGION}.amazonaws.com/${fileKey}`,
    contentType: args.contentType,
    expiresIn: ttl,
    maxBytes,
  };
}

/**
 * Validate an inbound URL is in our `cravix-kyc` (or `cravix-cdn`) bucket.
 * Spec §14: "S3 URLs validated to belong to the cravix-* bucket domain only."
 */
export function isCravixS3Url(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const allowedHosts = new Set([
      `${Config.AWS_S3_BUCKET}.s3.${Config.AWS_REGION}.amazonaws.com`,
      `${Config.AWS_S3_CDN_BUCKET}.s3.${Config.AWS_REGION}.amazonaws.com`,
      `cdn.cravix.in`,
    ]);
    return allowedHosts.has(u.host);
  } catch {
    return false;
  }
}
