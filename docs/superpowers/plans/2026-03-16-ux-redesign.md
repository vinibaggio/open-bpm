# UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-tab layout (Readings / Manual Entry / Report) with a 2-tab layout (Readings / Trends) plus a Settings pushed screen, adding charts, swipe-to-delete, manual entry modal, and BLE device management.

**Architecture:** Two bottom tabs (Readings, Trends) with a shared Settings screen pushed via stack navigation from a gear icon. Manual entry opens as a slide-up Modal from a FAB on the Readings tab. BLE device info persisted via AsyncStorage. Trends tab uses victory-native for BP and HR line charts.

**Tech Stack:** React Native + Expo SDK 55, victory-native + react-native-svg (charts), react-native-gesture-handler (swipe-to-delete), AsyncStorage (device persistence), React Native Modal (manual entry sheet).

**Spec:** `docs/superpowers/specs/2026-03-16-ux-redesign-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/services/device/deviceStorage.ts` | Persist/retrieve saved BLE device info (name, id, lastSyncDate) via AsyncStorage |
| `src/services/device/__tests__/deviceStorage.test.ts` | Tests for device storage |
| `src/components/ManualEntrySheet.tsx` | Modal wrapping ReadingForm for slide-up manual entry |
| `src/components/SwipeableRow.tsx` | Swipeable wrapper providing swipe-left-to-delete on any child |
| `src/screens/SettingsScreen.tsx` | Grouped list: BLE device management, export, delete all, about |
| `src/screens/TrendsScreen.tsx` | BP chart, HR chart, time range picker, summary stats, export PDF |
| `src/screens/__tests__/TrendsScreen.test.tsx` | Tests for summary stat calculations |

### Modified Files
| File | Changes |
|------|---------|
| `package.json` | Add victory-native, react-native-svg, react-native-gesture-handler, @react-native-async-storage/async-storage, @react-navigation/native-stack |
| `App.tsx` | Wrap root with GestureHandlerRootView |
| `src/navigation/TabNavigator.tsx` | Replace 3 tabs with 2 tabs + native stack for Settings |
| `src/screens/ReadingListScreen.tsx` | Remove Clear All, add FAB, add sync banner, add gear icon header, use SwipeableRow, use ManualEntrySheet |
| `src/components/ReadingRow.tsx` | Add source badge (BLE/Manual) |

### Removed Files
| File | Reason |
|------|--------|
| `src/screens/CaptureScreen.tsx` | Replaced by ManualEntrySheet |
| `src/screens/ReportScreen.tsx` | Replaced by export in Trends + Settings |

---

## Chunk 1: Foundation — Dependencies, Device Storage, Navigation Shell

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `App.tsx`

- [ ] **Step 1: Install npm packages**

```bash
npx expo install react-native-svg react-native-gesture-handler @react-native-async-storage/async-storage
npm install victory-native
```

Note: `react-native-svg` and `react-native-gesture-handler` require a native rebuild. `@react-native-async-storage/async-storage` is needed for persisting saved device info. `victory-native` provides the charting library.

- [ ] **Step 2: Update jest transform ignore patterns**

In `package.json`, update the `transformIgnorePatterns` to include the new packages:

```json
"transformIgnorePatterns": [
  "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|native-base|react-native-svg|victory-native|victory-.*|@react-native-async-storage/.*|d3-.*)"
]
```

- [ ] **Step 3: Wrap root with GestureHandlerRootView**

In `App.tsx`, wrap the NavigationContainer:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 4: Verify existing tests still pass**

```bash
npm test
```

Expected: All 5 existing test suites pass.

