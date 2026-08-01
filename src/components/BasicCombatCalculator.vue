<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/BasicCombatCalculator.vue

  Removed: `tryAutoCalculate`, which pre-fills the form from a selected carrier's
  destination star. There is no galaxy to read here, so both sides are entered by
  hand and the player/star/carrier name labels are always the generic ones.
-->
<template>
  <div>
    <div class="row">
      <div class="col-12">
        <form-error-list v-bind:errors="errors" />
      </div>
      <form class="col-12" @submit="calculate">
        <div class="mb-2 row">
          <label for="defenderWeaponTech" class="col-8 col-form-label">
            <i class="fas fa-gun"></i>
            <span class="text-success ms-2">Defender</span>
            Weapons
          </label>
          <div class="col-4">
            <input
              type="number"
              min="1"
              class="form-control"
              id="defenderWeaponTech"
              placeholder="Tech Level"
              v-model.number="defender.weaponsLevel"
              :required="true"
            />
          </div>
        </div>
        <div class="mb-2 row">
          <label for="defenderShips" class="col-8 col-form-label">
            <i
              class="fas"
              :class="{
                'fa-rocket': !isCarrierToStar,
                'fa-star': isCarrierToStar,
              }"
            ></i>
            <span class="text-success ms-2">Defender</span>
            Ships
          </label>
          <div class="col-4">
            <input
              type="number"
              class="form-control"
              min="0"
              id="defenderShips"
              placeholder="Ships"
              v-model.number="defender.ships"
              :required="true"
            />
          </div>
        </div>
        <div class="mb-2 row">
          <div class="col-8">
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                v-model="isCarrierToStar"
                id="chkIsTurnBased"
              />
              <label class="form-check-label" for="chkIsTurnBased">
                Carrier-to-Star Combat
              </label>
            </div>
          </div>
        </div>
        <div class="mb-2 row" v-if="isCarrierToStar && hasDefenderBonus">
          <div class="col-8">
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                v-model="includeDefenderBonus"
                id="chkDefenderBonus"
              />
              <label class="form-check-label" for="chkDefenderBonus">
                Defender Bonus
              </label>
            </div>
          </div>

          <label
            class="col-4 col-form-label text-end text-success pt-0 pb-0"
            v-if="includeDefenderBonus"
            >+1 Weapons</label
          >
        </div>

        <hr />

        <div class="mb-2 row">
          <label for="attackerWeaponTech" class="col-8 col-form-label">
            <i class="fas fa-gun"></i>
            <span class="text-danger ms-2">Attacker</span>
            Weapons
          </label>
          <div class="col-4">
            <input
              type="number"
              class="form-control"
              min="1"
              id="attackerWeaponTech"
              placeholder="Tech Level"
              v-model.number="attacker.weaponsLevel"
              :required="true"
            />
          </div>
        </div>
        <div class="mb-2 row">
          <label for="attackerShips" class="col-8 col-form-label">
            <i class="fas fa-rocket"></i>
            <span class="text-danger ms-2">Attacker</span>
            Ships
          </label>
          <div class="col-4">
            <input
              type="number"
              class="form-control"
              id="attackerShips"
              min="0"
              placeholder="Ships"
              v-model.number="attacker.ships"
              :required="true"
            />
          </div>
        </div>

        <div class="mb-2 row">
          <div class="col-auto col-sm-8">
            <button
              type="button"
              class="btn btn-outline-info"
              title="Swap the defender/attacker values"
              @click="swapValues"
            >
              <i class="fas fa-exchange-alt"></i> Swap Values
            </button>
          </div>
          <div class="col col-sm-4">
            <div class="d-grid gap-2">
              <button
                type="submit"
                class="btn btn-success"
                :disabled="isInvalid"
                title="Calculate the combat result"
              >
                <i class="fas fa-fist-raised"></i> Fight
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>

    <div class="row bg-dark pt-2 pb-2" v-if="result">
      <p
        class="col text-center mb-0"
        v-if="result.defender.shipsAfter >= result.attacker.shipsAfter"
      >
        <span class="text-success">Defender</span> wins with
        <span class="text-success">{{ result.defender.shipsAfter }}</span>
        ship(s) remaining.
      </p>
      <p
        class="col text-center mb-0"
        v-if="result.attacker.shipsAfter > result.defender.shipsAfter"
      >
        <span class="text-danger">Attacker</span> wins with
        <span class="text-danger">{{ result.attacker.shipsAfter }}</span>
        ship(s) remaining.
      </p>
    </div>
    <p class="col text-center mb-0" v-if="result?.defender.shipsNeeded">
      <small
        ><span class="text-success">Defender</span> would need
        <span class="text-success">{{ result.defender.shipsNeeded }}</span>
        ship(s) to win.</small
      >
    </p>
    <p class="col text-center mb-0" v-if="result?.attacker.shipsNeeded">
      <small
        ><span class="text-danger">Attacker</span> would need
        <span class="text-danger">{{ result.attacker.shipsNeeded }}</span>
        ship(s) to win.</small
      >
    </p>
    <p class="col text-center mb-0" v-if="shipsNeededUnknown">
      <small class="text-secondary"
        >This battle is too large to work out how many ships
        {{ shipsNeededUnknown }} would have needed.</small
      >
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import FormErrorList from "@/components/FormErrorList.vue";
import { combatService } from "@/services";
import { game } from "@/stores/game";
import { addEntry } from "@/stores/combatHistory";
// The form state lives in a store so a battle can be loaded back out of the
// history whether or not this component happens to be mounted.
import {
  attacker,
  defender,
  errors,
  includeDefenderBonus,
  isCarrierToStar,
  result,
} from "@/stores/basicCalculator";

