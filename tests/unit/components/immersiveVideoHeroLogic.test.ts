import { describe, expect, it } from 'vitest'

import {
  normalizeCrossfadeMs,
  normalizePlaybackRate,
  resolveVideoRenderMode,
} from '@/components/molecules/ImmersiveVideoHero/logic'

describe('ImmersiveVideoHero logic', () => {
  describe('normalizeCrossfadeMs', () => {
    it('uses default when value is missing', () => {
      expect(normalizeCrossfadeMs(undefined)).toBe(700)
    })

    it('clamps the value into supported boundaries', () => {
      expect(normalizeCrossfadeMs(120)).toBe(200)
      expect(normalizeCrossfadeMs(1800)).toBe(1400)
      expect(normalizeCrossfadeMs(650)).toBe(650)
    })
  })

  describe('normalizePlaybackRate', () => {
    it('uses default when value is missing', () => {
      expect(normalizePlaybackRate(undefined)).toBe(1)
    })

    it('clamps the value into supported boundaries', () => {
      expect(normalizePlaybackRate(0.4)).toBe(0.5)
      expect(normalizePlaybackRate(1.3)).toBe(1.2)
      expect(normalizePlaybackRate(0.88)).toBe(0.88)
    })
  })

  describe('resolveVideoRenderMode', () => {
    it('returns placeholder without a video source', () => {
      expect(
        resolveVideoRenderMode({
          fallbackToNativeLoop: false,
          hasVideoSource: false,
          shouldDisableMotion: false,
          withCrossfade: true,
        }),
      ).toBe('placeholder')
    })

    it('returns reduced-motion when motion should be disabled', () => {
      expect(
        resolveVideoRenderMode({
          fallbackToNativeLoop: false,
          hasVideoSource: true,
          shouldDisableMotion: true,
          withCrossfade: true,
        }),
      ).toBe('reduced-motion')
    })

    it('returns dual-crossfade only when enabled and no fallback is active', () => {
      expect(
        resolveVideoRenderMode({
          fallbackToNativeLoop: false,
          hasVideoSource: true,
          shouldDisableMotion: false,
          withCrossfade: true,
        }),
      ).toBe('dual-crossfade')

      expect(
        resolveVideoRenderMode({
          fallbackToNativeLoop: true,
          hasVideoSource: true,
          shouldDisableMotion: false,
          withCrossfade: true,
        }),
      ).toBe('native')
    })
  })
})
