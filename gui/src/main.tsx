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

/** 跨目录选页分组：挂在所属章节卡片下，最终合并到该章节提交 */
interface CrossDirGroup {
  id: string;
  dirPath: string;
  files: string[];
}

/** 跨目录多章节任务队列卡片项定义 */
interface BatchTaskItem {
  id: string;
  name: string;
  dirPath: string;
  pageRange: string;
  useCustomRef: boolean;
  customRefPath: string;
  selectedFiles?: string[];
  selectionGroups?: CrossDirGroup[];
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
  badge?: number | string;
  tooltipTitle?: string;
  tooltipText?: string;
}

function Md3ConnectedButtonGroup<T extends string>({
  options,
  value,
  onChange,
  height = '42px',
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

        const btnElement = (
          <button
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.id)}
            onPointerDown={() => setPressedId(opt.id)}
            onPointerUp={() => setPressedId(null)}
            onPointerLeave={() => setPressedId(null)}
            className="md3-focus-ring"
            style={{
              width: '100%',
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
                'border-radius var(--md-sys-motion-spring-expressive-fast-spatial), background-color var(--md-sys-motion-spring-expressive-fast-effects), color var(--md-sys-motion-spring-expressive-fast-effects)',
            }}
          >
            {opt.icon ? (
              opt.icon
            ) : selected ? (
              <Md3Icon name="check" size={18} />
            ) : null}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
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

        return (
          <div
            key={opt.id}
            style={{
              flex: selected ? 1.25 : pressed ? 1.12 : 1,
              transition: 'flex var(--md-sys-motion-spring-expressive-fast-spatial)',
              display: 'flex',
            }}
          >
            {opt.tooltipText ? (
              <Md3Tooltip title={opt.tooltipTitle} text={opt.tooltipText} fullWidth>
                {btnElement}
              </Md3Tooltip>
            ) : (
              btnElement
            )}
          </div>
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
  trailingAction?: React.ReactNode;
  dense?: boolean;
}

const Md3TextField: React.FC<Md3TextFieldProps> = ({
  label,
  supportingText,
  leadingIcon,
  trailingAction,
  dense = false,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  ...rest
}) => {
  const inputId = useId();
  const [focused, setFocused] = useState(false);
  const strVal = String(value ?? '');
  const isPopulated = strVal.length > 0;
  const isFloating = focused || isPopulated;

  const borderColor = focused ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)';
  const borderWidth = focused ? '2px' : '1px';
  const labelColor = focused
    ? 'var(--md-sys-color-primary)'
    : 'var(--md-sys-color-on-surface-variant)';

  // 左端第一段 outline 宽度：有 leadingIcon 时延伸至 38px，使得标签切口恰好在 leadingIcon 之后展开
  const leftSegmentWidth = leadingIcon ? '38px' : '12px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div
        style={{
          position: 'relative',
          height: dense ? '44px' : '52px',
          display: 'flex',
          alignItems: 'center',
          paddingInlineStart: leadingIcon ? '12px' : '16px',
          paddingInlineEnd: '12px',
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
          {/* 左端段 */}
          <div
            style={{
              width: leftSegmentWidth,
              borderTop: `${borderWidth} solid ${borderColor}`,
              borderLeft: `${borderWidth} solid ${borderColor}`,
              borderBottom: `${borderWidth} solid ${borderColor}`,
              borderRadius: '8px 0 0 8px',
              transition: 'border-color var(--md-sys-motion-spring-expressive-fast-effects)',
            }}
          />
          {/* 切口段：浮动时断开顶部边框以容纳标签 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingInline: isFloating ? '4px' : '0px',
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
                maxWidth: isFloating ? '380px' : '0px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'max-width var(--md-sys-motion-spring-expressive-fast-spatial)',
              }}
            >
              {label}
            </span>
          </div>
          {/* 右端延伸段 */}
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
              left: '0px',
              top: isFloating ? '0px' : '50%',
              transform: 'translateY(-50%)',
              fontSize: isFloating ? '12px' : dense ? '13px' : '14px',
              fontWeight: isFloating ? 600 : 400,
              color: labelColor,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 'calc(100% - 16px)',
              transition:
                'top var(--md-sys-motion-spring-expressive-fast-spatial), font-size var(--md-sys-motion-spring-expressive-fast-spatial), color var(--md-sys-motion-spring-expressive-fast-effects)',
            }}
          >
            {label}
          </label>
          <input
            id={inputId}
            value={value}
            placeholder={focused ? placeholder : undefined}
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

        {trailingAction && (
          <div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, zIndex: 2 }}>
            {trailingAction}
          </div>
        )}
      </div>
      {supportingText && (
        <span
          className="md3-body-small"
          style={{
            padding: '4px 14px 0',
            color: 'var(--md-sys-color-on-surface-variant)',
            fontSize: '11px',
            lineHeight: '14px',
          }}
        >
          {supportingText}
        </span>
      )}
    </div>
  );
};

/** 4.6 MD3 规范工具提示 (Plain & Rich Tooltip) */
interface Md3TooltipProps {
  title?: string;
  text?: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

const Md3Tooltip: React.FC<Md3TooltipProps> = ({
  title,
  text,
  children,
  position = 'top',
  fullWidth = false,
  style,
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  if (!text && !title) return <>{children}</>;

  const handleEnter = () => {
    timerRef.current = window.setTimeout(() => setVisible(true), 150);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div
      style={{
        position: 'relative',
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : 'auto',
        flexShrink: fullWidth ? 1 : 0,
        ...style,
      }}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            [position === 'top' ? 'bottom' : 'top']: 'calc(100% + 8px)',
            zIndex: 9999,
            pointerEvents: 'none',
            maxWidth: '300px',
            minWidth: '180px',
            padding: title ? '10px 14px' : '6px 12px',
            borderRadius: 'var(--md-sys-shape-corner-medium)',
            backgroundColor: 'var(--md-sys-color-inverse-surface)',
            color: 'var(--md-sys-color-inverse-on-surface)',
            boxShadow: 'var(--md-sys-elevation-level2)',
            fontSize: '12px',
            lineHeight: '18px',
            animation: 'md3-tooltip-enter var(--md-sys-motion-spring-expressive-fast-spatial) forwards',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {title && (
            <div
              style={{
                fontWeight: 700,
                fontSize: '13px',
                marginBottom: '3px',
                color: 'var(--md-sys-color-inverse-primary)',
              }}
            >
              {title}
            </div>
          )}
          {text && <div style={{ opacity: 0.94 }}>{text}</div>}
        </div>
      )}
    </div>
  );
};

