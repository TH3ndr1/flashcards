# GCP Vercel Integration Documentation

## Introduction
Welcome to the Google Cloud Platform (GCP) Vercel integration documentation. This integration simplifies adding Google Cloud Platform to your Vercel projects.

## Why This Integration?
Integrating GCP with Vercel can be challenging due to how GCP manages credentials through a service account key file, making it difficult to manage securely in a Vercel environment. This integration streamlines credential management, allowing seamless integration of GCP's extensive capabilities with Vercel projects.

## Installation Guide

### Prerequisites
- **Google Cloud Platform Account**: Create a GCP account and a project [here](https://console.cloud.google.com/).
- **Service Account Key File**: Obtain a JSON key file for your project from the GCP console.
- **Vercel Account and Project**: Ensure you have an active Vercel account and project.

### Installation Steps
1. **Add Integration**: Visit the [GCP Vercel integration page](https://www.gcpvercel.com/docs/install) and select "Add Integration" for your Vercel project.
2. **Upload Key File**: Upload the GCP service account key file during the setup to securely add credentials as environment variables.
3. **Complete Setup**: Confirm the setup by selecting your Vercel project and finalize by clicking "Add Credentials" and "Finish Setup."

## Usage Instructions

After installation, your credentials will be automatically available as environment variables in your Vercel project, prefixed by `GCP_`:
- `GCP_PROJECT_ID`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `GCP_PRIVATE_KEY`

### Accessing Credentials
To access these variables within your Vercel project, utilize `process.env`. Here’s a recommended helper function:

```javascript
export const getGCPCredentials = () => {
  return process.env.GCP_PRIVATE_KEY
    ? {
        credentials: {
          client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GCP_PRIVATE_KEY,
        },
        projectId: process.env.GCP_PROJECT_ID,
      }
    : {};
};
```

### Example Usage
Here's how to integrate the credentials with Google Cloud Storage in Node.js:

```javascript
import { Storage } from '@google-cloud/storage';

export const storageClient = new Storage(getGCPCredentials());

const bucketName = 'my-bucket';
const fileName = 'my-file.json';
const file = storageClient.bucket(bucketName).file(fileName);

await file.save(
  JSON.stringify({ foo: 'bar' }),
  { contentType: 'application/json' }
);
```


### Usage in this project
Below is an extract from the api/tts/route.ts file where the credentials are used
This works both in Vercel (since the environment variabeles are defined through the Vercel GCP Integration) and in a local deployment (via the .evn.local file)

```javascript
// Define a function to capture the credentials

export const getGCPCredentials = () => {
  // for Vercel, use environment variables
  return process.env.GCP_PRIVATE_KEY
    ? {
        credentials: {
          client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GCP_PRIVATE_KEY,
        },
        projectId: process.env.GCP_PROJECT_ID,
      }
      // for local development, use gcloud CLI
    : {};
};

// Initialize Google Cloud TTS client
const client = new TextToSpeechClient(getGCPCredentials());
```


### Local Development
Use the `gcloud` CLI for local authentication with Google Cloud Platform. More details are available in the [local development documentation](https://cloud.google.com/sdk/docs).

## Additional Resources
- [Official Documentation](https://www.gcpvercel.com/docs)
- [Installation Guide](https://www.gcpvercel.com/docs/install)
- [Usage Instructions](https://www.gcpvercel.com/docs/usage)

