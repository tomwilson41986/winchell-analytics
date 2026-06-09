import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import './Layout.css'

export default function Layout() {
  return (
    <div className="layout">
      <NavBar />
      <main className="layout__main">
        <Outlet />
      </main>
      <footer className="layout__footer">
        <div className="layout__footer-inner">
          <span>Winchell Analytics</span>
          <span className="layout__footer-muted">
            Thoroughbred racing data &amp; analysis
          </span>
        </div>
      </footer>
    </div>
  )
}
