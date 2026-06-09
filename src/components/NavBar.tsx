import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import Logo from './Logo'
import './NavBar.css'

interface NavItem {
  to: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/horses', label: 'Horses' },
  { to: '/sales', label: 'Sales' },
  { to: '/sires', label: 'Sires' },
  { to: '/broodmares', label: 'Broodmares' },
]

export default function NavBar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Logo />

        <button
          className="navbar__toggle"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          className={`navbar__links${open ? ' navbar__links--open' : ''}`}
          onClick={() => setOpen(false)}
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `navbar__link${isActive ? ' navbar__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
