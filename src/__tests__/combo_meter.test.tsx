import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ComboMeter, getComboTierConfig } from '../components/ComboMeter';

describe('ComboMeter Component & Tier Configurations', () => {
  it('correctly maps multiplier < 1.25 to Tier 1 (Streak)', () => {
    const config = getComboTierConfig(1.0, 'en');
    expect(config.tier).toBe(1);
    expect(config.name).toContain('STREAK');
    expect(config.pulseClass).toBe('animate-combo-pulse-1');
    expect(config.accentColor).toBe('#00f5d4');
    expect(config.multiplierText).toBe('x1.00');
  });

  it('correctly maps multiplier 1.25 to Tier 2 (Surge)', () => {
    const config = getComboTierConfig(1.25, 'en');
    expect(config.tier).toBe(2);
    expect(config.name).toContain('SURGE');
    expect(config.pulseClass).toBe('animate-combo-pulse-2');
    expect(config.accentColor).toBe('#ffb703');
    expect(config.multiplierText).toBe('x1.25');
  });

  it('correctly maps multiplier 1.50 to Tier 3 (Hyper)', () => {
    const config = getComboTierConfig(1.50, 'en');
    expect(config.tier).toBe(3);
    expect(config.name).toContain('HYPER');
    expect(config.pulseClass).toBe('animate-combo-pulse-3');
    expect(config.accentColor).toBe('#ff007f');
    expect(config.multiplierText).toBe('x1.50');
  });

  it('correctly maps multiplier 1.75 to Tier 4 (Overdrive)', () => {
    const config = getComboTierConfig(1.75, 'en');
    expect(config.tier).toBe(4);
    expect(config.name).toContain('OVERDRIVE');
    expect(config.pulseClass).toBe('animate-combo-pulse-4');
    expect(config.accentColor).toBe('#ff5400');
    expect(config.multiplierText).toBe('x1.75');
  });

  it('correctly maps multiplier 2.00 to Tier 5 (Ultra)', () => {
    const config = getComboTierConfig(2.0, 'en');
    expect(config.tier).toBe(5);
    expect(config.name).toContain('ULTRA');
    expect(config.pulseClass).toBe('animate-combo-pulse-4');
    expect(config.accentColor).toBe('#ff007f');
    expect(config.multiplierText).toBe('x2.00');
  });

  it('correctly maps multiplier 3.00+ to Tier 6 (Omega / Max Intensity)', () => {
    const config = getComboTierConfig(3.5, 'en');
    expect(config.tier).toBe(6);
    expect(config.name).toContain('OMEGA');
    expect(config.pulseClass).toBe('animate-combo-pulse-max');
    expect(config.accentColor).toBe('#00f5d4');
    expect(config.multiplierText).toBe('x3.50');
  });

  it('supports Russian localization across all tiers', () => {
    const tier1Ru = getComboTierConfig(1.0, 'ru');
    expect(tier1Ru.name).toContain('СЕРИЯ');

    const tier2Ru = getComboTierConfig(1.25, 'ru');
    expect(tier2Ru.name).toContain('РАЗГОН');

    const tier3Ru = getComboTierConfig(1.50, 'ru');
    expect(tier3Ru.name).toContain('ГИПЕР');

    const tier4Ru = getComboTierConfig(1.75, 'ru');
    expect(tier4Ru.name).toContain('ОВЕРДРАЙВ');

    const tier5Ru = getComboTierConfig(2.0, 'ru');
    expect(tier5Ru.name).toContain('УЛЬТРА');

    const tier6Ru = getComboTierConfig(3.0, 'ru');
    expect(tier6Ru.name).toContain('ОМЕГА');
  });

  it('renders collapsed/hidden when combo is less than 2', () => {
    const html = renderToString(<ComboMeter combo={1} multiplier={1.0} lang="en" />);
    expect(html).toContain('opacity-0');
    expect(html).toContain('max-h-0');
  });

  it('renders visible with hit counts and pips when combo is >= 2', () => {
    const html = renderToString(<ComboMeter combo={7} multiplier={1.25} lang="en" />);
    expect(html).toContain('opacity-100');
    expect(html).toContain('scale-100');
    expect(html).toContain('7');
    expect(html).toContain('x1.25');
    expect(html).toContain('animate-combo-pulse-2');
  });
});
