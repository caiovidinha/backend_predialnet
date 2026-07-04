const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Storage agnóstico S3-compatível (AWS S3, DigitalOcean Spaces, Cloudflare R2,
// Backblaze B2, MinIO). Tudo por env — nada é obrigatório para o app subir; o
// upload só é habilitado quando as credenciais estão presentes.
const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.S3_REGION || 'us-east-1';
const ENDPOINT = process.env.S3_ENDPOINT || undefined; // p/ não-AWS
const FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === 'true'; // MinIO etc.
const ACCESS_KEY = process.env.S3_ACCESS_KEY_ID;
const SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY;
const URL_TTL = Number.parseInt(process.env.S3_URL_TTL_SEC, 10) || 300;

let _client = null;

const isConfigured = () => Boolean(BUCKET && ACCESS_KEY && SECRET_KEY);

const client = () => {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      endpoint: ENDPOINT,
      forcePathStyle: FORCE_PATH_STYLE,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    });
  }
  return _client;
};

const putObject = async (key, body, contentType) => {
  await client().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
  return key;
};

// URL temporária de download (assinada localmente, sem custo de rede).
const getDownloadUrl = (key, filename) =>
  getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
    }),
    { expiresIn: URL_TTL },
  );

const deleteObject = (key) =>
  client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

module.exports = { isConfigured, putObject, getDownloadUrl, deleteObject, URL_TTL };
