import { Badge, Card, SectionTitle } from "@/components/ui";
import { SECURITY_FEATURES } from "@/lib/security";
import { LAYOUT_LIST } from "@/lib/layouts";
import { MICR_CLEAR_BAND, MICR_BASELINE, MICR_PITCH, MICR_LEADING_EDGE } from "@/lib/micr";

export const metadata = {
  title: "Bank acceptance standards — eCheckPay",
};

const SPEC = [
  {
    heading: "The MICR line",
    rows: [
      ["Font", "E-13B — 10 digits plus Transit, On-Us, Amount and Dash symbols (the “TOAD” line)"],
      ["Character pitch", `exactly 8 characters per inch (${MICR_PITCH}" per position)`],
      ["Character height", '0.125" (3.175 mm), stroke 0.0165" ±0.001"'],
      ["Positions", "65 per line, numbered right to left, position 1 = rightmost"],
      ["Clear band", `${MICR_CLEAR_BAND}" minimum height from the aligning (bottom) edge — no other magnetic ink`],
      ["Print band", `0.25" tall, starting ${MICR_BASELINE}" (3/16") above the bottom edge`],
      ["Leading edge", `${MICR_LEADING_EDGE}" (5/16") from the right edge of the document`],
      ["Signal level", "Iron-oxide toner/ink must hold the ANSI X9.27 waveform — colour laser toner will not read"],
    ],
  },
  {
    heading: "Field layout (right to left)",
    rows: [
      ["Amount — positions 1-12", "Amount symbol, 2 cents digits, 8 dollar digits, Amount symbol. Encoded by the bank of first deposit; normally left blank."],
      ["On-Us — positions 13-32", "18 usable positions (13 and 32 stay blank). Account number, an On-Us symbol after the last account digit, optional serial/transaction code."],
      ["Transit — positions 33-43", "Transit symbol + 9-digit ABA routing number (check digit first from the right) + Transit symbol. Fixed field."],
      ["EPC — position 44 or 45", "External Processing Code. Controlled by ASC X9B — leave blank unless authorised."],
      ["Aux On-Us — 45/46-65", "Only on documents longer than 6½\". Serial number bounded by On-Us symbols; the rightmost symbol must start within ¼\" of the leftmost Transit symbol."],
    ],
  },
  {
    heading: "Negotiable instrument content",
    rows: [
      ["Sum certain", "Both a courtesy amount (numeral box) and a legal amount in words. Words control over numerals — UCC 3-114."],
      ["Payee", "Named payee or bearer. A named payee plus a restrictive endorsement is the strongest cheap control — UCC 3-110."],
      ["Date", "Required. Stale-dating kicks in at 6 months for ordinary instruments — UCC 3-304."],
      ["Signature", "No drawer signature = not properly payable — UCC 3-401."],
      ["Order language", "“Pay to the order of” makes it negotiable; “pay to” alone makes it non-negotiable."],
      ["Fractional routing", "Top-right manual-sort fallback used when the MICR line is damaged."],
    ],
  },
  {
    heading: "Physical production",
    rows: [
      ["Paper", "24 lb bond or heavier security check stock; chemical-reactive and toner-fusing qualified."],
      ["Print scale", "100% / Actual size. Never “fit to page” — it destroys the 1/8\" pitch and the clear band position."],
      ["Toner", "MICR-grade iron-oxide toner on a laser printer, or pre-printed magnetic MICR blank stock."],
      ["Verification", "Check the baseline at 3/16\" and the leading edge at 5/16\" with an E-13B position gauge before a production run."],
      ["Image exchange", "Black on white, no reverse type, no screens behind the payee or MICR — the item must survive 200 dpi truncation (ANSI X9.100-181)."],
      ["Issue file", "Transmit a Positive Pay file (account, serial, amount, payee, date) so counterfeits are returned automatically."],
    ],
  },
];

export default function StandardsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Bank acceptance specification
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          This is the specification eCheckPay enforces. It is the same ANSI/ABA document geometry
          that the major check printers (Deluxe, Harland Clarke) print to, which is why every Chase
          or Bank of America check you handle looks the same underneath the branding.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SPEC.map((s) => (
          <Card key={s.heading} className="overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                {s.heading}
              </h2>
            </div>
            <dl className="divide-y divide-slate-100">
              {s.rows.map(([k, v]) => (
                <div key={k} className="px-4 py-3">
                  <dt className="text-xs font-bold text-slate-900">{k}</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-slate-600">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>

      <section>
        <SectionTitle
          title="Document formats"
          subtitle="The physical width decides which MICR fields are legal."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {LAYOUT_LIST.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">{l.name}</h3>
                <Badge tone={l.supportsAuxOnUs ? "indigo" : "slate"}>
                  {l.supportsAuxOnUs ? "Aux On-Us serial" : "On-Us serial"}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{l.description}</p>
              <div className="mt-2 font-mono text-[11px] text-slate-500">
                {l.width}&quot; × {l.height}&quot; · {l.perPage} per {l.page.width}×{l.page.height}
                &quot; sheet · {l.stubs.length} stub{l.stubs.length === 1 ? "" : "s"}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          title="Security features reference"
          subtitle="Each feature is a real, printed control — not a label in a settings panel."
        />
        <Card className="divide-y divide-slate-100">
          {SECURITY_FEATURES.map((f) => (
            <div key={f.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[220px_1fr_180px]">
              <div className="text-sm font-semibold text-slate-900">{f.label}</div>
              <p className="text-xs leading-relaxed text-slate-600">{f.description}</p>
              <div className="text-right">
                <Badge tone="indigo">{f.standard}</Badge>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <Card className="border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-bold text-amber-900">What software cannot do for you</h2>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-900">
          <li>
            • <strong>Magnetic signal.</strong> A browser can only lay down toner. If the printer uses
            ordinary toner, the sorter will not see the line regardless of how correct the geometry
            is. Use MICR toner or pre-printed magnetic stock.
          </li>
          <li>
            • <strong>Your bank&apos;s On-Us convention.</strong> The On-Us field is bank-defined. Ask
            for your bank&apos;s MICR printing specification and match the exact string, including any
            transaction code.
          </li>
          <li>
            • <strong>Positive Pay enrolment.</strong> The export only protects you if the bank is
            actually consuming it. Enrol the account, then export after every print run.
          </li>
          <li>
            • <strong>Legal authority.</strong> Printing a negotiable instrument you are entitled to
            draw is lawful; printing against an account you do not control is a crime. This tool is
            for the drawer&apos;s own accounts.
          </li>
        </ul>
      </Card>
    </div>
  );
}
