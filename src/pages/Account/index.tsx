import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../lib/auth'
import {
  disablePush,
  enablePush,
  getPushStatus,
  type PushStatus,
} from '../../lib/pushNotifications'
import { accountsEnabled } from '../../lib/supabaseClient'
import '../page.css'
import './Account.css'

export default function Account() {
  const { user, loading, signIn, signOut } = useAuth()

  return (
    <div className="page">
      <PageHeader
        eyebrow="Profile"
        title="Account"
        icon="user"
        intro="Sign in to keep your sale and sire subscriptions on your profile and receive push notifications when watched sires get new entries or a subscribed sale goes live."
      />

      {!accountsEnabled ? (
        <section className="section">
          <p className="page__note-block">
            Accounts are not configured on this deployment. Subscriptions made on the{' '}
            <Link to="/sales/live">Live Sales</Link> page still work, but they stay in
            this browser only. To enable accounts, create a Supabase project, apply{' '}
            <code>supabase/schema.sql</code> and set <code>VITE_SUPABASE_URL</code>,{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> and <code>VITE_VAPID_PUBLIC_KEY</code> —
            see the README.
          </p>
        </section>
      ) : loading ? (
        <section className="section">
          <p className="account__quiet">Restoring your session…</p>
        </section>
      ) : user ? (
        <SignedIn email={user.email ?? ''} userId={user.id} onSignOut={signOut} />
      ) : (
        <SignInForm onSignIn={signIn} />
      )}
    </div>
  )
}

function SignInForm({ onSignIn }: { onSignIn: (email: string) => Promise<string | null> }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await onSignIn(email.trim())
    setBusy(false)
    if (err) setError(err)
    else setSent(true)
  }

  return (
    <section className="section" aria-label="Sign in">
      <div className="account-card">
        <h2 className="section__title">Sign in</h2>
        <p className="account__quiet">
          No password needed — we email you a one-time sign-in link.
        </p>
        {sent ? (
          <p className="page__note-block">
            Check <strong>{email}</strong> for your sign-in link. You can close this tab.
          </p>
        ) : (
          <form className="account-form" onSubmit={submit}>
            <input
              className="account-form__input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <button className="btn-export" type="submit" disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Email me a link'}
            </button>
          </form>
        )}
        {error && <p className="account__error">{error}</p>}
      </div>
    </section>
  )
}

function SignedIn({
  email,
  userId,
  onSignOut,
}: {
  email: string
  userId: string
  onSignOut: () => Promise<void>
}) {
  const [push, setPush] = useState<PushStatus>('disabled')
  const [busy, setBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  useEffect(() => {
    void getPushStatus().then(setPush)
  }, [])

  const togglePush = async () => {
    setBusy(true)
    setPushError(null)
    try {
      setPush(push === 'enabled' ? await disablePush() : await enablePush(userId))
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Could not update push settings.')
    } finally {
      setBusy(false)
    }
  }

  const pushNote: Record<PushStatus, string> = {
    enabled: 'This device will receive notifications from the daily sales sweep.',
    disabled: 'Enable to get notified on this device, even when the site is closed.',
    denied:
      'Notifications are blocked for this site in your browser settings — allow them, then try again.',
    unsupported:
      'This browser does not support Web Push. On iPhone/iPad, add the site to your Home Screen first.',
    unconfigured:
      'Push is not configured on this deployment (missing VAPID key) — see the README.',
  }

  return (
    <>
      <section className="section" aria-label="Profile">
        <div className="account-card">
          <h2 className="section__title">Signed in</h2>
          <p className="account__identity">
            <Icon name="user" size={18} /> {email}
          </p>
          <p className="account__quiet">
            Subscriptions you make on <Link to="/sales/live">Live Sales</Link> are saved to
            this profile and follow you across devices.
          </p>
          <button className="btn-export" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
      </section>

      <section className="section" aria-label="Push notifications">
        <div className="account-card">
          <h2 className="section__title">
            <Icon name="bell" size={17} /> Push notifications
          </h2>
          <p className="account__quiet">{pushNote[push]}</p>
          {(push === 'enabled' || push === 'disabled') && (
            <button className="btn-export" onClick={() => void togglePush()} disabled={busy}>
              {busy ? 'Working…' : push === 'enabled' ? 'Disable on this device' : 'Enable on this device'}
            </button>
          )}
          {pushError && <p className="account__error">{pushError}</p>}
          <p className="account__fineprint">
            Notifications are sent by the daily sales sweep (~06:00 UK time): new entries by
            your watched sires and damsires, catalogues publishing, and subscribed sales
            going active. Enable on each device you want notified.
          </p>
        </div>
      </section>
    </>
  )
}
