'use client'

import React, { createContext, useContext } from 'react'

import { Card } from '@/components/atoms/card'
import { Checkbox } from '@/components/atoms/checkbox'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select'
import { Separator } from '@/components/atoms/separator'
import { GlowUnderlay, type GlowUnderlayValue } from '@/components/atoms/glow'
import { cn } from '@/utilities/ui'

type GlowTunerContextValue = {
  value: GlowUnderlayValue
  onValueChange: (next: GlowUnderlayValue) => void
}

const GlowTunerContext = createContext<GlowTunerContextValue | null>(null)

const useGlowTunerContext = () => {
  const context = useContext(GlowTunerContext)
  if (!context) throw new Error('useGlowTunerContext must be used within GlowTuner.Root')
  return context
}

type RootProps = {
  children: React.ReactNode
  value: GlowUnderlayValue
  onValueChange: (next: GlowUnderlayValue) => void
  className?: string
}

const Root = ({ children, value, onValueChange, className }: RootProps) => {
  return (
    <GlowTunerContext.Provider value={{ value, onValueChange }}>
      <div className={cn('grid gap-6 lg:grid-cols-12', className)}>{children}</div>
    </GlowTunerContext.Provider>
  )
}

const Controls = ({ className }: { className?: string }) => {
  const { value, onValueChange } = useGlowTunerContext()

  const setPartial = (patch: Partial<GlowUnderlayValue>) => onValueChange({ ...value, ...patch })

  return (
    <Card className={cn('lg:col-span-5', className)}>
      <div className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Glow controls</h3>
            <p className="text-muted-foreground text-sm">Tune the decorative glow behind the image.</p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Enabled</span>
            <Checkbox
              checked={value.enabled}
              onCheckedChange={(checked) => setPartial({ enabled: checked === true })}
              aria-label="Toggle glow"
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Desktop only (lg+)</span>
            <Checkbox
              checked={value.desktopOnly}
              onCheckedChange={(checked) => setPartial({ desktopOnly: checked === true })}
              aria-label="Toggle desktop-only glow"
            />
          </label>

          <div className="grid gap-2">
            <Label>Size (%)</Label>
            <Input
              type="number"
              value={value.size}
              onChange={(event) => {
                const next = Number(event.target.value)
                setPartial({ size: Number.isFinite(next) ? next : value.size })
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label>X offset (%)</Label>
            <Input
              type="number"
              value={value.offsetX}
              onChange={(event) => {
                const next = Number(event.target.value)
                setPartial({ offsetX: Number.isFinite(next) ? next : value.offsetX })
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label>Y offset (%)</Label>
            <Input
              type="number"
              value={value.offsetY}
              onChange={(event) => {
                const next = Number(event.target.value)
                setPartial({ offsetY: Number.isFinite(next) ? next : value.offsetY })
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label>Shape (0–100)</Label>
            <Input
              type="number"
              value={value.shape}
              onChange={(event) => {
                const next = Number(event.target.value)
                setPartial({ shape: Number.isFinite(next) ? next : value.shape })
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label>Brand color</Label>
            <Select value={value.color} onValueChange={(v) => setPartial({ color: v as GlowUnderlayValue['color'] })}>
              <SelectTrigger>
                <SelectValue placeholder="Select color" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary (blue)</SelectItem>
                <SelectItem value="accent">Accent (mint)</SelectItem>
                <SelectItem value="secondary">Secondary (navy)</SelectItem>
                <SelectItem value="accent-2">Accent 2 (gray)</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Intensity (0–100)</Label>
            <Input
              type="number"
              value={value.intensity}
              onChange={(event) => {
                const next = Number(event.target.value)
                setPartial({ intensity: Number.isFinite(next) ? next : value.intensity })
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label>Falloff (0–100)</Label>
            <Input
              type="number"
              value={value.falloff}
              onChange={(event) => {
                const next = Number(event.target.value)
                setPartial({ falloff: Number.isFinite(next) ? next : value.falloff })
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}

type PreviewProps = {
  children: React.ReactNode
  className?: string
  frameClassName?: string
}

const Preview = ({ children, className, frameClassName }: PreviewProps) => {
  const { value } = useGlowTunerContext()

  return (
    <Card className={cn('lg:col-span-7', className)}>
      <div className="space-y-4 p-6">
        <div>
          <h3 className="text-lg font-semibold">Preview</h3>
          <p className="text-muted-foreground text-sm">Glow is rendered behind this frame.</p>
        </div>

        <div className={cn('relative isolate mx-auto aspect-576/968 w-full max-w-lg', frameClassName)}>
          <GlowUnderlay {...value} />
          <div className="bg-background relative z-10 h-full w-full overflow-hidden rounded-3xl">{children}</div>
        </div>
      </div>
    </Card>
  )
}

export const GlowTuner = {
  Root,
  Controls,
  Preview,
}
