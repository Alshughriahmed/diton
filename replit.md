# Overview

DitonaChat is a Next.js-based adult video chat platform designed for 18+ users to connect globally through random video matching. The application features real-time WebRTC video communication, advanced filtering by gender and country, VIP subscription tiers with Stripe integration, and comprehensive safety measures including age verification and content moderation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 15.5.2 with React 19.1.1 and TypeScript, using the App Router architecture
- **Styling**: Tailwind CSS for responsive design with mobile-first approach and Arabic language support
- **State Management**: Zustand for persistent profile storage, React hooks and context for session state
- **Real-time Communication**: Socket.io 4.8.1 for messaging and event broadcasting, WebRTC for peer-to-peer video connections

## Authentication & Session Management
- **Provider**: NextAuth 4.24.11 with Google OAuth integration
- **Session Storage**: JWT tokens via secure HTTP-only cookies
- **Age Verification**: Custom JWT-based 18+ verification system with cookie persistence
- **Access Control**: Role-based access (Guest, Authenticated, VIP) with middleware protection

## Real-Time Video System
- **WebRTC Implementation**: Peer-to-peer connections with TURN/STUN server support for NAT traversal
- **Media Features**: Camera switching, beauty filters using MediaPipe, AR masks, audio/video controls
- **Auto-Matching**: Automatic peer switching with 700ms cooldown and filter-aware matching
- **Gesture Controls**: Touch-based navigation with swipe detection for next/prev actions

## Payment & Subscription
- **Payment Processor**: Stripe integration for VIP subscriptions
- **Pricing Tiers**: Daily (€1.49), Weekly (€5.99), Monthly (€16.99), Yearly (€99.99)
- **Feature Gating**: Comprehensive VIP lock system with visual indicators and upsell modals
- **Billing Management**: Stripe Customer Portal for subscription management

## Data Architecture
- **Database**: SQLite with Prisma ORM for development, PostgreSQL-ready for production
- **Caching**: Upstash Redis for real-time like system and queue management
- **State Persistence**: localStorage for user preferences, session storage for temporary data
- **Rate Limiting**: Token bucket algorithm for API endpoint protection

## Security & Safety Features
- **Content Security**: CSP headers, CORS configuration, and security middleware
- **User Protection**: Age verification, abuse reporting system, content moderation tools
- **Privacy Controls**: Country/city hiding options, encrypted communication channels
- **Performance**: Smart caching with TTL, metrics collection, health monitoring

## UI/UX Components
- **Layout System**: 50/50 split layout for mobile optimization with z-index management
- **Interactive Elements**: Professional 8-button toolbar, gesture-based navigation, real-time messaging
- **Accessibility**: ARIA labels, keyboard shortcuts, screen reader support
- **Responsive Design**: Mobile-first with visual viewport API for keyboard handling

## External Dependencies

### Core Runtime Dependencies
- **Next.js**: Web framework and routing
- **React**: UI library with hooks and context
- **NextAuth**: Authentication provider integration
- **Prisma**: Database ORM and migrations
- **Stripe**: Payment processing and subscription management
- **Socket.io**: Real-time communication
- **Zustand**: Client-side state management

### Media & Effects
- **MediaPipe**: Face detection and beauty filters (@mediapipe/face_mesh, @mediapipe/camera_utils, @mediapipe/drawing_utils)
- **WebRTC**: Native browser APIs for video chat
- **Canvas API**: Video effects and AR mask rendering

### Data & Utilities
- **world-countries**: ISO country data and flags
- **jose**: JWT token handling for age verification
- **Tailwind CSS**: Utility-first CSS framework

### External Services
- **Google OAuth**: User authentication
- **Stripe**: Payment processing and webhooks
- **Upstash Redis**: Real-time data caching and queues
- **TURN/STUN Servers**: WebRTC connection assistance for NAT traversal

### Development Tools
- **TypeScript**: Type safety and development experience
- **Playwright**: End-to-end testing framework
- **ESLint**: Code quality and consistency
- **Autoprefixer**: CSS vendor prefixing