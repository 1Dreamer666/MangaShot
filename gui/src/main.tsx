import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import './index.css';

/* ============================================================================
 * 1. 原有业务数据结构定义 (严格保持不变)
 * ========================================================================== */
interface DialogueItem {
  id: number;
  page: string;
  order: number;
  box: [number, number, number, number];
  cls: string;
  original: string;
  translation: string;
}

interface ProcessResult {
  page: string;
  action: string;
  bubbles: number;
  seconds: number;
  output: string;
  qa_url?: string;
  final_url?: string;
  items?: DialogueItem[];
}

/* ============================================================================
 * 2. MD3 动态色彩主题预设矩阵 (HCT Perceptual Tonal Palettes)
 * 支持 5 组高表现力源色 × 明暗双主题 × 对比度增强
 * ========================================================================== */
type Md3ThemePresetId = 'oceanBlue' | 'sakuraPink' | 'matchaGreen' | 'amberGold' | 'royalViolet';

interface ThemePaletteTokens {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  outline: string;
  outlineVariant: string;
}

const MD3_THEME_PRESETS: Record<
  Md3ThemePresetId,
  { name: string; swatch: string; dark: ThemePaletteTokens; light: ThemePaletteTokens }
> = {
  oceanBlue: {
    name: '深海蔚蓝 (Ocean)',
    swatch: '#38BDF8',
    dark: {
      primary: '#A6C8FF',
      onPrimary: '#00315F',
      primaryContainer: '#1C4876',
      onPrimaryContainer: '#D5E3FF',
      secondary: '#BDC7DC',
      onSecondary: '#273141',
      secondaryContainer: '#3D4758',
      onSecondaryContainer: '#D9E3F8',
      tertiary: '#DABDE2',
      onTertiary: '#3D2846',
      tertiaryContainer: '#553F5D',
      onTertiaryContainer: '#F7D8FF',
      surface: '#111318',
      onSurface: '#E2E2E9',
      surfaceVariant: '#43474E',
      onSurfaceVariant: '#C4C6CF',
      surfaceContainerLowest: '#0C0E13',
      surfaceContainerLow: '#191C20',
      surfaceContainer: '#1D2024',
      surfaceContainerHigh: '#282A2F',
      surfaceContainerHighest: '#33353A',
      outline: '#8E9099',
      outlineVariant: '#43474E',
    },
    light: {
      primary: '#2B5EA7',
      onPrimary: '#FFFFFF',
      primaryContainer: '#D6E3FF',
      onPrimaryContainer: '#001B3E',
      secondary: '#565F71',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#DAE2F9',
      onSecondaryContainer: '#131C2B',
      tertiary: '#705575',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#FAD8FD',
      onTertiaryContainer: '#28132E',
      surface: '#F9F9FF',
      onSurface: '#191C20',
      surfaceVariant: '#E0E2EC',
      onSurfaceVariant: '#44474E',
      surfaceContainerLowest: '#FFFFFF',
      surfaceContainerLow: '#F3F3FA',
      surfaceContainer: '#EDEDF4',
      surfaceContainerHigh: '#E7E8EE',
      surfaceContainerHighest: '#E2E2E9',
      outline: '#74777F',
      outlineVariant: '#C4C6D0',
    },
  },
  sakuraPink: {
    name: '桃酱绯樱 (Sakura)',
    swatch: '#F472B6',
    dark: {
      primary: '#FFB1C8',
      onPrimary: '#5E1133',
      primaryContainer: '#7B2949',
      onPrimaryContainer: '#FFD9E2',
      secondary: '#E3BDC6',
      onSecondary: '#422931',
      secondaryContainer: '#5B3F47',
      onSecondaryContainer: '#FFD9E2',
      tertiary: '#EFBD94',
      onTertiary: '#48290C',
      tertiaryContainer: '#623F20',
      onTertiaryContainer: '#FFDCC1',
      surface: '#191113',
      onSurface: '#EFDFE1',
      surfaceVariant: '#514347',
      onSurfaceVariant: '#D5C2C6',
      surfaceContainerLowest: '#140C0E',
      surfaceContainerLow: '#22191C',
      surfaceContainer: '#261D20',
      surfaceContainerHigh: '#31282A',
      surfaceContainerHighest: '#3C3235',
      outline: '#9E8C90',
      outlineVariant: '#514347',
    },
    light: {
      primary: '#984061',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFD9E2',
      onPrimaryContainer: '#3E001D',
      secondary: '#74565F',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#FFD9E2',
      onSecondaryContainer: '#2B151C',
      tertiary: '#7C5635',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#FFDCC1',
      onTertiaryContainer: '#2E1500',
      surface: '#FFF8F8',
      onSurface: '#22191C',
      surfaceVariant: '#F2DDE1',
      onSurfaceVariant: '#514347',
      surfaceContainerLowest: '#FFFFFF',
      surfaceContainerLow: '#FCF0F2',
      surfaceContainer: '#F6EAED',
      surfaceContainerHigh: '#F0E4E7',
      surfaceContainerHighest: '#EFDFE1',
      outline: '#837377',
      outlineVariant: '#D5C2C6',
    },
  },
  matchaGreen: {
    name: '竹林若叶 (Matcha)',
    swatch: '#34D399',
    dark: {
      primary: '#8BD6B5',
      onPrimary: '#003826',
      primaryContainer: '#005139',
      onPrimaryContainer: '#A6F2D0',
      secondary: '#B3CCBF',
      onSecondary: '#1F352B',
      secondaryContainer: '#354B41',
      onSecondaryContainer: '#CFE9DA',
      tertiary: '#A6CCE0',
      onTertiary: '#0A3544',
      tertiaryContainer: '#254B5C',
      onTertiaryContainer: '#C2E8FD',
      surface: '#0F1512',
      onSurface: '#DEE4DF',
      surfaceVariant: '#404944',
      onSurfaceVariant: '#BFC9C2',
      surfaceContainerLowest: '#0A0F0D',
      surfaceContainerLow: '#171D1A',
      surfaceContainer: '#1B211E',
      surfaceContainerHigh: '#252B28',
      surfaceContainerHighest: '#303633',
      outline: '#89938D',
      outlineVariant: '#404944',
    },
    light: {
      primary: '#196B50',
      onPrimary: '#FFFFFF',
      primaryContainer: '#A6F2D0',
      onPrimaryContainer: '#002115',
      secondary: '#4C6358',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#CFE9DA',
      onSecondaryContainer: '#092017',
      tertiary: '#3E6374',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#C2E8FD',
      onTertiaryContainer: '#001F2A',
      surface: '#F5FBF6',
      onSurface: '#171D1A',
      surfaceVariant: '#DBE5DE',
      onSurfaceVariant: '#404944',
      surfaceContainerLowest: '#FFFFFF',
      surfaceContainerLow: '#EFF5F0',
      surfaceContainer: '#E9EFEA',
      surfaceContainerHigh: '#E3EAE5',
      surfaceContainerHighest: '#DEE4DF',
      outline: '#707974',
      outlineVariant: '#BFC9C2',
    },
  },
  amberGold: {
    name: '暖阳琥珀 (Amber)',
    swatch: '#FBBF24',
    dark: {
      primary: '#FFB951',
      onPrimary: '#452B00',
      primaryContainer: '#633F00',
      onPrimaryContainer: '#FFDDB3',
      secondary: '#DFC2A2',
      onSecondary: '#3F2D17',
      secondaryContainer: '#57432B',
      onSecondaryContainer: '#FBDEBC',
      tertiary: '#BACEA9',
      onTertiary: '#25351B',
      tertiaryContainer: '#3B4C30',
      onTertiaryContainer: '#D6E9C4',
      surface: '#18120B',
      onSurface: '#EDE0D4',
      surfaceVariant: '#4F4539',
      onSurfaceVariant: '#D3C4B4',
      surfaceContainerLowest: '#120D07',
      surfaceContainerLow: '#201B13',
      surfaceContainer: '#251F17',
      surfaceContainerHigh: '#2F2921',
      surfaceContainerHighest: '#3B342B',
      outline: '#9C8F80',
      outlineVariant: '#4F4539',
    },
    light: {
      primary: '#825500',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFDDB3',
      onPrimaryContainer: '#291800',
      secondary: '#705B40',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#FBDEBC',
      onSecondaryContainer: '#271904',
      tertiary: '#526446',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#D6E9C4',
      onTertiaryContainer: '#111F08',
      surface: '#FFF8F4',
      onSurface: '#201B13',
      surfaceVariant: '#F0E0CF',
      onSurfaceVariant: '#4F4539',
      surfaceContainerLowest: '#FFFFFF',
      surfaceContainerLow: '#FDF1E6',
      surfaceContainer: '#F7ECDF',
      surfaceContainerHigh: '#F1E6D9',
      surfaceContainerHighest: '#EDE0D4',
      outline: '#817567',
      outlineVariant: '#D3C4B4',
    },
  },
  royalViolet: {
    name: '星夜紫罗兰 (Violet)',
    swatch: '#A78BFA',
    dark: {
      primary: '#CFBCFF',
      onPrimary: '#381E72',
      primaryContainer: '#4F378A',
      onPrimaryContainer: '#E9DDFF',
      secondary: '#CBC2DB',
      onSecondary: '#332D41',
      secondaryContainer: '#4A4458',
      onSecondaryContainer: '#E8DEF8',
      tertiary: '#EFB8C8',
      onTertiary: '#4A2532',
      tertiaryContainer: '#633B48',
      onTertiaryContainer: '#FFD9E3',
      surface: '#141218',
      onSurface: '#E6E0E9',
      surfaceVariant: '#49454E',
      onSurfaceVariant: '#CAC4CF',
      surfaceContainerLowest: '#0F0D13',
      surfaceContainerLow: '#1D1B20',
      surfaceContainer: '#211F26',
      surfaceContainerHigh: '#2B2930',
      surfaceContainerHighest: '#36343B',
      outline: '#948F99',
      outlineVariant: '#49454E',
    },
    light: {
      primary: '#6750A4',
      onPrimary: '#FFFFFF',
      primaryContainer: '#E9DDFF',
      onPrimaryContainer: '#22005D',
      secondary: '#625B71',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#E8DEF8',
      onSecondaryContainer: '#1E192B',
      tertiary: '#7E5260',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#FFD9E3',
      onTertiaryContainer: '#31101D',
      surface: '#FEF7FF',
      onSurface: '#1D1B20',
      surfaceVariant: '#E7E0EB',
      onSurfaceVariant: '#49454E',
      surfaceContainerLowest: '#FFFFFF',
      surfaceContainerLow: '#F7F2FA',
      surfaceContainer: '#F3EDF7',
      surfaceContainerHigh: '#ECE6F0',
      surfaceContainerHighest: '#E6E0E9',
      outline: '#7A757F',
      outlineVariant: '#CAC4CF',
    },
  },
};

