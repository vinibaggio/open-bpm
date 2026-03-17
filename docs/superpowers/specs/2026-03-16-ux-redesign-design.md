# UX Redesign: Navigation & Screen Structure

## Problem

The current app has three UX issues:

1. **Manual entry as a dedicated tab** — wastes a tab on a form that takes seconds to fill out.
2. **No BLE device management** — sync is hardcoded to Omron BP7150 with no way to see, forget, or re-pair a device.
3. **Destructive "Clear All" button on the readings page** — too easy to hit accidentally, and the real need is deleting individual readings.

## Design Summary

Replace the current 3-tab layout (Readings / Manual Entry / Report) with a 2-tab layout (Readings / Trends) plus a Settings screen accessed via a gear icon.

### Navigation Structure

```
Tab Bar
├── Readings (list icon) — primary screen
├── Trends (chart icon) — BP & HR charts over time
└── [Gear icon in header] → Settings (pushed screen)
```

Manual entry becomes a bottom sheet/modal triggered by a FAB on the Readings tab. The Report tab is removed — PDF export lives in both the Trends tab header (time-scoped) and Settings (full export).

---

## Screen: Readings Tab

The primary screen. Shows all blood pressure readings in reverse chronological order.

### Header
- Title: "Readings"
- Right: gear icon (⚙️) navigates to Settings

### Sync Banner
- Appears below the header when a BLE device is configured in Settings.
- Shows device name and connection status (e.g., "Omron BP7150 connected").
- Contains a "Sync" button that triggers the existing BLE sync flow.
- During sync: button shows a spinner and is disabled, status text updates with progress (e.g., "Scanning...", "Reading blocks 10/60...") — same status messages as the current implementation.
- Hidden when no device is configured — first-time BLE setup happens in Settings.

### Reading List
- FlatList of readings, newest first.
- Each row shows: colored BP classification indicator, systolic/diastolic, heart rate, timestamp, classification label, and source badge ("BLE" or "Manual").
- **Swipe left to delete** individual readings (replaces "Clear All").
- Confirmation alert before deletion.

### Floating Action Button (+)
- Bottom-right FAB opens manual entry as a **bottom sheet / modal**.
- Same form fields as current: systolic, diastolic, heart rate (optional), notes (optional).
- On save: inserts reading, dismisses sheet, list refreshes.
- On cancel/tap-outside: dismisses sheet.

### Empty State
- Illustration + "No readings yet"
- Two CTAs: "Sync from Monitor" (navigates to Settings if no device configured, or triggers sync if device exists) and "Add Manually" (opens the manual entry sheet).

---

## Screen: Trends Tab

Daily dashboard for tracking BP and heart rate over time.

### Header
- Title: "Trends"
- Right side, left to right: "Export PDF" text button, then gear icon (⚙️). The gear icon is consistent across both tabs. "Export PDF" is a text button (not an icon) to make its purpose clear.

### Time Range Picker
- Segmented control: **7D / 30D / 90D / All**
- Defaults to 30D. Selection resets to default when navigating away from the tab.
- Filters both charts and summary stats.

### Blood Pressure Chart
- Line chart with two series: systolic (red) and diastolic (blue).
- Background colored zones show AHA classification bands: Normal (green), Elevated (yellow), Stage 1 (orange), Stage 2 (red).
- X-axis: dates. Y-axis: mmHg.
- Tapping a data point shows the reading detail.

### Heart Rate Chart
- Separate smaller chart below the BP chart.
- Single series in purple.
- Own Y-axis scale (appropriate for HR range ~40-120 bpm).
- Shares the same X-axis time range as the BP chart.

### Summary Stats
- Row of 4 stats below the charts: **Avg BP**, **Avg HR**, **Highest BP** (highlighted red if abnormal), **Reading Count**.
- All scoped to the selected time range.

### Scrolling
- The screen scrolls vertically: time picker → BP chart → HR chart → summary stats.
- On shorter phones the HR chart may start below the fold, which is acceptable since BP is the primary metric.

