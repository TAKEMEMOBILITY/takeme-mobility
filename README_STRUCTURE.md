# Ride App - MVP Structure

## Project Overview
Professional rideshare booking app built with Next.js and Tailwind CSS.

## Directory Structure
```
app/
├── page.tsx                 # Booking homepage
├── layout.tsx               # Root layout
├── auth/
│   ├── login/page.tsx       # Login page
│   ├── signup/page.tsx      # Signup page
│   └── layout.tsx           # Auth layout
├── dashboard/
│   ├── page.tsx             # User dashboard
│   └── layout.tsx           # Dashboard layout
└── api/
    └── auth/
        ├── login/route.ts   # Login API
        └── signup/route.ts  # Signup API

components/                 # Reusable React components
lib/
├── constants.ts             # App constants
└── utils.ts                 # Utility functions
types/
└── index.ts                 # TypeScript types

public/                     # Static assets
```

## Features
- ✅ Ride booking form with pickup/dropoff inputs
- ✅ Multiple ride type options
- ✅ Estimated fare calculation
- ✅ User authentication (auth pages)
- ✅ Dashboard with ride history
- ✅ Responsive mobile design

## To Build
- Implement actual authentication with JWT/sessions
- Add maps integration (Google Maps/Mapbox)
- Connect database for user/ride persistence
- Deploy to Vercel
