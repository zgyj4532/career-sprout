# AI Resume Builder - Frontend

React + Vite frontend for the AI Resume Builder application.

## Quick Start

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Copy `.env.example` to `.env` and set the Clerk publishable key for the intended instance. Never put a Clerk secret key in frontend environment variables.

## Authentication SDK

The frontend uses Clerk Core 3 (`@clerk/react` 6.18.6 and `@clerk/localizations` 4.24.6), requiring Node.js 20.9 or later. Campus authentication uses the official `SignIn` and `SignUp` components with the official Chinese dictionary and local branding overrides.

Keep Clerk's default browser runtime loading and UI prefetch enabled. The SDK loads the latest stable ClerkJS 6.x and UI 1.x; challenged sign-ups require ClerkJS 6.36.0+ and UI 1.38.0+. Do not add private script/version overrides, switch to legacy custom authentication APIs, or disable Protect rules to bypass a challenge. After dependency upgrades, browser acceptance must confirm the served runtime versions and successful challenge/session completion; mocked form tests do not establish this.


## Features

- Modern React 19 with Vite
- TailwindCSS 4 for styling
- Clerk Authentication
- Responsive design
- Framer Motion animations
- PDF generation with jsPDF
