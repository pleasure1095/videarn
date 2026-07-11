import { C } from "../styles/theme";

export default function Logo({ size = 28 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#2ECC71" />
        <path d="M8 22L14 12l4 6 3-4 5 8H8z" fill="#06110A" fillOpacity=".92" />
      </svg>
      <span
        style={{
          fontSize: size * 0.65,
          color: C.emerald,
          letterSpacing: "0.08em",
          fontFamily: "Georgia,serif",
        }}
      >
        VIDEARN
      </span>
    </div>
  );
}
