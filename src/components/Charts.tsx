import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { AppText } from './ui';
import { usePalette } from '@/theme';

export interface Point {
  x: number; // timestamp or index
  y: number;
  label?: string;
}

const H = 170;
const PAD = { l: 38, r: 10, t: 12, b: 22 };

function niceRange(min: number, max: number): [number, number] {
  if (min === max) return [Math.max(0, min - 1), max + 1];
  const span = max - min;
  return [Math.max(0, min - span * 0.1), max + span * 0.1];
}

export function LineChart({ points, format = (v: number) => String(Math.round(v)), xLabel }: { points: Point[]; format?: (v: number) => string; xLabel?: (x: number) => string }) {
  const p = usePalette();
  const [w, setW] = useState(300);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  if (points.length === 0) return <AppText variant="muted">No data in this range.</AppText>;
  const xs = points.map((q) => q.x);
  const ys = points.map((q) => q.y);
  const [y0, y1] = niceRange(Math.min(...ys), Math.max(...ys));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const sx = (x: number) => PAD.l + (x1 === x0 ? (w - PAD.l - PAD.r) / 2 : ((x - x0) / (x1 - x0)) * (w - PAD.l - PAD.r));
  const sy = (y: number) => PAD.t + (1 - (y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  const d = points.map((q, i) => `${i ? 'L' : 'M'}${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(' ');
  const ticks = [y0, (y0 + y1) / 2, y1];
  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={H}>
        {ticks.map((t, i) => (
          <React.Fragment key={i}>
            <Line x1={PAD.l} x2={w - PAD.r} y1={sy(t)} y2={sy(t)} stroke={p.border} strokeWidth={1} />
            <SvgText x={PAD.l - 4} y={sy(t) + 4} fontSize={10} fill={p.textFaint} textAnchor="end">{format(t)}</SvgText>
          </React.Fragment>
        ))}
        <Path d={d} stroke={p.accent} strokeWidth={2.5} fill="none" />
        {points.map((q, i) => <Circle key={i} cx={sx(q.x)} cy={sy(q.y)} r={points.length > 40 ? 2 : 4} fill={p.accent} />)}
        {xLabel ? (
          <>
            <SvgText x={PAD.l} y={H - 4} fontSize={10} fill={p.textFaint}>{xLabel(x0)}</SvgText>
            <SvgText x={w - PAD.r} y={H - 4} fontSize={10} fill={p.textFaint} textAnchor="end">{xLabel(x1)}</SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}

export function BarChart({ bars, format = (v: number) => String(v) }: { bars: { label: string; value: number }[]; format?: (v: number) => string }) {
  const p = usePalette();
  const [w, setW] = useState(300);
  if (bars.length === 0) return <AppText variant="muted">No data in this range.</AppText>;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const bw = Math.max(3, (w - PAD.l - PAD.r) / bars.length - 3);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={H}>
        <Line x1={PAD.l} x2={w - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke={p.border} />
        <SvgText x={PAD.l - 4} y={PAD.t + 8} fontSize={10} fill={p.textFaint} textAnchor="end">{format(max)}</SvgText>
        {bars.map((b, i) => {
          const h = (b.value / max) * (H - PAD.t - PAD.b);
          const x = PAD.l + i * ((w - PAD.l - PAD.r) / bars.length) + 1.5;
          return <Rect key={i} x={x} y={H - PAD.b - h} width={bw} height={Math.max(h, b.value > 0 ? 2 : 0)} rx={2} fill={p.accent} />;
        })}
        <SvgText x={PAD.l} y={H - 4} fontSize={10} fill={p.textFaint}>{bars[0]!.label}</SvgText>
        <SvgText x={w - PAD.r} y={H - 4} fontSize={10} fill={p.textFaint} textAnchor="end">{bars[bars.length - 1]!.label}</SvgText>
      </Svg>
    </View>
  );
}
