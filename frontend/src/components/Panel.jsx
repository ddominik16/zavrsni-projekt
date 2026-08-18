export default function Panel({ title, sub, flush, children }) {
  return (
    <div className="panel">
      <div className="panel__hd">
        <div className="panel__t">{title}</div>
        {sub ? <div className="panel__sub">{sub}</div> : null}
      </div>
      <div className={flush ? "panel__bd panel__bd--flush" : "panel__bd"}>
        {children}
      </div>
    </div>
  );
}
