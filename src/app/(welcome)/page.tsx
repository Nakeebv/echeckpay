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
    n: "1",
    title: "Add your bank account",
    body: "Routing and account numbers from the bottom of an existing check. Stored only on your own server.",
  },
  {
    n: "2",
    title: "Write the check",
    body: "Pick a payee, type the amount, choose a design. It's checked for bank acceptance as you go.",
  },
  {
    n: "3",
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
      <section className="overflow-hidden px-6 pb-10 pt-14 text-center sm:pt-20">
        <Link
          href="/#features"
          className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3.5 py-1 text-xs font-medium text-[#6e6e73] shadow-sm"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0071e3]" />
          Bank-accepted check printing for your business
        </Link>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-[#1d1d1f] sm:text-5xl lg:text-6xl">
          Checks your bank accepts.
          <br />
          Written in minutes.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#6e6e73]">
          Write, print and track checks from any computer — with real bank-standard account
          numbers, built-in security features and one-click fraud protection.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full bg-[#0071e3] px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#0077ed]"
          >
            Get started
          </Link>
          <Link href="/login" className="text-[15px] font-medium text-[#0071e3] transition hover:underline">
            Sign in →
          </Link>
        </div>

        {/* Hero product visual */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <div className="pointer-events-none absolute -inset-x-8 -top-10 bottom-16 bg-gradient-to-b from-[#0071e3]/10 via-transparent to-transparent blur-2xl" />
          <img
            src="/images/hero-check.png"
            alt="An eCheckPay check with a true E-13B MICR line, ready to print"
            className="doc-shadow relative mx-auto w-full max-w-3xl rounded-2xl"
          />
          <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            True E-13B · protected 5/8&Prime; clear band · printed from your browser
          </p>
        </div>

        <p className="mt-10 font-mono text-[11px] tracking-wider text-[#86868b]">
          E-13B · ANSI X9.27 · X9.100-160-1 · X9.6 · UCC ARTICLE 3
        </p>
      </section>

      {/* Features */}
      <section id="features" className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-4xl">
            Everything a returned check isn&rsquo;t.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed text-[#6e6e73]">
            Most check writers produce a decorative document. eCheckPay produces an instrument —
            built to the same standard your bank prints to.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-[#f5f5f7] p-6 transition hover:bg-[#ebebed]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0071e3] shadow-sm">
                  {f.icon}
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-[#1d1d1f]">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6e6e73]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-[#f5f5f7] px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-4xl">
            Three steps. No surprises.
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#1d1d1f] text-sm font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 text-[17px] font-semibold text-[#1d1d1f]">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6e6e73]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security (dark, imagery) */}
      <section id="security" className="overflow-hidden bg-[#1d1d1f] px-6 py-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Security that lives on the paper.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#a1a1a6]">
              The anti-counterfeit stack is printed by the software, not bolted on — microprint
              borders, the padlock mark, tamper-evident chemistry and the rear disclosure clause
              your bank expects to find.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {SPEC.map((s) => (
                <div key={s.k}>
                  <h3 className="text-sm font-semibold text-white">{s.k}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#a1a1a6]">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
          <img
            src="/images/security.png"
            alt="Security details printed on every eCheckPay check"
            className="w-full rounded-2xl shadow-2xl"
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-4xl">
            Questions, answered.
          </h2>
          <div className="mt-10 divide-y divide-slate-200">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-[#1d1d1f]">
                  {f.q}
                  <span className="text-lg text-[#86868b] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[#6e6e73]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