const hasDefenderBonus = computed(
  () => game.settings.specialGalaxy.defenderBonus === "enabled",
);

// `null` means the search was abandoned - the battle was too big to walk up
// one ship at a time. Say so, rather than quietly showing nothing.
const shipsNeededUnknown = computed(() => {
  if (result.value?.defender.shipsNeeded === null) {
    return "Defender";
  }

  if (result.value?.attacker.shipsNeeded === null) {
    return "Attacker";
  }

  return null;
});

const isInvalid = computed(() => {
  return (
    defender.value.weaponsLevel <= 0 ||
    attacker.value.weaponsLevel <= 0 ||
    attacker.value.ships <= 0
  );
});

const swapValues = () => {
  let dS = defender.value.ships,
    dW = defender.value.weaponsLevel,
    aS = attacker.value.ships,
    aW = attacker.value.weaponsLevel;

  defender.value.ships = aS;
  defender.value.weaponsLevel = aW;
  attacker.value.ships = dS;
  attacker.value.weaponsLevel = dW;
};

const calculate = async (e: Event) => {
  errors.value = [];

  if (defender.value.weaponsLevel <= 0) {
    errors.value.push("Defender weapons level must be greater than 0.");
  }

  if (defender.value.ships < 0) {
    errors.value.push("Defender ships must be greater than or equal to 0.");
  }

  if (attacker.value.weaponsLevel <= 0) {
    errors.value.push("Attacker weapons level must be greater than 0.");
  }

  if (attacker.value.ships < 0) {
    errors.value.push("Attacker ships must be greater than or equal to 0.");
  }

  if (e) {
    e.preventDefault();
  }

  if (errors.value.length) {
    return;
  }

  const bonus = includeDefenderBonus.value && hasDefenderBonus.value;

  result.value = combatService.calculateBasic(
    defender.value,
    attacker.value,
    isCarrierToStar.value,
    bonus,
  );

  // Same rule the result panel above uses to name the winner: a draw goes to
  // the defender, who held the field.
  const defenderWon =
    result.value.defender.shipsAfter >= result.value.attacker.shipsAfter;

  addEntry({
    kind: "basic",
    sides: [
      { label: "Defender", ships: result.value.defender.shipsBefore },
      { label: "Attacker", ships: result.value.attacker.shipsBefore },
    ],
    winner: defenderWon ? "Defender" : "Attacker",
    input: {
      defender: { ...defender.value },
      attacker: { ...attacker.value },
      isCarrierToStar: isCarrierToStar.value,
      includeDefenderBonus: bonus,
    },
  });
};
</script>

<style scoped>
.form-check-input,
.form-check-label {
  cursor: pointer;
}
</style>
