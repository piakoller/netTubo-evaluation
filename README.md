# NetTubo LLM Evaluation Platform

## Setup Instructions

### Prerequisites
- Node.js 14 or higher
- npm package manager

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the backend server:
   ```bash
   npm run dev
   ```
   
   The backend will run on `http://localhost:5001`

### Frontend Setup

1. Navigate to the root directory:
   ```bash
   cd ..  # if you're in the backend directory
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```
   
   The frontend will run on `http://localhost:3000`

## Data Sources

The system automatically loads:
- **Patient Data**: From `C:\Users\pia\OneDrive - Universitaet Bern\Projects\NetTubo\netTubo\data\ExpertCases.xlsx`
- **LLM Recommendations**: From `C:\Users\pia\OneDrive - Universitaet Bern\Projects\NetTubo\netTubo\agentic_assessment\batch_results\run_20250922_094323\batch_run_20250922_094323\patient_X\patient_X_therapy_recommendation.json`

## Usage

1. Start both backend and frontend servers
2. Open `http://localhost:3000` in your browser
3. Navigate to "Evaluation" to review and evaluate patient cases
4. View analytics in the "Summary" section
5. Check "Instructions" for detailed evaluation guidelines

## API Endpoints

- `GET /api/patients` - Get all patients with their recommendations
- `GET /api/patients/:id` - Get specific patient data
- `GET /api/patients/:id/recommendation` - Get patient's LLM recommendation
- `POST /api/reload` - Reload data from files (clear cache)
- `GET /api/health` - Backend health check

## Troubleshooting

If you see "Backend server is not running" error:
1. Make sure the backend is running on port 5001
2. Check that the data file paths exist
3. Review the backend console for error messages

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
