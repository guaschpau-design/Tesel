// How the app names what a member tells the team about themselves (protocol §3.14): their profile,
// their status and what they carry, in the order they are offered.

import type { DutyStatus, Equipment, Profile } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';
import type { StatusTone } from '../ui/status-tone.ts';

export const PROFILES: readonly { readonly value: Profile; readonly label: MessageKey }[] = [
  { value: 'unspecified', label: 'profileUnspecified' },
  { value: 'civil-protection', label: 'profileCivilProtection' },
  { value: 'firefighters', label: 'profileFirefighters' },
  { value: 'police', label: 'profilePolice' },
  { value: 'medical', label: 'profileMedical' },
  { value: 'rescue', label: 'profileRescue' },
  { value: 'volunteer', label: 'profileVolunteer' },
  { value: 'military', label: 'profileMilitary' },
  { value: 'other', label: 'profileOther' },
];

/** Each status, with the colour of its dot: ready, not now, gone; in the order offered. */
export const DUTY_STATUSES: Readonly<
  Record<DutyStatus, { readonly label: MessageKey; readonly tone: StatusTone }>
> = {
  active: { label: 'dutyActive', tone: 'good' },
  resting: { label: 'dutyResting', tone: 'fair' },
  'off-duty': { label: 'dutyOffDuty', tone: 'poor' },
};

interface EquipmentItem {
  readonly value: Equipment;
  readonly label: MessageKey;
}

/**
 * What can be picked, in four groups so that the list reads at a glance: looking after people,
 * finding and rescuing them, working on the ground, and getting there and keeping in touch.
 */
export const EQUIPMENT_GROUPS: readonly {
  readonly label: MessageKey;
  readonly items: readonly EquipmentItem[];
}[] = [
  {
    label: 'equipmentGroupCare',
    items: [
      { value: 'first-aid', label: 'equipmentFirstAid' },
      { value: 'defibrillator', label: 'equipmentDefibrillator' },
      { value: 'oxygen', label: 'equipmentOxygen' },
      { value: 'stretcher', label: 'equipmentStretcher' },
      { value: 'blankets', label: 'equipmentBlankets' },
      { value: 'water', label: 'equipmentWater' },
      { value: 'food', label: 'equipmentFood' },
    ],
  },
  {
    label: 'equipmentGroupRescue',
    items: [
      { value: 'light', label: 'equipmentLight' },
      { value: 'rope', label: 'equipmentRope' },
      { value: 'search-dog', label: 'equipmentSearchDog' },
      { value: 'thermal-camera', label: 'equipmentThermalCamera' },
      { value: 'drone', label: 'equipmentDrone' },
      { value: 'extinguisher', label: 'equipmentExtinguisher' },
      { value: 'weapon', label: 'equipmentWeapon' },
    ],
  },
  {
    label: 'equipmentGroupTools',
    items: [
      { value: 'tools', label: 'equipmentTools' },
      { value: 'chainsaw', label: 'equipmentChainsaw' },
      { value: 'pump', label: 'equipmentPump' },
      { value: 'generator', label: 'equipmentGenerator' },
      { value: 'power-bank', label: 'equipmentPowerBank' },
    ],
  },
  {
    label: 'equipmentGroupTransport',
    items: [
      { value: 'vehicle', label: 'equipmentVehicle' },
      { value: 'four-by-four', label: 'equipmentFourByFour' },
      { value: 'boat', label: 'equipmentBoat' },
      { value: 'radio', label: 'equipmentRadio' },
      { value: 'satellite-phone', label: 'equipmentSatellitePhone' },
      { value: 'megaphone', label: 'equipmentMegaphone' },
    ],
  },
];

/**
 * What each profile most often carries, offered first when equipment is added (ADR-0133): a few
 * items, so that the usual is marked in a tap or two. None for a profile that says nothing of it.
 */
export const TYPICAL_EQUIPMENT: Readonly<Record<Profile, readonly Equipment[]>> = {
  unspecified: [],
  'civil-protection': ['light', 'generator', 'pump', 'megaphone', 'radio'],
  firefighters: ['extinguisher', 'chainsaw', 'rope', 'light', 'pump'],
  police: ['light', 'vehicle', 'radio', 'megaphone', 'first-aid'],
  medical: ['first-aid', 'defibrillator', 'oxygen', 'stretcher', 'blankets'],
  rescue: ['rope', 'light', 'search-dog', 'thermal-camera', 'drone'],
  volunteer: ['water', 'food', 'blankets', 'light', 'first-aid'],
  military: ['radio', 'satellite-phone', 'light', 'first-aid', 'four-by-four'],
  other: [],
};

/** Everything that can be picked, group after group. */
export const EQUIPMENT: readonly EquipmentItem[] = EQUIPMENT_GROUPS.flatMap((group) => group.items);

/**
 * What this person carries, as the group is told: what they picked by hand, and a LoRa radio while
 * one is linked to the app (protocol §3.14), which is never picked by hand.
 */
export function ownEquipment(picked: readonly Equipment[], radioLinked: boolean): Equipment[] {
  const byHand = picked.filter((item) => item !== 'lora');
  return radioLinked ? [...byHand, 'lora'] : byHand;
}

export function profileLabel(profile: Profile): MessageKey {
  return PROFILES.find((item) => item.value === profile)?.label ?? 'profileUnspecified';
}
