import { Resend } from "resend";

interface WeeklySummary {
  childName: string;
  parentEmail: string;
  totalStars: number;
  dailySummaries: {
    date: string;
    dayName: string;
    stars: number;
    total: number;
  }[];
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY ontbreekt.");
  }

  return new Resend(apiKey);
}

export async function sendWeeklySummaryEmail(summary: WeeklySummary) {
  const resend = getResendClient();

  const daysHtml = summary.dailySummaries
    .map(
      (day) => `
      <tr>
        <td style="padding: 8px 16px; border-bottom: 1px solid #e5e7eb;">${day.dayName}</td>
        <td style="padding: 8px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${"&#11088;".repeat(day.stars)}${day.stars === 0 ? "&mdash;" : ""}
        </td>
        <td style="padding: 8px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${day.stars}/${day.total}
        </td>
      </tr>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Noor Tracker weekoverzicht</title>
    </head>
    <body style="margin: 0; font-family: 'Nunito', Arial, sans-serif; background-color: #ecfdf5; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.08);">
        <div style="background: #1a6b4a; padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Noor Tracker</h1>
          <p style="color: #a7f3d0; margin: 8px 0 0;">Wekelijks overzicht</p>
        </div>

        <div style="padding: 32px;">
          <h2 style="color: #1a6b4a; margin-top: 0; line-height: 1.4;">
            &#1605;&#1575; &#1588;&#1575;&#1569; &#1575;&#1604;&#1604;&#1607;! ${summary.childName} heeft ${summary.totalStars} sterren verdiend deze week! &#127775;
          </h2>

          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <thead>
              <tr style="background: #ecfdf5;">
                <th style="padding: 8px 16px; text-align: left;">Dag</th>
                <th style="padding: 8px 16px; text-align: center;">Sterren</th>
                <th style="padding: 8px 16px; text-align: center;">Score</th>
              </tr>
            </thead>
            <tbody>
              ${daysHtml}
            </tbody>
          </table>

          <div style="background: #fefce8; border-radius: 12px; padding: 20px; text-align: center; margin-top: 24px;">
            <p style="font-size: 32px; margin: 0;">&#11088; ${summary.totalStars}</p>
            <p style="color: #856306; margin: 8px 0 0;">Totaal sterren deze week</p>
          </div>

          <div style="text-align: center; margin-top: 32px;">
            <a href="${process.env.NEXTAUTH_URL}/dashboard"
               style="display: inline-block; background: #1a6b4a; color: white; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: bold;">
              Bekijk voortgang &rarr;
            </a>
          </div>
        </div>

        <div style="background: #f9fafb; padding: 16px; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">Noor Tracker - Islamitische gewoontes voor kinderen</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: "Noor Tracker <noor@noortracker.nl>",
    to: summary.parentEmail,
    subject: `Maashallah! ${summary.childName} verdiende ${summary.totalStars} sterren deze week \u{1F31F}`,
    html,
  });
}
