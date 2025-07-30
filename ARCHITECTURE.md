# System Architecture

This document provides a detailed overview of the technical architecture for the VoiceFem Tracker application.

## 1. Core Philosophy

The application is built using a **serverless, JAMstack architecture**. This approach minimizes server maintenance and cost while maximizing scalability and security.

- **Frontend**: A static single-page application (SPA) built with React.
- **Backend**: A collection of managed, serverless services on AWS.
- **API**: Communication between the frontend and backend is handled via a RESTful API.

---

## 2. Frontend

The frontend is responsible for all user interface rendering and client-side logic.

- **Framework**: **React** (with Vite for tooling) is used to build a component-based, interactive user interface.
- **Styling**: **Tailwind CSS** is used for all styling, providing a utility-first approach for rapid and consistent design.
- **State Management**:
  - Global authentication state is managed by `@aws-amplify/ui-react`'s `Authenticator` component.
  - Local component state is managed using React Hooks (`useState`, `useEffect`, `useCallback`).
- **Routing**: A simple hash-based routing mechanism is implemented in `App.jsx` to switch between the Home, Profile, and Dashboard pages.
- **Hosting**: The static site is hosted for free on **GitHub Pages**.

### Component Structure

- `App.jsx`: The root component, responsible for wrapping the application in the `Authenticator.Provider` and handling routing.
- `Layout.jsx`: Provides the consistent page structure (header, footer) for all pages.
- `Home.jsx`: The public landing page.
- `Profile.jsx`: The user's private page, which contains the `EventForm` and `EventList`.
- `PublicDashboard.jsx`: The public data aggregation and visualization page.
- `EventForm.jsx`: The form for adding new events.
- `EventList.jsx`: The component that displays a user's events in a timeline format.
- `Auth.jsx`: The component in the header that shows the user's status and the sign-out button.

---

## 3. Backend (AWS Serverless)

The backend is composed of several independent, managed AWS services.

### 3.1. Authentication: Amazon Cognito

- **Service**: Cognito User Pools provide a secure user directory.
- **Flow**:
  1. The user is presented with the Amplify UI `Authenticator` component.
  2. The user signs up or logs in using their email and password.
  3. Upon successful authentication, Cognito issues JWT (JSON Web Tokens) to the client.
  4. The Amplify library securely stores these tokens and automatically attaches them to subsequent API Gateway requests for authorization.

### 3.2. Database: Amazon DynamoDB

- **Service**: A fully managed NoSQL database.
- **Table**: A single table named `VoiceFemEvents`.
- **Data Model**:
  - **`userId`** (Partition Key, String): The unique identifier (sub) from the Cognito user. This allows for efficient querying of all events for a single user.
  - **`eventId`** (Sort Key, String): A unique UUID for each event.
  - **`type`** (String): The event type (e.g., `hospital_test`, `training`).
  - **`notes`** (String): User-provided text.
  - **`attachment`** (String, optional): The S3 key for any uploaded file.
  - **`status`** (String): The approval status (`approved` or `pending_approval`).
  - **`createdAt`** (String): ISO 8601 timestamp for when the event was created.

### 3.3. File Storage: Amazon S3

- **Service**: Simple Storage Service (S3) is used for object storage.
- **Bucket**: A single S3 bucket is used to store all user-uploaded files (e.g., reports, images).
- **Security**:
  - The bucket is configured to be private (Block Public Access is enabled).
  - Files are uploaded directly from the client using pre-signed URLs implicitly handled by the Amplify Storage library. The user's Cognito identity grants them temporary, limited permissions to upload to their own "folder" within the bucket.
  - File downloads are also handled via pre-signed URLs, ensuring only authorized users can access them.

### 3.4. API: API Gateway + AWS Lambda

- **Service**: API Gateway provides RESTful endpoints, and Lambda runs our backend logic. This decouples our frontend from our database and allows for secure, controlled access.
- **Endpoints**:
  - `POST /events`: Triggers the `addVoiceEvent` Lambda to create a new event in DynamoDB.
  - `GET /events/{userId}`: Triggers the `getVoiceEvents` Lambda to fetch all approved events for a specific user.
  - `GET /all-events`: Triggers the `getAllPublicEvents` Lambda to fetch all approved events from all users for the public dashboard.
- **Logic**: The Lambda functions are written in Node.js and use the AWS SDK to interact with DynamoDB. They contain the business logic for creating and retrieving data.

---

## 4. Deployment (CI/CD)

- **Service**: **GitHub Actions**.
- **Workflow**: A workflow is defined in `.github/workflows/deploy.yml`.
- **Trigger**: The workflow runs automatically on every `push` to the `main` branch.
- **Process**:
  1. **Checkout**: The code is checked out.
  2. **Setup**: Node.js is installed.
  3. **Install**: `npm install` is run to get all dependencies.
  4. **Build**: `npm run build` is executed. The Vite build process uses GitHub Actions secrets (e.g., `VITE_AWS_REGION`) to inject the necessary AWS configuration into the static files as environment variables.
  5. **Deploy**: The contents of the `dist` directory are pushed to the `gh-pages` branch.
- **Hosting**: GitHub Pages is configured to serve the contents of the `gh-pages` branch as the live site.
