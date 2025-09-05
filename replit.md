# Overview

DitonaChat is a Next.js-based video chat platform that connects users with strangers worldwide for 18+ adult conversations. The application features a modern React frontend with real-time video communication capabilities, user authentication through NextAuth, and premium subscription management via Stripe. The platform includes safety features, moderation tools, and enhanced user experience elements like AR masks, translation services, and social features.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 15.5.2 with React 19.1.1 and TypeScript
- **UI Components**: Component-based architecture with dynamic imports for performance
- **Styling**: Tailwind CSS with responsive design and Arabic language support
- **State Management**: React hooks and context for user sessions and VIP status
- **Client-Side Routing**: Next.js App Router with protected routes and middleware

## Authentication & Session Management
- **Provider**: NextAuth 4.24.11 with Google OAuth integration
- **Session Storage**: JWT tokens with secure HTTP-only cookies
- **Age Verification**: Cookie-based age confirmation system for 18+ compliance
- **User Roles**: Guest, authenticated user, and VIP subscription tiers

## Real-Time Communication
- **WebRTC**: Peer-to-peer video chat with TURN/STUN server fallbacks
- **Socket.io**: Real-time messaging and event broadcasting (4.8.1)
- **Media Bridge**: Custom utilities for gesture detection and media stream management
- **Auto-Next**: Automatic peer switching on connection failures or user action

## Payment & Subscription System
- **Payment Processor**: Stripe integration for VIP subscriptions
- **Subscription Tiers**: Multiple pricing plans (daily, weekly, monthly, yearly)
- **Rate Limiting**: API protection for payment endpoints
- **Portal Integration**: Customer billing management through Stripe portal

## Security & Safety
- **Content Security Policy**: Comprehensive CSP headers in middleware
- **Rate Limiting**: Request throttling for sensitive endpoints
- **Age Verification**: Mandatory 18+ confirmation with persistent cookies
- **Reporting System**: In-app abuse reporting and moderation tools

## Performance & Monitoring
- **Caching**: Smart cache implementation with TTL support
- **Metrics API**: Real-time monitoring of system performance and WebRTC stats
- **Error Tracking**: Client-side error monitoring and reporting
- **Health Checks**: System health endpoints for uptime monitoring

## Enhanced Features
- **AR Masks**: Video filter system with multiple mask options
- **Translation**: Multi-language support with real-time translation
- **Friends System**: Social features for user connections
- **Screen Effects**: Visual feedback for user interactions
- **Gender Filtering**: User preference-based matching system

# External Dependencies

## Core Technologies
- **Next.js 15.5.2**: Full-stack React framework with App Router
- **React 19.1.1**: Frontend UI library with concurrent features
- **TypeScript 5.9.2**: Type safety and development tooling
- **Socket.io-client 4.8.1**: Real-time bidirectional communication

## Authentication Services
- **NextAuth 4.24.11**: Authentication library with OAuth providers
- **Google OAuth**: Primary authentication provider integration

## Payment Processing
- **Stripe**: Payment gateway for subscription management
- **Stripe Checkout**: Hosted payment page integration
- **Stripe Customer Portal**: Self-service billing management

## WebRTC Infrastructure
- **TURN/STUN Servers**: ICE server configuration for NAT traversal
- **Google STUN**: Public STUN servers for connection establishment
- **Custom TURN**: Environment-configurable TURN server support

## Development Tools
- **ESLint 9.34.0**: Code linting and style enforcement
- **PNPM**: Package manager for dependency management
- **TypeScript ESLint**: TypeScript-specific linting rules

## Optional Integrations
- **Translation API**: External service for real-time message translation
- **Analytics**: User behavior tracking and metrics collection
- **Content Moderation**: Automated content filtering and safety systems