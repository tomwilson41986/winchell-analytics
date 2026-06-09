import './Tabs.css'

export interface TabDef {
  id: string
  label: string
}

interface TabsProps {
  tabs: TabDef[]
  active: string
  onChange: (id: string) => void
}

/** Accessible tab strip (controlled). Pair with panels rendered by the parent. */
export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label="Report sections">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={active === t.id}
          className={`tabs__tab${active === t.id ? ' is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
