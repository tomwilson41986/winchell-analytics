import { Link } from 'react-router-dom'
import './Logo.css'

/**
 * Brand mark for Winchell Analytics.
 * Displays the provided silks image (public/winchell-silks.png) alongside the
 * wordmark. The image is the official brand asset — do not swap it for a
 * generated graphic.
 */
export default function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Winchell Analytics — home">
      <img
        className="logo__mark"
        src="/winchell-silks.png"
        alt="Winchell Thoroughbreds silks"
        height={40}
        width="auto"
      />
      <span className="logo__word">Winchell Analytics</span>
    </Link>
  )
}
