const PRODUCT_URL = "https://workbench.earlythunder.com/workbench/";

type WorkbenchCTAProps = {
  /** Closed list: homepage, footer, compare, screen, token. Used for the class, utm_content and data-cta ids. */
  placement?: string;
  /** Topic heading for in-content placements. */
  heading?: string;
  /** Topic body text for in-content placements. */
  body?: string;
};

const DEFAULT_HEADING = "Turn what you read into research you can use.";
const DEFAULT_BODY =
  "Keep sources, compare token assumptions, and export your own research memo. An offline workspace for the evidence behind your decisions.";
const INLINE_PLACEMENTS = new Set(["compare", "screen", "token", "screenhub", "blog"]);

export default function WorkbenchCTA({ placement = "footer", heading, body }: WorkbenchCTAProps) {
  const safePlacement = /^[a-z]{1,20}$/.test(placement) ? placement : "inline";
  const tracking = `?utm_source=earlythunder&utm_medium=website&utm_campaign=workbench-fit&utm_content=${encodeURIComponent(safePlacement)}`;
  const isInline = INLINE_PLACEMENTS.has(safePlacement);
  const classes = `workbench-offer workbench-offer--${safePlacement}${isInline ? " workbench-offer--inline" : ""}`;
  return (
    <section className={classes} aria-label="Token Evidence Workbench">
      <div className="workbench-offer__copy">
        <p className="workbench-offer__eyebrow">TOKEN EVIDENCE WORKBENCH</p>
        <h2>{heading ?? DEFAULT_HEADING}</h2>
        <p>{body ?? DEFAULT_BODY}</p>
        <details className="workbench-offer__fit">
          <summary>Is the Workbench right for my research?</summary>
          <p>Use the free calculators for a quick calculation. Use the Workbench when you need to collect sources, compare your own token assumptions, and export a research memo.</p>
          <p>Try the preview. Change a source date or revenue assumption in the fictional examples and inspect the comparison before buying. Your own projects, exports, and research memos are included in the paid download. Every purchase buys a research workspace, not a trading signal or a promise of investment returns.</p>
        </details>
        <p className="workbench-offer__details">$29 USD once, Version 1 ZIP, no subscription</p>
      </div>
      <div className="workbench-offer__actions">
        <a
          className="workbench-offer__buy"
          href={PRODUCT_URL + tracking}
          id={`cta-${safePlacement}-workbench`}
          data-cta={`${safePlacement}_workbench`}
          data-placement={safePlacement}
        >
          Get the Workbench, $29 <span aria-hidden="true">→</span>
        </a>
        <a
          className="workbench-offer__preview"
          href={PRODUCT_URL + "preview/" + tracking}
          id={`cta-${safePlacement}-preview`}
          data-cta={`${safePlacement}_preview`}
          data-placement={safePlacement}
        >
          Try the free preview <span aria-hidden="true">↗</span>
        </a>
        <span className="workbench-offer__note">Your data stays in your browser.</span>
      </div>
    </section>
  );
}
