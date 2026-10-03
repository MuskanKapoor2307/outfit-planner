'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RequireAuth } from '@/lib/auth'
import { useAiSettings } from '@/lib/ai/useAi'
import {
  DEFAULT_MODELS, PROVIDERS, keyMode, keyStatus, removeAllKeys, removeKey, requestsToday, saveKey, saveSettings,
  type KeyMode, type KeyProvider, type ProviderId,
} from '@/lib/ai/settings'
import { callProvider } from '@/lib/ai/providers'
import { getKey } from '@/lib/ai/settings'
import { useFeedback } from '@/components/Feedback'
import Icon, { AiBadge } from '@/components/Icon'
import PasswordInput from '@/components/PasswordInput'

const GUIDES: Record<KeyProvider, { url: string; steps: string[] }> = {
  gemini: {
    url: 'https://aistudio.google.com/apikey',
    steps: ['Open Google AI Studio and sign in with a Google account.', 'Click “Create API key”. No card is needed.', 'Copy the key and paste it below.'],
  },
  claude: {
    url: 'https://platform.claude.com/settings/keys',
    steps: ['Open the Claude Console (separate from a Claude Pro subscription).', 'Add prepaid credits and set a monthly spend limit.', 'Create a key just for this app and paste it below.'],
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    steps: ['Open the OpenAI platform (separate from ChatGPT Plus).', 'Add prepaid credits and set a usage limit.', 'Create a key just for this app and paste it below.'],
  },
}

