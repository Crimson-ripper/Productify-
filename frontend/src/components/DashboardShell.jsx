import SEO from "@/components/SEO";

/**
 * Shared layout for the buyer, seller and admin dashboards: a section sidebar
 * (a scrollable tab row on phones), a header, and the active section's content.
 *
 * nav: [{ key, label, icon: LucideIcon, count? }]
 */
export default function DashboardShell({ seoTitle, path, eyebrow, title, subtitle, actions, nav = [], active, onNav, children }) {
  return (
    <>
      <SEO title={seoTitle} path={path} />
      <div className={nav.length ? "dash" : "dash no-side"}>
        {nav.length > 0 && (
          <aside className="dash-side" aria-label="Dashboard sections">
            <div className="dash-side-label">{eyebrow}</div>
            <nav>
              {nav.map(({ key, label, icon: Icon, count }) => (
                <button
                  key={key}
                  className={active === key ? "dash-nav active" : "dash-nav"}
                  onClick={() => onNav(key)}
                  aria-current={active === key ? "page" : undefined}
                  data-testid={`dash-nav-${key}`}
                >
                  {Icon && <Icon size={16} />}
                  <span>{label}</span>
                  {count > 0 && <b className="dash-count">{count}</b>}
                </button>
              ))}
            </nav>
          </aside>
        )}
        <main className="dash-main">
          <header className="dash-head">
            <div>
              {!nav.length && <div className="eyebrow">{eyebrow}</div>}
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="dash-actions">{actions}</div>}
          </header>
          {children}
        </main>
      </div>
    </>
  );
}

/** A labelled number tile for the overview row. */
export function Stat({ label, value, note, tone }) {
  return (
    <div className={tone ? `dash-stat ${tone}` : "dash-stat"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <small>{note}</small>}
    </div>
  );
}

/** A titled white panel inside a dashboard section. */
export function Panel({ title, actions, children, flush }) {
  return (
    <section className={flush ? "dash-panel flush" : "dash-panel"}>
      {(title || actions) && (
        <div className="dash-panel-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="dash-panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** "Needs attention" list: each item is { text, action?: { label, onClick } }. */
export function Attention({ items }) {
  if (!items.length) return <p className="dash-clear">Nothing needs your attention right now.</p>;
  return (
    <ul className="dash-attention">
      {items.map((it, i) => (
        <li key={i}>
          <span>{it.text}</span>
          {it.action && <button className="link-button" onClick={it.action.onClick}>{it.action.label}</button>}
        </li>
      ))}
    </ul>
  );
}
