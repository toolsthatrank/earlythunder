/* L09R2: compact first-screen Workbench line for token pages. Facts mirror WorkbenchCTA. */
const PRODUCT_URL = "https://workbench.earlythunder.com/workbench/";

export default function WorkbenchStrip({ placement, symbol }: { readonly placement: string; readonly symbol: string }) {
  const safe = /^[a-z]{1,20}$/.test(placement) ? placement : "inline";
  const href = `${PRODUCT_URL}?utm_source=earlythunder&utm_medium=website&utm_campaign=workbench-fit&utm_content=${safe}strip`;
  return (
    <div className="workbench-strip">
      <p>
        <b>Researching {symbol}?</b> This scorecard is free. The Token Evidence Workbench, $29 once, keeps your own sources and assumptions beside it.
      </p>
      <a href={href} id={`cta-${safe}strip-workbench`} data-cta={`${safe}strip_workbench`} data-placement={`${safe}strip`}>
        Get the Workbench, $29
      </a>
    </div>
  );
}
