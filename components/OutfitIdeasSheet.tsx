'use client'
import { useEffect, useMemo, useState } from 'react'
import Sheet from './Sheet'
import Icon, { AiBadge } from './Icon'
import { useFeedback } from './Feedback'
import { supabase } from '@/lib/supabase'
import { OUTFIT_AESTHETICS, friendlyError } from '@/lib/constants'
import { mixAndMatch, type OutfitIdea } from '@/lib/mixMatch'
import { useAiSettings } from '@/lib/ai/useAi'
import { PROVIDERS, getKey, keyStatus, saveSettings, type ProviderId } from '@/lib/ai/settings'
import { AiError, callProvider } from '@/lib/ai/providers'
import { IDEAS_SYSTEM_PROMPT, buildIdeasPrompt, manualIdeasPrompt, parseIdeas, type AiIdea } from '@/lib/ai/ideas'
import type { Section, StyleProfile, Trip, WardrobeItem } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  profile: StyleProfile
  trip: Trip
  section: Section | null
  dayLabel: string
  items: WardrobeItem[]
  urls: Record<string, string>
  onSaved: () => void
}

type Idea = OutfitIdea & Partial<Pick<AiIdea, 'footwear' | 'accessories' | 'hair'>>
type Stage = 'setup' | 'thinking' | 'manual' | 'results'

