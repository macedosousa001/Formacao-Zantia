/**
 * EvolutionChart — SVG-based learning evolution chart.
 * Shows two lines: "Eu" (cumulative %) vs "Média" (global average per attempt index).
 * Pure react-native-svg, no external chart library.
 */
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { theme } from './theme';

type Point = { index: number; percent: number; cumulative_percent?: number; title?: string; date?: string };

type Props = {
  myPoints: Point[];
  globalPoints: Point[];
  height?: number;
  width?: number;
};

export default function EvolutionChart({ myPoints, globalPoints, height = 220, width }: Props) {
  const screenW = Dimensions.get('window').width;
  const w = width || Math.min(screenW - 32, 520);
  const h = height;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 30;
  const innerW = w - padLeft - padRight;
  const innerH = h - padTop - padBottom;

  const maxIndex = Math.max(myPoints.length, globalPoints.length, 5);
  const xStep = maxIndex > 1 ? innerW / (maxIndex - 1) : innerW;
  const yScale = (pct: number) => padTop + innerH - (Math.max(0, Math.min(100, pct)) / 100) * innerH;
  const xAt = (i: number) => padLeft + (i - 1) * xStep;

  const buildPath = (points: { index: number; value: number }[]): string => {
    if (points.length === 0) return '';
    return points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${xAt(p.index).toFixed(1)},${yScale(p.value).toFixed(1)}`)
      .join(' ');
  };

  const myCurve = myPoints.map((p) => ({ index: p.index, value: p.cumulative_percent ?? p.percent }));
  const globalCurve = globalPoints.map((p) => ({ index: p.index, value: p.percent }));

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
          <Text style={styles.legendText}>Eu (acumulada)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.colors.secondary }]} />
          <Text style={styles.legendText}>Média da turma</Text>
        </View>
      </View>
      <Svg width={w} height={h}>
        {/* Background grid */}
        <Rect x={padLeft} y={padTop} width={innerW} height={innerH} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={1} />
        {yTicks.map((t) => (
          <React.Fragment key={t}>
            <Line
              x1={padLeft}
              y1={yScale(t)}
              x2={padLeft + innerW}
              y2={yScale(t)}
              stroke="#F1F5F9"
              strokeWidth={1}
            />
            <SvgText
              x={padLeft - 6}
              y={yScale(t) + 4}
              fontSize={10}
              fill={theme.colors.textMuted}
              textAnchor="end"
            >
              {t}%
            </SvgText>
          </React.Fragment>
        ))}

        {/* X axis labels (test #) */}
        {Array.from({ length: maxIndex }).map((_, i) => (
          <SvgText
            key={i}
            x={xAt(i + 1)}
            y={padTop + innerH + 16}
            fontSize={10}
            fill={theme.colors.textMuted}
            textAnchor="middle"
          >
            {i + 1}
          </SvgText>
        ))}
        <SvgText
          x={padLeft + innerW / 2}
          y={padTop + innerH + 28}
          fontSize={10}
          fill={theme.colors.textMuted}
          textAnchor="middle"
        >
          Nº do teste
        </SvgText>

        {/* Global average line (dashed-ish via low opacity) */}
        {globalCurve.length > 1 && (
          <Path d={buildPath(globalCurve)} stroke={theme.colors.secondary} strokeWidth={2.5} fill="none" />
        )}

        {/* My line */}
        {myCurve.length > 1 && (
          <Path d={buildPath(myCurve)} stroke={theme.colors.primary} strokeWidth={3} fill="none" />
        )}

        {/* My data points */}
        {myCurve.map((p) => (
          <Circle key={`mp-${p.index}`} cx={xAt(p.index)} cy={yScale(p.value)} r={4} fill={theme.colors.primary} />
        ))}
        {globalCurve.map((p) => (
          <Circle key={`gp-${p.index}`} cx={xAt(p.index)} cy={yScale(p.value)} r={3} fill={theme.colors.secondary} opacity={0.7} />
        ))}
      </Svg>
      {myPoints.length === 0 && (
        <Text style={styles.emptyHint}>Realize testes para começar a ver a sua evolução comparada com a média.</Text>
      )}
    </View>
  );
}

type GavetaoBarsProps = {
  data: { title: string; my_percent: number | null; global_percent: number | null }[];
};

export function GavetaoComparisonBars({ data }: GavetaoBarsProps) {
  const screenW = Dimensions.get('window').width;
  const w = Math.min(screenW - 32, 520);
  const barHeight = 18;
  const groupHeight = 52;
  const labelHeight = 16;
  const totalH = data.length * groupHeight + 30;
  const padLeft = 90;
  const padRight = 10;
  const innerW = w - padLeft - padRight;

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
          <Text style={styles.legendText}>Eu</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.colors.secondary }]} />
          <Text style={styles.legendText}>Turma</Text>
        </View>
      </View>
      <Svg width={w} height={totalH}>
        {data.map((row, i) => {
          const y = i * groupHeight + 4;
          const my = row.my_percent ?? 0;
          const gl = row.global_percent ?? 0;
          const myW = (Math.max(0, Math.min(100, my)) / 100) * innerW;
          const glW = (Math.max(0, Math.min(100, gl)) / 100) * innerW;
          const trim = (s: string) => (s.length > 12 ? s.slice(0, 12) + '…' : s);
          return (
            <React.Fragment key={`row-${i}`}>
              <SvgText x={padLeft - 8} y={y + labelHeight + 4} fontSize={11} fill={theme.colors.textMain} textAnchor="end" fontWeight="700">
                {trim(row.title)}
              </SvgText>
              {/* Track */}
              <Rect x={padLeft} y={y + 4} width={innerW} height={barHeight} fill="#F1F5F9" rx={3} />
              <Rect x={padLeft} y={y + 4} width={myW} height={barHeight} fill={theme.colors.primary} rx={3} />
              <SvgText x={padLeft + myW + 4} y={y + 4 + 13} fontSize={10} fill={theme.colors.textMain}>
                {row.my_percent === null ? '—' : `${row.my_percent.toFixed(0)}%`}
              </SvgText>
              {/* Global track */}
              <Rect x={padLeft} y={y + barHeight + 8} width={innerW} height={barHeight - 6} fill="#F1F5F9" rx={3} />
              <Rect x={padLeft} y={y + barHeight + 8} width={glW} height={barHeight - 6} fill={theme.colors.secondary} rx={3} opacity={0.85} />
              <SvgText x={padLeft + glW + 4} y={y + barHeight + 8 + 11} fontSize={10} fill={theme.colors.textMuted}>
                {row.global_percent === null ? '—' : `${row.global_percent.toFixed(0)}%`}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: theme.colors.surface, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 8, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '700' },
  emptyHint: { fontSize: 11, color: theme.colors.textLight, fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
});
