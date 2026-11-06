/* DeadlinesGrid, 4-card deadline tracker. Server Component. */

interface DeadlinesGridProps {
  readonly deadlines: readonly {
    readonly protocol: string;
    readonly event: string;
    readonly end_date: string | null;
    readonly estimated_end: string | null;
    readonly urgency: string;
    readonly status: string;
  }[];
}

/* ─── Helpers ─── */

/** Compute days remaining from end_date, or null if unavailable. */
function computeDaysLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/** Map urgency to CSS modifier. */
function urgencyMod(urgency: string): string {
  if (urgency === "CRITICAL") return "deadline--critical";
  return "";
}

/** Map status to badge CSS class. */
function statusClass(status: string, urgency: string): string {
  if (urgency === "CRITICAL") return "status status--critical";
  if (urgency === "HIGH") return "status status--warn";
  return "status status--ok";
}

/** Effective time (ms) for a deadline: firm date, else estimate, else far future. */
function effectiveTime(d: {
  readonly end_date: string | null;
  readonly estimated_end: string | null;
}): number {
  const s = d.end_date ?? d.estimated_end ?? "2100-01-01";
  const t = new Date(s).getTime();
  return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/* ─── DeadlineCard ─── */

function DeadlineCard({
  d,
}: {
  readonly d: DeadlinesGridProps["deadlines"][number];
}) {
  const daysLeft = computeDaysLeft(d.end_date);
  const dateLabel = d.end_date ?? d.estimated_end ?? "TBD";
  const progressPct = daysLeft !== null && daysLeft <= 90
    ? Math.min(100, Math.round(((90 - daysLeft) / 90) * 100))
    : 0;

  return (
    <div className={`deadline ${urgencyMod(d.urgency)}`}>
      <div className="deadline__top">
        <div>
          <span className="deadline__name">{d.protocol}</span>
          <span className="deadline__event">{d.event}</span>
        </div>
        <span className={statusClass(d.status, d.urgency)}>{d.status}</span>
      </div>
      <div className="deadline__bot">
        <span className="deadline__days mono">{daysLeft ?? ", "}</span>
        <span className="deadline__label">days left</span>
        <span className="deadline__date">{dateLabel}</span>
      </div>
      <div className="deadline__bar">
        <div className="deadline__bar-fill" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}

/* ─── Main Export ─── */

export default function DeadlineStrip({ deadlines }: DeadlinesGridProps) {
  const upcoming = deadlines
    .filter((d) => d.status !== "ENDED")
    .sort((a, b) => effectiveTime(a) - effectiveTime(b));
  const visible = upcoming.slice(0, 4);

  if (visible.length === 0) return null;

  return (
    <section className="section">
      <div className="section__head">
        <div>
          <div className="section__eyebrow mono">04, DEADLINE TRACKER</div>
          <h2 className="section__title">Upcoming dates to track</h2>
          <p className="section__sub">
            {upcoming.length} active countdowns across token releases, ETF
            rulings, mainnet launches, and governance votes.
          </p>
        </div>
        <a className="ghost-btn" href="/deadlines/">Track all deadlines <span className="arr">&rarr;</span></a>
      </div>
      <div className="deadlines">
        {visible.map((d) => (
          <DeadlineCard key={`${d.protocol}-${d.event}`} d={d} />
        ))}
      </div>
    </section>
  );
}
