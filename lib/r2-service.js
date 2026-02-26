import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

/**
 * Upload a buffer to R2
 * @param {string} key - Object key (e.g. 'i/abc123/960.webp')
 * @param {Buffer} buffer - File contents
 * @param {string} contentType - MIME type
 * @returns {Promise<void>}
 */
export async function uploadObject(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

/**
 * Delete a single object from R2
 * @param {string} key - Object key
 * @returns {Promise<void>}
 */
export async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

/**
 * Delete all objects under a given prefix (simulates recursive rm)
 * @param {string} prefix - Key prefix (e.g. 'i/abc123/')
 * @returns {Promise<number>} Number of objects deleted
 */
export async function deletePrefix(prefix) {
  let deleted = 0;
  let continuationToken;

  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    const objects = (list.Contents || []).map(obj => ({ Key: obj.Key }));

    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: objects },
      }));
      deleted += objects.length;
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

/**
 * Check if an object exists in R2
 * @param {string} key - Object key
 * @returns {Promise<boolean>} true if object exists
 */
export async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

/**
 * Build the public URL for an R2 object
 * @param {string} key - Object key (e.g. 'i/abc123/960.webp')
 * @returns {string} Full public URL
 */
export function getPublicUrl(key) {
  // Strip trailing slash from R2_PUBLIC_URL if present
  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  return `${base}/${key}`;
}
