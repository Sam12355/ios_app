# Stock Nexus React Native Mobile App

Cross-platform mobile app for Stock Nexus inventory management system. Targets both Android and iOS platforms.

## Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- CocoaPods (for iOS)

## Setup

### 1. Install dependencies

```bash
cd react-native
npm install
```

### 2. iOS Setup (macOS only)

```bash
cd ios
pod install
cd ..
```

### 3. Configure Android

Make sure you have Android SDK installed and `ANDROID_HOME` environment variable set.

## Running the App

### Android

```bash
# Start Metro bundler
npm start

# In another terminal, run on Android
npm run android
```

### iOS (macOS only)

```bash
# Start Metro bundler
npm start

# In another terminal, run on iOS
npm run ios
```

## Demo Login

Use these credentials to test the app:

- **Email**: demo@stocknexus.com
- **Password**: password123

## Features

- ✅ Dashboard with real-time stats
- ✅ Stock management (In/Out)
- ✅ Item management
- ✅ Moveout list management
- ✅ ICA Delivery tracking
- ✅ Staff management
- ✅ Analytics & Reports
- ✅ Notifications
- ✅ Settings with theme toggle
- ✅ Branch/Region/District management (Admin)
- ✅ Activity logs
- ✅ User profile management
- ✅ Messaging (Inbox/Chat)

## Project Structure

```
react-native/
├── src/
│   ├── api/           # API client
│   ├── components/    # Shared components
│   ├── models/        # TypeScript models
│   ├── navigation/    # Navigation configuration
│   ├── screens/       # App screens
│   │   ├── auth/      # Authentication screens
│   │   ├── main/      # Main app screens
│   │   └── management/# Admin management screens
│   ├── stores/        # Zustand state stores
│   ├── theme/         # Theme configuration
│   └── App.tsx        # App entry point
├── android/           # Android native code
├── ios/               # iOS native code
├── package.json
└── README.md
```

## Tech Stack

- React Native 0.73.2
- TypeScript
- React Navigation 6
- Zustand (State Management)
- react-native-vector-icons
- react-native-gesture-handler
- react-native-reanimated

## Backend API

The app connects to the Stock Nexus backend API at:
`https://stock-nexus-84-main-2-1.onrender.com/api`

## Troubleshooting

### Metro bundler issues

```bash
npm start -- --reset-cache
```

### Android build issues

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### iOS build issues

```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```
