import { ImageResponse } from "next/og";

// The link preview: the hero's idea as a still — night, the headline, and the brief
// the Wire assembles, with its first line in dawn.
export const alt = "Nyux: hundreds of stories broke overnight. Read the ten that matter to your work.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [0.82, 0.62, 0.9, 0.7, 0.84, 0.58, 0.88, 0.66, 0.78, 0.5];

const STAR_PATH = "M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(60% 70% at 85% 10%, #2a2470 0%, #0d0f2b 60%)",
          color: "#eceeff",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 40, fontWeight: 700 }}>
            <svg width="34" height="34" viewBox="0 0 24 24">
              <path fill="#ffbe8a" d={STAR_PATH} />
            </svg>
            nyux
          </div>
          <div style={{ marginTop: 70, fontSize: 64, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
            Hundreds of stories broke overnight. Read the ten that matter to your work.
          </div>
          <div style={{ marginTop: 28, fontSize: 26, color: "#9ea3d6" }}>A daily brief, checked against every source.</div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            marginTop: 40,
            width: 400,
            height: 470,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "40px 36px",
            borderRadius: 28,
            border: "1px solid rgba(236,238,255,0.16)",
            background: "linear-gradient(135deg, rgba(247,247,252,0.10), rgba(140,123,255,0.07))",
          }}
        >
          {ROWS.map((w, i) => (
            <div
              key={i}
              style={{
                width: `${w * 100}%`,
                height: i === 0 ? 14 : 9,
                borderRadius: 7,
                background: i === 0 ? "#ffbe8a" : "rgba(236,238,255,0.75)",
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