function AiSettingsPage() {
  const s = useAiSettings()
  const { confirm, ask, toast } = useFeedback()
  const [selected, setSelected] = useState<ProviderId>('gemini')
  const [key, setKey] = useState('')
  const [mode, setMode] = useState<KeyMode>('device')
  const [pin, setPin] = useState('')
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState('')
  const [, force] = useState(0)

  useEffect(() => {
    if (s) setSelected(s.provider)
  }, [s?.provider]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!s || selected === 'manual') return
    setModel(s.models[selected])
    setKey('')
    setPin('')
    setMode(keyMode(selected) ?? 'device')
  }, [selected, s])

  if (!s) return null
  const isKey = selected !== 'manual'
  const status = isKey ? keyStatus(selected as KeyProvider) : 'ready'

  function choose(p: ProviderId) {
    setSelected(p)
    saveSettings({ ...s!, provider: p })
  }

  async function save() {
    if (!isKey) return
    const p = selected as KeyProvider
    setBusy('save')
    try {
      if (key.trim()) await saveKey(p, key, mode, pin)
      if (model.trim() && model.trim() !== s!.models[p]) saveSettings({ ...s!, models: { ...s!.models, [p]: model.trim() } })
      setKey('')
      setPin('')
      toast('AI settings saved')
      force((n) => n + 1)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  async function test() {
    const p = selected as KeyProvider
    setBusy('test')
    try {
      const k = await getKey(p, () => ask({ title: 'Unlock your API key', label: 'PIN', secret: true, inputMode: 'numeric', confirmText: 'Unlock' }))
      if (!k) throw new Error('No key saved yet.')
      await callProvider(p, k, s!.models[p], 'Reply with JSON only.', 'Reply with {"ok": true}', [])
      toast('The key works')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy('')
      force((n) => n + 1)
    }
  }

  async function remove() {
    const p = selected as KeyProvider
    const ok = await confirm({ title: 'Remove this key from this device?', message: 'You can paste it again any time. To fully cancel it, also delete it on the provider’s website.', confirmText: 'Remove key', danger: true })
    if (!ok) return
    removeKey(p)
    toast('Key removed')
    force((n) => n + 1)
  }

  return (
    <div className="wrap">
      <div className="sheet-page">
      <header className="topbar">
        <Link href="/" className="back"><Icon name="left" /> Back</Link>
      </header>
      <main className="page-enter stack" style={{ ['--gap' as string]: '1.4rem', maxWidth: 760 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>
          <h1>AI settings</h1>
          <p className="muted">These settings and keys are saved only on this device. They are never sent to the app’s database.</p>
        </div>

        <div className="card">
          <label className="switch">
            <span className="label">
              <strong>Show AI features</strong>
              <span className="hint">Turn off to use the app only as a planner and organiser. Everything else keeps working.</span>
            </span>
            <input type="checkbox" checked={s.enabled} onChange={(e) => saveSettings({ ...s, enabled: e.target.checked })} />
          </label>
        </div>

        {s.enabled && (
          <>
            <div className="stack" style={{ ['--gap' as string]: '0.6rem' }}>
              <h2 className="row">Default AI <AiBadge text="Uses AI" /></h2>
              <div className="provider-grid" role="radiogroup" aria-label="Default AI">
                {PROVIDERS.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={selected === p.id} className="provider" onClick={() => choose(p.id)}>
                    <strong>{p.name} <span className="badge">{p.cost}</span></strong>
                    <span>{p.blurb}</span>
                    {p.id !== 'manual' && (
                      <span>
                        {keyStatus(p.id as KeyProvider) === 'none' ? 'No key yet' : keyStatus(p.id as KeyProvider) === 'locked' ? 'Key saved, PIN-locked' : 'Key saved'}
                        {requestsToday(p.id) ? `, ${requestsToday(p.id)} requests today` : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {isKey ? (
              <div className="card stack">
                <h3>{PROVIDERS.find((p) => p.id === selected)!.name} key</h3>
                <ol className="steps">
                  {GUIDES[selected as KeyProvider].steps.map((st) => <li key={st}>{st}</li>)}
                </ol>
                <a className="btn small" href={GUIDES[selected as KeyProvider].url} target="_blank" rel="noopener noreferrer" style={{ width: 'fit-content' }}>
                  Open the key page <Icon name="link" />
                </a>
                <label className="field">
                  <span>{status === 'none' ? 'Paste your API key' : 'Replace the saved key (optional)'}</span>
                  <PasswordInput value={key} onChange={setKey} autoComplete="off" />
                </label>
                <div className="field">
                  <span>Keep the key</span>
                  <div className="segmented" role="group" aria-label="Keep the key">
                    <button type="button" aria-pressed={mode === 'device'} onClick={() => setMode('device')}>On this device</button>
                    <button type="button" aria-pressed={mode === 'pin'} onClick={() => setMode('pin')}><Icon name="lock" /> With a PIN</button>
                    <button type="button" aria-pressed={mode === 'session'} onClick={() => setMode('session')}>Until I close the tab</button>
                  </div>
                  {mode === 'pin' && key && (
                    <label className="field" style={{ marginTop: '0.5rem' }}>
                      <span>Choose a PIN (4 or more digits)</span>
                      <PasswordInput value={pin} onChange={setPin} inputMode="numeric" autoComplete="off" />
                      <small>You’ll type it once each time you open the app. If you forget it, just paste the key again.</small>
                    </label>
                  )}
                </div>
                <label className="field">
                  <span>Model</span>
                  <input className="input" value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
                  <small>
                    Default: {DEFAULT_MODELS[selected as KeyProvider]}.
                    {selected === 'gemini' ? ' When its free limit runs out, the app automatically tries the lighter Flash-Lite model.' : ' Change it if the provider renames its models.'}
                  </small>
                </label>
                <div className="row">
                  <button className="btn primary" onClick={save} disabled={!!busy}>{busy === 'save' ? <><span className="spinner" aria-hidden /> Saving</> : 'Save'}</button>
                  {status !== 'none' && <button className="btn ai" onClick={test} disabled={!!busy}>{busy === 'test' ? <><span className="spinner" aria-hidden /> Testing</> : <><Icon name="sparkle" /> Test key (1 request)</>}</button>}
                  {status !== 'none' && <button className="btn danger" onClick={remove}>Remove key</button>}
                </div>
              </div>
            ) : (
              <div className="card stack">
                <h3>Using your Claude or ChatGPT subscription</h3>
                <p className="muted">
                  Subscriptions don’t come with API keys, so the app can’t connect to them directly. Instead, when you ask for styling ideas, the app prepares a prompt and your photos.
                  You paste them into your Claude or ChatGPT app, then paste the reply back. It takes a few taps and costs nothing extra.
                </p>
                <p className="muted small">Your photos and outfit details will be in that app’s chat history. Check its setting for whether chats are used to train models.</p>
              </div>
            )}

            <div className="card stack">
              <h3 className="row"><Icon name="shield" /> Keeping keys safe</h3>
              <ol className="steps">
                <li>Make a separate key just for this app, so you can cancel it without affecting anything else.</li>
                <li>For Claude and OpenAI, use prepaid credits and a monthly limit, so a leaked key can’t run up a big bill.</li>
                <li>On a shared computer, choose “Until I close the tab”, or use a PIN.</li>
                <li>If you think a key leaked, delete it on the provider’s website straight away.</li>
              </ol>
              <button
                className="btn danger"
                style={{ width: 'fit-content' }}
                onClick={async () => {
                  if (await confirm({ title: 'Remove all AI keys from this device?', confirmText: 'Remove all', danger: true })) {
                    removeAllKeys()
                    toast('All keys removed from this device')
                    force((n) => n + 1)
                  }
                }}
              >
                Remove all keys from this device
              </button>
            </div>
          </>
        )}
      </main>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <RequireAuth>
      <AiSettingsPage />
    </RequireAuth>
  )
}
