# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Blood Pressure Tracker — a personal iOS app (with future Android path) for tracking blood pressure readings. Users photograph their BP monitor display, OCR extracts the values, readings are stored locally, and a printable PDF report can be generated for clinician visits.

## Tech Stack

- React Native + Expo (managed workflow, eject for native modules as needed)
- SQLite (expo-sqlite) for local storage
- Apple Vision framework (Swift native module) for OCR on iOS
- react-native-html-to-pdf for PDF report generation
- expo-camera, expo-sharing

## Architecture

### OCR Subsystem

The OCR layer uses a platform-agnostic `OCRService` interface so implementations can be swapped per platform:
- iOS: Apple Vision (Swift native module)
- Android (future): Google ML Kit

The JS-side BP value parser is intentionally separate from the OCR service — it takes raw text strings and extracts systolic/diastolic/heart rate. This keeps parsing logic shared, testable, and platform-independent.

### Abnormal Value Thresholds

Based on AHA guidelines. Defined once and shared between the reading list UI (colored indicators) and PDF report (highlighted rows). See `docs/superpowers/specs/2026-03-14-bloodpressure-app-design.md` for the threshold table.

## Design Spec

Full design spec at `docs/superpowers/specs/2026-03-14-bloodpressure-app-design.md`.