/** 4.7 MD3 标准图标按钮 (Icon Button with Tooltip & State Layer) */
interface Md3IconButtonProps {
  icon: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  colorVar?: string;
  active?: boolean;
  size?: number;
}

const Md3IconButton: React.FC<Md3IconButtonProps> = ({
  icon,
  tooltip,
  onClick,
  disabled = false,
  colorVar,
  active = false,
  size = 20,
}) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const fgColor = disabled
    ? 'var(--md-sys-color-outline)'
    : colorVar || (active ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)');

  const bgColor = disabled
    ? 'transparent'
    : pressed
      ? 'var(--md-sys-color-surface-container-highest)'
      : hovered
        ? 'var(--md-sys-color-surface-container-high)'
        : active
          ? 'var(--md-sys-color-surface-container-high)'
          : 'transparent';

  return (
    <Md3Tooltip text={tooltip}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        className="md3-focus-ring"
        aria-label={tooltip}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--md-sys-shape-corner-full)',
          border: 'none',
          backgroundColor: bgColor,
          color: fgColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          transition:
            'background-color var(--md-sys-motion-spring-expressive-fast-effects), color var(--md-sys-motion-spring-expressive-fast-effects), transform var(--md-sys-motion-spring-expressive-fast-spatial)',
          transform: pressed && !disabled ? 'scale(0.92)' : 'scale(1)',
        }}
      >
        <Md3Icon name={icon} size={size} fill={active ? 1 : 0} />
      </button>
    </Md3Tooltip>
  );
};

/* ============================================================================
 * 5. 主应用组件 App (100% 保持原有状态与接口逻辑)
 * ========================================================================== */
