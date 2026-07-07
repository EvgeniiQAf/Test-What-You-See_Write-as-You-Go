<<<<<<< HEAD
# Testmo AI Helper

This project is a helper service designed to integrate with Testmo and leverage AI capabilities, specifically from OpenAI, to assist with test case generation and management.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd testmo-ai-helper
    ```

2.  **Install root dependencies:**
    These are mainly for running tests.
    ```bash
    npm install
    ```

3.  **Install server dependencies:**
    Navigate to the `server` directory and install its dependencies.
    ```bash
    cd server
    npm install
    ```

## Configuration

The server requires environment variables to connect to external services like OpenAI and Testmo.

1.  **Create a `.env` file** in the `server/` directory by copying the example file:
    ```bash
    cp .env.example .env
    ```

2.  **Edit the `.env` file** and add your credentials:
    ```
    # OpenAI API Key
    OPENAI_API_KEY="your_openai_api_key"

    # Testmo Configuration
    TESTMO_URL="https://yourcompany.testmo.net"
    TESTMO_TOKEN="your_testmo_api_token"
    ```

## Running the Application

### Development Mode

To run the server in development mode with hot-reloading (thanks to `tsx`), run the following command from the `server/` directory:

```bash
npm run dev
```

The server will start, typically on port 3000.

### Running Tests

To run the test suite, execute the following command from the **root** directory:

```bash
npm test
```
=======
# Test-What-You-See.-Write-as-You-Go.
Turn exploratory testing into living documentation. Select any UI element, describe its behavior, and let AI generate structured test cases from the real UI. Review and save everything directly to your Test Management System.
>>>>>>> 88395a712bb35ca93b08ba751e88f2d185e8ef16
