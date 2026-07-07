# 🛍️ Full-Stack E-Commerce Platform

Welcome to the documentation for the **Full-Stack E-Commerce Platform**! This repository contains a complete, robust, and production-ready e-commerce solution comprising a **React Native + Expo mobile application**, a **Vite + React administrator dashboard**, and a **Node.js + Express REST API** with fully integrated database management, automated background job syncs, and error tracking.

---

## 🏗️ System Architecture & Workflow

The platform follows a modern, decoupled client-server architecture:

```mermaid
graph TD
    subgraph Mobile Client [📱 Mobile App - Expo Router]
        M_Home[Home Feed & Search]
        M_Details[Product Details]
        M_Cart[Cart & Checkout]
        M_Profile[User Profile & Addresses]
    end

    subgraph Admin Dashboard [🏪 Web Admin Panel - React Vite]
        A_KPI[KPI & Sales Analytics]
        A_Products[Product CRUD & Uploads]
        A_Orders[Order Status & Management]
        A_Customers[Customer Management]
    end

    subgraph Backend Core [⚙️ Express API Server]
        Auth_Clerk[Clerk Auth Middleware]
        Upload_Cloud[Cloudinary Client]
        Payment_Stripe[Stripe SDK Gateway]
        Job_Inngest[Inngest Event Serve Router]
        Db_Mongo[(MongoDB Database)]
    end

    M_Home -->|REST API Requests| Auth_Clerk
    M_Details -->|REST API Requests| Auth_Clerk
    M_Cart -->|Create Payment Intent| Payment_Stripe
    M_Profile -->|Manage Profile/Addresses| Auth_Clerk

    A_KPI -->|Fetch Live Analytics| Auth_Clerk
    A_Products -->|Upload Product Images| Upload_Cloud
    A_Products -->|Sync Product Data| Auth_Clerk
    A_Orders -->|Update Order Status| Auth_Clerk
    A_Customers -->|Get Customer Insights| Auth_Clerk

    Auth_Clerk -->|Read/Write Operations| Db_Mongo
    Job_Inngest -->|Database Syncs| Db_Mongo

    classDef client fill:#3b82f6,stroke:#1d4ed8,color:#fff;
    classDef admin fill:#8b5cf6,stroke:#6d28d9,color:#fff;
    classDef server fill:#10b981,stroke:#047857,color:#fff;
    class Mobile Client client;
    class Admin Dashboard admin;
    class Backend Core server;
```

### 🔐 1. User Synchronization Flow (Clerk ➔ Inngest ➔ MongoDB)
When a user logs in via SSO (Google, Apple, or Email) in the mobile client:
1. **Clerk** handles authentication and issues a secure JWT token.
2. Clerk fires a webhook event (`user.created` or `user.deleted`).
3. The Express Server's Inngest endpoint serving [inngest.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/config/inngest.js) captures the event asynchronously.
4. The background job validates the payload and automatically synchronizes the profile record inside the MongoDB database.

