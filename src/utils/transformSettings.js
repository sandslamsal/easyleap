import {
  BRIDGE_PRESETS,
  DEFAULT_BRIDGE_PRESET_ID,
} from '../data/samples.js'

const SETTINGS_JSON_VERSION = 1
const LEGACY_PRESET_ID_MAP = new Map([
  ['bridge4', 'i16_bridge_4'],
  ['bridge6', 'i16_bridge_6'],
  ['bridge9', 'i16_bridge_9'],
  ['create', 'user'],
])

function requireString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`Settings JSON field "${fieldName}" must be a string.`)
  }

  return value
}

function requireBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new Error(`Settings JSON field "${fieldName}" must be true or false.`)
  }

  return value
}

export function getBridgePreset(presetId = DEFAULT_BRIDGE_PRESET_ID) {
  const normalizedPresetId = LEGACY_PRESET_ID_MAP.get(presetId) ?? presetId
  return (
    BRIDGE_PRESETS[normalizedPresetId] ?? BRIDGE_PRESETS[DEFAULT_BRIDGE_PRESET_ID]
  )
}

export function createTransformSettingsFromPreset(
  presetId = DEFAULT_BRIDGE_PRESET_ID,
) {
  const preset = getBridgePreset(presetId)

  return {
    bridgePresetId: preset.id,
    applyRemaps: preset.applyRemaps,
    applyDeleteFilters: preset.applyDeleteFilters,
    bearingPointRemapText: preset.remaps.bearingPoint,
    columnNumberRemapText: preset.remaps.columnNumber,
    bearingPointDeleteText: preset.deletes.bearingPoint,
    columnNumberDeleteText: preset.deletes.columnNumber,
  }
}

export function createClearedTransformSettings(
  presetId = DEFAULT_BRIDGE_PRESET_ID,
) {
  return {
    bridgePresetId: getBridgePreset(presetId).id,
    applyRemaps: false,
    applyDeleteFilters: false,
    bearingPointRemapText: '',
    columnNumberRemapText: '',
    bearingPointDeleteText: '',
    columnNumberDeleteText: '',
  }
}

export function serializeTransformSettings(settings) {
  return JSON.stringify(
    {
      version: SETTINGS_JSON_VERSION,
      bridgePresetId: settings.bridgePresetId,
      applyRemaps: settings.applyRemaps,
      applyDeleteFilters: settings.applyDeleteFilters,
      bearingPointRemapText: settings.bearingPointRemapText,
      columnNumberRemapText: settings.columnNumberRemapText,
      bearingPointDeleteText: settings.bearingPointDeleteText,
      columnNumberDeleteText: settings.columnNumberDeleteText,
    },
    null,
    2,
  )
}

export function parseTransformSettingsJson(jsonText) {
  let parsed

  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Settings JSON could not be parsed.')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Settings JSON must contain an object.')
  }

  return {
    bridgePresetId: getBridgePreset(
      typeof parsed.bridgePresetId === 'string'
        ? parsed.bridgePresetId
        : DEFAULT_BRIDGE_PRESET_ID,
    ).id,
    applyRemaps: requireBoolean(parsed.applyRemaps, 'applyRemaps'),
    applyDeleteFilters: requireBoolean(
      parsed.applyDeleteFilters,
      'applyDeleteFilters',
    ),
    bearingPointRemapText: requireString(
      parsed.bearingPointRemapText,
      'bearingPointRemapText',
    ),
    columnNumberRemapText: requireString(
      parsed.columnNumberRemapText,
      'columnNumberRemapText',
    ),
    bearingPointDeleteText: requireString(
      parsed.bearingPointDeleteText,
      'bearingPointDeleteText',
    ),
    columnNumberDeleteText: requireString(
      parsed.columnNumberDeleteText,
      'columnNumberDeleteText',
    ),
  }
}
