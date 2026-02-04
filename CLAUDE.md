# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Expo React Native application called "little-pieces" that uses:
- **Expo SDK 54** with the new architecture enabled (`newArchEnabled: true`)
- **React 19.1.0** and **React Native 0.81.5**
- **Expo Router 6** with typed routes and file-based navigation
- **React Compiler** enabled (experimental)
- **Node.js 24** (specified in .nvmrc)

The app supports iOS, Android, and web platforms with automatic dark/light theme switching.

## Development Commands

### Running the App
```bash
npm start                 # Start Expo dev server
npm run android          # Run on Android (dev build)
npm run ios              # Run on iOS (dev build)
npm run web              # Run on web
```

### Code Quality
```bash
npm run lint             # Run ESLint (uses expo's flat config)
```

### Reset Project
```bash
npm run reset-project    # Moves current app/ to app-example/ for fresh start
```

## Architecture

### File-Based Routing (Expo Router)

The app uses Expo Router's file-based routing system:

- **`app/_layout.tsx`**: Root layout with theme provider and navigation setup
  - Wraps app with `ThemeProvider` from `@react-navigation/native`
  - Configures Stack navigator with tabs as anchor point (`unstable_settings.anchor`)
  - Includes modal route configuration

- **`app/(tabs)/_layout.tsx`**: Tab navigation layout
  - Two tabs: "Home" (index) and "Explore"
  - Uses custom `HapticTab` component for tactile feedback
  - Tab bar colors configured via theme system

- **`app/(tabs)/index.tsx`**: Home screen
- **`app/(tabs)/explore.tsx`**: Explore screen
- **`app/modal.tsx`**: Modal screen (presented as modal)

### Theming System

The app has a comprehensive theming system with dark/light mode support:

1. **`constants/theme.ts`**: Central theme configuration
   - Exports `Colors` object with light/dark color schemes
   - Exports `Fonts` object with platform-specific font families (iOS, web, default)
   - Color tokens: text, background, tint, icon, tabIconDefault, tabIconSelected

2. **`hooks/use-color-scheme.ts`**: Re-exports React Native's `useColorScheme` hook

3. **`hooks/use-theme-color.ts`**: Theme color resolution hook
   - Accepts light/dark color overrides via props
   - Falls back to theme constants
   - Typed to ensure color names exist in both themes

4. **Themed Components**: All use the theme system
   - `components/themed-text.tsx`: Text with theme colors and type variants (default, title, subtitle, link, defaultSemiBold)
   - `components/themed-view.tsx`: View with theme-aware background colors
   - Both accept `lightColor`/`darkColor` props for overrides

### Component Patterns

- **`components/ui/icon-symbol.tsx`**: Cross-platform icon component
  - iOS version (`icon-symbol.ios.tsx`) uses SF Symbols
  - Default version uses Expo vector icons

- **`components/haptic-tab.tsx`**: Tab bar button with haptic feedback (uses `expo-haptics`)

- **`components/parallax-scroll-view.tsx`**: Scrollable view with parallax header effect

- **`components/collapsible.tsx`**: Expandable/collapsible content container

### Path Aliases

TypeScript is configured with path aliases in `tsconfig.json`:
- `@/*` maps to root directory
- Example: `import { Colors } from '@/constants/theme'`

### Platform-Specific Code

The codebase uses React Native's `Platform` API and platform-specific file extensions:
- Use `Platform.select()` for conditional values
- Use `.ios.tsx`, `.android.tsx`, `.web.tsx` for platform-specific implementations

## Important Configuration Notes

1. **New Architecture**: This project has React Native's new architecture enabled in app.json (`newArchEnabled: true`). Be mindful of compatibility when adding libraries.

2. **Expo Router Experiments**:
   - `typedRoutes: true` - Routes are type-safe
   - `reactCompiler: true` - Using experimental React Compiler

3. **Edge-to-Edge**: Android is configured with `edgeToEdgeEnabled: true`, meaning content can extend under system bars.

4. **Bundle Identifier**: iOS bundle ID is `com.anonymous.little-pieces`

5. **Scheme**: Deep linking scheme is `littlepieces://`

## Adding New Features

### Adding a New Screen
1. Create file in `app/` or `app/(tabs)/` directory
2. Export default component
3. Route is automatically available based on file name

### Adding a New Themed Component
1. Import `useThemeColor` from `@/hooks/use-theme-color`
2. Accept optional `lightColor`/`darkColor` props
3. Use theme color tokens from `Colors` object

### Adding Icons
- Use `IconSymbol` component from `@/components/ui/icon-symbol`
- On iOS, it uses SF Symbols (check Apple's SF Symbols app for available names)
- On other platforms, uses Expo vector icons

## Development Workflow

1. The dev server supports Fast Refresh for quick iteration
2. Press `cmd+d` (iOS), `cmd+m` (Android), or `F12` (web) to open dev tools
3. TypeScript strict mode is enabled
4. ESLint uses Expo's flat config format (eslint.config.js)
