import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CLIENT_ORIGIN, isPublicFieldPath } from "@/utils/publicHosts";
import { BookedShiftActionsCard, ShiftReleaseCard } from "./PublicJobBoard";
import type { ShiftReleasePayload } from "./PublicJobBoard";
import {
  buildAppleCalendarHref,
  buildGoogleCalendarUrl,
  buildShiftsIcs,
  resolveShiftCheckinUrl,
  resolveShiftTrainingUrl,
  suggestIcsFilename,
} from "./shiftCalendar";
import type { BookedShiftCalendarData } from "./shiftCalendar";

const SAMPLE_SHIFT: BookedShiftCalendarData = {
  id: "0194f0e8-1111-7000-8000-000000000001",
  title: "Torch THC · Event Activation — Wynwood Art Walk",
  brandLabel: "Torch THC",
  typeLabel: "Event Activation",
  venue: "Wynwood Art Walk",
  address: "250 NW 24th St, Miami, FL 33127",
  startsAt: "2026-12-05T16:00:00-05:00",
  endsAt: "2026-12-05T20:00:00-05:00",
  timezone: "America/New_York",
  dateLabel: "Sat, Dec 5",
  timeLabel: "4–8pm EST",
  brief: "Park in lot C. Wear black Torch tee.",
  checkinCode: "TH-2HRV3D",
  trainingUrl: "/training/torch/ba-sampling-guide.pdf",
  releaseToken: "signed-release-token",
  releaseUrl: "https://client.igniteproductions.co/jobs/jb_tok?release=signed-release-token",
};

describe("shiftCalendar helpers", () => {
  it("mints check-in and training links strictly on CLIENT_ORIGIN", () => {
    expect(resolveShiftCheckinUrl(SAMPLE_SHIFT)).toBe(
      `${CLIENT_ORIGIN}/checkin/TH-2HRV3D`,
    );
    expect(resolveShiftTrainingUrl(SAMPLE_SHIFT)).toBe(
      `${CLIENT_ORIGIN}/training/torch/ba-sampling-guide.pdf`,
    );
    expect(
      resolveShiftTrainingUrl({
        ...SAMPLE_SHIFT,
        trainingUrl: "https://spark.igniteproductions.co/training/torch/guide.pdf",
      }),
    ).toBe(`${CLIENT_ORIGIN}/training/torch/guide.pdf`);
  });

  it("builds a pre-populated Google Calendar TEMPLATE link with times, venue, check-in, and training URLs", () => {
    const url = new URL(buildGoogleCalendarUrl(SAMPLE_SHIFT));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Torch THC · Event Activation — Wynwood Art Walk");
    expect(url.searchParams.get("dates")).toBe("20261205T210000Z/20261206T010000Z");
    expect(url.searchParams.get("location")).toBe(
      "Wynwood Art Walk, 250 NW 24th St, Miami, FL 33127",
    );
    const details = url.searchParams.get("details") ?? "";
    expect(details).toContain("https://client.igniteproductions.co/checkin/TH-2HRV3D");
    expect(details).toContain(
      "https://client.igniteproductions.co/training/torch/ba-sampling-guide.pdf",
    );
    expect(details).toContain("Park in lot C. Wear black Torch tee.");
  });

  it("generates RFC 5545 .ics files (single + multi-shift) and Apple Calendar data URIs", () => {
    const secondShift: BookedShiftCalendarData = {
      ...SAMPLE_SHIFT,
      id: "0194f0e8-2222-7000-8000-000000000002",
      venue: "Brickell Night Market",
      startsAt: "2026-12-06T18:00:00-05:00",
      endsAt: "2026-12-06T22:00:00-05:00",
    };

    const ics = buildShiftsIcs(
      [SAMPLE_SHIFT, secondShift],
      new Date("2026-11-22T18:00:00Z"),
    );
    expect(ics.endsWith("\r\n")).toBe(true);
    // Unfold RFC 5545 folded lines before checking field payloads.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    expect(unfolded.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(unfolded).toContain("DTSTART:20261205T210000Z");
    expect(unfolded).toContain("DTEND:20261206T010000Z");
    expect(unfolded).toContain(
      "LOCATION:Wynwood Art Walk\\, 250 NW 24th St\\, Miami\\, FL 33127",
    );
    expect(unfolded).toContain("URL:https://client.igniteproductions.co/checkin/TH-2HRV3D");
    expect(unfolded).toContain(
      "https://client.igniteproductions.co/training/torch/ba-sampling-guide.pdf",
    );

    const appleHref = buildAppleCalendarHref([SAMPLE_SHIFT]);
    expect(appleHref.startsWith("data:text/calendar;charset=utf-8,")).toBe(true);
    expect(suggestIcsFilename([SAMPLE_SHIFT])).toBe("torch-thc-wynwood-art-walk.ics");
    expect(suggestIcsFilename([SAMPLE_SHIFT, secondShift])).toBe("ignite-shifts-2.ics");
  });
});

