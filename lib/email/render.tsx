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
}): Promise<{ html: string; subject: string }> {
  const local = DateTime.fromJSDate(props.sentAt, { zone: props.timezone });
  const dateLabel = local.toFormat("ccc d LLL yyyy").toUpperCase();
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
  };

  const html = await render(<DigestEmail {...emailProps} />);
  const subject = `${props.sectors.join(" · ")} — ${local.toFormat("d LLL")} brief`;

  return { html, subject };
}
