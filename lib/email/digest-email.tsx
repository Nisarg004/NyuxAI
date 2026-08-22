import { Body, Column, Container, Head, Hr, Html, Link, Preview, Row, Section, Text } from "react-email";

const INK = "#101425";
const PAPER = "#EEF0F6";
const AMBER = "#FFB020";
const AMBER_TINT = "#FFF7E8";
const SLATE = "#4B5163";

const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type DigestEmailItem = {
  headline: string;
  summary: string;
  whyItMatters: string;
  sourceUrl: string;
};

export type DigestEmailSector = {
  sector: string;
  items: DigestEmailItem[];
};

export type DigestEmailProps = {
  userName: string;
  dateLabel: string;
  timeLabel: string;
  sectors: string[];
  editorsNote: string;
  sectorGroups: DigestEmailSector[];
  archiveUrl: string;
  preferencesUrl: string;
};

function SectorTag({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: MONO,
        fontSize: "11px",
        letterSpacing: "0.06em",
        color: AMBER,
        border: `1px solid ${AMBER}`,
        borderRadius: "3px",
        padding: "3px 8px",
        marginRight: "6px",
        marginBottom: "6px",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

export function DigestEmail({
  userName,
  dateLabel,
  timeLabel,
  sectors,
  editorsNote,
  sectorGroups,
  archiveUrl,
  preferencesUrl,
}: DigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{editorsNote || `Your briefing for ${dateLabel}`}</Preview>
      <Body style={{ backgroundColor: PAPER, margin: 0, padding: 0, fontFamily: SANS }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: PAPER }}>
          {/* Header */}
          <Section style={{ backgroundColor: INK, padding: "32px 28px" }}>
            <Text
              style={{
                fontFamily: MONO,
                fontSize: "12px",
                letterSpacing: "0.08em",
                color: AMBER,
                margin: "0 0 12px 0",
                textTransform: "uppercase",
              }}
            >
              {dateLabel} · {timeLabel}
            </Text>
            <Text
              style={{
                fontFamily: SANS,
                fontSize: "24px",
                fontWeight: 700,
                color: "#FFFFFF",
                margin: "0 0 14px 0",
              }}
            >
              {userName}&rsquo;s brief
            </Text>
            <Row>
              <Column>
                {sectors.map((sector) => (
                  <SectorTag key={sector} label={sector} />
                ))}
              </Column>
            </Row>
          </Section>

          {/* Editor's note */}
          {editorsNote ? (
            <Section style={{ padding: "24px 28px 0 28px" }}>
              <Text
                style={{
                  fontFamily: SANS,
                  fontSize: "14px",
                  fontStyle: "italic",
                  color: SLATE,
                  margin: 0,
                  lineHeight: "22px",
                }}
              >
                {editorsNote}
              </Text>
            </Section>
          ) : null}

          {/* Sectors */}
          {sectorGroups.map((group) => (
            <Section key={group.sector} style={{ padding: "20px 28px 0 28px" }}>
              <Text
                style={{
                  fontFamily: MONO,
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  color: INK,
                  textTransform: "uppercase",
                  borderBottom: `2px solid ${AMBER}`,
                  paddingBottom: "6px",
                  margin: "0 0 16px 0",
                }}
              >
                {group.sector}
              </Text>

              {group.items.map((item, idx) => (
                <Section key={item.sourceUrl} style={{ margin: "0 0 20px 0" }}>
                  <Link
                    href={item.sourceUrl}
                    style={{
                      fontFamily: SANS,
                      fontSize: "16px",
                      fontWeight: 700,
                      color: INK,
                      textDecoration: "none",
                      lineHeight: "22px",
                    }}
                  >
                    {item.headline}
                  </Link>
                  <Text
                    style={{
                      fontFamily: SANS,
                      fontSize: "14px",
                      color: SLATE,
                      margin: "8px 0",
                      lineHeight: "21px",
                    }}
                  >
                    {item.summary}
                  </Text>
                  <table
                    role="presentation"
                    width="100%"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{ backgroundColor: AMBER_TINT, borderLeft: `3px solid ${AMBER}` }}
                  >
                    <tbody>
                      <tr>
                        <td style={{ padding: "10px 14px" }}>
                          <Text
                            style={{
                              fontFamily: MONO,
                              fontSize: "10px",
                              letterSpacing: "0.06em",
                              color: AMBER,
                              textTransform: "uppercase",
                              margin: "0 0 4px 0",
                            }}
                          >
                            Why it matters
                          </Text>
                          <Text style={{ fontFamily: SANS, fontSize: "13px", color: INK, margin: 0, lineHeight: "19px" }}>
                            {item.whyItMatters}
                          </Text>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {idx < group.items.length - 1 ? <Hr style={{ borderTop: "1px solid #D9DCE6", margin: "20px 0 0 0" }} /> : null}
                </Section>
              ))}
            </Section>
          ))}

          {/* Footer */}
          <Section style={{ padding: "28px", marginTop: "8px" }}>
            <Hr style={{ borderTop: "1px solid #D9DCE6", margin: "0 0 20px 0" }} />
            <Text style={{ fontFamily: SANS, fontSize: "12px", color: SLATE, margin: "0 0 8px 0" }}>
              <Link href={archiveUrl} style={{ color: INK, fontWeight: 600, textDecoration: "underline" }}>
                View in archive
              </Link>
              {"  ·  "}
              <Link href={preferencesUrl} style={{ color: INK, fontWeight: 600, textDecoration: "underline" }}>
                Manage preferences
              </Link>
            </Text>
            <Text style={{ fontFamily: MONO, fontSize: "11px", color: "#9AA0B4", margin: 0 }}>BRIEFF</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
