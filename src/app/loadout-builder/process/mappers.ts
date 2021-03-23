import _ from 'lodash';
import { DimItem } from '../../inventory/item-types';
import {
  getModTypeTagByPlugCategoryHash,
  getSpecialtySocketMetadatas,
} from '../../utils/item-utils';
import { ProcessArmorSet, ProcessItem, ProcessMod } from '../process-worker/types';
import {
  ArmorSet,
  knownModPlugCategoryHashes,
  LockedMod,
  LockedModMap,
  raidPlugCategoryHashes,
  statHashToType,
  StatTypes,
} from '../types';

export function mapArmor2ModToProcessMod(mod: LockedMod): ProcessMod {
  const processMod: ProcessMod = {
    hash: mod.modDef.hash,
    plugCategoryHash: mod.modDef.plug.plugCategoryHash,
    energy: mod.modDef.plug.energyCost && {
      type: mod.modDef.plug.energyCost.energyType,
      val: mod.modDef.plug.energyCost.energyCost,
    },
    investmentStats: mod.modDef.investmentStats,
  };

  if (
    raidPlugCategoryHashes.includes(processMod.plugCategoryHash) ||
    !knownModPlugCategoryHashes.includes(processMod.plugCategoryHash)
  ) {
    processMod.tag = getModTypeTagByPlugCategoryHash(mod.modDef.plug.plugCategoryHash);
  }

  return processMod;
}

/**
 * This sums up the total stat contributions across mods passed in. These are then applied
 * to the loadouts after all the items base values have been summed. This mimics how mods
 * effect stat values in game and allows us to do some preprocessing.
 */
export function getTotalModStatChanges(lockedArmor2Mods: LockedModMap) {
  const totals: { [stat in StatTypes]: number } = {
    Mobility: 0,
    Recovery: 0,
    Resilience: 0,
    Intellect: 0,
    Discipline: 0,
    Strength: 0,
  };

  for (const mods of Object.values(lockedArmor2Mods)) {
    for (const mod of mods || []) {
      for (const stat of mod.modDef.investmentStats) {
        const statType = statHashToType[stat.statTypeHash];
        if (statType) {
          totals[statType] += stat.value;
        }
      }
    }
  }

  return totals;
}

export function mapDimItemToProcessItem(dimItem: DimItem, modsForSlot?: LockedMod[]): ProcessItem {
  const { bucket, id, type, name, equippingLabel, basePower, stats, energy } = dimItem;

  const baseStatMap: { [statHash: number]: number } = {};

  if (stats) {
    for (const { statHash, base } of stats) {
      baseStatMap[statHash] = base;
    }
  }

  const modMetadatas = getSpecialtySocketMetadatas(dimItem);
  const modsCost = modsForSlot
    ? _.sumBy(modsForSlot, (mod) => mod.modDef.plug.energyCost?.energyCost || 0)
    : 0;

  return {
    bucketHash: bucket.hash,
    id,
    type,
    name,
    equippingLabel,
    basePower,
    baseStats: baseStatMap,
    energy: energy
      ? {
          type: energy.energyType,
          capacity: energy.energyCapacity,
          val: modsCost,
        }
      : undefined,
    compatibleModSeasons: modMetadatas?.flatMap((m) => m.compatibleModTags),
    hasLegacyModSocket: Boolean(modMetadatas?.some((m) => m.slotTag === 'legacy')),
  };
}

export function hydrateArmorSet(
  processed: ProcessArmorSet,
  itemsById: Map<string, DimItem[]>
): ArmorSet {
  const armor: DimItem[][] = [];

  for (const itemId of processed.armor) {
    armor.push(itemsById.get(itemId)!);
  }

  return {
    armor,
    stats: processed.stats,
  };
}
