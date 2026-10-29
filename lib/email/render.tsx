import { render } from "react-email";
import { DateTime } from "luxon";
import { DigestEmail, type DigestEmailProps, type DigestEmailSector } from "./digest-email";

export async function renderDigestEmail(props: {
  userName: string;
  sentAt: Date;
  timezone: string;
  sectors: string[];
  editorsNote: string;
  sectorGroups: DigestEmailSector[];
  archiveUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
  postalAddress?: string | null;
}): Promise<{ html: string; subject: string }> {
  const local = DateTime.fromJSDate(props.sentAt, { zone: props.timezone });
  const dateLabel = local.toFormat("cccc d LLLL");
  const timeLabel = local.toFormat("HH:mm");

  const emailProps: DigestEmailProps = {
    userName: props.userName,
    dateLabel,
    timeLabel,
    sectors: props.sectors,
    editorsNote: props.editorsNote,
    sectorGroups: props.sectorGroups,
    archiveUrl: props.archiveUrl,
    preferencesUrl: props.preferencesUrl,
    unsubscribeUrl: props.unsubscribeUrl,
    postalAddress: props.postalAddress,
  };

  const html = await render(<DigestEmail {...emailProps} />);
  const desks = props.sectors.length > 1
    ? `${props.sectors.slice(0, -1).join(", ")} and ${props.sectors[props.sectors.length - 1]}`
    : props.sectors.join("");
  const subject = `Your brief for ${local.toFormat("d LLL")}: ${desks}`;

  return { html, subject };
}
