'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sheet from './Sheet'
import Icon, { AiBadge } from './Icon'
import ItemGrid from './ItemGrid'
import ItemSheet from './ItemSheet'
import { useFeedback } from './Feedback'
import { supabase } from '@/lib/supabase'
import { getSignedUrls } from '@/lib/signedUrls'
import { CATEGORIES, OUTFIT_AESTHETICS, friendlyError } from '@/lib/constants'
import { useAiSettings } from '@/lib/ai/useAi'
import { PROVIDERS, getKey, keyStatus, saveSettings, type ProviderId } from '@/lib/ai/settings'
import { AiError, callProvider, type AiImage } from '@/lib/ai/providers'
import { ASKS, SYSTEM_PROMPT, buildPrompt, manualPrompt, parseResult, pinterestUrl, type AskType, type StylistResult } from '@/lib/ai/stylist'
import { toAiImage } from '@/lib/ai/images'
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
  onItemsChanged: () => void
  onSaved: () => void
}

const THINKING = ['Looking at your pieces', 'Checking the occasion', 'Pairing colours', 'Picking footwear', 'Adding finishing touches']
const MAX_PIECES = 6

type Stage = 'setup' | 'thinking' | 'manual' | 'result'

export default function AiStylistSheet({ open, onClose, profile, trip, section, dayLabel, items, urls, onItemsChanged, onSaved }: Props) {
  const settings = useAiSettings()
  const { ask: askDialog, confirm, toast } = useFeedback()
  const [stage, setStage] = useState<Stage>('setup')
  const [provider, setProvider] = useState<ProviderId>('gemini')
  const [pieces, setPieces] = useState<string[]>([])
  const [choosing, setChoosing] = useState(false)
  const [filter, setFilter] = useState('all')
  const [askType, setAskType] = useState<AskType>('complete')
  const [customAsk, setCustomAsk] = useState('')
  const [aesthetic, setAesthetic] = useState('')
  const [note, setNote] = useState('')
  const [preferOwned, setPreferOwned] = useState(true)
  const [result, setResult] = useState<StylistResult | null>(null)
  const [modelUsed, setModelUsed] = useState('')
  const [error, setError] = useState<{ text: string; quota?: boolean } | null>(null)
  const [thinkingIdx, setThinkingIdx] = useState(0)
  const [addingPiece, setAddingPiece] = useState(false)
  const [manual, setManual] = useState<{ prompt: string; files: File[]; codes: ReturnType<typeof buildPrompt>['pieceCodes'] } | null>(null)
  const [pasted, setPasted] = useState('')
  const [saving, setSaving] = useState(false)
  const [addedToList, setAddedToList] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setStage('setup')
    setPieces([])
    setChoosing(false)
    setAskType('complete')
    setCustomAsk('')
    setAesthetic('')
    setNote('')
    setResult(null)
    setError(null)
    setManual(null)
    setPasted('')
    setAddedToList([])
  }, [open, section?.id])

  useEffect(() => {
    if (settings) setProvider(settings.provider)
  }, [settings])

  useEffect(() => {
    if (stage !== 'thinking') return
    const t = setInterval(() => setThinkingIdx((i) => (i + 1) % THINKING.length), 1600)
    return () => clearInterval(t)
  }, [stage])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const usedCats = new Set(items.map((i) => i.category))
  const visible = filter === 'all' ? items : items.filter((i) => i.category === filter)
  const providerInfo = PROVIDERS.find((p) => p.id === provider)!
  const status = provider === 'manual' ? 'ready' : keyStatus(provider)

  function togglePiece(it: WardrobeItem) {
    setPieces((p) => (p.includes(it.id) ? p.filter((x) => x !== it.id) : p.length >= MAX_PIECES ? p : [...p, it.id]))
  }

  async function ensureConsent(p: ProviderId) {
    if (!settings || settings.consent[p]) return true
    const ok = await confirm({
      title: 'Before your first AI request',
      message:
        p === 'manual'
          ? 'You’ll copy a prompt (and your photos) into your own Claude or ChatGPT app. Those apps keep them in your chat history.'
          : `The selected photos and a text list of your wardrobe will be sent to ${PROVIDERS.find((x) => x.id === p)!.name}. ${
              p === 'gemini' ? 'On Google’s free tier, Google may use them to improve its models. Avoid photos with faces or private details.' : 'Avoid photos with faces or private details.'
            }`,
      confirmText: 'I understand',
    })
    if (ok) saveSettings({ ...settings, consent: { ...settings.consent, [p]: true } })
    return ok
  }

  async function prepare() {
    const chosen = pieces.map((id) => byId.get(id)).filter(Boolean) as WardrobeItem[]
    const prompt = buildPrompt({
      ask: askType,
      customAsk,
      styleFor: profile.style_for,
      aesthetic,
      note,
      tripName: trip.name,
      destination: trip.destination,
      dayLabel,
      sectionName: section?.name ?? 'Any time',
      sectionKind: section?.kind ?? 'time',
      pieces: chosen,
      wardrobe: preferOwned ? items : [],
    })
    const missing = chosen.filter((c) => !urls[c.image_path]).map((c) => c.image_path)
    const fresh = missing.length ? await getSignedUrls(missing) : {}
    const imgs: { ai: AiImage; blob: Blob; name: string }[] = []
    for (const [i, c] of chosen.entries()) {
      const r = await toAiImage(urls[c.image_path] || fresh[c.image_path])
      imgs.push({ ...r, name: `P${i + 1}-${c.name.replace(/[^\w-]+/g, '-').slice(0, 30)}.jpg` })
    }
    return { prompt, imgs }
  }

  async function run(useProvider: ProviderId = provider) {
    if (askType === 'custom' && !customAsk.trim()) return setError({ text: 'Type what you want to ask.' })
    if (!(await ensureConsent(useProvider))) return
    setError(null)
    setThinkingIdx(0)
    setStage('thinking')
    try {
      const { prompt, imgs } = await prepare()
      if (useProvider === 'manual') {
        setManual({
          prompt: manualPrompt(prompt.text, imgs.length),
          files: imgs.map((i) => new File([i.blob], i.name, { type: 'image/jpeg' })),
          codes: [...prompt.pieceCodes, ...prompt.wardrobeCodes],
        })
        setStage('manual')
        return
      }
      const key = await getKey(useProvider, () =>
        askDialog({ title: 'Unlock your API key', label: 'PIN', secret: true, inputMode: 'numeric', confirmText: 'Unlock' }),
      )
      if (!key) {
        setStage('setup')
        return setError({ text: `No ${PROVIDERS.find((p) => p.id === useProvider)!.name} key is set up on this device yet.` })
      }
      const model = settings!.models[useProvider]
      const out = await callProvider(useProvider, key, model, SYSTEM_PROMPT, prompt.text, imgs.map((i) => i.ai))
      setResult(parseResult(out.text, [...prompt.pieceCodes, ...prompt.wardrobeCodes]))
      setModelUsed(out.model)
      setStage('result')
    } catch (e) {
      setStage('setup')
      const quota = e instanceof AiError && e.code === 'quota'
      setError({
        text: quota
          ? `${(e as Error).message} ${useProvider === 'gemini' ? 'The free limit resets around 12:30 to 1:30 PM India time.' : ''} You can use your Claude or ChatGPT app instead.`
          : friendlyError(e),
        quota,
      })
    }
  }

  function readPasted() {
    if (!manual) return
    try {
      setResult(parseResult(pasted, manual.codes))
      setModelUsed('your chat app')
      setStage('result')
      setError(null)
    } catch (e) {
      setError({ text: (e as Error).message })
    }
  }

  async function sharePhotos() {
    if (!manual) return
    try {
      if (manual.files.length && navigator.canShare?.({ files: manual.files })) {
        await navigator.share({ files: manual.files, text: manual.prompt })
        return
      }
    } catch {
      return // cancelled
    }
    for (const f of manual.files) {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(f)
      a.download = f.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    }
    toast(`${manual.files.length} photo${manual.files.length > 1 ? 's' : ''} downloaded`)
  }

  async function addToList(text: string) {
    const name = text.length > 80 ? text.slice(0, 77) + '…' : text
    const { error } = await supabase().from('shopping_items').insert({ trip_id: trip.id, name, notes: text.length > 80 ? text.slice(0, 500) : null })
    if (error) return toast(friendlyError(error), 'error')
    setAddedToList((l) => [...l, text])
    toast('Added to the trip’s shopping list')
  }

  async function saveLook() {
    if (!result || !section) return
    setSaving(true)
    const join = (xs: string[], max: number) => xs.filter(Boolean).join('; ').slice(0, max) || null
    const notes = [
      result.summary,
      result.layers && `Layer: ${result.layers}`,
      result.colour_palette.length ? `Palette: ${result.colour_palette.join(', ')}` : '',
      result.to_buy.length ? `To buy: ${result.to_buy.join('; ')}` : '',
    ].filter(Boolean).join('\n\n').slice(0, 1000)
    const itemIds = [...new Set([...pieces, ...result.use_from_wardrobe.map((u) => u.itemId)])].slice(0, 12)
    try {
      const sb = supabase()
      const { data, error } = await sb
        .from('outfits')
        .insert({
          trip_id: trip.id,
          section_id: section.id,
          title: result.look_name.slice(0, 60),
          aesthetic: aesthetic ? aesthetic.slice(0, 40) : null,
          footwear: result.footwear ? result.footwear.slice(0, 200) : null,
          accessories: join([result.jewellery, result.bag, result.accessories], 300),
          hairstyle: join([result.hair, result.makeup_or_grooming], 200),
          notes: notes || null,
          ai_generated: true,
        })
        .select('id')
        .single()
      if (error) throw error
      if (itemIds.length) {
        const { error: e2 } = await sb.from('outfit_items').insert(itemIds.map((item_id, position) => ({ outfit_id: data.id, item_id, position })))
        if (e2) throw e2
      }
      toast(`Saved to ${section.name}`)
      onSaved()
      onClose()
    } catch (e) {
      setError({ text: friendlyError(e) })
    } finally {
      setSaving(false)
    }
  }

  const aiOff = settings && !settings.enabled

  const footer =
    stage === 'setup' && !aiOff ? (
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn ai primary" onClick={() => run()} disabled={status === 'none'}>
          <Icon name="sparkle" /> Get styling ideas
        </button>
      </>
    ) : stage === 'result' ? (
      <>
        <button className="btn ghost" onClick={() => setStage('setup')} style={{ marginRight: 'auto' }}><Icon name="left" /> Change request</button>
        <button className="btn ai" onClick={() => run()}><Icon name="sparkle" /> Try again</button>
        <button className="btn primary" onClick={saveLook} disabled={saving}>{saving ? <><span className="spinner" aria-hidden /> Saving</> : 'Save as a look'}</button>
      </>
    ) : stage === 'manual' ? (
      <>
        <button className="btn ghost" onClick={() => setStage('setup')} style={{ marginRight: 'auto' }}><Icon name="left" /> Back</button>
        <button className="btn primary" onClick={readPasted} disabled={!pasted.trim()}>Read the reply</button>
      </>
    ) : undefined

  return (
    <>
      <Sheet open={open} onClose={onClose} title={<>Style with AI <AiBadge text="Uses AI" /></>} footer={footer}>
        {aiOff ? (
          <div className="empty-state">
            <p>AI features are turned off on this device.</p>
            <Link className="btn" href="/settings/ai">Open AI settings</Link>
          </div>
        ) : stage === 'thinking' ? (
          <div className="ai-thinking" aria-live="polite">
            <div className="ai-orb"><Icon name="sparkle" /></div>
            <strong>{THINKING[thinkingIdx]}…</strong>
            <span className="muted small">{provider === 'manual' ? 'Preparing your prompt and photos' : `Asking ${providerInfo.name}`}</span>
          </div>
        ) : stage === 'manual' && manual ? (
          <div className="stack" style={{ ['--gap' as string]: '1.1rem' }}>
            <p className="muted">Use your own Claude or ChatGPT app. Nothing is charged here; it uses your subscription.</p>
            <ol className="steps">
              <li>
                <strong>Copy the prompt.</strong>{' '}
                <button className="btn small" onClick={async () => { await navigator.clipboard.writeText(manual.prompt); toast('Prompt copied') }}><Icon name="copy" /> Copy prompt</button>
              </li>
              {manual.files.length > 0 && (
                <li>
                  <strong>Add the {manual.files.length} photo{manual.files.length > 1 ? 's' : ''}</strong> (in order, P1 first).{' '}
                  <button className="btn small" onClick={sharePhotos}><Icon name="share" /> Share or download photos</button>
                </li>
              )}
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
              <textarea className="textarea" style={{ minHeight: 140 }} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='Paste the reply here. It starts with { "look_name": …' />
            </label>
            {error && <p className="alert error" role="alert"><Icon name="alert" /> {error.text}</p>}
          </div>
        ) : stage === 'result' && result ? (
          <div className="result">
            <div className="stack" style={{ ['--gap' as string]: '0.4rem' }}>
              <h3>{result.look_name}</h3>
              {result.summary && <p>{result.summary}</p>}
              <span className="ai-note"><Icon name="sparkle" /> Idea from {modelUsed}. Check sizes, fabrics and weather yourself.</span>
            </div>
            {(pieces.length > 0 || result.use_from_wardrobe.length > 0) && (
              <div className="stack" style={{ ['--gap' as string]: '0.5rem' }}>
                <strong className="small">Pieces in this look</strong>
                <div className="piece-row">
                  {[...new Set([...pieces, ...result.use_from_wardrobe.map((u) => u.itemId)])].map((id) => {
                    const it = byId.get(id)
                    if (!it) return null
                    const why = result.use_from_wardrobe.find((u) => u.itemId === id)?.why
                    return (
                      <div key={id} className="piece" title={why}>
                        <span className="pic">{urls[it.image_path] && <img src={urls[it.image_path]} alt="" />}</span>
                        <span>{it.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <dl>
              {([
                ['Footwear', result.footwear],
                [profile.style_for === 'men' ? 'Watch and accessories' : 'Jewellery', result.jewellery],
                ['Bag', result.bag],
                ['Accessories', result.accessories],
                ['Layers', result.layers],
                ['Hair', result.hair],
                [profile.style_for === 'men' ? 'Grooming' : 'Makeup', result.makeup_or_grooming],
              ] as const)
                .filter(([, v]) => v)
                .map(([k, v], i) => (
                  <div key={k} style={{ ['--i' as string]: i }}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            {result.colour_palette.length > 0 && (
              <div className="palette" aria-label="Colour palette">{result.colour_palette.map((c) => <span key={c}>{c}</span>)}</div>
            )}
            {result.to_buy.length > 0 && (
              <div className="stack" style={{ ['--gap' as string]: '0.5rem' }}>
                <strong className="small">Worth buying</strong>
                <div className="shop-list">
                  {result.to_buy.map((b) => (
                    <div key={b} className="shop-row">
                      <div className="shop-main"><span>{b}</span></div>
                      <button className="btn small" disabled={addedToList.includes(b)} onClick={() => addToList(b)}>
                        {addedToList.includes(b) ? <><Icon name="check" /> On the list</> : <><Icon name="plus" /> Shopping list</>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.pinterest_searches.length > 0 && (
              <div className="stack" style={{ ['--gap' as string]: '0.5rem' }}>
                <strong className="small">See similar looks on Pinterest</strong>
                <div className="chips">
                  {result.pinterest_searches.map((q) => (
                    <a key={q} className="chip" href={pinterestUrl(q)} target="_blank" rel="noopener noreferrer">{q} <Icon name="link" /></a>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="alert error" role="alert"><Icon name="alert" /> {error.text}</p>}
          </div>
        ) : (
          <div className="stack" style={{ ['--gap' as string]: '1.25rem' }}>
            <p className="muted small">
              For <strong>{section?.name}</strong>, {dayLabel}. Add the pieces you want styled, like a top, jeans and a jacket, or leave it empty for a look from scratch.
            </p>

            <div className="field">
              <div className="spread">
                <span className="field-label">Pieces to style ({pieces.length}/{MAX_PIECES})</span>
                <div className="row">
                  {items.length > 0 && <button type="button" className="btn small" onClick={() => setChoosing((c) => !c)}>{choosing ? 'Done' : 'From wardrobe'}</button>}
                  <button type="button" className="btn small" onClick={() => setAddingPiece(true)} disabled={pieces.length >= MAX_PIECES}><Icon name="upload" /> New photo</button>
                </div>
              </div>
              {pieces.length > 0 && (
                <div className="piece-row">
                  {pieces.map((id) => {
                    const it = byId.get(id)
                    if (!it) return null
                    return (
                      <div key={id} className="piece">
                        <span className="pic">{urls[it.image_path] && <img src={urls[it.image_path]} alt="" />}</span>
                        <span>{it.name}</span>
                        <button type="button" className="x" aria-label={`Remove ${it.name}`} onClick={() => setPieces((p) => p.filter((x) => x !== id))}><Icon name="x" /></button>
                      </div>
                    )
                  })}
                </div>
              )}
              {choosing && (
                <div className="stack" style={{ ['--gap' as string]: '0.6rem' }}>
                  <div className="chips scroll">
                    <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
                    {CATEGORIES.filter((c) => usedCats.has(c.id)).map((c) => (
                      <button key={c.id} type="button" className="chip" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>{c.label}</button>
                    ))}
                  </div>
                  <ItemGrid items={visible} urls={urls} onPick={togglePiece} selected={pieces} />
                </div>
              )}
              <small>New photos are added to your wardrobe first. Background removal there is free and optional.</small>
            </div>

            <div className="field">
              <span>What do you need?</span>
              <div className="chips">
                {ASKS.map((a) => (
                  <button key={a.id} type="button" className="chip" aria-pressed={askType === a.id} onClick={() => setAskType(a.id)}>{a.label(profile.style_for)}</button>
                ))}
              </div>
              {askType === 'custom' && (
                <input className="input" value={customAsk} maxLength={300} onChange={(e) => setCustomAsk(e.target.value)} placeholder="Would white sneakers work with this?" autoFocus />
              )}
            </div>

            <div className="field">
              <span>Aesthetic (optional)</span>
              <div className="chips scroll">
                {OUTFIT_AESTHETICS.map((a) => (
                  <button key={a} type="button" className="chip" aria-pressed={aesthetic === a} onClick={() => setAesthetic(aesthetic === a ? '' : a)}>{a}</button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Anything else? (optional)</span>
              <input className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Windy beach dinner, I’ll be walking on sand" />
            </label>

            <label className="switch">
              <span className="label">
                <strong>Prefer pieces I already own</strong>
                <span className="hint">Shares a text list of your wardrobe (names, colours and tags only, no photos).</span>
              </span>
              <input type="checkbox" checked={preferOwned} onChange={(e) => setPreferOwned(e.target.checked)} />
            </label>

            <div className="ai-panel stack" style={{ ['--gap' as string]: '0.6rem' }}>
              <div className="spread">
                <span className="field-label">Use</span>
                <select className="select" style={{ width: 'auto', minHeight: 40 }} value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)} aria-label="AI to use">
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.cost.toLowerCase()})</option>)}
                </select>
              </div>
              {status === 'none' ? (
                <span className="ai-note"><Icon name="key" /> No key set up for {providerInfo.name} on this device. <Link href="/settings/ai">Set it up</Link></span>
              ) : (
                <span className="ai-note">
                  {provider === 'manual' ? 'You’ll copy a prompt into your own app. Free here.' : `One request per click.${status === 'locked' ? ' Your key is PIN-locked; you’ll be asked for the PIN.' : ''}`}
                </span>
              )}
            </div>

            {error && (
              <div className="alert error" role="alert">
                <Icon name="alert" />
                <div className="stack" style={{ ['--gap' as string]: '0.5rem' }}>
                  <span>{error.text}</span>
                  {error.quota && (
                    <button className="btn small" onClick={() => { setProvider('manual'); run('manual') }}>Use my Claude or ChatGPT app</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>

      <ItemSheet
        open={addingPiece}
        onClose={() => setAddingPiece(false)}
        profileId={profile.id}
        onSaved={(newId) => {
          onItemsChanged()
          if (newId) setPieces((p) => (p.length >= MAX_PIECES ? p : [...p, newId]))
        }}
      />
    </>
  )
}