function syncThemeTokensToDom(presetId: Md3ThemePresetId, isDark: boolean) {
  const root = document.documentElement;
  root.dataset.mdTheme = isDark ? 'dark' : 'light';
  const tokens = isDark ? MD3_THEME_PRESETS[presetId].dark : MD3_THEME_PRESETS[presetId].light;

  const map: Record<string, string> = {
    '--md-sys-color-primary': tokens.primary,
    '--md-sys-color-on-primary': tokens.onPrimary,
    '--md-sys-color-primary-container': tokens.primaryContainer,
    '--md-sys-color-on-primary-container': tokens.onPrimaryContainer,
    '--md-sys-color-secondary': tokens.secondary,
    '--md-sys-color-on-secondary': tokens.onSecondary,
    '--md-sys-color-secondary-container': tokens.secondaryContainer,
    '--md-sys-color-on-secondary-container': tokens.onSecondaryContainer,
    '--md-sys-color-tertiary': tokens.tertiary,
    '--md-sys-color-on-tertiary': tokens.tertiaryContainer,
    '--md-sys-color-tertiary-container': tokens.tertiaryContainer,
    '--md-sys-color-on-tertiary-container': tokens.onTertiaryContainer,
    '--md-sys-color-surface': tokens.surface,
    '--md-sys-color-on-surface': tokens.onSurface,
    '--md-sys-color-surface-variant': tokens.surfaceVariant,
    '--md-sys-color-on-surface-variant': tokens.onSurfaceVariant,
    '--md-sys-color-surface-container-lowest': tokens.surfaceContainerLowest,
    '--md-sys-color-surface-container-low': tokens.surfaceContainerLow,
    '--md-sys-color-surface-container': tokens.surfaceContainer,
    '--md-sys-color-surface-container-high': tokens.surfaceContainerHigh,
    '--md-sys-color-surface-container-highest': tokens.surfaceContainerHighest,
    '--md-sys-color-outline': tokens.outline,
    '--md-sys-color-outline-variant': tokens.outlineVariant,
  };

  for (const [k, v] of Object.entries(map)) {
    root.style.setProperty(k, v);
  }
}

/* ============================================================================
 * 3. MD3 触控坐标驱动涟漪与状态层 Hook (useMd3Ripple)
 * ========================================================================== */
interface RippleWaveItem {
  id: number;
  x: number;
  y: number;
  size: number;
  closing: boolean;
}

