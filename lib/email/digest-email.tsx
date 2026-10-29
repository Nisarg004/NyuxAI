import { Body, Button, Container, Head, Hr, Html, Link, Preview, Section, Text } from "react-email";

const NIGHT = "#0D0F2B";
const LINE = "#2A2E66";
const STAR = "#ECEEFF";
const HAZE = "#9EA3D6";
const DAWN = "#FFBE8A";
const AURORA = "#8C7BFF";
const MORNING = "#F7F7FC";
const MORNING_2 = "#ECEEF8";
const INK = "#171A3F";
const INK_SOFT = "#5B5F86";
const RULE = "#DCDFEE";

const HEADING = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";
const BODY = "'Geist', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

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
  unsubscribeUrl: string;
  // CAN-SPAM: a physical postal address in every email; omitted when unset.
  postalAddress?: string | null;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the source";
  }
}

function joinList(values: string[]): string {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function Wordmark({ size }: { size: number }) {
  return (
    <Text style={{ fontFamily: HEADING, fontSize: `${size}px`, fontWeight: 700, lineHeight: `${size + 4}px`, margin: 0, color: STAR }}>
      <span style={{ color: DAWN, fontSize: `${Math.round(size * 0.7)}px`, marginRight: "6px" }}>&#10022;</span>
      nyux
    </Text>
  );
}

function StoryBlock({ item, last }: { item: DigestEmailItem; last: boolean }) {
  return (
    <Section style={{ margin: last ? "0" : "0 0 24px 0" }}>
      <Text style={{ fontFamily: HEADING, fontSize: "19px", fontWeight: 700, color: INK, lineHeight: "25px", margin: "0 0 8px 0" }}>
        {item.headline}
      </Text>
      <Text style={{ fontFamily: BODY, fontSize: "15px", color: INK_SOFT, lineHeight: "24px", margin: "0 0 14px 0" }}>
        {item.summary}
      </Text>
      {item.whyItMatters ? (
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ borderCollapse: "separate", margin: "0 0 12px 0" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  backgroundColor: MORNING_2,
                  borderLeft: `3px solid ${AURORA}`,
                  borderRadius: "12px",
                  padding: "12px 16px",
                }}
              >
                <Text style={{ fontFamily: BODY, fontSize: "13px", fontWeight: 600, color: INK, lineHeight: "18px", margin: "0 0 4px 0" }}>
                  Why it matters
                </Text>
                <Text style={{ fontFamily: BODY, fontSize: "14px", color: INK, lineHeight: "22px", margin: 0 }}>
                  {item.whyItMatters}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
      <Text style={{ fontFamily: BODY, fontSize: "13px", lineHeight: "18px", margin: 0 }}>
        <Link href={item.sourceUrl} style={{ color: INK, fontWeight: 600, textDecoration: "underline" }}>
          Read the source at {hostOf(item.sourceUrl)}
        </Link>
      </Text>
      {last ? null : <Hr style={{ borderTop: `1px solid ${RULE}`, margin: "24px 0 0 0" }} />}
    </Section>
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
  unsubscribeUrl,
  postalAddress,
}: DigestEmailProps) {
  const footerLink = { color: INK_SOFT, fontWeight: 600, textDecoration: "underline" } as const;

  return (
    <Html>
      <Head />
      <Preview>{editorsNote || `Your brief for ${dateLabel}`}</Preview>
      <Body style={{ backgroundColor: MORNING, margin: 0, padding: 0, fontFamily: BODY }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: MORNING }}>
          {/* Night header band */}
          <Section style={{ backgroundColor: NIGHT, padding: "28px 32px 32px 32px" }}>
            <Wordmark size={22} />
            <Hr style={{ borderTop: `1px solid ${LINE}`, margin: "22px 0 20px 0" }} />
            <Text style={{ fontFamily: BODY, fontSize: "13px", color: HAZE, lineHeight: "18px", margin: "0 0 8px 0" }}>
              {dateLabel} at {timeLabel}
            </Text>
            <Text style={{ fontFamily: HEADING, fontSize: "28px", fontWeight: 700, color: STAR, lineHeight: "32px", margin: "0 0 10px 0" }}>
              Hi {userName}, here&rsquo;s your brief.
            </Text>
            {sectors.length > 0 ? (
              <Text style={{ fontFamily: BODY, fontSize: "15px", color: HAZE, lineHeight: "22px", margin: 0 }}>
                Today&rsquo;s brief covers {joinList(sectors)}.
              </Text>
            ) : null}
          </Section>

          {/* Editor's note */}
          {editorsNote ? (
            <Section style={{ padding: "28px 32px 0 32px" }}>
              <Text style={{ fontFamily: BODY, fontSize: "15px", fontStyle: "italic", color: INK_SOFT, lineHeight: "24px", margin: 0 }}>
                {editorsNote}
              </Text>
            </Section>
          ) : null}

          {/* Sectors */}
          {sectorGroups.map((group) => (
            <Section key={group.sector} style={{ padding: "32px 32px 0 32px" }}>
              <Text
                style={{
                  fontFamily: HEADING,
                  fontSize: "22px",
                  fontWeight: 700,
                  color: INK,
                  lineHeight: "28px",
                  borderBottom: `1px solid ${RULE}`,
                  paddingBottom: "10px",
                  margin: "0 0 20px 0",
                }}
              >
                {group.sector}
              </Text>

              {group.items.length === 0 ? (
                <Text style={{ fontFamily: BODY, fontSize: "15px", fontStyle: "italic", color: INK_SOFT, margin: 0 }}>
                  Nothing in {group.sector} cleared our bar today.
                </Text>
              ) : null}

              {group.items.map((item, idx) => (
                <StoryBlock key={item.sourceUrl} item={item} last={idx === group.items.length - 1} />
              ))}
            </Section>
          ))}

          {/* Call to action */}
          <Section style={{ padding: "36px 32px 8px 32px", textAlign: "center" }}>
            <Button
              href={archiveUrl}
              style={{
                backgroundColor: DAWN,
                color: NIGHT,
                fontFamily: BODY,
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: "20px",
                textDecoration: "none",
                borderRadius: "999px",
                padding: "14px 28px",
              }}
            >
              Open in Nyux
            </Button>
          </Section>

          {/* Footer */}
          <Section style={{ padding: "28px 32px 36px 32px" }}>
            <Hr style={{ borderTop: `1px solid ${RULE}`, margin: "0 0 20px 0" }} />
            <Text style={{ fontFamily: BODY, fontSize: "13px", color: INK_SOFT, lineHeight: "20px", margin: "0 0 10px 0" }}>
              <Link href={preferencesUrl} style={footerLink}>
                Manage preferences
              </Link>
              <span style={{ display: "inline-block", width: "20px" }}>&nbsp;</span>
              <Link href={unsubscribeUrl} style={footerLink}>
                Unsubscribe
              </Link>
            </Text>
            {postalAddress ? (
              <Text style={{ fontFamily: BODY, fontSize: "12px", color: INK_SOFT, lineHeight: "18px", margin: "0 0 10px 0" }}>
                {postalAddress}
              </Text>
            ) : null}
            <Text style={{ fontFamily: HEADING, fontSize: "13px", fontWeight: 700, color: INK_SOFT, margin: 0 }}>
              <span style={{ color: AURORA, marginRight: "4px" }}>&#10022;</span>
              nyux
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
