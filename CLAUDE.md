# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Blood Pressure Tracker — a personal iOS app (with future Android path) for tracking blood pressure readings. Users photograph their BP monitor display, OCR extracts the values, readings are stored locally, and a printable PDF report can be generated for clinician visits.

## Tech Stack

- React Native + Expo SDK 55 (TypeScript)
- SQLite (expo-sqlite) for local storage
- expo-text-extractor for OCR (Apple Vision on iOS, Google ML Kit on Android)
- expo-print for PDF generation, expo-sharing for export
- expo-camera for photo capture
- @react-navigation/bottom-tabs for navigation

## Common Commands

```bash
npm start              # Start Expo dev server
npm test               # Run all tests (Jest)
npx jest path/to/test  # Run a single test file
npm run typecheck       # TypeScript type checking (tsc --noEmit)
npx expo start --ios   # Run on iOS simulator
```

## Architecture

### Directory Structure

- `src/types/` — TypeScript interfaces (Reading)
- `src/utils/` — Pure utility functions (BP classification, thresholds, colors)
- `src/services/ocr/` — OCR interface (`OCRService`), platform implementation, and BP text parser
- `src/services/database/` — SQLite setup and reading CRUD repository
- `src/services/report/` — HTML report generator for PDF export
- `src/screens/` — Three tab screens: ReadingList, Capture, Report
- `src/components/` — Reusable UI components (ReadingRow, ReadingForm)
- `src/navigation/` — Bottom tab navigator

### OCR Subsystem

The OCR layer uses a platform-agnostic `OCRService` interface (`src/services/ocr/types.ts`) so implementations can be swapped per platform. Currently uses `expo-text-extractor` which wraps Apple Vision (iOS) and Google ML Kit (Android).

The JS-side BP parser (`src/services/ocr/bpParser.ts`) is intentionally separate from the OCR service — it takes raw text strings and extracts systolic/diastolic/heart rate. This keeps parsing logic shared, testable, and platform-independent.

### Abnormal Value Thresholds

BP classification is in `src/utils/bloodPressure.ts` (AHA guidelines). Shared between the reading list UI (colored indicators) and PDF report (highlighted rows).

## Design Spec

Full design spec at `docs/superpowers/specs/2026-03-14-bloodpressure-app-design.md`.
