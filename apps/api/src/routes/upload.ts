import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import {
  UPLOAD_ACCEPTED_TYPES,
  UPLOAD_MAX_BYTES,
  uploadKindSchema,
  type UploadDto,
  type UploadResponse,
} from '@app/shared';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';
import { requireAuth } from '../middleware/auth';
import { GenerationLog } from '../models/GenerationLog';
import { Upload, type UploadDoc } from '../models/Upload';
import { detectFace, focusFor, type FaceDetection } from '../services/faceDetect';
import { processUpload } from '../services/imageProcessing';
import { signedImageUrl, storeImage } from '../services/storage';

export const uploadRouter = Router();

const receiveFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1, fields: 5 },
  fileFilter: (_req, file, accept) => {
    // A first check on the declared type; processUpload() checks the real format.
    if ((UPLOAD_ACCEPTED_TYPES as readonly string[]).includes(file.mimetype)) accept(null, true);
    else accept(new HttpError(400, 'UNSUPPORTED_IMAGE', `Unsupported type ${file.mimetype}`));
  },
}).single('photo');

/** Runs multer and turns its errors into API errors. */
const receivePhoto: RequestHandler = (req, res, next) => {
  receiveFile(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new HttpError(413, 'FILE_TOO_LARGE', 'File is too large', {
            maxBytes: UPLOAD_MAX_BYTES,
          }),
        );
      }
      return next(new HttpError(400, 'NO_FILE', `Upload error: ${err.code}`));
    }
    next(err);
  });
};

export function toUploadDto(doc: UploadDoc): UploadDto {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    url: signedImageUrl(doc),
    width: doc.width,
    height: doc.height,
    focus: { x: doc.focus.x, y: doc.focus.y },
    faceDetected: doc.faceDetected ?? false,
    lowResolution: doc.lowResolution ?? false,
  };
}

// POST /api/upload  (multipart: photo=<file>, kind=leader|requester|symbol)
uploadRouter.post('/', requireAuth, receivePhoto, async (req, res) => {
  if (!req.file) throw new HttpError(400, 'NO_FILE', 'Attach a photo in the "photo" field');
  const kind = uploadKindSchema.safeParse(req.body?.kind);
  if (!kind.success)
    throw new HttpError(400, 'VALIDATION_ERROR', 'kind must be leader, requester or symbol');

  const user = req.auth!.userDoc;
  const image = await processUpload(req.file.buffer, kind.data);

  // Storage and face detection don't depend on each other: run them together.
  const [stored, detection] = await Promise.all([
    storeImage(image.buffer, { folder: `uploads/${user._id.toString()}`, tags: [kind.data] }),
    kind.data === 'symbol'
      ? Promise.resolve<FaceDetection>({ face: null, attempted: false, latencyMs: 0 })
      : detectFace(image.preview),
  ]);

  const doc = await Upload.create({
    userId: user._id,
    kind: kind.data,
    ...stored,
    focus: focusFor(detection.face),
    faceDetected: detection.face !== null,
    faceBox: detection.face,
    lowResolution: image.lowResolution,
  });

  if (detection.attempted) {
    // Logging must never fail the upload.
    GenerationLog.create({
      userId: user._id,
      uploadId: doc._id,
      stage: 'face-crop',
      model: detection.model ?? env.GEMINI_VISION_MODEL,
      latencyMs: detection.latencyMs,
      success: !detection.error,
      error: detection.error ?? null,
    }).catch((err: unknown) => logger.error({ err }, 'Could not write GenerationLog'));
  }

  const body: UploadResponse = { upload: toUploadDto(doc.toObject()) };
  res.status(201).json(body);
});
