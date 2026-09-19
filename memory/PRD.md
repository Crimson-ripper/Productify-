# Productify PRD

## Original problem statement
Build productifynow.com as an ecommerce marketplace for digital products, software, and verified GPU/system rentals, with search and complete marketplace functionality.

## Personas
- Buyer: discovers and purchases digital goods or rents compute.
- Seller: publishes digital goods and submits GPU/system listings for approval.
- Admin: verifies and approves rental submissions.

## Architecture decisions
- React frontend with FastAPI API and MongoDB persistence.
- Bearer JWT sessions for the demo; seeded admin account.
- Productify visual marketplace uses a light commerce surface, dark technical hero, lime action color, and responsive layouts.

## Core requirements
- Marketplace landing page with navigation, categories, search, products, GPU rentals.
- Cart and MOCK checkout.
- Buyer/seller registration and login plus a Google demo entry point.
- Seller and admin role data model with rental approval API.

## Implemented (2025-02-01)
- Seeded products, verified rentals, auth endpoints, orders, seller submission endpoints, admin approval endpoints.
- Built complete marketplace homepage, search/category filtering, product cart, mock checkout, auth modal, responsive mobile presentation.
- Added test IDs to interactive and critical UI elements.

## Backlog
- P0: Connect real Google OAuth and payment provider when credentials are available.
- P1: Add dedicated seller dashboard with document uploads and order analytics.
- P1: Add admin review workspace with proof document preview.
- P2: Add product detail routes, reviews, wishlists, and live rental telemetry.