export default function App() {
  /* ---------------- 原有业务状态 (100% 保留与扩展) ---------------- */
  const [isBatch, setIsBatch] = useState<boolean>(false);
  const [mode, setMode] = useState<string>('advanced');
  const [colorMode, setColorMode] = useState<'composite' | 'direct'>('composite');
  const [inputPath, setInputPath] = useState<string>(
    'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_003.jpg'
  );
  const [baseDir, setBaseDir] = useState<string>('');
  const [referencePath, setReferencePath] = useState<string>(
    'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_001.jpg'
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('就绪');
  const [activeTab, setActiveTab] = useState<'compare' | 'final' | 'table'>('compare');

  /* 多章节任务队列卡片状态 (Multi-Folder Batch Queue) */
  const [batchQueue, setBatchQueue] = useState<BatchTaskItem[]>([
    {
      id: 'task-1',
      name: '第 01 话',
      dirPath: 'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）',
      pageRange: '03-19',
      useCustomRef: false,
      customRefPath: '',
      selectedFiles: [],
    },
  ]);

  /* 隐藏式原生文件选择器 Ref */
  const singleFilePickerRef = useRef<HTMLInputElement | null>(null);
  const globalRefPickerRef = useRef<HTMLInputElement | null>(null);
  const customRefPickerRef = useRef<HTMLInputElement | null>(null);
  const taskFolderPickerRef = useRef<HTMLInputElement | null>(null);
  const taskFolderNativeDirPickerRef = useRef<HTMLInputElement | null>(null);
  const activePickerTaskIdRef = useRef<string | null>(null);
  const pickerBusyRef = useRef<boolean>(false);

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

  /* 浏览器备用文件选择器被取消时，及时复位状态提示，避免卡在“正在唤起...” */
  useEffect(() => {
    const inputs = [
      singleFilePickerRef.current,
      globalRefPickerRef.current,
      customRefPickerRef.current,
      taskFolderPickerRef.current,
      taskFolderNativeDirPickerRef.current,
    ].filter(Boolean) as HTMLInputElement[];
    const handleCancel = () => {
      activePickerTaskIdRef.current = null;
      setStatusMsg('已取消浏览器文件选择');
    };
    inputs.forEach((input) => input.addEventListener('cancel', handleCancel));
    return () => {
      inputs.forEach((input) => input.removeEventListener('cancel', handleCancel));
    };
  }, []);

  const loadMomoumixPreset = () => {
    setIsBatch(true);
    setMode('advanced');
    setColorMode('composite');
    setBatchQueue([
      {
        id: 'task-1',
        name: '第 01 话',
        dirPath: 'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）',
        pageRange: '03-19',
        useCustomRef: false,
        customRefPath: '',
        selectedFiles: [],
      },
    ]);
    setReferencePath('examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_001.jpg');
    setStatusMsg('已载入 MOMOUMIX 03-19 测试预设 (色彩基准: 封面 MOMOUMIX_001.jpg)');
  };

  const getTaskDisplayName = (task: BatchTaskItem, idx: number): string => {
    return task.name && task.name.trim() ? task.name : `第 ${String(idx + 1).padStart(2, '0')} 话`;
  };

  /* 队列卡片增删改克隆操作 */
  const updateTask = (taskId: string, partial: Partial<BatchTaskItem>) => {
    setBatchQueue((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...partial } : t))
    );
  };

  const handleCloneTask = (taskId: string) => {
    const target = batchQueue.find((t) => t.id === taskId);
    if (!target) return;
    let nextDir = target.dirPath;
    const matchNum = nextDir.match(/(\d+)(?!.*\d)/);
    if (matchNum) {
      const origNum = matchNum[1];
      const incNum = String(parseInt(origNum, 10) + 1).padStart(origNum.length, '0');
      nextDir =
        nextDir.slice(0, matchNum.index!) + incNum + nextDir.slice(matchNum.index! + origNum.length);
    }
    const newTask: BatchTaskItem = {
      ...target,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      dirPath: nextDir,
    };
    setBatchQueue((prev) => [...prev, newTask]);
    setStatusMsg(`已克隆任务 -> 第 ${String(batchQueue.length + 1).padStart(2, '0')} 话 (${nextDir})`);
  };

  const handleDeleteTask = (taskId: string) => {
    if (batchQueue.length <= 1) {
      setStatusMsg('至少保留一个章节任务');
      return;
    }
    setBatchQueue((prev) => prev.filter((t) => t.id !== taskId));
    setStatusMsg('已移除章节，队列序号已即时同步重排');
  };

  const handleAddFolderTask = () => {
    const nextIdx = batchQueue.length + 1;
    const newTask: BatchTaskItem = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      dirPath: '',
      pageRange: '*',
      useCustomRef: false,
      customRefPath: '',
      selectedFiles: [],
    };
    setBatchQueue((prev) => [...prev, newTask]);
    setStatusMsg(`已添加新章节 -> 第 ${String(nextIdx).padStart(2, '0')} 话`);
  };

  const fileNameOf = (filePath: string): string => {
    const parts = String(filePath || '').split(/[\\/]/);
    return parts[parts.length - 1] || filePath;
  };

  const computePageRange = (files: string[]): string => {
    const numbers: number[] = [];
    for (const f of files) {
      const m = fileNameOf(f).match(/\d+/g);
      if (m) numbers.push(parseInt(m[m.length - 1], 10));
    }
    numbers.sort((a, b) => a - b);
    if (numbers.length === 0) return '*';
    const minNum = numbers[0];
    const maxNum = numbers[numbers.length - 1];
    if (numbers.length >= 2 && maxNum - minNum === numbers.length - 1) {
      return `${String(minNum).padStart(2, '0')}-${String(maxNum).padStart(2, '0')}`;
    }
    return numbers.map((n) => String(n).padStart(2, '0')).join(', ');
  };

  const handleBrowseFolderForTask = async (taskId: string) => {
    if (pickerBusyRef.current) {
      setStatusMsg('选择窗口已打开，请先完成当前选择');
      return;
    }
    pickerBusyRef.current = true;
    const currentTask = batchQueue.find((t) => t.id === taskId);
    setStatusMsg('正在唤起文件夹选择窗口...');
    try {
      const resp = await fetch('/api/browse_dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: currentTask?.dirPath || '' }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.status === 'cancelled') {
        setStatusMsg('已取消文件夹选择');
        return;
      }
      if (data.status === 'error') {
        setStatusMsg(`文件夹选择失败: ${data.message || '未知错误'}`);
        return;
      }
      if (data.path) {
        let detectedRange = currentTask?.pageRange || '*';
        try {
          const inspResp = await fetch('/api/inspect_dir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dir: data.path }),
          });
          if (inspResp.ok) {
            const inspData = await inspResp.json();
            if (inspData.range && inspData.range !== '*') {
              detectedRange = inspData.range;
            }
          }
        } catch (e) {}

        updateTask(taskId, {
          dirPath: data.path,
          pageRange: detectedRange,
          selectedFiles: [],
        });
        setStatusMsg(`已成功选择章节文件夹: ${data.path} (范围: ${detectedRange})`);
        return;
      }
    } catch (err) {
      console.warn('Backend browse_dir failed, using webkitdirectory fallback:', err);
      setStatusMsg('后端目录选择器不可用，已切换到浏览器备用选择器');
      activePickerTaskIdRef.current = taskId;
      if (taskFolderNativeDirPickerRef.current) {
        taskFolderNativeDirPickerRef.current.value = '';
        taskFolderNativeDirPickerRef.current.click();
      }
      return;
    } finally {
      pickerBusyRef.current = false;
    }
    setStatusMsg('就绪');
  };

  const handlePickFilesForTask = async (taskId: string) => {
    if (pickerBusyRef.current) {
      setStatusMsg('选择窗口已打开，请先完成当前选择');
      return;
    }
    pickerBusyRef.current = true;
    const currentTask = batchQueue.find((t) => t.id === taskId);
    setStatusMsg('正在唤起图片选择窗口 (支持多选)...');
    try {
      const resp = await fetch('/api/browse_files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: currentTask?.dirPath || '' }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.status === 'cancelled') {
        setStatusMsg('已取消图片选择');
        return;
      }
      if (data.status === 'error') {
        setStatusMsg(`图片选择失败: ${data.message || '未知错误'}`);
        return;
      }
      const picked: string[] = Array.isArray(data.paths) && data.paths.length > 0
        ? data.paths
        : (data.files || []).map((fn: string) => (data.dir ? `${data.dir}\\${fn}` : fn));
      if (picked.length > 0) {
        const existing = currentTask?.selectedFiles || [];
        const merged = Array.from(new Set([...existing, ...picked]));
        updateTask(taskId, {
          dirPath: data.dir || currentTask?.dirPath || '',
          pageRange: computePageRange(merged),
          selectedFiles: merged,
        });
        setStatusMsg(`已并入本章节 ${picked.length} 张图片，当前共 ${merged.length} 张，完整目录: ${data.dir}`);
        return;
      }
    } catch (err) {
      console.warn('Backend browse_files failed, using fallback:', err);
      setStatusMsg('后端图片选择器不可用，已切换到浏览器备用选择器');
      activePickerTaskIdRef.current = taskId;
      if (taskFolderPickerRef.current) {
        taskFolderPickerRef.current.value = '';
        taskFolderPickerRef.current.click();
      }
      return;
    } finally {
      pickerBusyRef.current = false;
    }
    setStatusMsg('就绪');
  };

  const handleAddCrossDirSelection = async (taskId?: string) => {
    if (pickerBusyRef.current) {
      setStatusMsg('选择窗口已打开，请先完成当前选择');
      return;
    }
    pickerBusyRef.current = true;

    const fallbackId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const targetTask = taskId
      ? batchQueue.find((t) => t.id === taskId) || null
      : batchQueue.length > 0
        ? batchQueue[batchQueue.length - 1]
        : null;
    const targetId = targetTask?.id || fallbackId;
    const targetIdx = targetTask ? batchQueue.findIndex((t) => t.id === targetTask.id) : batchQueue.length;
    const groupNo = (targetTask?.selectionGroups?.length || 0) + 1;

    setStatusMsg(`正在为「${targetTask ? getTaskDisplayName(targetTask, Math.max(targetIdx, 0)) : '(第01话)'}」唤起跨目录选页窗口...`);
    try {
      const resp = await fetch('/api/browse_files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: targetTask?.dirPath || '' }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.status === 'cancelled') {
        setStatusMsg('已取消跨目录选页');
        return;
      }
      if (data.status === 'error') {
        setStatusMsg(`跨目录选页失败: ${data.message || '未知错误'}`);
        return;
      }
      const picked: string[] = Array.isArray(data.paths) && data.paths.length > 0
        ? data.paths
        : (data.files || []).map((fn: string) => (data.dir ? `${data.dir}\\${fn}` : fn));
      if (picked.length === 0) {
        setStatusMsg('未选择任何图片');
        return;
      }

      setBatchQueue((prev) => {
        let next = [...prev];
        let target = next.find((t) => t.id === targetId);
        if (!target) {
          // 队列为空时，第一个章节选择器作为 (第01话)
          target = {
            id: targetId,
            name: '(第01话)',
            dirPath: '',
            pageRange: '*',
            useCustomRef: false,
            customRefPath: '',
            selectedFiles: [],
            selectionGroups: [],
          };
          next = [...next, target];
        }
        const groups = target.selectionGroups || [];
        const newGroup: CrossDirGroup = {
          id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dirPath: data.dir || '',
          files: Array.from(new Set(picked)),
        };
        return next.map((t) =>
          t.id === targetId ? { ...t, selectionGroups: [...groups, newGroup] } : t
        );
      });
      setStatusMsg(`已添加跨目录选页 ${String(groupNo).padStart(2, '0')}：${picked.length} 张图片，完整目录: ${data.dir}`);
    } catch (err) {
      console.warn('Cross-directory picker failed:', err);
      setStatusMsg(`跨目录选页失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      pickerBusyRef.current = false;
    }
  };

  const handleAppendFilesToGroup = async (taskId: string, groupId: string) => {
    if (pickerBusyRef.current) {
      setStatusMsg('选择窗口已打开，请先完成当前选择');
      return;
    }
    pickerBusyRef.current = true;
    const task = batchQueue.find((t) => t.id === taskId);
    const group = task?.selectionGroups?.find((g) => g.id === groupId);
    setStatusMsg('正在追加跨目录图片...');
    try {
      const resp = await fetch('/api/browse_files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: group?.dirPath || task?.dirPath || '' }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.status === 'cancelled') {
        setStatusMsg('已取消追加图片');
        return;
      }
      if (data.status === 'error') {
        setStatusMsg(`追加图片失败: ${data.message || '未知错误'}`);
        return;
      }
      const picked: string[] = Array.isArray(data.paths) && data.paths.length > 0
        ? data.paths
        : (data.files || []).map((fn: string) => (data.dir ? `${data.dir}\\${fn}` : fn));
      if (picked.length === 0) {
        setStatusMsg('未选择任何图片');
        return;
      }
      setBatchQueue((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            selectionGroups: (t.selectionGroups || []).map((g) =>
              g.id === groupId ? { ...g, files: Array.from(new Set([...g.files, ...picked])) } : g
            ),
          };
        })
      );
      setStatusMsg(`已追加 ${picked.length} 张图片到跨目录选页，完整目录: ${data.dir}`);
    } catch (err) {
      setStatusMsg(`追加图片失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      pickerBusyRef.current = false;
    }
  };

  const removeCrossDirGroup = (taskId: string, groupId: string) => {
    setBatchQueue((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, selectionGroups: (t.selectionGroups || []).filter((g) => g.id !== groupId) }
          : t
      )
    );
    setStatusMsg('已移除跨目录选页分组');
  };

  const removeFileFromGroup = (taskId: string, groupId: string, filePath: string) => {
    setBatchQueue((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              selectionGroups: (t.selectionGroups || []).map((g) =>
                g.id === groupId ? { ...g, files: g.files.filter((f) => f !== filePath) } : g
              ),
            }
          : t
      )
    );
  };

  const handleTaskNativeDirPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const taskId = activePickerTaskIdRef.current;
    if (!files || files.length === 0 || !taskId) return;

    const fileList = Array.from(files);
    let inferredDir = '';
    const firstRel = (fileList[0] as any).webkitRelativePath as string | undefined;
    if (firstRel && firstRel.includes('/')) {
      inferredDir = firstRel.substring(0, firstRel.lastIndexOf('/'));
    }

    const numbers: number[] = [];
    for (const f of fileList) {
      const m = f.name.match(/\d+/g);
      if (m) {
        numbers.push(parseInt(m[m.length - 1], 10));
      }
    }
    numbers.sort((a, b) => a - b);
    let rangeStr = '*';
    if (numbers.length > 0) {
      rangeStr = `${String(numbers[0]).padStart(2, '0')}-${String(numbers[numbers.length - 1]).padStart(2, '0')}`;
    }

    updateTask(taskId, {
      dirPath: inferredDir || fileList[0].name,
      pageRange: rangeStr,
      selectedFiles: [],
    });
    setStatusMsg(`已选择目录 ${inferredDir || '本地目录'} (含 ${fileList.length} 页, 范围: ${rangeStr})`);
  };

  const triggerTaskFilePicker = (taskId: string) => {
    activePickerTaskIdRef.current = taskId;
    if (taskFolderPickerRef.current) {
      taskFolderPickerRef.current.value = '';
      taskFolderPickerRef.current.click();
    }
  };

  const handleTaskFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const taskId = activePickerTaskIdRef.current;
    if (!files || files.length === 0 || !taskId) return;

    const fileList = Array.from(files);
    let inferredDir = '';
    const firstRel = (fileList[0] as any).webkitRelativePath as string | undefined;
    if (firstRel && firstRel.includes('/')) {
      inferredDir = firstRel.substring(0, firstRel.lastIndexOf('/'));
    }

    const numbers: number[] = [];
    const fileNames: string[] = [];
    for (const f of fileList) {
      fileNames.push(f.name);
      const m = f.name.match(/\d+/g);
      if (m) {
        numbers.push(parseInt(m[m.length - 1], 10));
      }
    }
    numbers.sort((a, b) => a - b);

    let rangeStr = '';
    if (numbers.length > 0) {
      const minNum = numbers[0];
      const maxNum = numbers[numbers.length - 1];
      if (numbers.length >= 2 && maxNum - minNum === numbers.length - 1) {
        rangeStr = `${String(minNum).padStart(2, '0')}-${String(maxNum).padStart(2, '0')}`;
      } else {
        rangeStr = numbers.map((n) => String(n).padStart(2, '0')).join(', ');
      }
    }

    setBatchQueue((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            dirPath: inferredDir || t.dirPath || fileList[0].name,
            pageRange: rangeStr || t.pageRange,
            selectedFiles: fileNames,
          };
        }
        return t;
      })
    );
    setStatusMsg(`已解析 ${fileList.length} 张图片，页码范围: ${rangeStr || '自适应'}`);
  };

  const removeFileFromTask = (taskId: string, fileName: string) => {
    setBatchQueue((prev) =>
      prev.map((t) => {
        if (t.id === taskId && t.selectedFiles) {
          const nextFiles = t.selectedFiles.filter((f) => f !== fileName);
          return { ...t, selectedFiles: nextFiles };
        }
        return t;
      })
    );
  };

  const handleSingleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setInputPath(f.name);
      setStatusMsg(`已选择单页: ${f.name}`);
    }
  };

  const handleGlobalRefPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setReferencePath(f.name);
      setStatusMsg(`已选择基准图: ${f.name}`);
    }
  };

  const handleCustomRefPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    const taskId = activePickerTaskIdRef.current;
    if (f && taskId) {
      updateTask(taskId, { customRefPath: f.name });
      setStatusMsg(`已设置章节独立基准图: ${f.name}`);
    }
  };

  const handleRun = async () => {
    setIsProcessing(true);
    setStatusMsg(
      `正在以 [${mode}] 流水线与 [${colorMode === 'composite' ? '叠加复合' : '浓烈色彩'}] 模式启动...`
    );

    try {
      if (isBatch) {
        let allSummaries: any[] = [];
        let inferredMainTitle = '';

        // Collect all effective input paths for title inference
        const allPaths = batchQueue.flatMap((t) => {
          const effDir = baseDir
            ? t.dirPath.startsWith('/') || t.dirPath.includes(':')
              ? t.dirPath
              : `${baseDir.replace(/[\\/]$/, '')}/${t.dirPath}`
            : t.dirPath;
          const paths: string[] = [
            effDir || (t.selectedFiles && t.selectedFiles.length > 0 ? t.selectedFiles[0] : ''),
          ];
          (t.selectionGroups || []).forEach((g) => {
            paths.push(g.dirPath || (g.files.length > 0 ? g.files[0] : ''));
          });
          return paths;
        }).filter(Boolean);

        // Pre-infer main title if paths exist
        if (allPaths.length > 0) {
          try {
            const titleResp = await fetch('/api/infer_title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paths: allPaths }),
            });
            if (titleResp.ok) {
              const td = await titleResp.json();
              if (td.title) inferredMainTitle = td.title;
            }
          } catch (e) {
            console.warn('Title inference request failed:', e);
          }
        }

        for (const [idx, task] of batchQueue.entries()) {
          const chapterName = getTaskDisplayName(task, idx);
          const effectiveDir = baseDir
            ? task.dirPath.startsWith('/') || task.dirPath.includes(':')
              ? task.dirPath
              : `${baseDir.replace(/[\\/]$/, '')}/${task.dirPath}`
            : task.dirPath;

          const effectiveRef =
            task.useCustomRef && task.customRefPath ? task.customRefPath : referencePath;

          const extraGroups = (task.selectionGroups || [])
            .filter((g) => g.files.length > 0)
            .map((g) => ({ dir: g.dirPath, files: g.files }));

          setStatusMsg(
            `正在执行任务队列 (${idx + 1}/${batchQueue.length}): [${chapterName}] ${inferredMainTitle ? `《${inferredMainTitle}》` : ''} 范围: ${task.pageRange || '全部'}${(task.selectedFiles?.length || 0) + extraGroups.reduce((n, g) => n + g.files.length, 0) > 0 ? `，另有 ${(task.selectedFiles?.length || 0) + extraGroups.reduce((n, g) => n + g.files.length, 0)} 张离散选页` : ''}...`
          );

          const resp = await fetch('/api/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: effectiveDir,
              reference: effectiveRef,
              mode: mode,
              color_mode: colorMode,
              page_range: task.pageRange === '*' ? undefined : task.pageRange,
              glob: '*.jpg',
              main_title: inferredMainTitle,
              chapter_name: chapterName,
              all_paths: allPaths,
              selected_files: task.selectedFiles && task.selectedFiles.length > 0 ? task.selectedFiles : undefined,
              extra_groups: extraGroups,
            }),
          });

          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
          }

          const data = await resp.json();
          if (data.summary) {
            allSummaries = [...allSummaries, ...data.summary];
          }
        }

        setBatchSummary(allSummaries);
        if (allSummaries.length > 0) {
          const lastItem = allSummaries[allSummaries.length - 1];
          setResult({
            page: lastItem.page,
            action: lastItem.action || mode,
            bubbles: lastItem.bubbles || 0,
            seconds: lastItem.seconds || 0,
            output: lastItem.output || '',
            qa_url: lastItem.qa_url,
            final_url: lastItem.final_url,
          });
        }
        setStatusMsg(
          `跨目录任务队列全部完成！共处理 ${batchQueue.length} 个章节、${allSummaries.length} 个页面。${inferredMainTitle ? `输出主目录: ${inferredMainTitle}` : ''}`
        );
      } else {
        setStatusMsg(`正在处理单页: ${inputPath}...`);
        const resp = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: inputPath,
            reference: referencePath,
            mode: mode,
            color_mode: colorMode,
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
      title: '进阶汉化上色',
      desc: '先擦除生肉日文 -> 无字全彩上色 -> 矢量高锐重嵌，绝不糊字',
      badge: 'M3 推荐',
    },
    {
      id: 'auto',
      icon: 'auto_fix_high',
      title: '智能全自动',
      desc: '自动检测色彩与语言：黑白自动上色，非中文自动汉化',
    },
    {
      id: 'both',
      icon: 'palette',
      title: '翻译并上色',
      desc: '强制执行汉化翻译与全彩上色双重流程',
    },
    {
      id: 'translate',
      icon: 'translate',
      title: '仅汉化翻译',
      desc: '仅执行气泡检测、OCR、连贯翻译与排版嵌字',
    },
    {
      id: 'colorize',
      icon: 'brush',
      title: '仅漫画上色',
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

          {/* 2.2 上色色彩处理模式 (Color Mode) */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <label className="md3-title-small" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                色彩处理模式
              </label>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--md-sys-shape-corner-full)',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  color: 'var(--md-sys-color-primary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  transition: 'all var(--md-sys-motion-spring-expressive-fast-effects)',
                }}
              >
                {colorMode === 'composite' ? '高保真线稿复合' : '扩散模型直出'}
              </span>
            </div>
            <Md3ConnectedButtonGroup
              value={colorMode}
              onChange={(val) => setColorMode(val as 'composite' | 'direct')}
              height="42px"
              options={[
                {
                  id: 'composite',
                  label: '叠加复合',
                  icon: <Md3Icon name="layers" size={18} fill={colorMode === 'composite' ? 1 : 0} />,
                  tooltipTitle: '叠加复合模式 (推荐首选)',
                  tooltipText:
                    '基于 MangaColour 算法：提取 FLUX.2 预测的 a/b 色度与原始 2000px 高分辨率线稿导向复合，对白气泡自动漂白，100% 保持原始印刷级矢量锐度。',
                },
                {
                  id: 'direct',
                  label: '浓烈色彩',
                  icon: <Md3Icon name="local_fire_department" size={18} fill={colorMode === 'direct' ? 1 : 0} />,
                  tooltipTitle: '浓烈色彩模式 (直接上色)',
                  tooltipText:
                    '跳过线稿色度复合，直接输出 FLUX.2 扩散采样的原始画幅。色彩浓厚饱满，呈现扩散原生的厚涂艺术画风。',
                },
              ]}
            />
            {/* 动态特性说明胶囊条 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--md-sys-shape-corner-small)',
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                color: 'var(--md-sys-color-on-surface-variant)',
                fontSize: '12px',
                lineHeight: '16px',
                transition: 'all var(--md-sys-motion-spring-expressive-fast-effects)',
              }}
            >
              <Md3Icon
                name={colorMode === 'composite' ? 'verified' : 'auto_awesome'}
                size={15}
                style={{ color: 'var(--md-sys-color-primary)', flexShrink: 0 }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {colorMode === 'composite'
                  ? '线稿导向复合：对白框纯白漂白，保持印刷级锐利边缘'
                  : '扩散模型直出：色彩浓烈饱满，呈现厚涂艺术质感'}
              </span>
            </div>
          </div>

          {/* 2.3 单页 vs 多章节任务队列模式 (M3 Expressive Connected Button Group) */}
          <Md3ConnectedButtonGroup
            value={isBatch ? 'batch' : 'single'}
            onChange={(val) => setIsBatch(val === 'batch')}
            options={[
              {
                id: 'single',
                label: '单页处理模式',
                icon: <Md3Icon name="description" size={18} />,
              },
              {
                id: 'batch',
                label: '多章节任务队列',
                badge: batchQueue.length,
                icon: <Md3Icon name="folder_copy" size={18} />,
              },
            ]}
          />

          {/* 2.4 路径参数输入与跨目录卡片队列 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!isBatch ? (
              <Md3TextField
                label="输入漫画单页路径"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                leadingIcon={<Md3Icon name="description" size={20} />}
                placeholder="例如 examples/MOMOUMIX/003.jpg 或输入绝对路径"
                trailingAction={
                  <button
                    type="button"
                    title="浏览选择本地单页图片"
                    className="md3-focus-ring"
                    onClick={() => singleFilePickerRef.current?.click()}
                    style={{
                      border: 'none',
                      background: 'var(--md-sys-color-surface-container-high)',
                      color: 'var(--md-sys-color-primary)',
                      borderRadius: 'var(--md-sys-shape-corner-full)',
                      padding: '5px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <Md3Icon name="upload_file" size={16} />
                    <span>选择文件</span>
                  </button>
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 公共主目录提取 (可选) */}
                <Md3TextField
                  label="公共漫画主目录"
                  value={baseDir}
                  onChange={(e) => setBaseDir(e.target.value)}
                  leadingIcon={<Md3Icon name="folder_special" size={20} />}
                  placeholder="例如 examples/ (留空则各章节使用自身完整路径)"
                  supportingText="可选：提取公共前缀，下方章节卡片仅需填写子文件夹名"
                />

                {/* 多章节任务队列卡片列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="md3-title-small" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      跨目录章节队列
                    </span>
                    <span className="md3-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      顺序调度 {batchQueue.length} 个任务
                    </span>
                  </div>

                  {batchQueue.map((task, idx) => {
                    const chapterName = getTaskDisplayName(task, idx);
                    return (
                    <div
                      key={task.id}
                      style={{
                        backgroundColor: 'var(--md-sys-color-surface-container)',
                        borderRadius: 'var(--md-sys-shape-corner-large)',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {/* 第 1 行：章节序号徽标与操作工具栏 (选择文件夹 / 选多图 / 克隆 / 删除) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: 'var(--md-sys-shape-corner-small)',
                              backgroundColor: 'var(--md-sys-color-primary-container)',
                              color: 'var(--md-sys-color-on-primary-container)',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            {chapterName}
                          </span>
                          {task.selectedFiles && task.selectedFiles.length > 0 && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--md-sys-shape-corner-full)',
                                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                                color: 'var(--md-sys-color-on-surface-variant)',
                                fontSize: '11px',
                              }}
                            >
                              已选 {task.selectedFiles.length} 页
                            </span>
                          )}
                          {task.selectionGroups && task.selectionGroups.length > 0 && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--md-sys-shape-corner-full)',
                                backgroundColor: 'var(--md-sys-color-tertiary-container)',
                                color: 'var(--md-sys-color-on-tertiary-container)',
                                fontSize: '11px',
                              }}
                            >
                              跨目录 {task.selectionGroups.length} 组 / {task.selectionGroups.reduce((n, g) => n + g.files.length, 0)} 页
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {/* 浏览选择章节文件夹按钮 (调用原生目录选择器) */}
                          <Md3IconButton
                            icon="folder_supervised"
                            tooltip="选择整章文件夹 (直接弹出系统目录选择框)"
                            onClick={() => handleBrowseFolderForTask(task.id)}
                          />
                          {/* 挑选离散图片按钮 */}
                          <Md3IconButton
                            icon="add_photo_alternate"
                            tooltip="挑选离散图片并入本章节 (自动分析页码与完整路径)"
                            onClick={() => handlePickFilesForTask(task.id)}
                          />
                          {/* 添加跨目录选页分组 (归属于本章节) */}
                          <Md3IconButton
                            icon="library_add"
                            tooltip="跨目录选页并入本章节 (输出为 章节名-跨目录选页xx)"
                            onClick={() => handleAddCrossDirSelection(task.id)}
                          />
                          {/* 克隆本章节按钮 */}
                          <Md3IconButton
                            icon="content_copy"
                            tooltip="克隆本项 (自动递增末尾数字)"
                            onClick={() => handleCloneTask(task.id)}
                          />
                          {/* 删除本章节按钮 */}
                          <Md3IconButton
                            icon="delete"
                            tooltip={batchQueue.length <= 1 ? '至少保留一个章节任务' : '删除本章节任务'}
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={batchQueue.length <= 1}
                            colorVar="var(--md-sys-color-error)"
                          />
                        </div>
                      </div>

                      {/* 第 2 行：章节目录路径 (独占整行，保证完整显示与编辑体验) */}
                      <Md3TextField
                        label="章节目录路径"
                        value={task.dirPath}
                        dense
                        onChange={(e) => updateTask(task.id, { dirPath: e.target.value })}
                        leadingIcon={<Md3Icon name="folder_open" size={18} />}
                        placeholder="输入子文件夹名或完整绝对路径"
                        supportingText={task.dirPath ? `完整路径: ${task.dirPath}` : '输入完整绝对路径或点击上方按钮选择'}
                      />

                      {/* 第 3 行：页码过滤输入框 + 独立基准色 Chip 开关 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Md3TextField
                            label="页码过滤"
                            value={task.pageRange}
                            dense
                            onChange={(e) => updateTask(task.id, { pageRange: e.target.value })}
                            leadingIcon={<Md3Icon name="filter_9_plus" size={18} />}
                            placeholder="例如 03-19, 01,05 或 * 全选"
                          />
                        </div>

                        {/* 独立基准色开关 Chip */}
                        <div style={{ flexShrink: 0 }}>
                          <Md3Tooltip
                            title={task.useCustomRef ? '独立基准色：已开启' : '共用全局色：已开启'}
                            text={
                              task.useCustomRef
                                ? '当前章节单独指定专属基准色，点击可切回共用全局色'
                                : '当前章节共用全局色彩基准图，点击可为该章节单独指定基准色'
                            }
                          >
                            <button
                              type="button"
                              onClick={() => updateTask(task.id, { useCustomRef: !task.useCustomRef })}
                              className="md3-focus-ring"
                              style={{
                                height: '42px',
                                paddingInline: '12px',
                                borderRadius: 'var(--md-sys-shape-corner-full)',
                                border: task.useCustomRef
                                  ? 'none'
                                  : '1px solid var(--md-sys-color-outline-variant)',
                                backgroundColor: task.useCustomRef
                                  ? 'var(--md-sys-color-secondary-container)'
                                  : 'var(--md-sys-color-surface-container-high)',
                                color: task.useCustomRef
                                  ? 'var(--md-sys-color-on-secondary-container)'
                                  : 'var(--md-sys-color-on-surface-variant)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap',
                                transition: 'all var(--md-sys-motion-spring-expressive-fast-effects)',
                              }}
                            >
                              <Md3Icon
                                name={task.useCustomRef ? 'tune' : 'palette'}
                                size={16}
                                fill={task.useCustomRef ? 1 : 0}
                              />
                              <span>{task.useCustomRef ? '独立基准色' : '共用全局色'}</span>
                            </button>
                          </Md3Tooltip>
                        </div>
                      </div>

                      {/* 当开启独立基准色时展开专用输入框 */}
                      {task.useCustomRef && (
                        <div
                          style={{
                            paddingLeft: '10px',
                            borderLeft: '3px solid var(--md-sys-color-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <Md3TextField
                            label="本章专用色彩基准图"
                            value={task.customRefPath}
                            dense
                            onChange={(e) => updateTask(task.id, { customRefPath: e.target.value })}
                            leadingIcon={<Md3Icon name="palette" size={18} />}
                            placeholder="输入或选择本章专属基准图路径"
                            trailingAction={
                              <button
                                type="button"
                                title="选择本章独立基准图"
                                className="md3-focus-ring"
                                onClick={() => {
                                  activePickerTaskIdRef.current = task.id;
                                  customRefPickerRef.current?.click();
                                }}
                                style={{
                                  border: 'none',
                                  background: 'var(--md-sys-color-surface-container-high)',
                                  color: 'var(--md-sys-color-primary)',
                                  padding: '4px 8px',
                                  borderRadius: 'var(--md-sys-shape-corner-full)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                <Md3Icon name="image_search" size={16} />
                                <span>浏览</span>
                              </button>
                            }
                          />
                        </div>
                      )}

                      {/* 展示从本地混选器中提取的图片胶囊标签 */}
                      {task.selectedFiles && task.selectedFiles.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--md-sys-color-on-surface-variant)',
                              alignSelf: 'center',
                            }}
                          >
                            已选图片 ({task.selectedFiles.length}):
                          </span>
                          {task.selectedFiles.slice(0, 10).map((fn, fIdx) => (
                            <span
                              key={fIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                                color: 'var(--md-sys-color-on-surface)',
                                fontSize: '11px',
                              }}
                            >
                              <Md3Icon name="image" size={12} />
                              <span>{fileNameOf(fn)}</span>
                              <button
                                type="button"
                                title={`移除 ${fileNameOf(fn)}`}
                                onClick={() => removeFileFromTask(task.id, fn)}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  color: 'var(--md-sys-color-on-surface-variant)',
                                }}
                              >
                                <Md3Icon name="close" size={12} />
                              </button>
                            </span>
                          ))}
                          {task.selectedFiles.length > 10 && (
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--md-sys-color-on-surface-variant)',
                                alignSelf: 'center',
                              }}
                            >
                              +{task.selectedFiles.length - 10} 页...
                            </span>
                          )}
                        </div>
                      )}

                      {/* 跨目录选页分组：归属于本章节，提交时合并给后端 */}
                      {(task.selectionGroups || []).map((group, gIdx) => (
                        <div
                          key={group.id}
                          style={{
                            padding: '10px',
                            borderRadius: 'var(--md-sys-shape-corner-medium)',
                            backgroundColor: 'var(--md-sys-color-surface-container-high)',
                            borderLeft: '3px solid var(--md-sys-color-tertiary)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 'var(--md-sys-shape-corner-small)',
                                  backgroundColor: 'var(--md-sys-color-tertiary-container)',
                                  color: 'var(--md-sys-color-on-tertiary-container)',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                跨目录选页 {String(gIdx + 1).padStart(2, '0')}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                                已选 {group.files.length} 页
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                              <Md3IconButton
                                icon="playlist_add"
                                tooltip="向此分组追加图片"
                                onClick={() => handleAppendFilesToGroup(task.id, group.id)}
                              />
                              <Md3IconButton
                                icon="delete"
                                tooltip="移除此跨目录选页分组"
                                onClick={() => removeCrossDirGroup(task.id, group.id)}
                                colorVar="var(--md-sys-color-error)"
                              />
                            </div>
                          </div>

                          {group.dirPath && (
                            <div
                              style={{
                                fontSize: '10px',
                                color: 'var(--md-sys-color-on-surface-variant)',
                                wordBreak: 'break-all',
                              }}
                              title={group.dirPath}
                            >
                              {group.dirPath}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {group.files.slice(0, 8).map((filePath) => (
                              <span
                                key={filePath}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  backgroundColor: 'var(--md-sys-color-surface-container)',
                                  color: 'var(--md-sys-color-on-surface)',
                                  fontSize: '11px',
                                }}
                                title={filePath}
                              >
                                <Md3Icon name="image" size={12} />
                                <span>{fileNameOf(filePath)}</span>
                                <button
                                  type="button"
                                  title={`移除 ${fileNameOf(filePath)}`}
                                  onClick={() => removeFileFromGroup(task.id, group.id, filePath)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    color: 'var(--md-sys-color-on-surface-variant)',
                                  }}
                                >
                                  <Md3Icon name="close" size={12} />
                                </button>
                              </span>
                            ))}
                            {group.files.length > 8 && (
                              <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', alignSelf: 'center' }}>
                                +{group.files.length - 8} 页...
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    );
                  })}

                  {/* 队列底部添加操作栏 */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Md3Button
                      variant="tonal"
                      size="sm"
                      onClick={handleAddFolderTask}
                      leadingIcon={<Md3Icon name="create_new_folder" size={18} />}
                    >
                      添加新章节任务
                    </Md3Button>
                    <Md3Button
                      variant="outlined"
                      size="sm"
                      onClick={() => handleAddCrossDirSelection()}
                      leadingIcon={<Md3Icon name="add_photo_alternate" size={18} />}
                      title="选择任意目录中的图片，自动并入上方最后一个章节；输出为“章节名-跨目录选页01”"
                    >
                      跨目录选页
                    </Md3Button>
                    <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      选页会并入上方章节，不新增独立任务
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 全局色彩基准图 */}
            <Md3TextField
              label="全局色彩基准图"
              value={referencePath}
              onChange={(e) => setReferencePath(e.target.value)}
              leadingIcon={<Md3Icon name="palette" size={20} />}
              placeholder="输入或选择全局色彩基准图路径"
              supportingText="未指定独立基准色的章节将自动采用此基准图"
              trailingAction={
                <button
                  type="button"
                  title="浏览选择色彩基准图片"
                  className="md3-focus-ring"
                  onClick={() => globalRefPickerRef.current?.click()}
                  style={{
                    border: 'none',
                    background: 'var(--md-sys-color-surface-container-high)',
                    color: 'var(--md-sys-color-primary)',
                    borderRadius: 'var(--md-sys-shape-corner-full)',
                    padding: '5px 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <Md3Icon name="image_search" size={16} />
                  <span>选择基准图</span>
                </button>
              }
            />
          </div>

          {/* 2.5 启动流水线大号主操作按钮 (Large 56dp Expressive Button + 7形态变形加载器) */}
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
              ? '正在处理跨目录流水线...'
              : isBatch
                ? `开始执行跨目录批量处理 (共 ${batchQueue.length} 个任务)`
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

      {/* 隐藏式原生文件/文件夹选择器 */}
      <input
        type="file"
        ref={singleFilePickerRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleSingleFilePicked}
      />
      <input
        type="file"
        ref={globalRefPickerRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleGlobalRefPicked}
      />
      <input
        type="file"
        ref={customRefPickerRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleCustomRefPicked}
      />
      <input
        type="file"
        ref={taskFolderPickerRef}
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleTaskFilesPicked}
      />
      <input
        type="file"
        ref={taskFolderNativeDirPickerRef}
        // @ts-ignore
        webkitdirectory="true"
        directory=""
        style={{ display: 'none' }}
        onChange={handleTaskNativeDirPicked}
      />
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
