# Spark Front Client

A modern React application built with TypeScript, Vite, and Tailwind CSS, featuring authentication and routing capabilities.


## Tech Stack

- **Deno** - Runtime and package manager
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router 7** - Client-side routing
- **Tailwind CSS 4** - Utility-first CSS framework
- **DaisyUI** - Component library for Tailwind
- **Zustand** - Lightweight state management
- **React Hook Form** - Form handling and validation
- **Relay** - API communication
- **Heroicons** - Icon library

## Project Structure

```
src/
├── api/
│   ├── auth/                 # GraphQL mutations for login/register/me
│   ├── queries/              # Relay queries plus generated artifacts
│   └── relay/environment.ts  # Relay environment bootstrap
├── assets/                   # Static images (backgrounds, logos, SVGs)
├── auth/
│   ├── components/           # Auth form pieces & social sign-in buttons
│   ├── GoogleAuthProvider.tsx
│   └── Login.tsx             # Public login route
├── components/
│   └── SwitchButton.tsx      # Theme toggle switch used across layouts
├── events/
│   └── Dashboard.tsx         # Placeholder for the events dashboard view
├── hooks/
│   └── useTenantSelection.ts # Encapsulates tenant selection side effects
├── layout/
│   ├── CompanySelector.tsx   # Tenant-switch modal
│   └── Layout.tsx            # Authenticated shell shared by private pages
├── routes/
│   ├── AppRouter.tsx         # Router provider
│   ├── AppRoutes.tsx         # Route definitions
│   └── PrivateRoute.tsx      # Guards authenticated areas
├── shared/
│   ├── Alert.tsx             # Toast/alert component
│   ├── FormInputText.tsx     # Reusable input wrapper
│   ├── LoadingButton.tsx     # Button with loading state
│   └── ThemeToggle.tsx       # DaisyUI-based theme selector
├── store/
│   ├── alertStore.ts         # Zustand slice for alert state
│   └── authStore.ts          # Auth + tenant session state
├── types/
│   └── auth.ts               # Shared auth-related TypeScript types
├── utils/
│   └── index.ts              # Theme tokens shared across components
├── App.tsx                   # Root component
├── App.css / index.css       # Global styles and Tailwind layer overrides
└── main.tsx                  # Vite entry point that mounts the app
```

## Getting Started

### Prerequisites
- Deno

### Installation

1. Clone the repository:
```bash
git clone git@github.com:WERNSA/spark-front.git
cd spark-front
```

2. Install dependencies:
```bash
deno install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
VITE_GRAPHQL_ENDPOINT=http://your-graphql-endpoint.com/graphql
```

4. Compile Relay GraphQL schemas:
```bash
deno run -A npm:relay-compiler
```

5. Start the development server:
```bash
deno run dev
```

The application will be available at `http://localhost:5173`



## Contributing Guide (GitFlow)

### Branch Model

| Branch | Description |
|----------|-------------|
| `main` | Production-ready branch |
| `staging` | Pre-production testing branches |
| `develop` | Integration branch |
| `feature/*` | Created from develop for adding new features |
| `hotfix/*` | Created for urgent fixes |