### Empty State
- "No data yet — add readings to see your trends" with a link to the Readings tab.

---

## Screen: Settings (Pushed)

Accessed via gear icon from either tab. Standard iOS grouped list style (gray background, white grouped rows).

### Bluetooth Monitor Section
- **Saved device row**: Shows device name (e.g., "Omron BP7150"), connection state, and last sync date. "Forget" button (red text) removes the saved device. Note: this is app-level device remembering, not BLE pairing — the BP7150 is a no-pairing variant that connects directly.
- **Scan for Device row**: Triggers BLE discovery using the existing `scanForOmron` logic (scans for Omron service UUIDs). If multiple Omron devices are found, shows a list to select from. Only Omron devices are supported — no multi-vendor discovery. This is where first-time device setup happens.

### Export Section
- **Export All Readings as PDF**: Full export of all readings (not time-scoped). Uses the existing `expo-print` + `expo-sharing` flow. This complements the Trends tab's time-scoped export.

### Data Section
- **Delete All Readings**: Destructive action with red text. Shows confirmation alert ("Delete All Readings" / "Are you sure? This cannot be undone." / Cancel + Delete All). This is the "Clear All" functionality relocated from the main screen.
- Footer text: "This will permanently remove all saved readings. This cannot be undone."

### About Section
- Version number.

---

## What Changes from Current Implementation

| Current | New |
|---------|-----|
| 3 tabs: Readings, Manual Entry, Report | 2 tabs: Readings, Trends |
| Manual entry is a dedicated tab | Manual entry is a bottom sheet from FAB |
| Report is a dedicated tab with date pickers | PDF export from Trends header (time-scoped) and Settings (full) |
| "Clear All" button in readings toolbar | Swipe-to-delete on individual rows; "Delete All" moved to Settings |
| No device management | Settings screen with saved device info, forget, and scan |
| No charts or trends | Trends tab with BP chart, HR chart, and summary stats |
| Sync button always visible | Sync banner only when device is configured |

## What Stays the Same

- SQLite database and `readingRepository` — no schema changes needed.
- BLE protocol implementation (`src/services/ble/`) — scan, connect, sync logic is unchanged.
- `Reading` type with `source: 'manual' | 'ble'` — no changes.
- BP classification logic (`src/utils/bloodPressure.ts`) — used by charts and rows.
- PDF report HTML generation (`src/services/report/`) — reused by both export paths.
- `ReadingRow` component — extended with source badge and swipe-to-delete, but core display logic stays.

## New Dependencies

- `victory-native` + `react-native-svg` — for the Trends tab charts. Chosen over `react-native-chart-kit` for flexibility with AHA zone background customization.
- `react-native-gesture-handler` — new dependency, required for swipe-to-delete gestures. Will require a native rebuild.
- React Native `Modal` — for the manual entry bottom sheet. Using the built-in `Modal` component to avoid pulling in `@gorhom/bottom-sheet` and its peer dependencies (`react-native-reanimated`, `react-native-gesture-handler` setup). A simple slide-up modal is sufficient for this form.

## File Impact

### New Files
- `src/screens/TrendsScreen.tsx` — Trends tab with charts and summary stats
- `src/screens/SettingsScreen.tsx` — Settings grouped list
- `src/components/ManualEntrySheet.tsx` — Bottom sheet wrapping the existing ReadingForm

### Modified Files
- `src/navigation/TabNavigator.tsx` — Replace 3 tabs with 2 tabs + Settings stack
- `src/screens/ReadingListScreen.tsx` — Remove Clear All, add FAB, add sync banner, add swipe-to-delete, add gear icon
- `src/components/ReadingRow.tsx` — Add source badge (BLE/Manual), add swipe-to-delete gesture

### Removed Files
- `src/screens/CaptureScreen.tsx` — Replaced by ManualEntrySheet
- `src/screens/ReportScreen.tsx` — Replaced by export in Trends + Settings
