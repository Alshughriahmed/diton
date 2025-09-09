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

## Recent Implementation (September 8, 2025)

### Phase 1 Features Complete Implementation

Successfully implemented comprehensive Phase 1 requirements for DitonaChat video platform:

#### Advanced Filtering System
**1. Country Filter**: Dropdown with 2-column layout, search functionality, max 15 countries for VIP (unlimited for free)
**2. Gender Filter**: Clean UI matching theme, max 2 selections for VIP, "All/Male/Female/Couple/LGBT" options
**3. VIP Feature Gating**: FREE_FOR_ALL=1 compatible with internal restrictions and upsell prompts

#### Camera & Media Controls
**4. Camera Switching**: WebRTC-based front/back camera toggle with proper stream replacement
**5. Beauty Effects**: MediaPipe integration for real-time facial enhancement (VIP-only feature)
**6. AR Masks**: Strip-based mask selection system with Jeeliz/MediaPipe backend (VIP-only)

#### Social Features
**7. Like System**: Real-time heart animations, counter persistence, database APIs for tracking
**8. Friends View**: Modal displaying "liked by me" and "liked by them" with online status
**9. Social Integration**: Complete friend management APIs with mock data generation

#### Enhanced Messaging
**10. Message System**: Last 3 messages overlay, emoji quick-send, guest limitations (3 messages max)
**11. Scroll Mode**: Advanced messaging with visual effects and VIP unlimited access
**12. Mobile Optimization**: Keyboard handling with visualViewport and dynamic padding

#### Technical Achievements
- **Zero LSP Errors**: All TypeScript compilation issues resolved
- **API Completeness**: Like, friends, and VIP status endpoints fully functional
- **Mobile-First**: Responsive design with viewport optimization for mobile keyboards
- **Performance**: Optimized state management and efficient event handling
- **VIP Integration**: Comprehensive feature gating with upgrade prompts

All acceptance criteria passed with stable performance, proper error handling, and full mobile compatibility.

## Recent Implementation (September 9, 2025)

### Settings Page Implementation (Phase 1)

Successfully implemented comprehensive settings page with persistent profile store:

#### Core Features
**1. Profile Management**: Full user profile system with display name, avatar upload (DataURL), and personal information
**2. Zustand Store**: Persistent profile store using localStorage with automatic saving (`ditona.profile.v1`)
**3. Settings Page**: Complete `/settings` page with organized sections and modern UI design
**4. Settings Button Integration**: Connected existing ⚙️ button in chat toolbar to navigate to settings page

#### Settings Sections
**Profile**: Avatar upload, display name (24 char limit), with preview for other users
**Translation**: Auto-translate toggle with 9 language options (Arabic, English, German, etc.)
**Privacy**: Hide country/city options (future VIP-gated features)
**Gender**: User gender selection (Male, Female, Couple, LGBT, Other)
**Intro Message**: Auto-sent message toggle with 200 character text area
**Gain Followers**: Social platform integration (Instagram, Snapchat, OnlyFans)
**Likes**: Show likes count preference toggle
**VIP Badge**: Placeholder for future Stripe VIP integration

#### Technical Implementation
- **Type Safety**: Complete TypeScript interfaces for Profile, Social, Gender, and Language types
- **Data Persistence**: Zustand store with localStorage middleware for automatic saving
- **Navigation**: Seamless navigation between chat and settings with back button support
- **Responsive Design**: Mobile-optimized UI with Tailwind CSS styling
- **Form Validation**: Input limits and proper state management
- **Image Handling**: Client-side avatar upload with FileReader DataURL conversion

The settings system is fully functional with real-time updates and persistent storage, providing a solid foundation for future enhancements and VIP feature integration.