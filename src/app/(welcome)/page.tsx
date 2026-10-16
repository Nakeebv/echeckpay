import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "eCheckPay — print checks banks accept",
};

const FEATURES = [
  {
    title: "Real bank MICR",
    body: "The account numbers at the bottom are drawn in true E-13B on the exact grid banks read — not a lookalike font.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M4 7h16M4 12h10M4 17h13" />
      </svg>
    ),
  },
  {
    title: "Protected clear band",
    body: "The strip along the bottom is kept perfectly clean, the way check-reading machines require.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="4" y="14" width="16" height="5" rx="1.5" />
        <path d="M7 4h10" opacity=".5" />
      </svg>
    ),
  },
  {
    title: "Reviewed before printing",
    body: "Every check is graded against the rules a bank applies — you can't accidentally print something it would refuse.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8.5 12.2 2.4 2.4 4.6-5" />
      </svg>
    ),
  },
  {
    title: "Hard to copy or alter",
    body: "Micro-printed borders, the padlock mark, warning clauses and tamper-evident details come printed on every check.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
      </svg>
    ),
  },
  {
    title: "Positive Pay file",
    body: "Export the list your bank checks against — anything not written by you gets refused automatically.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
        <path d="M5 19h14" />
      </svg>
    ),
  },
  {
    title: "Complete history",
    body: "Every check — written, printed, voided — is recorded with a timestamp you can hand to your accountant.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    n: "01",
    title: "Add your bank account",
    body: "Routing and account numbers from the bottom of an existing check. Stored only on your own server.",
  },
  {
    n: "02",
    title: "Write the check",
    body: "Pick a payee, type the amount, choose a design. It's checked for bank acceptance as you go.",
  },
  {
    n: "03",
    title: "Print and file",
    body: "Print on security paper with a laser printer, then send your bank the matching issue file. Each print is $10.",
  },
];

const SPEC = [
  { k: "True E-13B numbers", v: "Routing, account and check number drawn on the standard bank grid." },
  { k: "Clean bottom band", v: "The 5/8\u2033 machine-read strip stays free of any printing." },
  { k: "Amounts that agree", v: "The written amount always matches the numbers — words win the bank's reading." },
  { k: "Front and back", v: "Security marks on the face; the required warning printed on the reverse." },
];

const FAQ = [
  {
    q: "Do I need special ink or paper?",
    a: "Yes. Banks read checks magnetically, so use a laser printer with MICR toner — or pre-printed MICR blank stock — plus 24 lb+ security paper. eCheckPay reminds you before every print run.",
  },
  {
    q: "Will my bank accept printed checks?",
    a: "A check printed to the bank standard with magnetic toner reads like any check your bank issued. If your bank publishes its own check spec, its format can be matched exactly.",
  },
  {
    q: "What does it cost?",
    a: "Deposits go into your wallet from $50 in crypto through NOWPayments. Every printed check — including reprints — costs $10, deducted from the wallet balance only when the print is confirmed.",
  },
  {
    q: "What is Positive Pay?",
    a: "A fraud service your bank offers: you send a list of checks you've written, and the bank automatically refuses any check that doesn't match — altered, copied or fake.",
  },
  {
    q: "Where does my banking data live?",
    a: "On your own server, behind password-protected accounts with signed sessions. Nothing is shared with a third-party service.",
  },
];

export default function WelcomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(46,81,240,0.10),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2e51f0]" />
            Bank-accepted check printing for your business
          </span>
          <h1 className="mt-6 text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-6xl lg:text-[4.25rem]">
            Checks your bank accepts.
            <br />
            <span className="text-slate-400">Written in minutes.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
            Write, print and track checks from any computer — with real bank-standard account
            numbers, built-in security features and one-click fraud protection.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/register" className="btn btn-dark btn-lg w-full sm:w-auto">
              Get started
            </Link>
            <Link href="/login" className="btn btn-ghost btn-lg w-full sm:w-auto">
              Sign in
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        {/* Hero product visual */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <div className="pointer-events-none absolute -inset-x-10 -top-12 bottom-16 bg-gradient-to-b from-[#2e51f0]/10 via-transparent to-transparent blur-2xl" />
          <img
            src="/images/hero-check.webp"
            width={1280}
            height={720}
            fetchPriority="high"
            decoding="async"
            alt="An eCheckPay check with a true E-13B MICR line, ready to print"
            className="doc-shadow relative mx-auto w-full max-w-3xl rounded-2xl"
          />
          <p className="mt-5 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            True E-13B · protected 5/8&Prime; clear band · printed from your browser
          </p>
        </div>

        <p className="mt-12 text-center font-mono text-[11px] tracking-wider text-slate-400">
          E-13B · ANSI X9.27 · X9.100-160-1 · X9.6 · UCC ARTICLE 3
        </p>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 bg-slate-50 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Why eCheckPay</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Everything a returned check isn&rsquo;t.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Most check writers produce a decorative document. eCheckPay produces an instrument —
              built to the same standard your bank prints to.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 [&>*]:bg-white sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group p-7 transition-colors hover:bg-slate-50">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2e51f0]/10 text-[#2e51f0]">
                  {f.icon}
                </span>
                <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 bg-white px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Three steps</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              No surprises.
            </h2>
          </div>
          <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="relative text-center sm:text-left">
                <div className="text-sm font-semibold tabular-nums text-[#2e51f0]">{s.n}</div>
                <div className="mt-3 h-px w-full bg-slate-200" />
                <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-slate-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security (dark, imagery) */}
      <section
        id="security"
        className="relative scroll-mt-16 overflow-hidden bg-[#0c0d11] px-4 py-20 text-white sm:px-6 sm:py-28"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_85%_20%,rgba(46,81,240,0.22),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow !text-white/40">Security that lives on the paper</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Printed by the software, not bolted on.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-white/60">
              Microprint borders, the padlock mark, tamper-evident chemistry and the rear
              disclosure clause your bank expects to find — on every check, automatically.
            </p>
            <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {SPEC.map((s) => (
                <div key={s.k} className="border-t border-white/10 pt-4">
                  <h3 className="text-sm font-semibold text-white">{s.k}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/55">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
          <img
            src="/images/security.webp"
            width={1248}
            height={832}
            loading="lazy"
            decoding="async"
            alt="Security details printed on every eCheckPay check"
            className="w-full rounded-2xl shadow-2xl ring-1 ring-white/10"
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 bg-white px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="eyebrow">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Questions, answered.
            </h2>
          </div>
          <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-slate-900">
                  {f.q}
                  <span className="text-xl font-light text-slate-400 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 pr-8 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-slate-50 px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#0c0d11] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_60%_at_50%_0%,rgba(46,81,240,0.35),transparent_70%)]"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Start printing checks your bank accepts.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/60">
              Create an account, add a bank account and print your first check in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="btn btn-lg w-full bg-white text-slate-900 hover:bg-white/90 sm:w-auto"
              >
                Get started
              </Link>
              <Link
                href="/standards"
                className="btn btn-lg w-full border border-white/20 text-white hover:bg-white/10 sm:w-auto"
              >
                Read the standards
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
