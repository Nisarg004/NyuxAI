import { ImageResponse } from "next/og";

// The browser-tab icon: the dawn star from the wordmark, on night.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0f2b",
          borderRadius: 14,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24">
          <path
            fill="#ffbe8a"
            d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z"
          />
        </svg>
      </div>
    ),
    size,
  );
}