function useMd3Ripple(disabled: boolean = false) {
  const [waves, setWaves] = useState<RippleWaveItem[]>([]);
  const seqRef = useRef(0);
  const currentWaveRef = useRef<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y)) * 2.15;

      const id = ++seqRef.current;
      currentWaveRef.current = id;
      setWaves((prev) => [...prev, { id, x, y, size, closing: false }]);
    },
    [disabled]
  );

  const releaseWave = useCallback(() => {
    if (currentWaveRef.current === null) return;
    const targetId = currentWaveRef.current;
    currentWaveRef.current = null;
    setWaves((prev) => prev.map((w) => (w.id === targetId ? { ...w, closing: true } : w)));
    window.setTimeout(() => {
      setWaves((prev) => prev.filter((w) => w.id !== targetId));
    }, 360);
  }, []);

  const RippleLayer: React.FC<{ colorVar?: string }> = useCallback(
    ({ colorVar = 'currentColor' }) => (
      <span
        aria-hidden="true"
        className="md3-state-layer-host"
        style={{ '--md-ripple-color': colorVar } as React.CSSProperties}
      >
        {waves.map((w) => (
          <span
            key={w.id}
            className={`md3-ripple-wave ${w.closing ? 'is-closing' : ''}`}
            style={{
              width: `${w.size}px`,
              height: `${w.size}px`,
              left: `${w.x - w.size / 2}px`,
              top: `${w.y - w.size / 2}px`,
            }}
          />
        ))}
      </span>
    ),
    [waves]
  );

  return {
    rippleProps: {
      onPointerDown,
      onPointerUp: releaseWave,
      onPointerLeave: releaseWave,
      onPointerCancel: releaseWave,
    },
    RippleLayer,
  };
}

/* ============================================================================
 * 4. M3 Expressive 专有原子组件库 (Button, ConnectedGroup, TextField, MorphLoader)
 * ========================================================================== */