- [ ] **Step 5: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json App.tsx
git commit -m "chore: add victory-native, gesture-handler, async-storage dependencies"
```

---

### Task 2: Device Storage Service

**Files:**
- Create: `src/services/device/deviceStorage.ts`
- Create: `src/services/device/__tests__/deviceStorage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/device/__tests__/deviceStorage.test.ts`:

```typescript
import {
  getSavedDevice,
  saveDevice,
  forgetDevice,
  updateLastSyncDate,
  SavedDevice,
} from '../deviceStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('deviceStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSavedDevice', () => {
    it('returns null when no device is saved', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      const result = await getSavedDevice();
      expect(result).toBeNull();
    });

    it('returns parsed device when saved', async () => {
      const device: SavedDevice = {
        id: 'abc-123',
        name: 'Omron BP7150',
        lastSyncDate: '2026-03-15T10:00:00.000Z',
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(device));
      const result = await getSavedDevice();
      expect(result).toEqual(device);
    });
  });

  describe('saveDevice', () => {
    it('persists device to storage', async () => {
      await saveDevice('abc-123', 'Omron BP7150');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@saved_device',
        expect.stringContaining('"id":"abc-123"')
      );
    });
  });

  describe('forgetDevice', () => {
    it('removes device from storage', async () => {
      await forgetDevice();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@saved_device');
    });
  });

  describe('updateLastSyncDate', () => {
    it('updates lastSyncDate on existing device', async () => {
      const device: SavedDevice = {
        id: 'abc-123',
        name: 'Omron BP7150',
        lastSyncDate: null,
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(device));
      await updateLastSyncDate();
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@saved_device',
        expect.stringContaining('"id":"abc-123"')
      );
    });

    it('does nothing when no device is saved', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      await updateLastSyncDate();
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/services/device/__tests__/deviceStorage.test.ts -v
```

Expected: FAIL — module `../deviceStorage` not found.

- [ ] **Step 3: Implement device storage**

Create `src/services/device/deviceStorage.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@saved_device';

export interface SavedDevice {
  id: string;
  name: string;
  lastSyncDate: string | null;
}

export async function getSavedDevice(): Promise<SavedDevice | null> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  if (!json) return null;
  return JSON.parse(json) as SavedDevice;
}

export async function saveDevice(id: string, name: string): Promise<void> {
  const device: SavedDevice = { id, name, lastSyncDate: null };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(device));
}

export async function forgetDevice(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function updateLastSyncDate(): Promise<void> {
  const device = await getSavedDevice();
  if (!device) return;
  device.lastSyncDate = new Date().toISOString();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(device));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/services/device/__tests__/deviceStorage.test.ts -v
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All test suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/device/
git commit -m "feat: add device storage service for BLE device persistence"
```

---

### Task 3: Navigation Restructure — 2 Tabs + Stack

**Files:**
- Modify: `src/navigation/TabNavigator.tsx`
- Create: `src/screens/TrendsScreen.tsx` (placeholder)
- Create: `src/screens/SettingsScreen.tsx` (placeholder)

- [ ] **Step 1: Create placeholder TrendsScreen**

Create `src/screens/TrendsScreen.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function TrendsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Trends — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  placeholder: { fontSize: 16, color: '#999' },
});
```

- [ ] **Step 2: Create placeholder SettingsScreen**

Create `src/screens/SettingsScreen.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Settings — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  placeholder: { fontSize: 16, color: '#999' },
});
```

- [ ] **Step 3: Install native stack navigator**

```bash
npm install @react-navigation/native-stack
```

- [ ] **Step 4: Rewrite TabNavigator with 2 tabs + stack**

Replace `src/navigation/TabNavigator.tsx`:

```tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import ReadingListScreen from '../screens/ReadingListScreen';
import TrendsScreen from '../screens/TrendsScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
  Tabs: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function SettingsButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Settings')}
      style={{ marginRight: 16 }}
    >
      <Ionicons name="settings-outline" size={22} color="#2196F3" />
    </TouchableOpacity>
  );
}

