# Voice Feminization Tracker

This is a web application designed to help users track the progress of their voice feminization training and/or surgeries. Users can create a public profile, log events, and upload relevant data and files.

## Tech Stack

- **Frontend**: React + Vite, hosted on GitHub Pages
- **Backend**: AWS Serverless
  - **Authentication**: Amazon Cognito
  - **Database**: Amazon DynamoDB
  - **File Storage**: Amazon S3
  - **API**: Amazon API Gateway + AWS Lambda

## Deployment

This project is automatically deployed to GitHub Pages via GitHub Actions whenever code is pushed to the `main` branch.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
