# Voice Feminization Tracker

This is a web application designed to help users track the progress of their voice feminization training and/or surgeries. Users can create a public profile, log events, and upload relevant data and files.

## Tech Stack

- **Frontend**: React + Vite, hosted on GitHub Pages
- **Backend**: AWS Serverless
  - **Authentication**: Amazon Cognito
  - **Database**: Amazon DynamoDB
  - **File Storage**: Amazon S3
  - **API**: Amazon API Gateway + AWS Lambda

## Development Setup

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd vfs-tracker
npm install
```

### 2. Environment Configuration

For development, the app will run in "development mode" without requiring AWS credentials. However, for production deployment, you'll need to configure AWS services.

**Development Mode (Default):**
- No configuration needed
- Uses mock authentication
- Limited functionality for testing UI/UX

**Production Mode:**
1. Copy `.env.example` to `.env`
2. Fill in your AWS Cognito credentials:
```env
VITE_AWS_REGION=your_aws_region
VITE_COGNITO_USER_POOL_ID=your_user_pool_id
VITE_COGNITO_USER_POOL_WEB_CLIENT_ID=your_web_client_id
```

### 3. Run Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:5173/`

## Deployment

This project is automatically deployed to GitHub Pages via GitHub Actions whenever code is pushed to the `main` branch.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


这是一个用于记录嗓音女性化手术/训练的效果的网站，我们允许用户添加她们的嗓音记录和事件记录。即“x年x月x日进行了训练”，或者“x年x月x日进行了手术”，并且同时包括一些其他内容，例如具体的训练内容，手术方法，个人感受等。

每个用户有一个专属的profile，她可以在进行了一些记录以后，然后再增加新的记录。

每个用户的profile都是公开的，但是公开的时候她们可以选择不公开她们的名字、联系方式、Github账号等个人信息。

每个用户的profile中，她们可以自己决定是否要填写名字或者联系方式等，但是必须有一种方式来识别用户，例如使用GitHub账号或者电子邮件地址。

用户可以增加的事件节点包括：嗓音测试（在医院内进行的完整测试），嗓音测试（使用自己的手机进行的简单测试），嗓音训练，以及嗓音手术。她们可以记录她们的嗓音频率，以及沙哑程度，发音费力程度，声音稳定程度等数据。

对于用户进行的记录，用户可以上传图片，但是记录嗓音测试（在医院内进行的完整测试）时必须上传报告，并且由管理员（例如 Repository的Owner）批准后才能展示。

首页是一个展示页面，允许任何用户查看以下内容：

1. 每个用户的profile，包括数据和事件记录，以及该用户选择开放的个人信息

2. 所有用户的数据汇总展示，分析以及统计图表