### 💳 2. Secure Stripe Checkout Flow
1. The Mobile Client sends the cart details to the backend `/api/payments/checkout` endpoint.
2. The server initializes a Stripe Payment Intent using [stripe](https://stripe.com) and returns the client secret along with the ephemeral key.
3. The Mobile Client presents the native Stripe payment sheet using `@stripe/stripe-react-native`.
4. Once completed, Stripe posts a signed webhook transaction to `/api/payment/webhook` on [server.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/server.js).
5. The backend validates the signature, creates a record in the Order Collection, and decrements stock counts in the Product Collection.

---

## 🛠️ Technology Stack & Dependencies

The repository is structured as a monorepo consisting of three main sub-projects:

### 1. Backend Core (`/backend`)
*   **Runtime**: Node.js with ES Modules configuration.
*   **Framework**: Express.js (v5) supporting routing, body-parsers, and custom error boundaries.
*   **Database**: MongoDB connected through Mongoose ODM.
*   **Authentication**: `@clerk/express` for token decoding and custom admin middleware verification.
*   **Background Processing**: `inngest` server routing for webhook actions.
*   **Image Management**: `cloudinary` SDK combined with `multer` to handle multi-image product submissions.
*   **Payments**: `stripe` for payment verification and webhooks.

### 2. Admin Dashboard (`/admin`)
*   **Build Tool**: Vite (v7) for instant HMR.
*   **UI Framework**: React (v19) styled with TailwindCSS (v4) and DaisyUI (v5) component templates.
*   **Routing**: React Router (v7) implementing login redirect guards and navigation layouts.
*   **Data Fetching**: TanStack React Query (v5) with Axios for caching, cache invalidation, and optimized request state.
*   **Error Monitoring**: `@sentry/react` for detailed client-side telemetry.

### 3. Mobile App (`/mobile`)
*   **Framework**: React Native with Expo (SDK 54).
*   **Routing**: Expo Router (v6) featuring file-based navigation (Tab & Stack layouts).
*   **Styling**: NativeWind (TailwindCSS v3 engine for React Native).
*   **Authentication**: `@clerk/clerk-expo` + `expo-secure-store` to cache auth session variables securely.
*   **Payments**: `@stripe/stripe-react-native` integrating native system sheets.
*   **State & Syncing**: TanStack React Query (v5) to cache products, user orders, and addresses offline.
*   **Telemetry**: `@sentry/react-native` tracking runtime errors, app freezes, and API request issues.

---

## 📂 Core Directory Structure

Here is a summary of the project architecture:

*   [package.json](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/package.json) - Monorepo dependencies and scripts.
*   **`backend/`**
    *   [backend/package.json](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/package.json) - API dependencies and scripts.
    *   `src/`
        *   [server.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/server.js) - Application entry point.
        *   `config/`
            *   [db.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/config/db.js) - Database connection configuration.
            *   [env.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/config/env.js) - Environment validation.
            *   [inngest.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/config/inngest.js) - Webhook functions mapping.
            *   [cloudinary.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/config/cloudinary.js) - Cloudinary API setup.
        *   `models/`
            *   [user.model.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/models/user.model.js) - User and address schema.
            *   [product.model.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/models/product.model.js) - Product attributes schema.
            *   [order.model.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/models/order.model.js) - Order schema.
            *   [cart.model.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/models/cart.model.js) - Shopping cart schema.
            *   [review.model.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/models/review.model.js) - Product reviews schema.
        *   `routes/`
            *   [admin.route.js](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/backend/src/routes/admin.route.js) - Protected endpoints for administrative actions.
*   **`admin/`**
    *   [admin/package.json](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/admin/package.json) - Dashboard dependencies.
    *   `src/`
        *   [main.jsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/admin/src/main.jsx) - Mounts root application with context providers.
        *   [App.jsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/admin/src/App.jsx) - Application router setup.
        *   `pages/`
            *   [DashboardPage.jsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/admin/src/pages/DashboardPage.jsx) - Main charts and metrics UI.
            *   [ProductsPage.jsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/admin/src/pages/ProductsPage.jsx) - Inventory management view.
            *   [OrdersPage.jsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/admin/src/pages/OrdersPage.jsx) - Customer shipments.
            *   [CustomersPage.jsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/admin/src/pages/CustomersPage.jsx) - Registered accounts.
            *   [LoginPage.jsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/admin/src/pages/LoginPage.jsx) - Secure access check.
*   **`mobile/`**
    *   [mobile/package.json](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/mobile/package.json) - Mobile app configuration.
    *   [app.json](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/mobile/app.json) - Expo project settings.
    *   `app/`
        *   [_layout.tsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/mobile/app/_layout.tsx) - Core layout registering Clerk, Stripe, TanStack Query, and Sentry.
        *   `(tabs)/`
            *   [tabs_layout.tsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/mobile/app/(tabs)/_layout.tsx) - Bottom tab configurations.
            *   [index.tsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/mobile/app/(tabs)/index.tsx) - Mobile store landing screen.
            *   [cart.tsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/mobile/app/(tabs)/cart.tsx) - Cart sheet and payment sheet integration.
            *   [profile.tsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/mobile/app/(tabs)/profile.tsx) - Main account control panel.
        *   `product/`
            *   [[id].tsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/mobile/app/product/%5Bid%5D.tsx) - Dynamic product details and rating view.

---

## 🛠️ Installation & Setup

### 1. Environment Variable Configuration

Create `.env` files in the directories detailed below:

#### 🟦 Backend Configuration (`/backend/.env`)
```bash
NODE_ENV=development
PORT=3000
DB_URL=<YOUR_MONGODB_URI>

CLERK_PUBLISHABLE_KEY=<YOUR_CLERK_PUBLISHABLE_KEY>
CLERK_SECRET_KEY=<YOUR_CLERK_SECRET_KEY>

INNGEST_SIGNING_KEY=<YOUR_INNGEST_SIGNING_KEY>

CLOUDINARY_API_KEY=<YOUR_CLOUDINARY_API_KEY>
CLOUDINARY_API_SECRET=<YOUR_CLOUDINARY_API_SECRET>
CLOUDINARY_CLOUD_NAME=<YOUR_CLOUDINARY_CLOUD_NAME>

ADMIN_EMAIL=<YOUR_ADMIN_EMAIL>
CLIENT_URL=http://localhost:5173

STRIPE_PUBLISHABLE_KEY=<YOUR_STRIPE_PUBLISHABLE_KEY>
STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
STRIPE_WEBHOOK_SECRET=<YOUR_STRIPE_WEBHOOK_SECRET>
```

#### 🟩 Admin Dashboard Configuration (`/admin/.env`)
```bash
VITE_CLERK_PUBLISHABLE_KEY=<YOUR_CLERK_PUBLISHABLE_KEY>
VITE_API_URL=http://localhost:3000/api
VITE_SENTRY_DSN=<YOUR_SENTRY_DSN_ENDPOINT>
```

#### 🟧 Mobile App Configuration (`/mobile/.env`)
```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<YOUR_CLERK_PUBLISHABLE_KEY>
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=<YOUR_STRIPE_PUBLISHABLE_KEY>
SENTRY_AUTH_TOKEN=<YOUR_SENTRY_AUTH_TOKEN>
```

---

### 2. Running the Application Locally

#### Step 1: Install Dependencies
Open your shell at the repository root and install workspace-wide requirements:
```bash
npm install
```

#### Step 2: Set Up and Run the REST API Backend
```bash
cd backend
npm install
# Seed mock product data into your database (optional)
npm run seed:products
# Start in watch mode
npm run dev
```

#### Step 3: Run the Web Admin Panel
```bash
cd admin
npm install
npm run dev
```

#### Step 4: Run the Mobile Client
```bash
cd mobile
npm install
npx expo start
```
*Scan the generated QR code using the Expo Go application on your iOS or Android mobile device.*

---

## 🛡️ Sentry & Error Monitoring
Error handling is integrated globally:
1. **Frontend Client & Router**: Custom catches log unhandled exceptions directly to Sentry.
2. **React Query Boundaries**: The main query client in [_layout.tsx](file:///c:/Users/Dell/OneDrive/Desktop/nelson/App%20Development%20Project/expo-ecommerce/mobile/app/_layout.tsx) captures network and response errors globally through custom query and mutation cache interceptors.
3. **Backend Middleware**: Catch-all Express middleware registers stack traces and alerts.