/** "Outfit ideas": mixes the wardrobe into new looks for a section. Free mix & match, or with AI. */
export default function OutfitIdeasSheet({ open, onClose, profile, trip, section, dayLabel, items, urls, onSaved }: Props) {
  const settings = useAiSettings()
  const { ask: askDialog, confirm, toast } = useFeedback()
  const [stage, setStage] = useState<Stage>('setup')
  const [occasion, setOccasion] = useState('')
  const [aesthetic, setAesthetic] = useState('')
  const [note, setNote] = useState('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [source, setSource] = useState<'mix' | 'ai'>('mix')
  const [seed, setSeed] = useState(1)
  const [error, setError] = useState('')
  const [savedIdx, setSavedIdx] = useState<number[]>([])
  const [savingIdx, setSavingIdx] = useState<number | null>(null)
  const [manual, setManual] = useState<{ prompt: string; codes: ReturnType<typeof buildIdeasPrompt>['codes'] } | null>(null)
  const [pasted, setPasted] = useState('')

  useEffect(() => {
    if (!open) return
    setStage('setup')
    setOccasion(section?.name ?? '')
    setAesthetic('')
    setNote('')
    setIdeas([])
    setError('')
    setSavedIdx([])
    setManual(null)
    setPasted('')
  }, [open, section?.id, section?.name])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const aiOn = !!settings?.enabled
  const provider: ProviderId = settings?.provider ?? 'gemini'
  const providerName = PROVIDERS.find((p) => p.id === provider)?.name ?? 'AI'
  const aiReady = provider === 'manual' || keyStatus(provider) !== 'none'

  function runMix(nextSeed = Date.now()) {
    setSeed(nextSeed)
    const { ideas: out, missing } = mixAndMatch(items, { occasion, aesthetic, styleFor: profile.style_for, count: 4, seed: nextSeed })
    setError(missing ?? '')
    setIdeas(out)
    setSource('mix')
    setSavedIdx([])
    if (out.length) setStage('results')
  }

  async function ensureConsent(p: ProviderId) {
    if (!settings || settings.consent[p]) return true
    const ok = await confirm({
      title: 'Before your first AI request',
      message:
        p === 'manual'
          ? 'You’ll copy a prompt with a text list of your wardrobe into your own Claude or ChatGPT app. That app keeps it in your chat history.'
          : `A text list of your wardrobe (names, types, colours and tags, no photos) will be sent to ${providerName}.${p === 'gemini' ? ' On Google’s free tier, Google may use it to improve its models.' : ''}`,
      confirmText: 'I understand',
    })
    if (ok) saveSettings({ ...settings, consent: { ...settings.consent, [p]: true } })
    return ok
  }

  async function runAi() {
    if (!settings || !items.length) return
    if (!(await ensureConsent(provider))) return
    setError('')
    const prompt = buildIdeasPrompt({
      styleFor: profile.style_for,
      occasion,
      sectionKind: section?.kind ?? 'event',
      aesthetic,
      note,
      tripName: trip.name,
      destination: trip.destination,
      dayLabel,
      wardrobe: items,
    })
    if (provider === 'manual') {
      setManual({ prompt: manualIdeasPrompt(prompt.text), codes: prompt.codes })
      setStage('manual')
      return
    }
    setStage('thinking')
    try {
      const key = await getKey(provider, () =>
        askDialog({ title: 'Unlock your API key', label: 'PIN', secret: true, inputMode: 'numeric', confirmText: 'Unlock' }),
      )
      if (!key) {
        setStage('setup')
        return setError(`No ${providerName} key is set up on this device yet.`)
      }
      const out = await callProvider(provider, key, settings.models[provider], IDEAS_SYSTEM_PROMPT, prompt.text, [])
      setIdeas(parseIdeas(out.text, prompt.codes))
      setSource('ai')
      setSavedIdx([])
      setStage('results')
    } catch (e) {
      setStage('setup')
      const quota = e instanceof AiError && e.code === 'quota'
      setError(
        quota
          ? `${(e as Error).message} ${provider === 'gemini' ? 'The free limit resets around 12:30 to 1:30 PM India time.' : ''} Try Mix & match meanwhile, or use your Claude or ChatGPT app (AI settings → My chat app).`
          : friendlyError(e),
      )
    }
  }

  function readPasted() {
    if (!manual) return
    try {
      setIdeas(parseIdeas(pasted, manual.codes))
      setSource('ai')
      setSavedIdx([])
      setStage('results')
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function save(idea: Idea, idx: number) {
    if (!section) return
    setSavingIdx(idx)
    try {
      const sb = supabase()
      const { data, error } = await sb
        .from('outfits')
        .insert({
          trip_id: trip.id,
          section_id: section.id,
          title: idea.title.slice(0, 60),
          aesthetic: aesthetic ? aesthetic.slice(0, 40) : null,
          footwear: idea.footwear ? idea.footwear.slice(0, 200) : null,
          accessories: idea.accessories ? idea.accessories.slice(0, 300) : null,
          hairstyle: idea.hair ? idea.hair.slice(0, 200) : null,
          notes: idea.why ? idea.why.slice(0, 1000) : null,
          ai_generated: source === 'ai',
        })
        .select('id')
        .single()
      if (error) throw error
      const ids = idea.itemIds.filter((id) => byId.has(id)).slice(0, 12)
      if (ids.length) {
        const { error: e2 } = await sb.from('outfit_items').insert(ids.map((item_id, position) => ({ outfit_id: data.id, item_id, position })))
        if (e2) throw e2
      }
      setSavedIdx((s) => [...s, idx])
      toast(`Saved to ${section.name}`)
      onSaved()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setSavingIdx(null)
    }
  }

  const footer =
    stage === 'setup' ? (
      <>
        <button className="btn" onClick={() => runMix()} disabled={!items.length}><Icon name="wand" /> Mix &amp; match</button>
        {aiOn && (
          <button className="btn ai primary" onClick={runAi} disabled={!items.length || !aiReady}>
            <Icon name="sparkle" /> Ideas with AI
          </button>
        )}
      </>
    ) : stage === 'results' ? (
      <>
        <button className="btn ghost" onClick={() => setStage('setup')} style={{ marginRight: 'auto' }}><Icon name="left" /> Change</button>
        {source === 'mix' ? (
          <button className="btn" onClick={() => runMix(seed + 7919)}><Icon name="wand" /> Shuffle</button>
        ) : (
          <button className="btn ai" onClick={runAi}><Icon name="sparkle" /> More ideas</button>
        )}
        <button className="btn primary" onClick={onClose}>Done</button>
      </>
    ) : stage === 'manual' ? (
      <>
        <button className="btn ghost" onClick={() => setStage('setup')} style={{ marginRight: 'auto' }}><Icon name="left" /> Back</button>
        <button className="btn primary" onClick={readPasted} disabled={!pasted.trim()}>Read the reply</button>
      </>
    ) : undefined

  return (
    <Sheet open={open} onClose={onClose} title={section ? `Outfit ideas for ${section.name}` : 'Outfit ideas'} footer={footer}>
      {stage === 'setup' && (
        <div className="stack">
          <p className="muted small">New looks mixed from your own wardrobe. Save the ones you like as options for this section.</p>
          {!items.length && <p className="alert"><Icon name="alert" /> Add some pieces to your wardrobe first.</p>}
          <label className="field">
            <span>Occasion or event</span>
            <input className="input" value={occasion} maxLength={60} onChange={(e) => setOccasion(e.target.value)} placeholder="Pool party, dinner date, sightseeing…" />
          </label>
          <div className="field">
            <span>Aesthetic</span>
            <div className="chips">
              {OUTFIT_AESTHETICS.map((a) => (
                <button key={a} type="button" className="chip" aria-pressed={aesthetic === a} onClick={() => setAesthetic(aesthetic === a ? '' : a)}>
                  {a}
                </button>
              ))}
            </div>
            <input className="input" value={OUTFIT_AESTHETICS.includes(aesthetic) ? '' : aesthetic} maxLength={40} onChange={(e) => setAesthetic(e.target.value)} placeholder="Or type your own vibe" style={{ marginTop: '0.5rem' }} />
          </div>
          {aiOn && (
            <label className="field">
              <span>Anything else? <small className="muted">(for AI)</small></span>
              <input className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="It might rain, I want to wear my new heels…" />
            </label>
          )}
          <div className="ideas-help small muted">
            <p><strong>Mix &amp; match</strong> is free and instant. It works on this phone and combines pieces by type, colour, name and tags.</p>
            {aiOn && (
              <p>
                <AiBadge /> <strong>Ideas with AI</strong> asks {providerName}, sending a text list of your wardrobe (no photos).
                {!aiReady && <> <a href="/settings/ai">Set up a key</a> first.</>}
              </p>
            )}
          </div>
          {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
        </div>
      )}

      {stage === 'thinking' && (
        <div className="ai-thinking" aria-live="polite">
          <div className="ai-orb"><Icon name="sparkle" /></div>
          <strong>Mixing your wardrobe…</strong>
          <span className="muted small">Asking {providerName}</span>
        </div>
      )}

      {stage === 'manual' && manual && (
        <div className="stack">
          <p className="muted">Use your own Claude or ChatGPT app. Nothing is charged here; it uses your subscription.</p>
          <ol className="steps">
            <li>
              <strong>Copy the prompt.</strong>{' '}
              <button className="btn small" onClick={async () => { await navigator.clipboard.writeText(manual.prompt); toast('Prompt copied') }}><Icon name="copy" /> Copy prompt</button>
            </li>
            <li>
              <strong>Open your app, paste and send.</strong>{' '}
              <span className="row" style={{ display: 'inline-flex' }}>
                <a className="btn small" href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">Claude <Icon name="link" /></a>
                <a className="btn small" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT <Icon name="link" /></a>
              </span>
            </li>
            <li><strong>Copy the whole reply</strong> and paste it below.</li>
          </ol>
          <label className="field">
            <span>The reply</span>
            <textarea className="textarea" style={{ minHeight: 140 }} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='Paste the reply here. It starts with { "outfits": …' />
          </label>
          {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
        </div>
      )}

      {stage === 'results' && (
        <div className="stack">
          {source === 'ai' && <p className="small"><AiBadge text="AI ideas" /> Made from your wardrobe. Check they suit you before saving.</p>}
          {ideas.map((idea, idx) => {
            const pieces = idea.itemIds.map((id) => byId.get(id)).filter((x): x is WardrobeItem => !!x)
            const saved = savedIdx.includes(idx)
            return (
              <article key={`${seed}-${idx}`} className={`idea-card ${source === 'ai' ? 'ai-panel' : ''}`} style={{ ['--i' as string]: idx }}>
                <div className="idea-head">
                  <h3>{idea.title}</h3>
                  <button className={`btn small ${saved ? '' : 'primary'}`} onClick={() => save(idea, idx)} disabled={saved || savingIdx !== null}>
                    {saved ? <><Icon name="check" /> Saved</> : savingIdx === idx ? <><span className="spinner" aria-hidden /> Saving</> : 'Save look'}
                  </button>
                </div>
                <div className="idea-pieces">
                  {pieces.map((p) => (
                    <figure key={p.id}>
                      <span className="pic">{urls[p.image_path] ? <img src={urls[p.image_path]} alt="" loading="lazy" decoding="async" /> : null}</span>
                      <figcaption>{p.name}</figcaption>
                    </figure>
                  ))}
                </div>
                {idea.why && <p className="small">{idea.why}</p>}
                {(idea.footwear || idea.accessories || idea.hair) && (
                  <ul className="idea-tips small muted">
                    {idea.footwear && <li><strong>Shoes:</strong> {idea.footwear}</li>}
                    {idea.accessories && <li><strong>Accessories:</strong> {idea.accessories}</li>}
                    {idea.hair && <li><strong>Hair:</strong> {idea.hair}</li>}
                  </ul>
                )}
              </article>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
