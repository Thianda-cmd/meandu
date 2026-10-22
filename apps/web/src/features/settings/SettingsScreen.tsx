import {
  ArrowClockwise,
  CloudCheck,
  CloudSlash,
  Heart,
  Moon,
  Translate,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { todayDate } from '../../lib/time'
import { useData, useMe, usePartner } from '../../state/data'
import { useSettings } from '../../state/settings'
import { useUi } from '../../state/ui'
import { syncNow, useSync } from '../../sync/engine'
import { Avatar, PendingAvatar } from '../../ui/Avatar'
import { Group, Row, Segmented } from '../../ui/controls'
import { Pressable } from '../../ui/Pressable'
import { DatePicker } from '../../ui/pickers'
import { Screen } from '../../ui/Screen'
import { Spinner } from '../../ui/states'
import { TonePicker } from '../../ui/TonePicker'
import { startOver } from '../onboarding/actions'

export function SettingsScreen() {
  const t = useT()
  const mode = useData((s) => s.mode)
  const lang = useSettings((s) => s.lang)
  const setLang = useSettings((s) => s.setLang)
  const theme = useSettings((s) => s.theme)
  const setTheme = useSettings((s) => s.setTheme)
  const togetherSince = useData((s) => s.togetherSince)
  const setTogetherSince = useData((s) => s.setTogetherSince)

  return (
    <Screen title={t.settings.title}>
      <div className="space-y-4 px-4 pb-10 pt-2">
        {mode === 'demo' && (
          <Pressable
            haptic="tap"
            onPress={startOver}
            className="flex w-full items-center gap-3 rounded-card bg-honey-soft px-4 py-3.5"
          >
            <span aria-hidden className="text-2xl">
              👀
            </span>
            <span className="min-w-0 flex-1 text-sub text-ink-2">{t.demo.hint}</span>
            <span className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-sub font-bold text-canvas">
              {t.demo.startForReal}
            </span>
          </Pressable>
        )}

        <MeCard />
        <PartnerCard />

        <Group>
          <Row
            icon={<Heart size={20} weight="fill" className="text-coral" />}
            label={t.settings.togetherSince}
          >
            <DatePicker
              label={t.settings.togetherSince}
              value={togetherSince}
              placeholder={t.onboarding.pickDate}
              max={todayDate().toString()}
              onChange={setTogetherSince}
            />
          </Row>
        </Group>

        <Group>
          <div className="space-y-2 px-4 py-3">
            <p className="flex items-center gap-3 text-body">
              <Translate size={20} className="text-ink-2" />
              {t.settings.language}
            </p>
            <Segmented
              label={t.settings.language}
              value={lang}
              onChange={setLang}
              options={[
                { value: 'en', label: 'English' },
                { value: 'de', label: 'Deutsch' },
              ]}
            />
          </div>
          <div className="space-y-2 px-4 py-3">
            <p className="flex items-center gap-3 text-body">
              <Moon size={20} className="text-ink-2" />
              {t.settings.look}
            </p>
            <Segmented
              label={t.settings.look}
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'auto', label: t.settings.looks.auto },
                { value: 'light', label: t.settings.looks.light },
                { value: 'dark', label: t.settings.looks.dark },
              ]}
            />
          </div>
        </Group>

        {mode === 'synced' && <SyncCard />}

        <div className="flex flex-col items-center gap-2 pt-6 text-center">
          <img src="/logo.svg" alt="" className="size-12" />
          <p className="font-display text-headline font-extrabold">meandu</p>
          <p className="text-foot text-ink-2">{t.settings.about}</p>
        </div>
      </div>
    </Screen>
  )
}

/** Your name and colour. The name is saved when you're done typing. */
function MeCard() {
  const t = useT()
  const me = useMe()
  const update = useData((s) => s.updatePerson)
  const [name, setName] = useState(me.name)

  useEffect(() => setName(me.name), [me.name])

  const commit = () => {
    const value = name.trim()
    if (value && value !== me.name) update(me.id, { name: value })
    else setName(me.name)
  }

  return (
    <div className="rounded-card bg-surface p-4 shadow-soft">
      <p className="pb-3 text-sub font-semibold text-ink-2">{t.settings.you}</p>
      <div className="flex items-center gap-3">
        <Avatar person={{ ...me, name: name || me.name }} size={48} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          aria-label={t.settings.name}
          maxLength={40}
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2.5 font-display text-title font-bold"
        />
      </div>
      <TonePicker
        label={t.settings.color}
        value={me.tone}
        onChange={(tone) => update(me.id, { tone })}
        className="mt-4"
      />
    </div>
  )
}

function PartnerCard() {
  const t = useT()
  const mode = useData((s) => s.mode)
  const partner = usePartner()
  const openSheet = useUi((s) => s.openSheet)

  return (
    <div className="rounded-card bg-surface p-4 shadow-soft">
      <p className="pb-3 text-sub font-semibold text-ink-2">{t.settings.partner}</p>
      <div className="flex items-center gap-3">
        {partner ? <Avatar person={partner} size={48} /> : <PendingAvatar size={48} />}
        <p
          className={
            partner
              ? 'font-display text-title font-bold'
              : 'font-display text-title font-bold text-ink-3'
          }
        >
          {partner ? partner.name : t.settings.pending}
        </p>
      </div>
      {!partner && mode === 'synced' && (
        <div className="mt-4 flex gap-2">
          <Pressable
            haptic="tap"
            onPress={() => openSheet({ type: 'invite' })}
            className="flex-1 rounded-full bg-coral px-3 py-2.5 text-center text-sub font-bold text-white"
          >
            {t.invite.title}
          </Pressable>
          <Pressable
            haptic="tap"
            onPress={() => openSheet({ type: 'join' })}
            className="flex-1 rounded-full bg-surface-2 px-3 py-2.5 text-center text-sub font-bold"
          >
            {t.onboarding.haveCode}
          </Pressable>
        </div>
      )}
    </div>
  )
}

/** How syncing is going. Tap to sync right now. */
function SyncCard() {
  const t = useT()
  const status = useSync((s) => s.status)

  const [icon, text] =
    status === 'syncing'
      ? [<Spinner key="s" size={18} className="text-ink-2" />, t.sync.syncing]
      : status === 'offline'
        ? [<CloudSlash key="o" size={20} className="text-ink-2" />, t.sync.offline]
        : status === 'error'
          ? [<WarningCircle key="e" size={20} className="text-coral-ink" />, t.sync.error]
          : status === 'signed-out'
            ? [<WarningCircle key="x" size={20} className="text-coral-ink" />, t.sync.signedOut]
            : [<CloudCheck key="i" size={20} className="text-sage" />, t.sync.upToDate]

  return (
    <Group>
      <Pressable
        feedback="row"
        aria-label={`${t.settings.sync}: ${text}`}
        onPress={() => void syncNow()}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-3"
      >
        <span className="grid size-5 place-items-center">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-body">{t.settings.sync}</span>
          <span className="block text-sub text-ink-2">{text}</span>
        </span>
        <ArrowClockwise size={18} className="text-ink-3" />
      </Pressable>
      {status === 'signed-out' && (
        <Pressable
          feedback="row"
          onPress={startOver}
          className="flex min-h-12 w-full items-center px-4 text-body font-semibold text-coral-ink"
        >
          {t.settings.startOver}
        </Pressable>
      )}
    </Group>
  )
}
