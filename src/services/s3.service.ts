import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import { MediaType } from '../repositories/istoricMedia/istoricMedia.repository'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.S3_BUCKET_NAME!

const ALLOWED_MIME_TYPES: Record<MediaType, string[]> = {
  image:    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video:    ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
  document: ['application/pdf', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB in bytes

export interface PresignedUploadResult {
  // POST these fields + the file to uploadUrl (multipart/form-data)
  uploadUrl: string
  fields: Record<string, string>
  // Store this in mediaURL column
  s3Key: string
  // Tell the client how long until the URL expires
  expiresInSeconds: number
}

export const s3Service = {
  /**
   * Generate a presigned POST URL.
   * Client uses this to upload directly to S3 — your server never touches the bytes.
   *
   * S3 presigned POST is preferred over presigned PUT here because it allows
   * server-side conditions (size, content-type) that S3 enforces before accepting the file.
   */
  async getPresignedUploadUrl(
    patientId: string,
    mediaType: MediaType,
    fileName: string,
    contentType: string
  ): Promise<PresignedUploadResult> {
    // Validate content type on our side too — don't trust S3 conditions alone
    const allowedTypes = ALLOWED_MIME_TYPES[mediaType]
    if (!allowedTypes.includes(contentType)) {
      throw new Error(
        `Invalid content type "${contentType}" for mediaType "${mediaType}". ` +
        `Allowed: ${allowedTypes.join(', ')}`
      )
    }

    // Build the key: patientId/images/uuid-filename.jpg
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const s3Key = `${patientId}/${mediaType}s/${randomUUID()}-${sanitizedFileName}`
    const expiresInSeconds = 300 // 5 minutes

    const { url, fields } = await createPresignedPost(s3, {
      Bucket: BUCKET,
      Key: s3Key,
      Conditions: [
        { 'Content-Type': contentType },
        ['content-length-range', 1, MAX_FILE_SIZE],
      ],
      Fields: {
        'Content-Type': contentType,
      },
      Expires: expiresInSeconds,
    })

    return { uploadUrl: url, fields, s3Key, expiresInSeconds }
  },

  /**
   * Generate a presigned GET URL so the client can download/view a private file.
   * Call this when serving media to the frontend — never expose s3Key directly as a URL.
   */
  async getPresignedDownloadUrl(
    s3Key: string,
    expiresInSeconds = 3600 // 1 hour default
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key })
    return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
  },

  /**
   * Delete a file from S3. Called when the DB record is deleted.
   * Does not throw if the file doesn't exist — safe to call unconditionally.
   */
  async deleteFile(s3Key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }))
  },
}