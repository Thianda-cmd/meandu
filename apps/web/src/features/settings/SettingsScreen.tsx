import { ArrowCounterClockwise, Heart, Moon, Translate } from '@phosphor-icons/react'
import { Radio, RadioGroup } from 'react-aria-components'
import { useT } from '../../i18n'
import { toneStyle } from '../../lib/tone'
import { haptics } from '../../platform'
import { useData } from '../../state/data'
import { useSettings } from '../../state/settings'
import { TONES, type Tone } from '../../state/types'
import { useUi } from '../../state/ui'
import { Avatar } from '../../ui/Avatar'
import { Group, Row, Segmented } from '../../ui/controls'
import { Pressable } from '../../ui/Pressable'
import { DatePicker } from '../../ui/pickers'
import { Screen } from '../../ui/Screen'

function PersonCard({ who }: { who: 'me' | 'partner' }) {
  const t = useT()
  const person = useData((s) => s[who])
  const update = useData((s) => s.updatePerson)

  return (
    <div className="rounded-card bg-surface p-4 shadow-soft">
      <p className="pb-3 text-sub font-semibold text-ink-2">
        {who === 'me' ? t.settings.you : t.settings.partner}
      </p>
      <div className="flex items-center gap-3">
        <Avatar person={person} size={48} />
        <input
          value={person.name}
          onChange={(e) => update(who, { name: e.target.value })}
          aria-label={t.settings.name}
          className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2.5 font-display text-title font-bold"
        />
      </div>
      <RadioGroup
        aria-label={t.settings.color}
        value={person.tone}
        orientation="horizontal"
        onChange={(tone) => {
          haptics.select()
          update(who, { tone: tone as Tone })
        }}
        className="mt-4 flex gap-3"
      >
        {TONES.map((tone) => (
          <Radio
            key={tone}
            value={tone}
            aria-label={tone}
            style={toneStyle(tone)}
            className="size-9 cursor-default rounded-full bg-tone outline-none transition-shadow data-[focus-visible]:ring-2 data-[focus-visible]:ring-ink data-[selected]:ring-[3px] data-[selected]:ring-tone/40 data-[selected]:ring-offset-2 data-[selected]:ring-offset-surface"
          />
        ))}
      </RadioGroup>
    </div>
  )
}

export function SettingsScreen() {
  const t = useT()
  const lang = useSettings((s) => s.lang)
  const setLang = useSettings((s) => s.setLang)
  const theme = useSettings((s) => s.theme)
  const setTheme = useSettings((s) => s.setTheme)
  const togetherSince = useData((s) => s.togetherSince)
  const setTogetherSince = useData((s) => s.setTogetherSince)

  return (
    <Screen title={t.settings.title}>
      <div className="space-y-4 px-4 pb-10 pt-2">
        <PersonCard who="me" />
        <PersonCard who="partner" />

        <Group>
          <Row
            icon={<Heart size={20} weight="fill" className="text-coral" />}
            label={t.settings.togetherSince}
          >
            <DatePicker
              label={t.settings.togetherSince}
              value={togetherSince}
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

        <Pressable
          feedback="row"
          onPress={() => {
            haptics.warn()
            useData.getState().reset(lang)
            useUi.getState().showToast(t.settings.resetDone)
          }}
          className="flex w-full items-center gap-3 rounded-card bg-surface-2/60 px-4 py-3.5 text-body"
        >
          <ArrowCounterClockwise size={20} className="text-ink-2" />
          {t.settings.reset}
        </Pressable>

        <div className="flex flex-col items-center gap-2 pt-6 text-center">
          <img src="/logo.svg" alt="" className="size-12" />
          <p className="font-display text-headline font-extrabold">meandu</p>
          <p className="text-foot text-ink-2">{t.settings.about}</p>
        </div>
      </div>
    </Screen>
  )
}
