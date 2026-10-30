"use client";

// The last resort, when the root layout itself fails: no app styles are loaded
// here, so everything is inline.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0f2b",
          color: "#eceeff",
          fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 480, padding: 24 }}>
          <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: 0 }}>Nyux didn&rsquo;t load.</h1>
          <p style={{ color: "#9ea3d6", lineHeight: 1.6 }}>
            Something went wrong on our side. Try again in a moment.
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button
            onClick={() => retry()}
            style={{
              marginTop: 12,
              padding: "12px 24px",
              borderRadius: 999,
              border: 0,
              background: "#ffbe8a",
              color: "#0d0f2b",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
