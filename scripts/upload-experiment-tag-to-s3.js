const fs = require('fs');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const bucket = process.env.S3_BUCKET_NAME;
const packageJson = require('../packages/experiment-tag/package.json');
const name = 'experiment-tag';
const version = packageJson.version;
const branchName = process.env.BRANCH_NAME || ''; // Optional branch name
const location = path.join(process.cwd(), 'packages/experiment-tag/dist');
// Use the -min.js.gz file created by rollup
const files = [
  {
    file: 'experiment-tag-min.js.gz',
    gzipped: true,
  },
];

let deployedCount = 0;

console.log('[Publish to AWS S3] START');
const promises = files.map(({ file, gzipped }) => {
  const body = fs.readFileSync(path.join(location, file));

  // Create the key with version and optional branch name
  let fileName = `${name}-${version}`;
  if (branchName) {
    fileName += `-${branchName}`;
  }
  fileName += '-min'; // Keep the -min suffix

  // Create the S3 key path
  const key = `libs/${fileName}.js`;

  const client = new S3Client();

  const headObject = new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  console.log(
    `[Publish to AWS S3] Checking if ${key} exists in target bucket...`,
  );

  return client
    .send(headObject)
    .then(() => {
      // If branch name is provided, always overwrite to ensure latest branch version
      if (branchName) {
        console.log(
          `[Publish to AWS S3] ${key} exists in target bucket. Overwriting for branch deployment...`,
        );
        const putObject = new PutObjectCommand({
          ACL: 'public-read',
          Body: body,
          Bucket: bucket,
          CacheControl: 'max-age=31536000',
          ContentType: 'application/javascript',
          ContentEncoding: 'gzip',
          Key: key,
        });
        return client
          .send(putObject)
          .then(() => {
            console.log(`[Publish to AWS S3] Upload success for ${key}.`);
            deployedCount += 1;
          })
          .catch(console.error);
      } else {
        // For regular releases, skip if file exists
        console.log(
          `[Publish to AWS S3] ${key} exists in target bucket. Skipping upload job.`,
        );
      }
    })
    .catch(() => {
      console.log(
        `[Publish to AWS S3] ${key} does not exist in target bucket. Uploading to S3...`,
      );
      const putObject = new PutObjectCommand({
        ACL: 'public-read',
        Body: body,
        Bucket: bucket,
        CacheControl: 'max-age=31536000',
        ContentType: 'application/javascript',
        ContentEncoding: 'gzip',
        Key: key,
      });
      return client
        .send(putObject)
        .then(() => {
          console.log(`[Publish to AWS S3] Upload success for ${key}.`);
          deployedCount += 1;
        })
        .catch(console.error);
    });
});

Promise.all(promises)
  .then(() => {
    if (deployedCount === 0) {
      console.log(`[Publish to AWS S3] Complete! Nothing to deploy.`);
    } else {
      console.log(
        `[Publish to AWS S3] Success! Deployed ${deployedCount}/${files.length} files.`,
      );
    }
    console.log('[Publish to AWS S3] END');
  })
  .catch(console.log);