function TabsScreen() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
        headerRight: () => <SettingsButton />,
      })}
    >
      <Tab.Screen
        name="Readings"
        component={ReadingListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Trends"
        component={TrendsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Tabs"
        component={TabsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: true }}
      />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 5: Update App.tsx import**

In `App.tsx`, the import already points to `TabNavigator` — since we renamed the default export to `RootNavigator`, update the import:

```tsx
import RootNavigator from './src/navigation/TabNavigator';
// ...
<RootNavigator />
```

- [ ] **Step 6: Verify typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Verify tests pass**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/navigation/TabNavigator.tsx src/screens/TrendsScreen.tsx src/screens/SettingsScreen.tsx App.tsx package.json package-lock.json
git commit -m "feat: restructure navigation to 2 tabs (Readings + Trends) with Settings stack"
```

---

## Chunk 2: Readings Tab — Source Badge, Swipe-to-Delete, Manual Entry Modal, FAB

### Task 4: Add Source Badge to ReadingRow

**Files:**
- Modify: `src/components/ReadingRow.tsx`

- [ ] **Step 1: Add source badge to ReadingRow**

In `src/components/ReadingRow.tsx`, update the `meta` Text to include a source badge:

```tsx
<Text style={styles.meta}>
  {dateStr} {timeStr} · {label} ·{' '}
  <Text style={reading.source === 'ble' ? styles.bleBadge : styles.manualBadge}>
    {reading.source === 'ble' ? 'BLE' : 'Manual'}
  </Text>
</Text>
```

Add to the StyleSheet:

```typescript
bleBadge: { color: '#2196F3', fontWeight: '600' },
manualBadge: { color: '#888' },
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ReadingRow.tsx
git commit -m "feat: add source badge (BLE/Manual) to ReadingRow"
```

---

### Task 5: SwipeableRow Component

**Files:**
- Create: `src/components/SwipeableRow.tsx`

- [ ] **Step 1: Create SwipeableRow**

Create `src/components/SwipeableRow.tsx`:

```tsx
import { useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
}

export default function SwipeableRow({ children, onDelete }: Props) {
  const swipeableRef = useRef<Swipeable>(null);

  function renderRightActions(
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <RectButton style={styles.deleteAction} onPress={onDelete}>
        <Animated.Text style={[styles.deleteText, { transform: [{ scale }] }]}>
          Delete
        </Animated.Text>
      </RectButton>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    width: 80,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SwipeableRow.tsx
git commit -m "feat: add SwipeableRow component for swipe-to-delete gesture"
```

---

### Task 6: ManualEntrySheet Component

**Files:**
- Create: `src/components/ManualEntrySheet.tsx`

- [ ] **Step 1: Create ManualEntrySheet**

Create `src/components/ManualEntrySheet.tsx`:

```tsx
import { Modal, View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import ReadingForm from './ReadingForm';

interface Props {
  visible: boolean;
  onSave: (systolic: number, diastolic: number, heartRate: number | null, notes: string | null) => void;
  onClose: () => void;
}

export default function ManualEntrySheet({ visible, onSave, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Manual Entry</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.formContainer}>
          <ReadingForm
            onSave={onSave}
            onCancel={onClose}
          />
        </ScrollView>

Note: `ReadingForm`'s cancel button is labeled "Clear" (resets the form). Inside the modal, the header "Cancel" button dismisses the sheet, while the form's "Clear" button resets the fields without closing. This gives the user two distinct actions. If this feels confusing, the form's `onCancel` prop could be renamed to `onReset` and the button relabeled to "Reset" in a follow-up.
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#333' },
  closeBtn: { fontSize: 16, color: '#2196F3' },
  formContainer: { flex: 1 },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ManualEntrySheet.tsx
git commit -m "feat: add ManualEntrySheet modal wrapping ReadingForm"
```

---

### Task 7: Overhaul ReadingListScreen

**Files:**
- Modify: `src/screens/ReadingListScreen.tsx`

This is the biggest change. The screen gets: sync banner (conditional on saved device), FAB, swipe-to-delete, gear icon already handled by navigation, and removal of the Clear All button.

- [ ] **Step 1: Rewrite ReadingListScreen**

Replace the entire content of `src/screens/ReadingListScreen.tsx`:

```tsx
import { useCallback, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Reading } from '../types/reading';
import {
  getAllReadings,
  deleteReading,
} from '../services/database/readingRepository';
import ReadingRow from '../components/ReadingRow';
import SwipeableRow from '../components/SwipeableRow';
import ManualEntrySheet from '../components/ManualEntrySheet';
import { scanForOmron, syncReadings } from '../services/ble/bleSync';
import { addReading } from '../services/database/readingRepository';
import { getSavedDevice, updateLastSyncDate, SavedDevice } from '../services/device/deviceStorage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/TabNavigator';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function ReadingListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [savedDevice, setSavedDevice] = useState<SavedDevice | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [data, device] = await Promise.all([
      getAllReadings(),
      getSavedDevice(),
    ]);
    setReadings(data);
    setSavedDevice(device);
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    setStatus('Scanning...');
    try {
      const device = await scanForOmron(setStatus);
      const imported = await syncReadings(device, setStatus);
      if (imported > 0) {
        await updateLastSyncDate();
        const updated = await getAllReadings();
        setReadings(updated);
      }
      setTimeout(() => setStatus(null), 3000);
    } catch (e: any) {
      Alert.alert('Sync Error', e.message || 'Failed to sync.');
      setStatus(null);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteReading(id: string) {
    Alert.alert(
      'Delete Reading',
      'Are you sure you want to delete this reading?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteReading(id);
            setReadings((prev) => prev.filter((r) => r.id !== id));
          },
        },
      ]
    );
  }

  async function handleManualSave(
    systolic: number,
    diastolic: number,
    heartRate: number | null,
    notes: string | null
  ) {
    const reading: Reading = {
      id: uuidv4(),
      systolic,
      diastolic,
      heartRate,
      timestamp: new Date().toISOString(),
      notes,
      source: 'manual',
    };
    await addReading(reading);
    setShowManualEntry(false);
    const updated = await getAllReadings();
    setReadings(updated);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (readings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyTitle}>No readings yet</Text>
          <Text style={styles.emptyHint}>
            Take a reading on your Omron monitor, then sync it here, or add one manually.
          </Text>
        </View>
        <View style={styles.emptyActions}>
          {status && (
            <View style={styles.statusBanner}>
              <ActivityIndicator size="small" color="#2196F3" style={{ marginRight: 8 }} />
              <Text style={styles.statusBannerText}>{status}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, syncing && styles.disabledBtn]}
            onPress={savedDevice ? handleSync : () => navigation.navigate('Settings')}
            disabled={syncing}
          >
            <Text style={styles.actionBtnText}>
              {savedDevice ? 'Sync from Monitor' : 'Set Up Monitor'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={() => setShowManualEntry(true)}
          >
            <Text style={[styles.actionBtnText, styles.secondaryBtnText]}>Add Manually</Text>
          </TouchableOpacity>
        </View>
        <ManualEntrySheet
          visible={showManualEntry}
          onSave={handleManualSave}
          onClose={() => setShowManualEntry(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sync banner — only when device is configured */}
      {savedDevice && (
        <View style={styles.syncBanner}>
          {status ? (
            <View style={styles.syncBannerStatus}>
              <ActivityIndicator size="small" color="#1565C0" style={{ marginRight: 8 }} />
              <Text style={styles.syncBannerStatusText}>{status}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.syncBannerDevice}>{savedDevice.name}</Text>
              <TouchableOpacity
                style={[styles.syncBannerBtn, syncing && styles.disabledBtn]}
                onPress={handleSync}
                disabled={syncing}
              >
                <Text style={styles.syncBannerBtnText}>Sync</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <FlatList
        data={readings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableRow onDelete={() => handleDeleteReading(item.id)}>
            <ReadingRow reading={item} />
          </SwipeableRow>
        )}
        style={styles.list}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowManualEntry(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <ManualEntrySheet
        visible={showManualEntry}
        onSave={handleManualSave}
        onClose={() => setShowManualEntry(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },

  // Sync banner
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  syncBannerDevice: { fontSize: 13, color: '#1565C0' },
  syncBannerBtn: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncBannerBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  syncBannerStatus: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  syncBannerStatusText: { fontSize: 13, color: '#1565C0' },

  // Empty state
  emptyContainer: { flex: 1, backgroundColor: '#fff' },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyActions: {
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  actionBtn: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  secondaryBtnText: {
    color: '#2196F3',
  },

  // Status
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
  },
  statusBannerText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 30 },

  disabledBtn: { opacity: 0.5 },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Verify tests pass**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ReadingListScreen.tsx
git commit -m "feat: overhaul ReadingListScreen with FAB, sync banner, swipe-to-delete"
```

---

## Chunk 3: Settings Screen

### Task 8: Implement Settings Screen

**Files:**
- Modify: `src/screens/SettingsScreen.tsx` (replace placeholder)

- [ ] **Step 1: Implement SettingsScreen**

Replace `src/screens/SettingsScreen.tsx`:

```tsx
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getSavedDevice, saveDevice, forgetDevice, SavedDevice } from '../services/device/deviceStorage';
import { scanForOmron } from '../services/ble/bleSync';
import { getAllReadings, deleteAllReadings } from '../services/database/readingRepository';
import { generateReportHtml } from '../services/report/reportHtml';

export default function SettingsScreen() {
  const [device, setDevice] = useState<SavedDevice | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      getSavedDevice().then((d) => {
        setDevice(d);
        setLoading(false);
      });
    }, [])
  );

  async function handleScan() {
    setScanning(true);
    try {
      const found = await scanForOmron();
      const name = found.name || found.localName || 'Omron Monitor';
      await saveDevice(found.id, name);
      setDevice({ id: found.id, name, lastSyncDate: null });
      Alert.alert('Device Saved', `${name} has been saved.`);
    } catch (e: any) {
      Alert.alert('Scan Failed', e.message || 'Could not find a device.');
    } finally {
      setScanning(false);
    }
  }

  async function handleForget() {
    Alert.alert('Forget Device', 'Remove this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: async () => {
          await forgetDevice();
          setDevice(null);
        },
      },
    ]);
  }

  async function handleExportAll() {
    const readings = await getAllReadings();
    if (readings.length === 0) {
      Alert.alert('No Data', 'No readings to export.');
      return;
    }
    const html = generateReportHtml(readings, 'All Time', 'Present');
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }

  async function handleDeleteAll() {
    Alert.alert(
      'Delete All Readings',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await deleteAllReadings();
            Alert.alert('Done', 'All readings have been deleted.');
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Bluetooth Monitor */}
      <Text style={styles.sectionHeader}>BLUETOOTH MONITOR</Text>
      <View style={styles.group}>
        {device ? (
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{device.name}</Text>
              <Text style={styles.rowSubtitle}>
                Saved{device.lastSyncDate
                  ? ` · Last synced ${new Date(device.lastSyncDate).toLocaleDateString()}`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={handleForget}>
              <Text style={styles.forgetText}>Forget</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.row, device && styles.rowBorder]}
          onPress={handleScan}
          disabled={scanning}
        >
          <Text style={styles.linkText}>
            {scanning ? 'Scanning...' : 'Scan for Device'}
          </Text>
          {scanning ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Export */}
      <Text style={styles.sectionHeader}>EXPORT</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={handleExportAll}>
          <Text style={styles.rowTitle}>Export All Readings as PDF</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Data */}
      <Text style={styles.sectionHeader}>DATA</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={handleDeleteAll}>
          <Text style={styles.destructiveText}>Delete All Readings</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footer}>
        This will permanently remove all saved readings. This cannot be undone.
      </Text>

      {/* About */}
      <Text style={styles.sectionHeader}>ABOUT</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
  },
  group: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, color: '#333' },
  rowSubtitle: { fontSize: 13, color: '#4CAF50', marginTop: 2 },
  rowValue: { fontSize: 16, color: '#999' },
  chevron: { fontSize: 20, color: '#ccc' },
  linkText: { fontSize: 16, color: '#2196F3' },
  forgetText: { fontSize: 14, color: '#F44336' },
  destructiveText: { fontSize: 16, color: '#F44336' },
  footer: { paddingHorizontal: 16, paddingTop: 8, fontSize: 12, color: '#999', lineHeight: 18 },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Verify tests pass**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: implement Settings screen with BLE device management, export, and data reset"
```

---

## Chunk 4: Trends Screen

### Task 9: Implement Trends Screen with Charts

**Files:**
- Modify: `src/screens/TrendsScreen.tsx` (replace placeholder)

- [ ] **Step 1: Write tests for summary stat calculations**

Create `src/screens/__tests__/TrendsScreen.test.tsx`:

```tsx
// Test the pure calculation logic that will be extracted into the screen.
// We test it as a standalone function to keep tests fast and avoid mocking charts.

import { computeStats } from '../TrendsScreen';
import { Reading } from '../../types/reading';

function makeReading(sys: number, dia: number, hr: number | null): Reading {
  return {
    id: String(Math.random()),
    systolic: sys,
    diastolic: dia,
    heartRate: hr,
    timestamp: new Date().toISOString(),
    notes: null,
    source: 'manual',
  };
}

describe('computeStats', () => {
  it('returns zeroed stats for empty readings', () => {
    const stats = computeStats([]);
    expect(stats.avgSystolic).toBe(0);
    expect(stats.avgDiastolic).toBe(0);
    expect(stats.avgHR).toBe(0);
    expect(stats.highestSystolic).toBe(0);
    expect(stats.highestDiastolic).toBe(0);
    expect(stats.count).toBe(0);
  });

  it('computes correct averages and highest', () => {
    const readings = [
      makeReading(120, 80, 70),
      makeReading(140, 90, 80),
      makeReading(130, 85, null),
    ];
    const stats = computeStats(readings);
    expect(stats.avgSystolic).toBe(130);
    expect(stats.avgDiastolic).toBe(85);
    expect(stats.avgHR).toBe(75); // average of 70 and 80 (null excluded)
    expect(stats.highestSystolic).toBe(140);
    expect(stats.highestDiastolic).toBe(90);
    expect(stats.count).toBe(3);
  });

  it('handles all null heart rates', () => {
    const readings = [makeReading(120, 80, null)];
    const stats = computeStats(readings);
    expect(stats.avgHR).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/screens/__tests__/TrendsScreen.test.tsx -v
```

Expected: FAIL — `computeStats` not exported.

- [ ] **Step 3: Implement TrendsScreen**

Replace `src/screens/TrendsScreen.tsx`:

```tsx
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { VictoryLine, VictoryChart, VictoryAxis, VictoryTheme, VictoryScatter, VictoryArea } from 'victory-native';
import { Reading } from '../types/reading';
import { getAllReadings, getReadingsByDateRange } from '../services/database/readingRepository';
import { generateReportHtml } from '../services/report/reportHtml';
import { classifyBP, BPCategory } from '../utils/bloodPressure';
import { useNavigation } from '@react-navigation/native';

const RANGES = ['7D', '30D', '90D', 'All'] as const;
type Range = (typeof RANGES)[number];

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export interface Stats {
  avgSystolic: number;
  avgDiastolic: number;
  avgHR: number;
  highestSystolic: number;
  highestDiastolic: number;
  count: number;
}

export function computeStats(readings: Reading[]): Stats {
  if (readings.length === 0) {
    return { avgSystolic: 0, avgDiastolic: 0, avgHR: 0, highestSystolic: 0, highestDiastolic: 0, count: 0 };
  }

  let totalSys = 0;
  let totalDia = 0;
  let totalHR = 0;
  let hrCount = 0;
  let maxSys = 0;
  let maxDia = 0;

  for (const r of readings) {
    totalSys += r.systolic;
    totalDia += r.diastolic;
    if (r.heartRate !== null) {
      totalHR += r.heartRate;
      hrCount++;
    }
    if (r.systolic > maxSys) maxSys = r.systolic;
    if (r.diastolic > maxDia) maxDia = r.diastolic;
  }

  return {
    avgSystolic: Math.round(totalSys / readings.length),
    avgDiastolic: Math.round(totalDia / readings.length),
    avgHR: hrCount > 0 ? Math.round(totalHR / hrCount) : 0,
    highestSystolic: maxSys,
    highestDiastolic: maxDia,
    count: readings.length,
  };
}

// AHA zone boundaries for BP chart background
const BP_ZONES = [
  { y0: 0, y: 120, color: '#E8F5E9' },     // Normal (green)
  { y0: 120, y: 130, color: '#FFFDE7' },    // Elevated (yellow)
  { y0: 130, y: 140, color: '#FFF3E0' },    // Stage 1 (orange)
  { y0: 140, y: 200, color: '#FFEBEE' },    // Stage 2 (red)
];

export default function TrendsScreen() {
  const navigation = useNavigation();
  const [range, setRange] = useState<Range>('30D');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setRange('30D');
      loadReadings('30D');
    }, [])
  );

  async function loadReadings(r: Range) {
    setLoading(true);
    let data: Reading[];
    if (r === 'All') {
      data = await getAllReadings();
    } else {
      const days = r === '7D' ? 7 : r === '30D' ? 30 : 90;
      const start = daysAgo(days);
      const end = new Date().toISOString();
      data = await getReadingsByDateRange(start, end);
    }
    setReadings(data);
    setLoading(false);
  }

  function handleRangeChange(r: Range) {
    setRange(r);
    loadReadings(r);
  }

  async function handleExportPdf() {
    if (readings.length === 0) {
      Alert.alert('No Data', 'No readings in the selected range.');
      return;
    }
    const rangeLabel = range === 'All' ? 'All Time' : `Last ${range}`;
    const html = generateReportHtml(readings, rangeLabel, 'Present');
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }

  const stats = useMemo(() => computeStats(readings), [readings]);

  // Prepare chart data — sorted oldest first for line charts
  const sortedReadings = useMemo(
    () => [...readings].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [readings]
  );

  const sysData = sortedReadings.map((r, i) => ({ x: i, y: r.systolic }));
  const diaData = sortedReadings.map((r, i) => ({ x: i, y: r.diastolic }));
  const hrData = sortedReadings
    .filter((r) => r.heartRate !== null)
    .map((r, i) => ({ x: i, y: r.heartRate! }));

  const isHighest = classifyBP(stats.highestSystolic, stats.highestDiastolic);
  const highestIsAbnormal = isHighest !== BPCategory.Normal;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (readings.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No data yet</Text>
        <Text style={styles.emptyHint}>Add readings to see your trends.</Text>
        <TouchableOpacity
          style={styles.emptyLink}
          onPress={() => navigation.navigate('Readings' as any)}
        >
          <Text style={styles.emptyLinkText}>Go to Readings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Time range picker */}
      <View style={styles.rangePicker}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
            onPress={() => handleRangeChange(r)}
          >
            <Text style={[styles.rangeBtnText, range === r && styles.rangeBtnTextActive]}>
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* BP Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.chartLabel}>Blood Pressure</Text>
        <VictoryChart
          theme={VictoryTheme.material}
          height={200}
          padding={{ top: 20, bottom: 30, left: 45, right: 20 }}
        >
          <VictoryAxis
            tickFormat={() => ''}
            style={{ axis: { stroke: '#eee' }, ticks: { size: 0 } }}
          />
          <VictoryAxis
            dependentAxis
            style={{ axis: { stroke: '#eee' }, tickLabels: { fontSize: 10, fill: '#999' } }}
          />
          {/* AHA classification background zones */}
          {BP_ZONES.map((zone, i) => (
            <VictoryArea
              key={i}
              data={[
                { x: 0, y: zone.y, y0: zone.y0 },
                { x: sysData.length - 1 || 1, y: zone.y, y0: zone.y0 },
              ]}
              style={{ data: { fill: zone.color, opacity: 0.4, stroke: 'none' } }}
            />
          ))}
          <VictoryLine
            data={sysData}
            style={{ data: { stroke: '#F44336', strokeWidth: 2 } }}
          />
          <VictoryScatter
            data={sysData}
            size={3}
            style={{ data: { fill: '#F44336' } }}
          />
          <VictoryLine
            data={diaData}
            style={{ data: { stroke: '#2196F3', strokeWidth: 2 } }}
          />
          <VictoryScatter
            data={diaData}
            size={3}
            style={{ data: { fill: '#2196F3' } }}
          />
        </VictoryChart>
        <View style={styles.legend}>
          <Text style={styles.legendItem}>
            <Text style={{ color: '#F44336' }}>●</Text> Systolic
          </Text>
          <Text style={styles.legendItem}>
            <Text style={{ color: '#2196F3' }}>●</Text> Diastolic
          </Text>
        </View>
      </View>

      {/* HR Chart */}
      {hrData.length > 0 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartLabel}>Heart Rate</Text>
          <VictoryChart
            theme={VictoryTheme.material}
            height={140}
            padding={{ top: 20, bottom: 30, left: 45, right: 20 }}
          >
            <VictoryAxis
              tickFormat={() => ''}
              style={{ axis: { stroke: '#eee' }, ticks: { size: 0 } }}
            />
            <VictoryAxis
              dependentAxis
              style={{ axis: { stroke: '#eee' }, tickLabels: { fontSize: 10, fill: '#999' } }}
            />
            <VictoryLine
              data={hrData}
              style={{ data: { stroke: '#9C27B0', strokeWidth: 2 } }}
            />
            <VictoryScatter
              data={hrData}
              size={3}
              style={{ data: { fill: '#9C27B0' } }}
            />
          </VictoryChart>
          <View style={styles.legend}>
            <Text style={styles.legendItem}>
              <Text style={{ color: '#9C27B0' }}>●</Text> Heart Rate (bpm)
            </Text>
          </View>
        </View>
      )}

      {/* Summary stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Avg BP</Text>
          <Text style={styles.statValue}>
            {stats.avgSystolic}/{stats.avgDiastolic}
          </Text>
        </View>
        <View style={[styles.stat, styles.statBorder]}>
          <Text style={styles.statLabel}>Avg HR</Text>
          <Text style={[styles.statValue, { color: '#9C27B0' }]}>
            {stats.avgHR || '—'}
          </Text>
        </View>
        <View style={[styles.stat, styles.statBorder]}>
          <Text style={styles.statLabel}>Highest</Text>
          <Text style={[styles.statValue, highestIsAbnormal && { color: '#F44336' }]}>
            {stats.highestSystolic}/{stats.highestDiastolic}
          </Text>
        </View>
        <View style={[styles.stat, styles.statBorder]}>
          <Text style={styles.statLabel}>Readings</Text>
          <Text style={styles.statValue}>{stats.count}</Text>
        </View>
      </View>

      {/* Export */}
      <TouchableOpacity style={styles.exportBtn} onPress={handleExportPdf}>
        <Text style={styles.exportBtnText}>Export PDF</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  // Range picker
  rangePicker: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rangeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  rangeBtnActive: { borderBottomColor: '#2196F3' },
  rangeBtnText: { fontSize: 13, color: '#888' },
  rangeBtnTextActive: { color: '#2196F3', fontWeight: '600' },

  // Charts
  chartSection: { paddingHorizontal: 8, paddingTop: 12 },
  chartLabel: { fontSize: 12, fontWeight: '600', color: '#666', paddingLeft: 8, marginBottom: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingBottom: 8 },
  legendItem: { fontSize: 11, color: '#666' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 8,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: '#eee' },
  statLabel: { fontSize: 11, color: '#888' },
  statValue: { fontSize: 15, fontWeight: '600', marginTop: 4 },

  // Export
  exportBtn: {
    margin: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  exportBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },

  // Empty
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyHint: { fontSize: 15, color: '#999' },
  emptyLink: { marginTop: 16, padding: 12 },
  emptyLinkText: { fontSize: 15, color: '#2196F3', fontWeight: '600' },
});
```

**Deviations from spec:**
- The Export PDF button is placed at the bottom of the scrollable content rather than the header. The bottom placement is more idiomatic for React Native and avoids crowding the header. Can be moved to `headerRight` if preferred.
- "Tapping a data point shows reading detail" is deferred to a follow-up task. Victory's event handling requires a custom tooltip overlay component. The charts are still fully functional for viewing trends without this.

- [ ] **Step 4: Run tests**

```bash
npx jest src/screens/__tests__/TrendsScreen.test.tsx -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All test suites pass.

