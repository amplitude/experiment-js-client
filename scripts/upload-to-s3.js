const fs = require('fs');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const bucket = process.env.S3_BUCKET_NAME;
const branchName = process.env.BRANCH_NAME || ''; // Optional branch name
const packagesInput = process.env.PACKAGES || ''; // Comma-separated list of packages

// Define available packages
const availablePackages = {
  tag: {
    name: 'experiment-tag',
    packagePath: '../packages/experiment-tag/package.json',
    distPath: 'packages/experiment-tag/dist',
    files: [
      {
        file: 'experiment-tag-min.js',
        gzipped: false,
      },
      {
        file: 'experiment-tag-min.js.gz',
        gzipped: true,
      },
    ],
  },
  'segment-plugin': {
    name: 'experiment-plugin-segment',
    packagePath: '../packages/plugin-segment/package.json',
    distPath: 'packages/plugin-segment/dist',
    files: [
      {
        file: 'experiment-plugin-segment-min.js',
        gzipped: false,
      },
      {
        file: 'experiment-plugin-segment-min.js.gz',
        gzipped: true,
      },
    ],
  },
  'chrome-extension': {
    name: 'experiment-tag-latest-chrome-ext-v1',
    packagePath: '../packages/experiment-tag/package.json',
    distPath: 'packages/experiment-tag/dist',
    files: [
      {
        file: 'experiment-tag-min.js',
        gzipped: false,
      },
    ],
  },
};

// Parse the packages input
let packagesToUpload = [];
if (packagesInput) {
  const packagesList = packagesInput
    .split(',')
    .map((p) => p.trim().toLowerCase());

  // Add each requested package if it exists in availablePackages
  packagesList.forEach((packageName) => {
    if (availablePackages[packageName]) {
      packagesToUpload.push(availablePackages[packageName]);
    } else {
      console.warn(
        `[Publish to AWS S3] Warning: Unknown package "${packageName}" requested. Skipping.`,
      );
    }
  });
} else {
  // Default to all packages if none specified
  packagesToUpload = Object.values(availablePackages);
}

// Log which packages we're uploading
console.log(
  `[Publish to AWS S3] Uploading packages: ${packagesToUpload
    .map((p) => p.name)
    .join(', ')}`,
);

let deployedCount = 0;
let totalFiles = 0;

console.log('[Publish to AWS S3] START');

// Process each package
const allPromises = packagesToUpload.flatMap((packageConfig) => {
  try {
    const packageJson = require(path.resolve(
      __dirname,
      packageConfig.packagePath,
    ));
    const version = packageJson.version;
    const location = path.join(process.cwd(), packageConfig.distPath);

    console.log(
      `[Publish to AWS S3] Processing ${packageConfig.name} v${version}`,
    );

    totalFiles += packageConfig.files.length;

    return packageConfig.files.map(({ file, gzipped }) => {
      const filePath = path.join(location, file);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(
          `[Publish to AWS S3] Warning: File ${filePath} does not exist. Skipping.`,
        );
        return Promise.resolve();
      }

      const body = fs.readFileSync(filePath);

      // Create the key with version and optional branch name
      let fileName = `${packageConfig.name}`;
      if (packageConfig.name !== availablePackages['chrome-extension'].name) {
        // chrome extension is not versioned
        fileName += `-${version}`;
      }
      if (branchName) {
        fileName += `-${branchName}`;
      }
      fileName += '-min.js'; // Keep the -min.js suffix

      // Add .gz extension for gzipped files
      const key = `libs/${fileName}${gzipped ? '.gz' : ''}`;

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
              CacheControl: branchName ? 'max-age=60' : 'max-age=31536000', // 1 minute for branch deployments, 1 year for regular
              ContentType: 'application/javascript',
              ContentEncoding: gzipped ? 'gzip' : undefined,
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
            CacheControl: branchName ? 'max-age=60' : 'max-age=31536000', // 1 minute for branch deployments, 1 year for regular
            ContentType: 'application/javascript',
            ContentEncoding: gzipped ? 'gzip' : undefined,
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
  } catch (error) {
    console.error(
      `[Publish to AWS S3] Error processing package ${packageConfig.name}:`,
      error,
    );
    return [Promise.resolve()]; // Return a resolved promise to continue with other packages
  }
});

// Filter out undefined promises (from skipped files)
const filteredPromises = allPromises.filter((p) => p);

Promise.all(filteredPromises)
  .then(() => {
    if (deployedCount === 0) {
      console.log(`[Publish to AWS S3] Complete! Nothing to deploy.`);
    } else {
      console.log(
        `[Publish to AWS S3] Success! Deployed ${deployedCount}/${totalFiles} files.`,
      );
    }
    console.log('[Publish to AWS S3] END');
  })
  .catch(console.log);
