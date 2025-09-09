# Overview
DitonaChat is a Next.js-based video chat platform designed for connecting users globally for 18+ adult conversations. It features a modern React frontend, real-time video communication via WebRTC, user authentication with NextAuth, and premium subscription management through Stripe. The platform emphasizes a rich user experience with features like AR masks, translation services, social interactions, and robust safety/moderation tools, aiming to provide a secure and engaging environment for adult communication.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture
## Frontend
- **Framework**: Next.js 15.5.2 (React 19.1.1, TypeScript), utilizing the App Router.
- **UI/UX**: Component-based architecture with Tailwind CSS for responsive design and Arabic language support. Features include a professional 8-button toolbar, `PeerInfoCard` for peer details, `PeerMetadata` for contextual information (country, gender, age), and `MyControls` for personal camera/beauty settings.
- **State Management**: React hooks and context API, with Zustand for persistent profile storage (e.g., `ditona.profile.v1` in localStorage).
- **Navigation**: Client-side routing with protected routes and middleware, including seamless navigation between chat and settings.

## Authentication & Session Management
- **Provider**: NextAuth 4.24.11 with Google OAuth for user authentication.
- **Session**: JWT tokens via secure HTTP-only cookies.
- **Access Control**: Cookie-based 18+ age verification and role-based access (Guest, Authenticated, VIP).

## Real-Time Communication
- **Video Chat**: WebRTC for peer-to-peer connections, supported by TURN/STUN servers for NAT traversal.
- **Messaging & Events**: Socket.io 4.8.1 for real-time messaging and event broadcasting.
- **Features**: Auto-Next for automatic peer switching, custom media bridge for gesture detection, and enhanced media controls (audio, mask toggles).

## Payment & Subscription
- **Processor**: Stripe for VIP subscription management, supporting multiple pricing plans (daily, weekly, monthly, yearly).
- **Integration**: Stripe Checkout for hosted payment pages and Stripe Customer Portal for billing management.
- **Monetization**: Comprehensive VIP lock system with visual indicators (🔒) and a dynamic upsell modal that provides feature-specific content.

## Security & Safety
- **Policies**: Content Security Policy (CSP) headers and request throttling for sensitive endpoints.
- **User Protection**: Mandatory 18+ age verification, in-app reporting system for abuse, and moderation tools.

## Performance & Monitoring
- **Optimization**: Smart caching with TTL support.
- **Telemetry**: Metrics API for WebRTC stats, client-side error monitoring, and health checks.

## Enhanced Features
- **Visuals**: AR Masks (Jeeliz/MediaPipe), beauty effects (MediaPipe), and screen effects.
- **Social**: Friends system with "liked by me" and "liked by them" views, like system with real-time animations.
- **Matching**: Gender and country filtering with VIP gating and intelligent upsell prompts, camera switching, and auto-next functionality.
- **Localization**: Multi-language support with real-time translation options.
- **Interaction**: Gesture-based navigation (swipe for Next/Previous), custom toast notification system for user feedback, and advanced messaging features.

# External Dependencies
## Core Technologies
- **Next.js**: Full-stack React framework.
- **React**: Frontend UI library.
- **TypeScript**: Type-safe development.
- **Socket.io-client**: Real-time communication.

## Authentication Services
- **NextAuth**: Authentication library.
- **Google OAuth**: Primary authentication provider.

## Payment Processing
- **Stripe**: Payment gateway for subscriptions.

## WebRTC Infrastructure
- **TURN/STUN Servers**: For NAT traversal.
- **Google STUN**: Public STUN servers.

## Development Tools
- **ESLint**: Code linting.
- **PNPM**: Package manager.

## Optional Integrations
- **Translation API**: For real-time message translation.
- **Analytics**: For user behavior tracking.
- **Content Moderation**: Automated content filtering.