- [ ] **Step 6: Verify typecheck**

```bash
npm run typecheck
```

Expected: No errors. Note: `victory-native` types may require checking. If type errors occur with Victory imports, add `// @ts-expect-error victory-native types` as needed, or install `@types/victory` if available.

- [ ] **Step 7: Commit**

```bash
git add src/screens/TrendsScreen.tsx src/screens/__tests__/TrendsScreen.test.tsx
git commit -m "feat: implement Trends screen with BP/HR charts and summary stats"
```

---

## Chunk 5: Cleanup and Final Integration

### Task 10: Remove Old Screens

**Files:**
- Remove: `src/screens/CaptureScreen.tsx`
- Remove: `src/screens/ReportScreen.tsx`

- [ ] **Step 1: Delete CaptureScreen and ReportScreen**

```bash
rm src/screens/CaptureScreen.tsx src/screens/ReportScreen.tsx
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "CaptureScreen\|ReportScreen" src/ --include="*.ts" --include="*.tsx"
```

Expected: No matches (TabNavigator already removed these imports in Task 3).

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Verify all tests pass**

```bash
npm test
```

Expected: All test suites pass.

- [ ] **Step 5: Commit**

```bash
git rm src/screens/CaptureScreen.tsx src/screens/ReportScreen.tsx
git commit -m "chore: remove CaptureScreen and ReportScreen, replaced by modal and Trends/Settings"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Start dev server and verify on device**

```bash
npm start
```

Manual verification checklist:
1. App opens on Readings tab — no readings shows empty state with "Add Manually" button
2. Tapping FAB (+) opens manual entry modal — fill and save, reading appears in list
3. Swipe left on a reading shows red Delete action — confirm deletes it
4. Gear icon in header navigates to Settings
5. Settings shows Bluetooth Monitor, Export, Data, About sections
6. "Scan for Device" triggers BLE scan (needs real device)
7. Trends tab shows charts and summary stats
8. Time range picker (7D/30D/90D/All) filters data
9. Export PDF generates and shares a PDF file
10. "Delete All Readings" in Settings shows confirmation, then clears data
