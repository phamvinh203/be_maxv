import type { JSX } from 'react';

/** Minh họa dashboard cho trang đăng nhập. */
export function DashboardIllustration(): JSX.Element {
  return (
    <svg viewBox="0 0 460 340" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 400 }}>
      <rect x="70" y="30" width="320" height="220" rx="14" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <rect x="70" y="30" width="320" height="30" rx="14" fill="rgba(255,255,255,0.15)" />
      <rect x="70" y="44" width="320" height="16" fill="rgba(255,255,255,0.15)" />
      <circle cx="93" cy="45" r="5" fill="rgba(255,255,255,0.5)" />
      <circle cx="110" cy="45" r="5" fill="rgba(255,255,255,0.5)" />
      <circle cx="127" cy="45" r="5" fill="rgba(255,255,255,0.5)" />
      <rect x="72" y="60" width="60" height="188" fill="rgba(255,255,255,0.08)" />
      <rect x="82" y="76" width="40" height="6" rx="3" fill="rgba(255,255,255,0.3)" />
      <rect x="82" y="92" width="32" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="82" y="108" width="36" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="82" y="124" width="28" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="82" y="140" width="34" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="155" y="155" width="22" height="60" rx="4" fill="rgba(255,255,255,0.35)" />
      <rect x="186" y="125" width="22" height="90" rx="4" fill="rgba(255,255,255,0.55)" />
      <rect x="217" y="105" width="22" height="110" rx="4" fill="rgba(255,255,255,0.75)" />
      <rect x="248" y="135" width="22" height="80" rx="4" fill="rgba(255,255,255,0.55)" />
      <rect x="279" y="90" width="22" height="125" rx="4" fill="rgba(255,255,255,0.90)" />
      <rect x="310" y="115" width="22" height="100" rx="4" fill="rgba(255,255,255,0.65)" />
      <line x1="148" y1="217" x2="342" y2="217" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <rect x="148" y="68" width="80" height="6" rx="3" fill="rgba(255,255,255,0.4)" />
      <rect x="148" y="80" width="50" height="14" rx="3" fill="rgba(255,255,255,0.6)" />
      <rect x="250" y="68" width="80" height="6" rx="3" fill="rgba(255,255,255,0.4)" />
      <rect x="250" y="80" width="50" height="14" rx="3" fill="rgba(255,255,255,0.6)" />
      <rect x="210" y="250" width="40" height="16" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="175" y="264" width="110" height="8" rx="4" fill="rgba(255,255,255,0.2)" />
      <rect x="6" y="110" width="112" height="62" rx="10" fill="white" fillOpacity="0.96" />
      <rect x="18" y="122" width="36" height="5" rx="2" fill="#64748b" fillOpacity="0.5" />
      <text x="18" y="150" fontSize="17" fontWeight="800" fill="#1a5fa8" fontFamily="system-ui">₫1.24 tỷ</text>
      <rect x="18" y="160" width="28" height="4" rx="2" fill="#22c55e" fillOpacity="0.6" />
      <rect x="342" y="60" width="112" height="62" rx="10" fill="white" fillOpacity="0.96" />
      <rect x="354" y="72" width="44" height="5" rx="2" fill="#64748b" fillOpacity="0.5" />
      <text x="354" y="100" fontSize="17" fontWeight="800" fill="#059669" fontFamily="system-ui">+24.5%</text>
      <rect x="354" y="110" width="36" height="4" rx="2" fill="#059669" fillOpacity="0.4" />
      <rect x="342" y="200" width="112" height="62" rx="10" fill="white" fillOpacity="0.96" />
      <rect x="354" y="212" width="38" height="5" rx="2" fill="#64748b" fillOpacity="0.5" />
      <text x="354" y="240" fontSize="17" fontWeight="800" fill="#7c3aed" fontFamily="system-ui">1,284</text>
      <rect x="354" y="250" width="50" height="4" rx="2" fill="#7c3aed" fillOpacity="0.4" />
      <circle cx="40" cy="290" r="5" fill="rgba(255,255,255,0.2)" />
      <circle cx="58" cy="290" r="3" fill="rgba(255,255,255,0.15)" />
      <circle cx="420" cy="30" r="6" fill="rgba(255,255,255,0.2)" />
      <circle cx="435" cy="45" r="3" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

/** Minh họa tính năng cho trang đăng ký. */
export function FeatureIllustration(): JSX.Element {
  const rows = [
    { y: 84, w: 130 },
    { y: 114, w: 110 },
    { y: 144, w: 150 },
    { y: 174, w: 120 },
    { y: 204, w: 140 },
  ];
  return (
    <svg viewBox="0 0 460 360" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 400 }}>
      <rect x="90" y="20" width="280" height="230" rx="16" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <rect x="90" y="20" width="280" height="44" rx="16" fill="rgba(255,255,255,0.18)" />
      <rect x="90" y="48" width="280" height="16" fill="rgba(255,255,255,0.18)" />
      <circle cx="118" cy="42" r="10" fill="rgba(255,255,255,0.3)" />
      <rect x="136" y="36" width="90" height="8" rx="4" fill="rgba(255,255,255,0.5)" />
      <rect x="136" y="48" width="60" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
      {rows.map(({ y, w }) => (
        <g key={y}>
          <circle cx="116" cy={y + 6} r="7" fill="rgba(255,255,255,0.2)" />
          <line x1="109" y1={y + 6} x2="123" y2={y + 6} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="116" y1={y - 1} x2="116" y2={y + 13} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="134" y={y + 1} width={w} height="10" rx="5" fill="rgba(255,255,255,0.35)" />
        </g>
      ))}
      <rect x="310" y="14" width="130" height="52" rx="12" fill="white" fillOpacity="0.97" />
      <text x="375" y="36" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0067e8" fontFamily="system-ui">DÙNG THỬ</text>
      <text x="375" y="52" textAnchor="middle" fontSize="18" fontWeight="900" fill="#0067e8" fontFamily="system-ui">7 NGÀY</text>
      <rect x="20" y="180" width="110" height="52" rx="12" fill="white" fillOpacity="0.97" />
      <text x="75" y="202" textAnchor="middle" fontSize="10" fontWeight="700" fill="#059669" fontFamily="system-ui">MIỄN PHÍ</text>
      <text x="75" y="222" textAnchor="middle" fontSize="16" fontWeight="900" fill="#059669" fontFamily="system-ui">100%</text>
      <circle cx="140" cy="290" r="6" fill="rgba(255,255,255,0.3)" />
      <circle cx="160" cy="290" r="4" fill="rgba(255,255,255,0.2)" />
      <circle cx="176" cy="290" r="3" fill="rgba(255,255,255,0.15)" />
      <circle cx="320" cy="295" r="5" fill="rgba(255,255,255,0.2)" />
      <circle cx="338" cy="295" r="3" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}