describe("PublicJobBoard booked calendar & shift release UI", () => {
  it("routes /jobs/release/:releaseToken through the lightweight public field bundle", () => {
    expect(isPublicFieldPath("/jobs/jb_123")).toBe(true);
    expect(isPublicFieldPath("/jobs/release/signed_tok_123")).toBe(true);
  });

  it("renders .ics, Google Calendar, Apple Calendar, check-in, training, and release actions on booked shifts", () => {
    const html = renderToStaticMarkup(
      <BookedShiftActionsCard shift={SAMPLE_SHIFT} onOpenRelease={() => {}} />,
    );
    expect(html).toContain("Wynwood Art Walk");
    expect(html).toContain("250 NW 24th St, Miami, FL 33127");
    expect(html).toContain("Download .ics");
    expect(html).toContain("Google Calendar");
    expect(html).toContain("Apple Calendar");
    expect(html).toContain("https://client.igniteproductions.co/checkin/TH-2HRV3D");
    expect(html).toContain(
      "https://client.igniteproductions.co/training/torch/ba-sampling-guide.pdf",
    );
    expect(html).toContain("Can&#x27;t make this shift?");
  });

  it("renders >36h self-serve release form and <=36h staffing escalation guardrail", () => {
    const baseInfo: ShiftReleasePayload = {
      brandLabel: "Torch THC",
      typeLabel: "Event Activation",
      venue: "Wynwood Art Walk",
      dateLabel: "Sat, Dec 5",
      timeLabel: "4–8pm EST",
      startsAt: "2026-12-05T16:00:00-05:00",
      hoursUntilStart: 96,
      minLeadHours: 36,
      baFirstName: "Jordan",
      status: "can_release",
      canSelfRelease: true,
      contactEmail: "staffing@igniteproductions.co",
      supportPhone: "775.406.0435",
      supportPhoneHref: "+17754060435",
      boardToken: "jb_tok",
    };

    const over36Html = renderToStaticMarkup(
      <ShiftReleaseCard
        info={baseInfo}
        reason=""
        onReasonChange={() => {}}
        onSubmit={() => {}}
        submitting={false}
        error=""
      />,
    );
    expect(over36Html).toContain("Release my shift");
    expect(over36Html).toContain("more than 36 hours out");

    const under36Html = renderToStaticMarkup(
      <ShiftReleaseCard
        info={{
          ...baseInfo,
          status: "urgent_window",
          canSelfRelease: false,
          hoursUntilStart: 18.4,
        }}
        reason=""
        onReasonChange={() => {}}
        onSubmit={() => {}}
        submitting={false}
        error=""
      />,
    );
    expect(under36Html).toContain("auto-drop is locked");
    expect(under36Html).toContain("Send urgent alert to staffing");
    expect(under36Html).toContain("sms:+17754060435");
    expect(under36Html).toContain("tel:+17754060435");
    expect(under36Html).toContain("mailto:staffing@igniteproductions.co");
  });
});
