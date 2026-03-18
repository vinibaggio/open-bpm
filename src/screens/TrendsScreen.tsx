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
import { CartesianChart, Line, Scatter, Area, type PointsArray } from 'victory-native';
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

interface Stats {
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

  const sortedReadings = useMemo(
    () => [...readings].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [readings]
  );

  // Prepare chart data for victory-native v41 CartesianChart
  const bpChartData = useMemo(
    () =>
      sortedReadings.map((r, i) => ({
        x: i,
        systolic: r.systolic,
        diastolic: r.diastolic,
      })),
    [sortedReadings]
  );

  const hrChartData = useMemo(
    () =>
      sortedReadings
        .filter((r) => r.heartRate !== null)
        .map((r, i) => ({
          x: i,
          hr: r.heartRate!,
        })),
    [sortedReadings]
  );

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
          onPress={() => navigation.navigate('Readings' as never)}
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
        {bpChartData.length > 1 ? (
          <View style={styles.bpChartContainer}>
            <CartesianChart
              data={bpChartData}
              xKey="x"
              yKeys={['systolic', 'diastolic']}
              domainPadding={{ top: 20, bottom: 20 }}
            >
              {({ points }: { points: Record<string, PointsArray> }) => (
                <>
                  <Line points={points.systolic} color="#F44336" strokeWidth={2} />
                  <Line points={points.diastolic} color="#2196F3" strokeWidth={2} />
                  <Scatter points={points.systolic} color="#F44336" radius={3} />
                  <Scatter points={points.diastolic} color="#2196F3" radius={3} />
                </>
              )}
            </CartesianChart>
          </View>
        ) : (
          <View style={styles.singleReading}>
            <Text style={styles.singleReadingText}>
              {bpChartData[0]?.systolic}/{bpChartData[0]?.diastolic} mmHg
            </Text>
            <Text style={styles.singleReadingHint}>Add more readings to see a chart</Text>
          </View>
        )}
        <View style={styles.legend}>
          <Text style={styles.legendItem}>
            <Text style={styles.legendDotSystolic}>●</Text> Systolic
          </Text>
          <Text style={styles.legendItem}>
            <Text style={styles.legendDotDiastolic}>●</Text> Diastolic
          </Text>
        </View>
      </View>

      {/* HR Chart */}
      {hrChartData.length > 1 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartLabel}>Heart Rate</Text>
          <View style={styles.hrChartContainer}>
            <CartesianChart
              data={hrChartData}
              xKey="x"
              yKeys={['hr']}
              domainPadding={{ top: 20, bottom: 20 }}
            >
              {({ points }: { points: Record<string, PointsArray> }) => (
                <>
                  <Line points={points.hr} color="#9C27B0" strokeWidth={2} />
                  <Scatter points={points.hr} color="#9C27B0" radius={3} />
                </>
              )}
            </CartesianChart>
          </View>
          <View style={styles.legend}>
            <Text style={styles.legendItem}>
              <Text style={styles.legendDotHR}>●</Text> Heart Rate (bpm)
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
          <Text style={[styles.statValue, styles.hrColor]}>
            {stats.avgHR || '\u2014'}
          </Text>
        </View>
        <View style={[styles.stat, styles.statBorder]}>
          <Text style={styles.statLabel}>Highest</Text>
          <Text style={[styles.statValue, highestIsAbnormal && styles.abnormalColor]}>
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

  bpChartContainer: { height: 200 },
  hrChartContainer: { height: 140 },
  hrColor: { color: '#9C27B0' },
  abnormalColor: { color: '#F44336' },
  chartSection: { paddingHorizontal: 8, paddingTop: 12 },
  chartLabel: { fontSize: 12, fontWeight: '600', color: '#666', paddingLeft: 8, marginBottom: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingBottom: 8 },
  legendItem: { fontSize: 11, color: '#666' },
  legendDotSystolic: { color: '#F44336' },
  legendDotDiastolic: { color: '#2196F3' },
  legendDotHR: { color: '#9C27B0' },

  singleReading: { alignItems: 'center', paddingVertical: 24 },
  singleReadingText: { fontSize: 28, fontWeight: '700', color: '#333' },
  singleReadingHint: { fontSize: 13, color: '#999', marginTop: 4 },

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

  exportBtn: {
    margin: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  exportBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },

  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyHint: { fontSize: 15, color: '#999' },
  emptyLink: { marginTop: 16, padding: 12 },
  emptyLinkText: { fontSize: 15, color: '#2196F3', fontWeight: '600' },
});
