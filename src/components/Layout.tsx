import { Link, Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import './Layout.css'

const FOOTER_LINKS = [
  { to: '/horses', label: 'Horses' },
  { to: '/sales/live', label: 'Live Sales' },
  { to: '/sales/historic', label: 'Historic Sales' },
  { to: '/sires', label: 'Sires' },
  { to: '/broodmares', label: 'Broodmares' },
  { to: '/broodmares/japan-prospects', label: 'Japan Prospects' },
]

export default function Layout() {
  return (
    <div className="layout">
      <NavBar />
      <main className="layout__main">
        <Outlet />
      </main>

      <footer className="layout__footer">
        <div className="layout__footer-inner">
          <div className="layout__footer-brand">
            <span className="layout__footer-name">Winchell Analytics</span>
            <p className="layout__footer-tag">
              Thoroughbred racing data &amp; analysis.
            </p>
          </div>

          <nav className="layout__footer-nav" aria-label="Footer">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.to} to={l.to}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="layout__footer-base">
          <span>© {new Date().getFullYear()} Winchell Analytics</span>
          <span>Built for the Winchell Thoroughbreds programme</span>
        </div>
      </footer>
    </div>
  )
}