/** 4.0 Material Symbols Rounded 图标组件 */
interface Md3IconProps {
  name: string;
  fill?: 0 | 1;
  size?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

const Md3Icon: React.FC<Md3IconProps> = ({ name, fill = 0, size = 20, style, className = '' }) => (
  <span
    className={`material-symbols-rounded ${className}`}
    aria-hidden="true"
    style={{
      fontSize: typeof size === 'number' ? `${size}px` : size,
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
      fontVariationSettings: `'FILL' ${fill}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      verticalAlign: 'middle',
      lineHeight: 1,
      userSelect: 'none',
      flexShrink: 0,
      ...style,
    }}
  >
    {name}
  </span>
);

/** 4.1 M3 Expressive 多边形 SVG 连续变形生成器 (用于加载器与空状态) */
type ExpressiveShapeType = 'softBurst' | 'cookie7' | 'slantedPill' | 'sunny12' | 'clover4' | 'squircle';

function createExpressivePolygonPath(shape: ExpressiveShapeType, rotDeg: number = 0): string {
  const samples = 96;
  const cx = 50;
  const cy = 50;
  const baseR = 45;
  const rotRad = (rotDeg * Math.PI) / 180;
  const pts: string[] = [];

  for (let i = 0; i < samples; i++) {
    const theta = (i / samples) * Math.PI * 2;
    let r = baseR;
    switch (shape) {
      case 'softBurst':
        r = baseR * (0.83 + 0.17 * Math.abs(Math.cos(4 * theta)));
        break;
      case 'cookie7':
        r = baseR * (0.87 + 0.13 * Math.cos(7 * theta));
        break;
      case 'sunny12':
        r = baseR * (0.91 + 0.09 * Math.cos(12 * theta));
        break;
      case 'clover4':
        r = baseR * (0.79 + 0.21 * Math.cos(4 * theta));
        break;
      case 'slantedPill': {
        const phi = theta - Math.PI / 4;
        const a = baseR * 1.02;
        const b = baseR * 0.7;
        r = (a * b) / Math.sqrt(Math.pow(b * Math.cos(phi), 2) + Math.pow(a * Math.sin(phi), 2));
        break;
      }
      case 'squircle': {
        const n = 4.2;
        r =
          baseR /
          Math.pow(
            Math.pow(Math.abs(Math.cos(theta)), n) + Math.pow(Math.abs(Math.sin(theta)), n),
            1 / n
          );
        break;
      }
    }
    const x = (cx + r * Math.cos(theta + rotRad)).toFixed(2);
    const y = (cy + r * Math.sin(theta + rotRad)).toFixed(2);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return pts.join(' ') + ' Z';
}

const Md3MorphingIndicator: React.FC<{ size?: number; contained?: boolean }> = ({
  size = 28,
  contained = false,
}) => {
  const [step, setStep] = useState(0);
  const shapes: ExpressiveShapeType[] = [
    'softBurst',
    'cookie7',
    'slantedPill',
    'sunny12',
    'clover4',
    'squircle',
  ];

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => s + 1), 620);
    return () => window.clearInterval(id);
  }, []);

  const d = createExpressivePolygonPath(shapes[step % shapes.length], step * 48);

  return (
    <span
      role="progressbar"
      aria-label="处理中"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: 'var(--md-sys-shape-corner-full)',
        backgroundColor: contained ? 'var(--md-sys-color-primary-container)' : 'transparent',
        display: 'inline-grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={contained ? size * 0.72 : size} height={contained ? size * 0.72 : size} viewBox="0 0 100 100">
        <path
          d={d}
          fill={
            contained
              ? 'var(--md-sys-color-on-primary-container)'
              : 'currentColor'
          }
          style={{
            transition: 'd 580ms cubic-bezier(0.42, 1.67, 0.21, 0.90)',
          }}
        />
      </svg>
    </span>
  );
};

/** 4.2 M3 Expressive 流动正弦波浪进度指示器 */
const Md3WavyLinearProgress: React.FC = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % 24), 45);
    return () => window.clearInterval(id);
  }, []);

  const pts: string[] = [];
  for (let x = 0; x <= 360; x += 3) {
    const y = 7 + 3.2 * Math.sin(((x + phase * 3) / 28) * Math.PI * 2);
    pts.push(`${x === 0 ? 'M' : 'L'} ${x} ${y.toFixed(2)}`);
  }

  return (
    <svg width="100%" height="14" viewBox="0 0 360 14" preserveAspectRatio="none" aria-hidden="true">
      <path
        d={pts.join(' ')}
        fill="none"
        stroke="var(--md-sys-color-primary)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** 4.3 M3 Expressive 按钮组件 (支持 5 种变体、尺寸及按压动态圆角形变) */
interface Md3ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'elevated' | 'outlined' | 'text';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  leadingIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Md3Button: React.FC<Md3ButtonProps> = ({
  variant = 'filled',
  size = 'sm',
  leadingIcon,
  fullWidth = false,
  disabled = false,
  children,
  style,
  ...rest
}) => {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { rippleProps, RippleLayer } = useMd3Ripple(disabled);

  const sizeMap = {
    xs: { h: '34px', px: '14px', fs: '12px', pressedR: '8px' },
    sm: { h: '40px', px: '18px', fs: '13px', pressedR: '10px' },
    md: { h: '48px', px: '24px', fs: '14px', pressedR: '12px' },
    lg: { h: '56px', px: '28px', fs: '15px', pressedR: '16px' },
  }[size];

  let bg = 'var(--md-sys-color-primary)';
  let fg = 'var(--md-sys-color-on-primary)';
  let border = 'none';
  let shadow = 'var(--md-sys-elevation-level0)';

  if (disabled) {
    bg =
      variant === 'outlined' || variant === 'text'
        ? 'transparent'
        : 'color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent)';
    fg = 'color-mix(in srgb, var(--md-sys-color-on-surface) 38%, transparent)';
  } else {
    switch (variant) {
      case 'filled':
        bg = 'var(--md-sys-color-primary)';
        fg = 'var(--md-sys-color-on-primary)';
        shadow = hovered && !pressed ? 'var(--md-sys-elevation-level2)' : 'var(--md-sys-elevation-level0)';
        break;
      case 'tonal':
        bg = 'var(--md-sys-color-secondary-container)';
        fg = 'var(--md-sys-color-on-secondary-container)';
        shadow = hovered && !pressed ? 'var(--md-sys-elevation-level1)' : 'var(--md-sys-elevation-level0)';
        break;
      case 'elevated':
        bg = 'var(--md-sys-color-surface-container-high)';
        fg = 'var(--md-sys-color-primary)';
        shadow = hovered && !pressed ? 'var(--md-sys-elevation-level2)' : 'var(--md-sys-elevation-level1)';
        break;
      case 'outlined':
        bg = 'transparent';
        fg = 'var(--md-sys-color-primary)';
        border = '1px solid var(--md-sys-color-outline)';
        break;
      case 'text':
        bg = 'transparent';
        fg = 'var(--md-sys-color-primary)';
        break;
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setPressed(false);
        rippleProps.onPointerLeave();
      }}
      onPointerDown={(e) => {
        setPressed(true);
        rippleProps.onPointerDown(e);
      }}
      onPointerUp={() => {
        setPressed(false);
        rippleProps.onPointerUp();
      }}
      onPointerCancel={() => {
        setPressed(false);
        rippleProps.onPointerCancel();
      }}
      className="md3-focus-ring"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: fullWidth ? '100%' : 'auto',
        height: sizeMap.h,
        paddingInline: sizeMap.px,
        borderRadius: pressed && !disabled ? sizeMap.pressedR : 'var(--md-sys-shape-corner-full)',
        backgroundColor: bg,
        color: fg,
        border,
        boxShadow: shadow,
        fontFamily: 'var(--md-ref-typeface-plain)',
        fontSize: sizeMap.fs,
        fontWeight: 600,
        letterSpacing: '0.15px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        transition:
          'border-radius var(--md-sys-motion-spring-expressive-fast-spatial), transform var(--md-sys-motion-spring-expressive-fast-spatial), background-color var(--md-sys-motion-spring-expressive-fast-effects), color var(--md-sys-motion-spring-expressive-fast-effects), box-shadow var(--md-sys-motion-spring-expressive-fast-effects)',
        ...style,
      }}
      {...rest}
    >
      <RippleLayer colorVar={fg} />
      {leadingIcon && (
        <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center' }}>
          {leadingIcon}
        </span>
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
    </button>
  );
};

/** 4.4 M3 Expressive 连通按钮组 (支持选中项弹性宽度延展与相邻内角变形) */
interface ConnectedGroupOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

function Md3ConnectedButtonGroup<T extends string>({
  options,
  value,
  onChange,
  height = '44px',
}: {
  options: ConnectedGroupOption<T>[];
  value: T;
  onChange: (val: T) => void;
  height?: string;
}) {
  const [pressedId, setPressedId] = useState<T | null>(null);

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        width: '100%',
        padding: '4px',
        borderRadius: 'var(--md-sys-shape-corner-full)',
        backgroundColor: 'var(--md-sys-color-surface-container-low)',
      }}
    >
      {options.map((opt, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === options.length - 1;
        const selected = opt.id === value;
        const pressed = opt.id === pressedId;

        const innerR = pressed ? '4px' : '8px';
        const tl = selected || isFirst ? '9999px' : innerR;
        const bl = selected || isFirst ? '9999px' : innerR;
        const tr = selected || isLast ? '9999px' : innerR;
        const br = selected || isLast ? '9999px' : innerR;

        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.id)}
            onPointerDown={() => setPressedId(opt.id)}
            onPointerUp={() => setPressedId(null)}
            onPointerLeave={() => setPressedId(null)}
            className="md3-focus-ring"
            style={{
              flex: selected ? 1.24 : pressed ? 1.12 : 1,
              height,
              paddingInline: '14px',
              borderRadius: `${tl} ${tr} ${br} ${bl}`,
              border: 'none',
              backgroundColor: selected
                ? 'var(--md-sys-color-secondary-container)'
                : 'var(--md-sys-color-surface-container-high)',
              color: selected
                ? 'var(--md-sys-color-on-secondary-container)'
                : 'var(--md-sys-color-on-surface-variant)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: 'var(--md-ref-typeface-plain)',
              fontSize: '13px',
              fontWeight: selected ? 700 : 500,
              fontVariationSettings: selected ? '"GRAD" 100' : '"GRAD" 0',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition:
                'flex var(--md-sys-motion-spring-expressive-fast-spatial), border-radius var(--md-sys-motion-spring-expressive-fast-spatial), background-color var(--md-sys-motion-spring-expressive-fast-effects), color var(--md-sys-motion-spring-expressive-fast-effects)',
            }}
          >
            {selected ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            ) : (
              opt.icon
            )}
            <span>{opt.label}</span>
            {typeof opt.badge === 'number' && (
              <span
                style={{
                  padding: '1px 7px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: selected
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-surface-container-highest)',
                  color: selected
                    ? 'var(--md-sys-color-on-primary)'
                    : 'var(--md-sys-color-on-surface-variant)',
                }}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 4.5 MD3 三段式透明切口边框文本输入框 (Notched Outlined TextField) */
interface Md3TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  supportingText?: string;
  leadingIcon?: React.ReactNode;
  dense?: boolean;
}

const Md3TextField: React.FC<Md3TextFieldProps> = ({
  label,
  supportingText,
  leadingIcon,
  dense = false,
  value,
  onChange,
  onFocus,
  onBlur,
  ...rest
}) => {
  const inputId = useId();
  const [focused, setFocused] = useState(false);
  const strVal = String(value ?? '');
  const isFloating = focused || strVal.length > 0;

  const borderColor = focused ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)';
  const borderWidth = focused ? '2px' : '1px';
  const labelColor = focused
    ? 'var(--md-sys-color-primary)'
    : 'var(--md-sys-color-on-surface-variant)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div
        style={{
          position: 'relative',
          height: dense ? '44px' : '54px',
          display: 'flex',
          alignItems: 'center',
          paddingInlineStart: leadingIcon ? '12px' : '16px',
          paddingInlineEnd: '14px',
          gap: '10px',
          backgroundColor: 'transparent',
        }}
      >
        {/* 三段式透明镂空切口边框 (Three-Segment Notched Outline) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '12px',
              borderTop: `${borderWidth} solid ${borderColor}`,
              borderLeft: `${borderWidth} solid ${borderColor}`,
              borderBottom: `${borderWidth} solid ${borderColor}`,
              borderRadius: '8px 0 0 8px',
              transition: 'border-color var(--md-sys-motion-spring-expressive-fast-effects)',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingInline: isFloating ? '5px' : '0px',
              borderTop: isFloating ? 'none' : `${borderWidth} solid ${borderColor}`,
              borderBottom: `${borderWidth} solid ${borderColor}`,
              transition: 'border-color var(--md-sys-motion-spring-expressive-fast-effects)',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                visibility: 'hidden',
                maxWidth: isFloating ? '480px' : '0px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </div>
          <div
            style={{
              flex: 1,
              borderTop: `${borderWidth} solid ${borderColor}`,
              borderRight: `${borderWidth} solid ${borderColor}`,
              borderBottom: `${borderWidth} solid ${borderColor}`,
              borderRadius: '0 8px 8px 0',
              transition: 'border-color var(--md-sys-motion-spring-expressive-fast-effects)',
            }}
          />
        </div>

        {leadingIcon && (
          <span
            style={{
              color: focused ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              display: 'inline-flex',
              flexShrink: 0,
              transition: 'color var(--md-sys-motion-spring-expressive-fast-effects)',
            }}
          >
            {leadingIcon}
          </span>
        )}

        <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
          <label
            htmlFor={inputId}
            style={{
              position: 'absolute',
              left: isFloating && leadingIcon ? '-26px' : '0px',
              top: isFloating ? '0px' : '50%',
              transform: 'translateY(-50%)',
              fontSize: isFloating ? '12px' : '14px',
              fontWeight: isFloating ? 600 : 400,
              color: labelColor,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              transition:
                'top var(--md-sys-motion-spring-expressive-fast-spatial), left var(--md-sys-motion-spring-expressive-fast-spatial), font-size var(--md-sys-motion-spring-expressive-fast-spatial), color var(--md-sys-motion-spring-expressive-fast-effects)',
            }}
          >
            {label}
          </label>
          <input
            id={inputId}
            value={value}
            onChange={onChange}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--md-sys-color-on-surface)',
              fontFamily: 'var(--md-ref-typeface-plain)',
              fontSize: dense ? '13px' : '14px',
              lineHeight: '20px',
            }}
            {...rest}
          />
        </div>
      </div>
      {supportingText && (
        <span
          className="md3-body-small"
          style={{
            padding: '4px 14px 0',
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          {supportingText}
        </span>
      )}
    </div>
  );
};

/* ============================================================================
 * 5. 主应用组件 App (100% 保持原有状态与接口逻辑)
 * ========================================================================== */
export default function App() {
  /* ---------------- 原有业务状态 (100% 保留) ---------------- */
  const [isBatch, setIsBatch] = useState<boolean>(false);
  const [mode, setMode] = useState<string>('advanced');
  const [inputPath, setInputPath] = useState<string>(
    'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_003.jpg'
  );
  const [batchDir, setBatchDir] = useState<string>(
    'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）'
  );
  const [pageRange, setPageRange] = useState<string>('03-19');
  const [referencePath, setReferencePath] = useState<string>(
    'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_022.jpg'
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('就绪');
  const [activeTab, setActiveTab] = useState<'compare' | 'final' | 'table'>('compare');

  const [result, setResult] = useState<ProcessResult | null>(null);
  const [dialogueItems, setDialogueItems] = useState<DialogueItem[]>([]);
  const [batchSummary, setBatchSummary] = useState<any[]>([]);

  const [health, setHealth] = useState({
    api: true,
    model: 'gemini-3.8-flash-tiered',
    comfyui: false,
    cuda: true,
  });

  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [config, setConfig] = useState({
    api_base: 'http://127.0.0.1:8045/v1',
    model: 'gemini-3.8-flash-tiered',
    comfy_url: 'http://127.0.0.1:8000',
    font: 'C:/Windows/Fonts/msyh.ttc',
  });

  /* ---------------- MD3 视觉与自适应布局增强状态 ---------------- */
  const [themePreset, setThemePreset] = useState<Md3ThemePresetId>('oceanBlue');
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true);
  const [controlPaneWidth, setControlPaneWidth] = useState<number>(420);
  const isDraggingPaneRef = useRef<boolean>(false);

  useEffect(() => {
    syncThemeTokensToDom(themePreset, isDarkTheme);
  }, [themePreset, isDarkTheme]);

  /* ---------------- 原有生命周期与业务处理函数 (100% 保留) ---------------- */
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data) setHealth(data);
      })
      .catch(() => {});
  }, []);

  const loadMomoumixPreset = () => {
    setIsBatch(true);
    setMode('advanced');
    setBatchDir('examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）');
    setPageRange('03-19');
    setReferencePath('examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_022.jpg');
    setStatusMsg('已载入 MOMOUMIX 03-19 话册测试预设 (基准色: MOMOUMIX_022.jpg)');
  };

  const handleRun = async () => {
    setIsProcessing(true);
    setStatusMsg(`正在以 [${mode}] 模式启动流水线...`);

    try {
      if (isBatch) {
        setStatusMsg(`正在执行批量任务: ${batchDir} (范围: ${pageRange})...`);
        const resp = await fetch('/api/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: batchDir,
            reference: referencePath,
            mode: mode,
            page_range: pageRange,
            glob: '*.jpg',
          }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        }

        const data = await resp.json();
        setBatchSummary(data.summary || []);
        setStatusMsg(`批量任务完成！处理了 ${data.summary?.length || 0} 个页面。`);
      } else {
        setStatusMsg(`正在处理单页: ${inputPath}...`);
        const resp = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: inputPath,
            reference: referencePath,
            mode: mode,
          }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        }

        const data: ProcessResult = await resp.json();
        setResult(data);
        if (data.items) {
          setDialogueItems(data.items);
        }
        setStatusMsg(`完成！耗时: ${data.seconds}秒, 共处理 ${data.bubbles} 处对白。`);
        setActiveTab('compare');
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`处理失败: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateTranslation = (id: number, newTrans: string) => {
    setDialogueItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, translation: newTrans } : it))
    );
  };

  /* ---------------- MD3 分栏手柄拖拽处理 ---------------- */
  const handleStartPaneDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDraggingPaneRef.current = true;
      const startX = e.clientX;
      const startW = controlPaneWidth;

      const onMove = (moveEvt: PointerEvent) => {
        if (!isDraggingPaneRef.current) return;
        const nextW = Math.min(Math.max(startW + (moveEvt.clientX - startX), 340), 560);
        setControlPaneWidth(nextW);
      };

      const onUp = () => {
        isDraggingPaneRef.current = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [controlPaneWidth]
  );

  const pipelineModes = [
    {
      id: 'advanced',
      icon: 'bolt',
      title: '进阶模式 (推荐: 先擦后色再嵌字)',
      desc: '先擦除生肉日文->无字全彩上色->高锐度重嵌中文，绝不糊字',
      badge: 'M3 Expressive 推荐',
    },
    {
      id: 'auto',
      icon: 'auto_fix_high',
      title: '智能全自动 (Auto-Detect)',
      desc: '自动检测色彩与语言：黑白自动上色，非中文自动汉化',
    },
    {
      id: 'both',
      icon: 'palette',
      title: '翻译并上色 (Both)',
      desc: '强制执行汉化翻译与全彩上色双重流程',
    },
    {
      id: 'translate',
      icon: 'translate',
      title: '仅汉化翻译 (Translate Only)',
      desc: '仅执行气泡检测、OCR、连贯翻译与排版嵌字',
    },
    {
      id: 'colorize',
      icon: 'brush',
      title: '仅漫画上色 (Colorize Only)',
      desc: '仅基于参考图执行扩散上色与高频线稿复合',
    },
  ];

  return (
    <div className="md3-app-shell">
      {/* ====================================================================
       * 1. MD3 Top App Bar (品牌标识 + 动态源色彩工作台 + 健康状态 Chip + 动作按钮)
       * ================================================================== */}
      <header className="md3-top-app-bar">
        {/* 左侧品牌区：采用 M3 Expressive 有机多边形徽章衬底 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--md-sys-shape-corner-large)',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: 'var(--md-sys-elevation-level1)',
              flexShrink: 0,
            }}
          >
            <Md3Icon name="palette" size={30} fill={1} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="md3-headline-small-emphasized" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                MangaShot Studio
              </h1>
              <span
                className="md3-label-small"
                style={{
                  padding: '2px 10px',
                  borderRadius: 'var(--md-sys-shape-corner-full)',
                  backgroundColor: 'var(--md-sys-color-tertiary-container)',
                  color: 'var(--md-sys-color-on-tertiary-container)',
                }}
              >
                Material You
              </span>
            </div>
            <p className="md3-body-Small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px', fontSize: '13px' }}>
              一键日漫全自动翻译与全彩上色工作台 (MangaTranslate &amp; MangaColour 集成)
            </p>
          </div>
        </div>

        {/* 右侧状态指示器、预设载入、MD3 动态换肤器与设置按钮 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {/* 动态源色切换胶囊 (Dynamic Seed Color Picker) */}
          <div
            role="group"
            aria-label="MD3 动态主题源色切换"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: 'var(--md-sys-shape-corner-full)',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
            }}
          >
            {(Object.keys(MD3_THEME_PRESETS) as Md3ThemePresetId[]).map((key) => {
              const item = MD3_THEME_PRESETS[key];
              const active = themePreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  title={item.name}
                  aria-label={item.name}
                  onClick={() => setThemePreset(key)}
                  className="md3-focus-ring"
                  style={{
                    width: active ? '24px' : '18px',
                    height: '18px',
                    borderRadius: active ? '6px' : '9999px',
                    border: active ? '2px solid var(--md-sys-color-on-surface)' : 'none',
                    backgroundColor: item.swatch,
                    cursor: 'pointer',
                    transition:
                      'width var(--md-sys-motion-spring-expressive-fast-spatial), border-radius var(--md-sys-motion-spring-expressive-fast-spatial)',
                  }}
                />
              );
            })}
            <button
              type="button"
              onClick={() => setIsDarkTheme((d) => !d)}
              title={isDarkTheme ? '切换为亮色模式 (Light)' : '切换为暗色模式 (Dark)'}
              className="md3-focus-ring"
              style={{
                marginLeft: '4px',
                padding: '3px 10px',
                borderRadius: 'var(--md-sys-shape-corner-full)',
                border: 'none',
                backgroundColor: 'var(--md-sys-color-secondary-container)',
                color: 'var(--md-sys-color-on-secondary-container)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Md3Icon name={isDarkTheme ? 'dark_mode' : 'light_mode'} size={15} />
              <span>{isDarkTheme ? 'Dark' : 'Light'}</span>
            </button>
          </div>

          {/* 载入 MOMOUMIX 测试预设 Tonal 按钮 */}
          <Md3Button
            variant="tonal"
            size="xs"
            onClick={loadMomoumixPreset}
            leadingIcon={<Md3Icon name="star" size={16} fill={1} />}
          >
            载入 MOMOUMIX 03-19 测试预设
          </Md3Button>

          {/* API 模型状态 Chip */}
          <span
            className="md3-label-medium"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              paddingInline: '14px',
              borderRadius: 'var(--md-sys-shape-corner-small)',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
            }}
          >
            <Md3Icon name="rocket_launch" size={16} /> API: {health.model}
          </span>

          {/* ComfyUI 状态 Chip */}
          <span
            className="md3-label-medium"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              paddingInline: '14px',
              borderRadius: 'var(--md-sys-shape-corner-small)',
              backgroundColor: health.comfyui
                ? 'var(--md-sys-color-success-container)'
                : 'var(--md-sys-color-warning-container)',
              color: health.comfyui
                ? 'var(--md-sys-color-on-success-container)'
                : 'var(--md-sys-color-on-warning-container)',
            }}
          >
            <Md3Icon
              name={health.comfyui ? 'check_circle' : 'sync_problem'}
              size={16}
              fill={health.comfyui ? 1 : 0}
            />{' '}
            {health.comfyui ? 'ComfyUI 在线' : 'ComfyUI 离线 (色度迁移就绪)'}
          </span>

          {/* 设置按钮 */}
          <Md3Button
            variant="outlined"
            size="xs"
            onClick={() => setShowConfig(!showConfig)}
            leadingIcon={<Md3Icon name="settings" size={16} />}
          >
            设置
          </Md3Button>
        </div>
      </header>

      {/* ====================================================================
       * 2. 双窗格自适应主工作区 (Control Pane + Drag Handle + Viewer Pane)
       * ================================================================== */}
      <main className="md3-workspace-split">
        {/* ---------------- 左窗格：流水线控制中心 ---------------- */}
        <section
          className="md3-pane-surface md3-control-pane-host"
          style={{
            width: `${controlPaneWidth}px`,
            flex: `0 0 ${controlPaneWidth}px`,
          }}
        >
          {/* 2.1 选择流水线模式 (MD3 Tonal Selection Cards with Shape Morphing) */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <label className="md3-title-small" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                选择流水线模式 (Pipeline Mode)
              </label>
              <span className="md3-label-small" style={{ color: 'var(--md-sys-color-primary)' }}>
                5 种工作流
              </span>
            </div>

            <div role="radiogroup" aria-label="选择流水线模式" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pipelineModes.map((m) => {
                const selected = mode === m.id;
                return (
                  <div
                    key={m.id}
                    role="radio"
                    aria-checked={selected}
                    tabIndex={0}
                    onClick={() => setMode(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setMode(m.id);
                      }
                    }}
                    className="md3-focus-ring"
                    style={{
                      position: 'relative',
                      padding: '12px 14px',
                      /* M3 Expressive 动态圆角变形：选中态变为 20px 大圆角，未选中为 12px */
                      borderRadius: selected
                        ? 'var(--md-sys-shape-corner-large-increased)'
                        : 'var(--md-sys-shape-corner-medium)',
                      cursor: 'pointer',
                      backgroundColor: selected
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container-low)',
                      color: selected
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      border: selected
                        ? '2px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      transition:
                        'border-radius var(--md-sys-motion-spring-expressive-fast-spatial), background-color var(--md-sys-motion-spring-expressive-fast-effects), border-color var(--md-sys-motion-spring-expressive-fast-effects)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Md3Icon name={m.icon} size={20} fill={selected ? 1 : 0} />
                        <span
                          className="md3-label-large"
                          style={{
                            fontWeight: selected ? 700 : 600,
                            color: selected
                              ? 'var(--md-sys-color-on-primary-container)'
                              : 'var(--md-sys-color-on-surface)',
                          }}
                        >
                          {m.title}
                        </span>
                      </div>
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '9999px',
                          border: selected
                            ? '5px solid var(--md-sys-color-primary)'
                            : '2px solid var(--md-sys-color-outline)',
                          backgroundColor: selected ? 'var(--md-sys-color-on-primary)' : 'transparent',
                          flexShrink: 0,
                          transition: 'border var(--md-sys-motion-spring-expressive-fast-spatial)',
                        }}
                      />
                    </div>
                    <div
                      className="md3-body-small"
                      style={{
                        marginTop: '4px',
                        color: selected
                          ? 'var(--md-sys-color-on-primary-container)'
                          : 'var(--md-sys-color-on-surface-variant)',
                        opacity: selected ? 0.9 : 1,
                      }}
                    >
                      {m.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2.2 单页 vs 整话批量模式 (M3 Expressive Connected Button Group) */}
          <Md3ConnectedButtonGroup
            value={isBatch ? 'batch' : 'single'}
            onChange={(val) => setIsBatch(val === 'batch')}
            options={[
              { id: 'single', label: '单页处理模式' },
              { id: 'batch', label: '整话批量模式' },
            ]}
          />

          {/* 2.3 路径参数输入框 (MD3 三段式透明切口浮动标签 TextField) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!isBatch ? (
              <Md3TextField
                label="输入漫画单页路径 (Page File)"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                leadingIcon={<Md3Icon name="description" size={20} />}
              />
            ) : (
              <>
                <Md3TextField
                  label="整话漫画目录路径 (Chapter Directory)"
                  value={batchDir}
                  onChange={(e) => setBatchDir(e.target.value)}
                  leadingIcon={<Md3Icon name="folder_open" size={20} />}
                />
                <Md3TextField
                  label="页码区间过滤 (Page Range, 如 03-19)"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  placeholder="03-19"
                  leadingIcon={<Md3Icon name="pin" size={20} />}
                />
              </>
            )}

            <Md3TextField
              label="色彩基准图 (Color Palette Reference)"
              value={referencePath}
              onChange={(e) => setReferencePath(e.target.value)}
              leadingIcon={<Md3Icon name="palette" size={20} />}
            />
          </div>

          {/* 2.4 启动流水线大号主操作按钮 (Large 56dp Expressive Button + 7形态变形加载器) */}
          <Md3Button
            variant="filled"
            size="lg"
            fullWidth
            disabled={isProcessing}
            onClick={handleRun}
            leadingIcon={
              isProcessing ? (
                <Md3MorphingIndicator size={22} />
              ) : (
                <Md3Icon name={isBatch ? 'auto_mode' : 'rocket_launch'} size={22} fill={1} />
              )
            }
          >
            {isProcessing
              ? '正在处理中...'
              : isBatch
                ? '开始执行整话批量处理'
                : '开始执行单页流水线'}
          </Md3Button>

          {/* 处理中展示 M3 Expressive 正弦波浪进度条 */}
          {isProcessing && <Md3WavyLinearProgress />}

          {/* 2.5 状态控制台卡片 (Surface Container High Tonal Banner) */}
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '14px 16px',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              borderRadius: 'var(--md-sys-shape-corner-large)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div className="md3-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              <strong style={{ color: 'var(--md-sys-color-primary)' }}>状态：</strong> {statusMsg}
            </div>

            {/* 当存在执行结果元数据时展示 MD3 Tonal 统计胶囊 */}
            {result && !isBatch && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                <span
                  className="md3-label-small"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--md-sys-color-secondary-container)',
                    color: 'var(--md-sys-color-on-secondary-container)',
                  }}
                >
                  <Md3Icon name="timer" size={14} /> 耗时 {result.seconds}s
                </span>
                <span
                  className="md3-label-small"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--md-sys-color-tertiary-container)',
                    color: 'var(--md-sys-color-on-tertiary-container)',
                  }}
                >
                  <Md3Icon name="chat_bubble" size={14} /> 气泡 {result.bubbles} 处
                </span>
              </div>
            )}

            {/* 批量模式汇总摘要展示 */}
            {isBatch && batchSummary.length > 0 && (
              <div
                className="md3-label-small"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--md-sys-shape-corner-small)',
                  backgroundColor: 'var(--md-sys-color-success-container)',
                  color: 'var(--md-sys-color-on-success-container)',
                }}
              >
                <Md3Icon name="check_circle" size={16} fill={1} /> 已完成 {batchSummary.length} 页批量流水线处理
              </div>
            )}
          </div>
        </section>

        {/* ---------------- 中央可拖拽分栏分隔手柄 (MD3 Pane Drag Handle) ---------------- */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="拖拽调整左右工作区宽度"
          tabIndex={0}
          onPointerDown={handleStartPaneDrag}
          className="md3-pane-drag-handle md3-focus-ring"
        >
          <span className="md3-pane-drag-handle-pill" />
        </div>

        {/* ---------------- 右窗格：可视化对比画布与坐标控制台词表 ---------------- */}
        <section className="md3-pane-surface" style={{ flex: 1, minWidth: 0 }}>
          {/* 顶部三视图切换栏 (M3 Expressive Connected Button Group) */}
          <Md3ConnectedButtonGroup
            value={activeTab}
            onChange={(tab) => setActiveTab(tab)}
            height="46px"
            options={[
              {
                id: 'compare',
                label: '双联画对比 (QA Compare)',
                icon: <Md3Icon name="compare" size={18} />,
              },
              {
                id: 'final',
                label: '最终成果图 (Final Page)',
                icon: <Md3Icon name="image" size={18} />,
              },
              {
                id: 'table',
                label: `坐标控制台词表 (${dialogueItems.length})`,
                icon: <Md3Icon name="table_chart" size={18} />,
                badge: dialogueItems.length,
              },
            ]}
          />

          {/* 主视口舞台区 (Surface Container Lowest 画布) */}
          <div className="md3-canvas-stage">
            {/* 视图 1：双联画对比 (QA Compare) */}
            {activeTab === 'compare' &&
              (result?.qa_url ? (
                <img
                  src={result.qa_url}
                  alt="QA Compare"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '680px',
                    objectFit: 'contain',
                    borderRadius: 'var(--md-sys-shape-corner-medium)',
                    boxShadow: 'var(--md-sys-elevation-level2)',
                  }}
                />
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    maxWidth: '420px',
                    padding: '32px',
                    borderRadius: 'var(--md-sys-shape-corner-extra-large)',
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: 'var(--md-sys-shape-corner-large-increased)',
                      backgroundColor: 'var(--md-sys-color-secondary-container)',
                      color: 'var(--md-sys-color-on-secondary-container)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Md3Icon name="compare" size={38} />
                  </div>
                  <p className="md3-title-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    点击左侧“开始执行流水线”以生成双联对比视图。
                  </p>
                  <p className="md3-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    展示生肉黑白原稿 vs 无字底稿 vs 全彩汉化最终成果。
                  </p>
                </div>
              ))}

            {/* 视图 2：最终成果图 (Final Page) */}
            {activeTab === 'final' &&
              (result?.final_url ? (
                <img
                  src={result.final_url}
                  alt="Final Result"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '680px',
                    objectFit: 'contain',
                    borderRadius: 'var(--md-sys-shape-corner-medium)',
                    boxShadow: 'var(--md-sys-elevation-level2)',
                  }}
                />
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    maxWidth: '380px',
                    padding: '32px',
                    borderRadius: 'var(--md-sys-shape-corner-extra-large)',
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: 'var(--md-sys-shape-corner-large-increased)',
                      backgroundColor: 'var(--md-sys-color-tertiary-container)',
                      color: 'var(--md-sys-color-on-tertiary-container)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Md3Icon name="auto_awesome" size={38} fill={1} />
                  </div>
                  <p className="md3-title-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    暂无最终成果图。
                  </p>
                </div>
              ))}

            {/* 视图 3：坐标控制台词表 (MD3 Data Table) */}
            {activeTab === 'table' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  maxHeight: '680px',
                  overflowY: 'auto',
                  alignSelf: 'stretch',
                }}
              >
                {dialogueItems.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      padding: '100px 24px',
                    }}
                  >
                    暂无台词数据。执行任务后将展示经过位置校验的完整对话列表。
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: 'var(--md-sys-shape-corner-large)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: 'var(--md-sys-color-surface)',
                      overflow: 'hidden',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr
                          style={{
                            backgroundColor: 'var(--md-sys-color-surface-container-high)',
                            color: 'var(--md-sys-color-on-surface)',
                            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                            textAlign: 'left',
                          }}
                        >
                          <th style={{ padding: '14px 16px', width: '72px' }}>ID</th>
                          <th style={{ padding: '14px 16px', width: '210px' }}>
                            气泡框坐标 [X1, Y1, X2, Y2]
                          </th>
                          <th style={{ padding: '14px 16px', width: '32%' }}>日文生肉原文 (OCR)</th>
                          <th style={{ padding: '14px 16px' }}>简体中文译文 (连贯汉化)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dialogueItems.map((item) => (
                          <tr
                            key={item.id}
                            style={{
                              borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                              transition:
                                'background-color var(--md-sys-motion-spring-expressive-fast-effects)',
                            }}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  padding: '3px 10px',
                                  borderRadius: '9999px',
                                  backgroundColor: 'var(--md-sys-color-primary-container)',
                                  color: 'var(--md-sys-color-on-primary-container)',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                }}
                              >
                                #{item.id}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <code
                                style={{
                                  fontFamily: 'var(--md-ref-typeface-mono)',
                                  fontSize: '12px',
                                  padding: '4px 8px',
                                  borderRadius: 'var(--md-sys-shape-corner-small)',
                                  backgroundColor: 'var(--md-sys-color-surface-container-low)',
                                  color: 'var(--md-sys-color-on-surface-variant)',
                                }}
                              >
                                [{item.box.join(', ')}]
                              </code>
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                color: 'var(--md-sys-color-on-surface)',
                                lineHeight: 1.5,
                              }}
                            >
                              {item.original}
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <input
                                type="text"
                                value={item.translation}
                                onChange={(e) => handleUpdateTranslation(item.id, e.target.value)}
                                className="md3-focus-ring"
                                style={{
                                  width: '100%',
                                  height: '40px',
                                  padding: '0 14px',
                                  borderRadius: 'var(--md-sys-shape-corner-small)',
                                  border: '1px solid var(--md-sys-color-outline)',
                                  backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                                  color: 'var(--md-sys-color-on-surface)',
                                  fontFamily: 'var(--md-ref-typeface-plain)',
                                  fontSize: '13px',
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ====================================================================
       * 3. MD3 模态对话框：流水线配置中心 (28px Extra-Large 圆角 + Level 3 阴影)
       * ================================================================== */}
      {showConfig && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="md3-config-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'color-mix(in srgb, var(--md-sys-color-scrim) 55%, transparent)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'md3-scrim-fade 200ms cubic-bezier(0.34, 0.80, 0.34, 1.00)',
          }}
        >
          <div
            style={{
              width: '540px',
              maxWidth: '92vw',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              borderRadius: 'var(--md-sys-shape-corner-extra-large)',
              padding: '24px',
              boxShadow: 'var(--md-sys-elevation-level3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              animation: 'md3-dialog-enter 350ms cubic-bezier(0.42, 1.67, 0.21, 0.90)',
            }}
          >
            <div>
              <h2
                id="md3-config-dialog-title"
                className="md3-headline-small-emphasized"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Md3Icon name="tune" size={24} /> 流水线配置中心
              </h2>
              <p
                className="md3-body-small"
                style={{ color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}
              >
                配置翻译推理服务端点、ComfyUI 渲染引擎地址及嵌字字体路径
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Md3TextField
                label="翻译 API 接口地址"
                value={config.api_base}
                onChange={(e) => setConfig({ ...config, api_base: e.target.value })}
                leadingIcon={<Md3Icon name="public" size={20} />}
              />
              <Md3TextField
                label="LLM 翻译模型"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                leadingIcon={<Md3Icon name="smart_toy" size={20} />}
              />
              <Md3TextField
                label="ComfyUI 服务地址"
                value={config.comfy_url}
                onChange={(e) => setConfig({ ...config, comfy_url: e.target.value })}
                leadingIcon={<Md3Icon name="palette" size={20} />}
              />
              <Md3TextField
                label="中文字体文件路径"
                value={config.font}
                onChange={(e) => setConfig({ ...config, font: e.target.value })}
                leadingIcon={<Md3Icon name="font_download" size={20} />}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <Md3Button variant="text" onClick={() => setShowConfig(false)}>
                关闭
              </Md3Button>
              <Md3Button variant="filled" onClick={() => setShowConfig(false)}>
                保存设置
              </Md3Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
