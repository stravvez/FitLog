import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Empty, T } from '@/src/components/ui';
import { useColors } from '@/src/theme';

export function Ring({
  value,
  max,
  size = 150,
  stroke = 12,
  color,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color: string;
  children?: ReactNode;
}) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? c.danger : color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Simple line chart. `secondary` is drawn as a thicker overlay (e.g. a moving average). */
export function LineChart({
  values,
  secondary,
  height = 150,
  color,
  format = (n) => String(Math.round(n)),
  startLabel,
  endLabel,
}: {
  values: number[];
  secondary?: number[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
  startLabel?: string;
  endLabel?: string;
}) {
  const c = useColors();
  const [w, setW] = useState(0);
  if (values.length < 2) return <Empty text="Not enough data yet — log a few more entries." />;
  const all = [...values, ...(secondary ?? [])];
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max - min < 1e-6) {
    min -= 1;
    max += 1;
  }
  const pad = 8;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (height - 2 * pad);
  const pts = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const stroke = color ?? c.primary;
  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {w > 0 && (
            <Svg width={w} height={height}>
              <Line x1={0} x2={w} y1={pad} y2={pad} stroke={c.border} strokeDasharray="4 4" />
              <Line x1={0} x2={w} y1={height - pad} y2={height - pad} stroke={c.border} strokeDasharray="4 4" />
              <Polyline
                points={pts(values)}
                fill="none"
                stroke={stroke}
                strokeOpacity={secondary ? 0.35 : 1}
                strokeWidth={2}
              />
              {secondary && <Polyline points={pts(secondary)} fill="none" stroke={stroke} strokeWidth={3} />}
              {!secondary &&
                values.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={stroke} />)}
            </Svg>
          )}
        </View>
        <View style={{ justifyContent: 'space-between', paddingLeft: 6, height }}>
          <T v="small">{format(max)}</T>
          <T v="small">{format(min)}</T>
        </View>
      </View>
      {(startLabel || endLabel) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="small">{startLabel}</T>
          <T v="small">{endLabel}</T>
        </View>
      )}
    </View>
  );
}

/** Vertical bars with an optional dashed target line. */
export function BarChart({
  values,
  labels,
  target,
  height = 130,
  color,
}: {
  values: number[];
  labels: string[];
  target?: number;
  height?: number;
  color?: string;
}) {
  const c = useColors();
  const max = Math.max(1, ...values, target ?? 0) * 1.1;
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        {target ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: (target / max) * height,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: c.muted,
            }}
          />
        ) : null}
        {values.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(v > 0 ? 2 : 0, (v / max) * height),
              backgroundColor: target && v > target * 1.05 ? c.warning : (color ?? c.primary),
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {labels.map((l, i) => (
          <T key={i} v="small" style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>
            {l}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars, for things like sets per muscle. */
export function HBars({ rows, color }: { rows: { label: string; value: number }[]; color?: string }) {
  const c = useColors();
  if (rows.length === 0) return <Empty text="No data yet." />;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <View style={{ gap: 6 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T v="small" style={{ width: 90, textTransform: 'capitalize' }} numberOfLines={1}>
            {r.label}
          </T>
          <View style={{ flex: 1, height: 14, backgroundColor: c.track, borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ width: `${(r.value / max) * 100}%`, height: '100%', backgroundColor: color ?? c.primary }} />
          </View>
          <T v="small" style={{ width: 28, textAlign: 'right' }}>
            {r.value}
          </T>
        </View>
      ))}
    </View>
  );
}
