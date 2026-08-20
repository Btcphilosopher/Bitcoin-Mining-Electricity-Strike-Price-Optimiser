/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ASICMachine,
  MarketData,
  PowerMarketData,
  OpportunityCost,
  ThermalModel,
  SwitchingCostConfig,
  DecisionRecord,
  FleetStats,
  MonteCarloResult,
  BreakEvenMetrics,
  SimulationScenario
} from '../types';

// Standard constant: blocks per day per TH/s formula coefficient
// Blocks/day = (1e12 * 86400) / (Difficulty * 2^32) = 20116567.61 / Difficulty
export const BLOCKS_PER_DAY_COEFF = 20116567.61;

/**
 * Generate a simulated ASIC fleet of a given size with varied age, efficiency, and models
 */
export function generateAsicFleet(fleetSize: number = 120): ASICMachine[] {
  const fleet: ASICMachine[] = [];
  const models = [
    { name: 'Antminer S21', hashrate: 200, powerDraw: 3.5, efficiency: 17.5 }, // Elite
    { name: 'WhatsMiner M60S', hashrate: 186, powerDraw: 3.44, efficiency: 18.5 }, // Elite
    { name: 'Antminer S19 XP', hashrate: 141, powerDraw: 3.03, efficiency: 21.5 }, // High-efficiency
    { name: 'WhatsMiner M50S+', hashrate: 136, powerDraw: 3.26, efficiency: 24.0 }, // Mid-efficiency
    { name: 'Antminer S19 Pro', hashrate: 110, powerDraw: 3.25, efficiency: 29.5 }, // Legacy standard
    { name: 'WhatsMiner M30S++', hashrate: 112, powerDraw: 3.47, efficiency: 31.0 }, // Legacy standard
    { name: 'Antminer S9', hashrate: 14, powerDraw: 1.37, efficiency: 98.0 } // Vintage / emergency load bank
  ];

  for (let i = 0; i < fleetSize; i++) {
    // Distribute models: newer are more common in serious fleets, but there's always a mix
    let modelIdx = 0;
    const rand = Math.random();
    if (rand < 0.20) modelIdx = 0; // S21
    else if (rand < 0.35) modelIdx = 1; // M60S
    else if (rand < 0.60) modelIdx = 2; // S19 XP
    else if (rand < 0.80) modelIdx = 3; // M50S+
    else if (rand < 0.92) modelIdx = 4; // S19 Pro
    else if (rand < 0.97) modelIdx = 5; // M30S++
    else modelIdx = 6; // Vintage S9

    const spec = models[modelIdx];
    const ageDays = Math.floor(Math.random() * 800) + (spec.efficiency < 20 ? 10 : 300);
    const availability = 95 + Math.random() * 5 - (ageDays > 600 ? Math.random() * 5 : 0);
    const failureProbability = Math.max(0.1, (ageDays / 1000) * 1.5 + (Math.random() * 2));
    
    // Vary specifications slightly to represent manufacturing variance and silicon lottery (+- 3%)
    const variance = 0.97 + Math.random() * 0.06;
    const actualHashrate = Number((spec.hashrate * variance).toFixed(1));
    const actualPower = Number((spec.powerDraw * variance).toFixed(2));
    const actualEfficiency = Number(((actualPower * 1000) / actualHashrate).toFixed(2));

    // Warm temp based on model
    const tempC = 55 + Math.random() * 15;

    fleet.push({
      id: `ASIC-${String(i + 1).padStart(4, '0')}`,
      model: spec.name,
      hashrateTH: actualHashrate,
      powerDrawKW: actualPower,
      efficiencyJTH: actualEfficiency,
      temperatureC: Number(tempC.toFixed(1)),
      uptimeHrs: Math.floor(ageDays * 24 * (availability / 100)),
      ageDays,
      availability: Number(availability.toFixed(2)),
      failureProbability: Number(failureProbability.toFixed(2)),
      status: 'RUN',
      lastSwitchTime: Date.now() - (Math.random() * 48 * 3600000), // random last switched time
      consecutiveRunningHrs: Math.floor(Math.random() * 120) + 12
    });
  }

  // Sort fleet by efficiency (J/TH) ascending so the most efficient machines are processed first
  return fleet.sort((a, b) => a.efficiencyJTH - b.efficiencyJTH);
}

/**
 * Calculates expected BTC per Terahash (TH/s) per day
 */
export function calculateExpectedBtcPerTHDay(
  difficultyT: number,
  blockSubsidyBtc: number,
  avgTxFeeBtc: number,
  poolFeePercent: number
): number {
  // Convert difficulty T (Trillions) to base
  const difficultyBase = difficultyT * 1e12;
  const blockReward = blockSubsidyBtc + avgTxFeeBtc;
  
  // Formula: (Hashrate_TH * seconds_per_day * Block Reward) / (Difficulty * 2^32) * (1 - PoolFee)
  // Hashrate_TH = 1 TH/s = 1e12 H/s
  const expectedBtc = (1e12 * 86400 * blockReward) / (difficultyBase * 4294967296);
  return expectedBtc * (1 - poolFeePercent / 100);
}

/**
 * Calculates cooling factor overhead and power requirements based on site temperature
 */
export function calculateCoolingPower(
  asicPowerDrawKW: number,
  thermal: ThermalModel
): { coolingPowerKW: number; effectiveEfficiencyMultiplier: number } {
  // If ambient temperature is high, cooling requirements scale up
  // Below 15C, active air chilling is minimal (ambient draft is enough), only fans run (approx 2% of ASIC power)
  // Above 15C, evaporative cooling or active chillers kick in.
  const tempThreshold = 15;
  let coolingRatio = 0.02; // Base fan power is 2% of ASIC draw

  if (thermal.ambientTempC > tempThreshold) {
    // Cooling power scales non-linearly with temperature up to cooling capacity limits
    const degreesAbove = thermal.ambientTempC - tempThreshold;
    
    // We model COP (Coefficient of Performance)
    // Cooling demand in kW: higher temps mean higher cooling load
    // Simple cooling demand estimation: 0.015 kW of cooling needed per kW of ASIC power per degree C above threshold
    const coolingDemandKW = asicPowerDrawKW * 0.015 * degreesAbove;
    
    // Power drawn by chillers = Demand / COP
    const activeCoolingPowerKW = coolingDemandKW / thermal.coolingEfficiencyCop;
    
    // Cap cooling power at site capacity
    const actualActiveCoolingKW = Math.min(activeCoolingPowerKW, thermal.coolingCapacityKW);
    
    coolingRatio = (asicPowerDrawKW * 0.02 + actualActiveCoolingKW) / asicPowerDrawKW;
  }

  // If ambient is dangerously high (e.g., > 40C), we apply thermal derating (throttling hashrate to protect hardware)
  let deratingFactor = 1.0;
  if (thermal.ambientTempC > 38) {
    deratingFactor = Math.max(0.5, 1.0 - (thermal.ambientTempC - 38) * 0.08); // drops 8% per degree above 38C
  }

  return {
    coolingPowerKW: asicPowerDrawKW * coolingRatio,
    effectiveEfficiencyMultiplier: coolingRatio + 1 / deratingFactor
  };
}

/**
 * Calculate the overall fleet metrics
 */
export function calculateFleetStats(
  fleet: ASICMachine[],
  market: MarketData,
  powerMarket: PowerMarketData,
  thermal: ThermalModel
): FleetStats {
  let totalHashrateTH = 0;
  let totalAsicPowerKW = 0;
  let runningAsicPowerKW = 0;
  let totalCoolingPowerKW = 0;
  let totalBtcPerDay = 0;

  fleet.forEach(machine => {
    // Only running/throttled machines consume power and produce hashrate
    if (machine.status === 'RUN' || machine.status === 'THROTTLE') {
      const scale = machine.status === 'THROTTLE' ? 0.6 : 1.0; // Throttling runs at 60% load/hashrate
      const machineHashrate = machine.hashrateTH * scale;
      const machinePower = machine.powerDrawKW * scale;

      totalHashrateTH += machineHashrate;
      runningAsicPowerKW += machinePower;

      // Compute individual cooling overhead
      const { coolingPowerKW } = calculateCoolingPower(machinePower, thermal);
      totalCoolingPowerKW += coolingPowerKW;

      // Expected BTC per day for this machine
      const btcPerTHDay = calculateExpectedBtcPerTHDay(
        market.networkDifficultyT,
        market.blockSubsidyBtc,
        market.avgTxFeeBtc,
        market.poolFeePercent
      );
      totalBtcPerDay += machineHashrate * btcPerTHDay;
    }
    
    totalAsicPowerKW += machine.powerDrawKW;
  });

  // Total site power includes running ASICs + cooling power
  const totalPowerKW = runningAsicPowerKW + totalCoolingPowerKW;
  const totalPowerMW = totalPowerKW / 1000;

  // Average efficiency across the fleet (J/TH = total W / total TH/s)
  const averageEfficiencyJTH = totalHashrateTH > 0 ? (runningAsicPowerKW * 1000) / totalHashrateTH : 0;

  // Revenue in USD and GBP
  const expectedRevenueUsdPerDay = totalBtcPerDay * market.btcPriceUsd;
  const expectedRevenueGbpPerDay = expectedRevenueUsdPerDay * market.usdToGbpRate;

  // Energy cost calculations
  // Price is per MWh. 1 MW of power for 1 day = 24 MWh of energy.
  const totalMWhPerDay = totalPowerMW * 24;
  
  // Power price is wholesale. Add grid, transmission, and balancing charges.
  const fullyLoadedPowerPricePerMWh = 
    powerMarket.basePricePerMWh + 
    powerMarket.gridChargesPerMWh + 
    powerMarket.transmissionChargesPerMWh + 
    powerMarket.balancingCostsPerMWh;

  let energyCostPerDayActiveCurrency = totalMWhPerDay * fullyLoadedPowerPricePerMWh;
  
  // Convert energy cost based on active currency
  let expectedEnergyCostUsdPerDay = 0;
  let expectedEnergyCostGbpPerDay = 0;

  if (powerMarket.currency === 'GBP') {
    expectedEnergyCostGbpPerDay = energyCostPerDayActiveCurrency;
    expectedEnergyCostUsdPerDay = energyCostPerDayActiveCurrency / market.usdToGbpRate;
  } else {
    expectedEnergyCostUsdPerDay = energyCostPerDayActiveCurrency;
    expectedEnergyCostGbpPerDay = energyCostPerDayActiveCurrency * market.usdToGbpRate;
  }

  const expectedGrossMarginUsdPerDay = expectedRevenueUsdPerDay - expectedEnergyCostUsdPerDay;
  const expectedGrossMarginGbpPerDay = expectedRevenueGbpPerDay - expectedEnergyCostGbpPerDay;

  return {
    totalHashrateEH: totalHashrateTH / 1e6, // Convert TH/s to EH/s
    totalPowerMW,
    averageEfficiencyJTH,
    expectedBtcPerDay: totalBtcPerDay,
    expectedRevenueUsdPerDay,
    expectedRevenueGbpPerDay,
    expectedEnergyCostUsdPerDay,
    expectedEnergyCostGbpPerDay,
    expectedGrossMarginUsdPerDay,
    expectedGrossMarginGbpPerDay
  };
}

/**
 * Calculates current mining value and opportunity-adjusted strike price for a given J/TH efficiency
 */
export function calculateAsicEconomics(
  efficiencyJTH: number,
  market: MarketData,
  powerMarket: PowerMarketData,
  thermal: ThermalModel
): {
  btcPerMWh: number;
  miningValuePerMWh: number; // in active currency (USD or GBP)
  strikePricePerMWh: number; // break-even electricity price in active currency
} {
  // 1 MWh of energy = 1000 kWh = 1,000,000 Wh.
  // Effective efficiency incorporates cooling factor
  const { effectiveEfficiencyMultiplier } = calculateCoolingPower(1.0, thermal);
  const effectiveEfficiency = efficiencyJTH * effectiveEfficiencyMultiplier;

  // Hashrate TH generated by 1 MWh of energy running for 1 hour:
  // hashrate_TH = energy_Wh / efficiency_JTH
  // 1 MWh = 3,600,000,000 Joules
  // hashrate_TH = 3.6e9 / efficiency_JTH
  // Wait, let's represent in terms of running hashrate per MW:
  // 1 MW power draw = 1000 kW power draw.
  // 1 MW draws 1000 kJ of energy per second.
  // 1000 kJ/s = 1,000,000 J/s.
  // hashrate_TH = (1,000,000 J/s) / (efficiency_J/TH) = 1,000,000 / efficiency TH/s.
  // Since 1 MW for 1 hour is 1 MWh:
  // TH-hours per MWh = 1,000,000 / efficiency.
  // Since expected BTC per TH is daily (24 hours), the BTC per TH-hour is:
  // BTC_per_TH_Hr = BTC_per_TH_day / 24
  // Thus, BTC produced per MWh is:
  // BTC_per_MWh = (1,000,000 / efficiency) * (BTC_per_TH_day / 24)
  const btcPerTHDay = calculateExpectedBtcPerTHDay(
    market.networkDifficultyT,
    market.blockSubsidyBtc,
    market.avgTxFeeBtc,
    market.poolFeePercent
  );

  const btcPerMWh = (1000000 / effectiveEfficiency) * (btcPerTHDay / 24);

  // Convert expected BTC to value in the currency of choice
  const btcPriceActiveCurrency = powerMarket.currency === 'GBP' 
    ? market.btcPriceUsd * market.usdToGbpRate 
    : market.btcPriceUsd;

  const miningValuePerMWh = btcPerMWh * btcPriceActiveCurrency;

  // Fully loaded charges that act as a deduction from our strike price
  // Strike price is the maximum wholesale electricity cost we can pay.
  // Strike Price + loaded charges = Mining Value per MWh.
  // Therefore, Strike Price = Mining Value per MWh - loaded charges
  const loadedCharges = 
    powerMarket.gridChargesPerMWh + 
    powerMarket.transmissionChargesPerMWh + 
    powerMarket.balancingCostsPerMWh;

  const strikePricePerMWh = Math.max(0, miningValuePerMWh - loadedCharges);

  return {
    btcPerMWh,
    miningValuePerMWh,
    strikePricePerMWh
  };
}

/**
 * Calculates Opportunity Cost per MWh (the best alternative value of electricity)
 */
export function calculateOpportunityCostPerMWh(
  oppCost: OpportunityCost,
  powerMarket: PowerMarketData
): { value: number; source: string } {
  let bestValue = 0;
  let source = 'None';

  if (oppCost.gridExportPricePerMWh > bestValue) {
    bestValue = oppCost.gridExportPricePerMWh;
    source = 'Grid Export';
  }
  if (oppCost.batteryStorageValuePerMWh > bestValue) {
    bestValue = oppCost.batteryStorageValuePerMWh;
    source = 'Battery Storage';
  }
  if (oppCost.demandResponseValuePerMWh > bestValue) {
    bestValue = oppCost.demandResponseValuePerMWh;
    source = 'Demand Response';
  }
  if (oppCost.industrialLoadValuePerMWh > bestValue) {
    bestValue = oppCost.industrialLoadValuePerMWh;
    source = 'Industrial Load Redirection';
  }
  if (powerMarket.curtailmentPaymentPerMWh > bestValue) {
    bestValue = powerMarket.curtailmentPaymentPerMWh;
    source = 'Curtailment Payout';
  }

  return { value: bestValue, source };
}

/**
 * Solves the optimal dispatch problem for the ASIC fleet at the current interval
 */
export function solveOptimalDispatch(
  fleet: ASICMachine[],
  market: MarketData,
  powerMarket: PowerMarketData,
  oppCost: OpportunityCost,
  thermal: ThermalModel,
  switchingConfig: SwitchingCostConfig,
  availablePowerMW: number = 100,
  decisionHour: number = 19
): {
  dispatchFleet: ASICMachine[];
  decisionRecord: DecisionRecord;
  allocatedAsicMW: number;
  allocatedExportMW: number;
} {
  // 1. Calculate Opportunity Cost
  const { value: bestAltPowerValue, source: altSource } = calculateOpportunityCostPerMWh(oppCost, powerMarket);

  // Fully loaded electricity cost
  const loadedCharges = 
    powerMarket.gridChargesPerMWh + 
    powerMarket.transmissionChargesPerMWh + 
    powerMarket.balancingCostsPerMWh;
  const currentFullyLoadedPricePerMWh = powerMarket.basePricePerMWh + loadedCharges;

  // 2. Process ASICs individually
  let totalRunningPowerKW = 0;
  const dispatchedFleet = fleet.map(machine => {
    // Determine individual economics
    const { miningValuePerMWh, strikePricePerMWh } = calculateAsicEconomics(
      machine.efficiencyJTH,
      market,
      powerMarket,
      thermal
    );

    // To prevent constant rapid switching, we model a switching delay & minimum run/off times
    const now = Date.now();
    const timeSinceSwitchHrs = (now - machine.lastSwitchTime) / 3600000;
    
    // Default decision matches economic rationality:
    // Expected Mining Value/MWh > Best Alternative Power Value AND Fully Loaded Electricity Price < Mining Value/MWh
    // Wait, the opportunity cost is what we COULD make if we didn't mine.
    // If we mine, our net value per MWh is: Mining Value - Fully Loaded Electricity Price.
    // If we curtail/sell, our net value is: Best Alternative Power Value - Wholesale Price (or direct payment).
    // In simpler terms, the economic benefit of mining is: Mining Value.
    // The economic benefit of alternative deployment is: Best Alternative Power Value + Power Purchase price saved (if we buy power).
    // Let's compare: Net Mining Profit vs Net Alternative Profit.
    // Net Mining Profit/MWh = Mining Value - Electricity Cost.
    // Net Alt Profit/MWh = Best Alternative Value - Electricity Cost (if we must buy it to redirect, or if we export PPA).
    // If we just curtail/export, our return is: Export price (bestAltPowerValue) OR curtailment payment.
    // So the marginal decision is: is Mining Value per MWh > Best Alternative Power Value AND is Mining Value > Fully Loaded Electricity Cost?
    // If Mining Value > Opportunity Cost AND Mining Value > Current Fully Loaded Electricity Price, MINE!
    const isMiningRational = miningValuePerMWh > bestAltPowerValue && miningValuePerMWh > currentFullyLoadedPricePerMWh;

    let targetStatus: 'RUN' | 'THROTTLE' | 'PAUSE' | 'CURTAIL' = 'CURTAIL';

    if (isMiningRational) {
      // If we are currently CURTAIL or PAUSE, verify minimum shutdown/cooldown time
      if (machine.status === 'CURTAIL' || machine.status === 'PAUSE') {
        if (timeSinceSwitchHrs >= switchingConfig.minimumShutdownHrs) {
          targetStatus = 'RUN';
        } else {
          // Locked in shutdown state
          targetStatus = machine.status;
        }
      } else {
        // Was running, keep running (can throttle if load constraints apply)
        targetStatus = 'RUN';
      }
    } else {
      // We should curtail
      // If we were running, verify minimum runtime
      if (machine.status === 'RUN' || machine.status === 'THROTTLE') {
        if (timeSinceSwitchHrs >= switchingConfig.minimumRuntimeHrs) {
          targetStatus = 'CURTAIL';
        } else {
          // Locked in running state to prevent thermal cycling shock
          targetStatus = machine.status;
        }
      } else {
        targetStatus = 'CURTAIL';
      }
    }

    // Apply capacity/load constraints
    // If running, does it exceed available power limit?
    // (We stack machines from most efficient to least. If we hit the MW capacity cap, we throttle or curtail older machines)
    const machinePowerKW = machine.powerDrawKW * (targetStatus === 'RUN' ? 1.0 : targetStatus === 'THROTTLE' ? 0.6 : 0);
    const { coolingPowerKW } = calculateCoolingPower(machinePowerKW, thermal);
    const totalMachineKW = machinePowerKW + coolingPowerKW;

    if ((targetStatus === 'RUN' || targetStatus === 'THROTTLE') && (totalRunningPowerKW + totalMachineKW) / 1000 > availablePowerMW) {
      // Overpower! Let's throttle or curtail this machine
      if (targetStatus === 'RUN' && (totalRunningPowerKW + totalMachineKW * 0.6) / 1000 <= availablePowerMW) {
        targetStatus = 'THROTTLE';
        totalRunningPowerKW += machinePowerKW * 0.6 + calculateCoolingPower(machinePowerKW * 0.6, thermal).coolingPowerKW;
      } else {
        targetStatus = 'CURTAIL';
      }
    } else if (targetStatus === 'RUN' || targetStatus === 'THROTTLE') {
      totalRunningPowerKW += totalMachineKW;
    }

    // Detect if status changed to update timestamp
    let updatedSwitchTime = machine.lastSwitchTime;
    let runningHrs = machine.consecutiveRunningHrs;
    if (targetStatus !== machine.status) {
      updatedSwitchTime = now;
      runningHrs = targetStatus === 'RUN' ? 1 : 0;
    } else if (targetStatus === 'RUN') {
      runningHrs += 1 / 60; // assume 1 minute tick
    }

    return {
      ...machine,
      status: targetStatus,
      lastSwitchTime: updatedSwitchTime,
      consecutiveRunningHrs: runningHrs
    };
  });

  // Calculate fleet stats with updated status
  const currentStats = calculateFleetStats(dispatchedFleet, market, powerMarket, thermal);
  
  // Dynamic Strike Price is the average strike price of running ASICs or the marginal machine
  const runningAsics = dispatchedFleet.filter(m => m.status === 'RUN' || m.status === 'THROTTLE');
  let avgStrikePrice = 0;
  let avgMiningValue = 0;

  if (runningAsics.length > 0) {
    const sumStrike = runningAsics.reduce((sum, m) => {
      const { strikePricePerMWh } = calculateAsicEconomics(m.efficiencyJTH, market, powerMarket, thermal);
      return sum + strikePricePerMWh;
    }, 0);
    const sumValue = runningAsics.reduce((sum, m) => {
      const { miningValuePerMWh } = calculateAsicEconomics(m.efficiencyJTH, market, powerMarket, thermal);
      return sum + miningValuePerMWh;
    }, 0);
    avgStrikePrice = sumStrike / runningAsics.length;
    avgMiningValue = sumValue / runningAsics.length;
  } else {
    // If none are running, display the strike price of the top elite ASIC
    const topAsic = fleet[0];
    const { strikePricePerMWh, miningValuePerMWh } = calculateAsicEconomics(topAsic.efficiencyJTH, market, powerMarket, thermal);
    avgStrikePrice = strikePricePerMWh;
    avgMiningValue = miningValuePerMWh;
  }

  // Determine aggregate decision and summary
  let decisionLabel: DecisionRecord['decision'] = 'PAUSE';
  let recommendedAsicLoadPercent = 0;
  let reason = '';

  const activeAsicPowerMW = currentStats.totalPowerMW;
  const remainingPowerMW = Math.max(0, availablePowerMW - activeAsicPowerMW);

  recommendedAsicLoadPercent = Math.min(100, (activeAsicPowerMW / availablePowerMW) * 100);

  if (recommendedAsicLoadPercent > 95) {
    decisionLabel = 'MINE_100';
    reason = `Mining expected value (${powerMarket.currency === 'GBP' ? '£' : '$'}${avgMiningValue.toFixed(2)}/MWh) exceeds electricity cost (${powerMarket.currency === 'GBP' ? '£' : '$'}${currentFullyLoadedPricePerMWh.toFixed(2)}/MWh) and best opportunity cost. High-efficiency dispatch stack fully active.`;
  } else if (recommendedAsicLoadPercent > 5) {
    decisionLabel = 'THROTTLE';
    reason = `Partial curtailment. Running top-tier efficient ASICs (${runningAsics.length}/${dispatchedFleet.length}). Throttled older ASICs to avoid high power cost or satisfy cooling constraints. Exporting ${remainingPowerMW.toFixed(1)} MW to grid.`;
  } else {
    decisionLabel = 'CURTAIL';
    reason = `Full curtailment triggered. Electricity cost (${powerMarket.currency === 'GBP' ? '£' : '$'}${currentFullyLoadedPricePerMWh.toFixed(2)}/MWh) or opportunity value (${powerMarket.currency === 'GBP' ? '£' : '$'}${bestAltPowerValue.toFixed(2)}/MWh) exceeds marginal mining revenue. Redirecting ${availablePowerMW.toFixed(1)} MW to alternative grid.`;
  }

  const miningMargin = avgMiningValue - currentFullyLoadedPricePerMWh;

  const decisionRecord: DecisionRecord = {
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    unixTime: Date.now(),
    electricityPricePerMWh: powerMarket.basePricePerMWh,
    expectedMiningValuePerMWh: avgMiningValue,
    miningStrikePricePerMWh: avgStrikePrice,
    miningMarginPerMWh: miningMargin,
    bestAlternativeValuePerMWh: bestAltPowerValue,
    bestAlternativeSource: altSource,
    recommendedAsicLoadPercent,
    decision: decisionLabel,
    reason,
    modelVersion: 'R-Econ-v4.2 // Rust-Control-v1.8',
    inputs: {
      btcPrice: market.btcPriceUsd,
      networkDifficulty: market.networkDifficultyT,
      powerPrice: powerMarket.basePricePerMWh,
      ambientTemp: thermal.ambientTempC
    }
  };

  return {
    dispatchFleet: dispatchedFleet,
    decisionRecord,
    allocatedAsicMW: activeAsicPowerMW,
    allocatedExportMW: remainingPowerMW
  };
}

/**
 * Calculates break-even indices for active market conditions
 */
export function calculateBreakEvens(
  fleet: ASICMachine[],
  market: MarketData,
  powerMarket: PowerMarketData,
  thermal: ThermalModel
): BreakEvenMetrics {
  const avgEfficiency = fleet.length > 0 
    ? fleet.reduce((sum, m) => sum + m.efficiencyJTH, 0) / fleet.length
    : 25.0;

  // Let's find break-even prices
  // 1. Break-even Electricity Price: Strike price is exactly the break-even electricity price
  const { miningValuePerMWh } = calculateAsicEconomics(avgEfficiency, market, powerMarket, thermal);
  const breakEvenPower = Math.max(0, miningValuePerMWh - (powerMarket.gridChargesPerMWh + powerMarket.transmissionChargesPerMWh + powerMarket.balancingCostsPerMWh));

  // 2. Break-even BTC Price: BTC price where Mining Value / MWh equals Fully Loaded Electricity Price
  // Mining Value / MWh = btcPerMWh * btcPrice = fullyLoadedElectricity
  // btcPrice = fullyLoadedElectricity / btcPerMWh
  const { btcPerMWh } = calculateAsicEconomics(avgEfficiency, market, powerMarket, thermal);
  const fullyLoadedElectricity = powerMarket.basePricePerMWh + powerMarket.gridChargesPerMWh + powerMarket.transmissionChargesPerMWh + powerMarket.balancingCostsPerMWh;
  
  const breakEvenBtcActive = btcPerMWh > 0 ? fullyLoadedElectricity / btcPerMWh : 50000;
  
  let breakEvenBtcUsd = 0;
  let breakEvenBtcGbp = 0;

  if (powerMarket.currency === 'GBP') {
    breakEvenBtcGbp = breakEvenBtcActive;
    breakEvenBtcUsd = breakEvenBtcActive / market.usdToGbpRate;
  } else {
    breakEvenBtcUsd = breakEvenBtcActive;
    breakEvenBtcGbp = breakEvenBtcActive * market.usdToGbpRate;
  }

  // 3. Break-even Network Difficulty T
  // BTC_per_MWh = (1,000,000 / efficiency) * (expectedBtcDay / 24)
  // expectedBtcDay = BLOCKS_PER_DAY_COEFF * reward * (1 - poolFee) / Difficulty
  // So: fullyLoadedElectricity = (1,000,000 / efficiency) * (BLOCKS_PER_DAY_COEFF * reward * (1 - poolFee) / Difficulty / 24) * btcPrice
  // Difficulty = (1,000,000 / efficiency) * (BLOCKS_PER_DAY_COEFF * reward * (1 - poolFee) / 24) * btcPrice / fullyLoadedElectricity
  const { effectiveEfficiencyMultiplier } = calculateCoolingPower(1.0, thermal);
  const effectiveAvgEff = avgEfficiency * effectiveEfficiencyMultiplier;
  const reward = market.blockSubsidyBtc + market.avgTxFeeBtc;
  const btcPriceActive = powerMarket.currency === 'GBP' ? market.btcPriceUsd * market.usdToGbpRate : market.btcPriceUsd;

  const difficultyNumerator = (1000000 / effectiveAvgEff) * (BLOCKS_PER_DAY_COEFF * reward * (1 - market.poolFeePercent / 100) / 24) * btcPriceActive;
  const breakEvenDifficultyT = fullyLoadedElectricity > 0 ? (difficultyNumerator / fullyLoadedElectricity) / 1e12 : 100.0;

  // 4. Break-even ASIC Efficiency: Efficiency where Mining Value equals Electricity Cost
  // miningValuePerMWh = btcPerMWh * btcPrice = (1,000,000 / efficiency) * (btcPerTHDay / 24) * btcPrice = fullyLoadedElectricity
  // efficiency = (1,000,000 * btcPerTHDay * btcPrice) / (24 * fullyLoadedElectricity)
  const btcPerTHDay = calculateExpectedBtcPerTHDay(market.networkDifficultyT, market.blockSubsidyBtc, market.avgTxFeeBtc, market.poolFeePercent);
  const breakEvenEff = fullyLoadedElectricity > 0 
    ? (1000000 * btcPerTHDay * btcPriceActive) / (24 * fullyLoadedElectricity * effectiveEfficiencyMultiplier)
    : 10.0;

  return {
    breakEvenBtcPriceUsd: breakEvenBtcUsd,
    breakEvenBtcPriceGbp: breakEvenBtcGbp,
    breakEvenElectricityPricePerMWh: breakEvenPower,
    breakEvenNetworkDifficultyT: breakEvenDifficultyT,
    breakEvenAsicEfficiencyJTH: breakEvenEff,
    breakEvenNetworkHashrateEH: breakEvenDifficultyT * 7.5 // linear correlation approximation for presentation
  };
}

/**
 * R Forecasting Module: Runs a Monte Carlo Simulation (1000 paths) to produce probability curves
 */
export function runMonteCarloSimulation(
  fleet: ASICMachine[],
  market: MarketData,
  powerMarket: PowerMarketData,
  oppCost: OpportunityCost,
  thermal: ThermalModel,
  switchingConfig: SwitchingCostConfig,
  scenarioTrend: SimulationScenario,
  runs: number = 1000
): MonteCarloResult[] {
  const baseBtc = market.btcPriceUsd;
  const baseDifficulty = market.networkDifficultyT;
  const basePowerPrice = powerMarket.basePricePerMWh;

  // Adjust standard deviations (volatility) and drift based on scenario trend
  let btcDrift = 0.0005; // standard minor drift
  let btcVol = 0.05; // 5% daily volatility
  let powerVol = 0.15; // 15% power volatility
  let diffDrift = 0.002; // difficulty tends to go up

  if (scenarioTrend.btcTrend === 'BULL') {
    btcDrift = 0.005;
    btcVol = 0.08;
  } else if (scenarioTrend.btcTrend === 'BEAR') {
    btcDrift = -0.004;
    btcVol = 0.06;
  }

  if (scenarioTrend.powerPriceTrend === 'HIGH') {
    basePowerPrice * 1.5;
    powerVol = 0.25;
  } else if (scenarioTrend.powerPriceTrend === 'LOW') {
    basePowerPrice * 0.7;
    powerVol = 0.10;
  }

  if (scenarioTrend.difficultyTrend === 'HIGH') {
    diffDrift = 0.005;
  } else if (scenarioTrend.difficultyTrend === 'LOW') {
    diffDrift = 0.0005;
  }

  const fleetStatsBase = calculateFleetStats(fleet, market, powerMarket, thermal);
  const totalFleetPowerMW = fleetStatsBase.totalPowerMW;

  const profits: number[] = [];
  const revenues: number[] = [];
  const costs: number[] = [];
  const gridRevenues: number[] = [];
  const btcProducedList: number[] = [];
  const curtailments: number[] = [];

  for (let r = 0; r < runs; r++) {
    // Simulate 30 days of operation
    let runRevenueUsd = 0;
    let runCostUsd = 0;
    let runGridRevenueUsd = 0;
    let runBtcMined = 0;
    let hoursCurtailed = 0;

    let simBtc = baseBtc;
    let simDiff = baseDifficulty;

    for (let day = 1; day <= 30; day++) {
      // Geometric Brownian Motion step for BTC price
      const btcShock = Math.exp((btcDrift - 0.5 * btcVol * btcVol) + btcVol * gaussianRandom());
      simBtc = simBtc * btcShock;

      // Difficulty step
      const diffShock = Math.exp((diffDrift) + 0.005 * gaussianRandom());
      simDiff = simDiff * diffShock;

      // Simulate 24 hours of power price swings
      for (let hr = 0; hr < 24; hr++) {
        // Power price has high volatility and mean reversion
        const timeOfDayFactor = Math.sin((hr - 6) * Math.PI / 12) * 15; // peak demand in afternoon
        let simPowerBase = basePowerPrice + timeOfDayFactor;
        
        if (scenarioTrend.gridDemandTrend === 'HIGH' && hr >= 17 && hr <= 21) {
          simPowerBase += 45; // extreme peak pricing
        } else if (scenarioTrend.gridDemandTrend === 'LOW') {
          simPowerBase -= 10;
        }

        const powerPrice = Math.max(-10, simPowerBase + simPowerBase * powerVol * gaussianRandom());

        // Update loop values
        const currentPowerMarket: PowerMarketData = { ...powerMarket, basePricePerMWh: powerPrice };
        const currentMarket: MarketData = { ...market, btcPriceUsd: simBtc, networkDifficultyT: simDiff };

        // Solve optimal dispatch
        const { decisionRecord, allocatedAsicMW, allocatedExportMW } = solveOptimalDispatch(
          fleet,
          currentMarket,
          currentPowerMarket,
          oppCost,
          thermal,
          switchingConfig,
          totalFleetPowerMW,
          hr
        );

        // Revenue & Costs calculation
        const scale = decisionRecord.recommendedAsicLoadPercent / 100;
        const btcMinedHr = (fleetStatsBase.expectedBtcPerDay / 24) * scale;
        runBtcMined += btcMinedHr;
        runRevenueUsd += btcMinedHr * simBtc;

        // Energy consumed by ASICs
        const mwhConsumed = (allocatedAsicMW) * 1.0; // 1 hour
        const fullyLoadedPrice = powerPrice + powerMarket.gridChargesPerMWh + powerMarket.transmissionChargesPerMWh + powerMarket.balancingCostsPerMWh;
        let costHrUsd = mwhConsumed * fullyLoadedPrice;
        if (powerMarket.currency === 'GBP') costHrUsd = costHrUsd / market.usdToGbpRate;
        runCostUsd += costHrUsd;

        // Grid Export or curtailment payment
        if (decisionRecord.decision === 'CURTAIL' || decisionRecord.decision === 'THROTTLE' || decisionRecord.decision === 'GRID_EXPORT') {
          hoursCurtailed += (1 - scale);
          let exportRevenueUsd = allocatedExportMW * decisionRecord.bestAlternativeValuePerMWh;
          if (powerMarket.currency === 'GBP') exportRevenueUsd = exportRevenueUsd / market.usdToGbpRate;
          runGridRevenueUsd += exportRevenueUsd;
        }
      }
    }

    const netProfitUsd = runRevenueUsd + runGridRevenueUsd - runCostUsd;
    profits.push(netProfitUsd);
    revenues.push(runRevenueUsd);
    costs.push(runCostUsd);
    gridRevenues.push(runGridRevenueUsd);
    btcProducedList.push(runBtcMined);
    curtailments.push((hoursCurtailed / (30 * 24)) * 100);
  }

  // Sort lists to find percentiles
  profits.sort((a, b) => a - b);
  revenues.sort((a, b) => a - b);
  costs.sort((a, b) => a - b);
  gridRevenues.sort((a, b) => a - b);
  btcProducedList.sort((a, b) => a - b);
  curtailments.sort((a, b) => a - b);

  // Standard economic indices (P10 = optimistic, P50 = median, P90 = conservative)
  // Let's match array indices. 1000 items:
  // P90 (conservative/downside - 90% chance of exceeding) => index 100
  // P75 => index 250
  // P50 => index 500
  // P25 => index 750
  // P10 (optimistic/upside - 10% chance of exceeding) => index 900
  const getIndex = (percent: number) => Math.min(runs - 1, Math.max(0, Math.floor(runs * percent)));

  const percentiles: { percentile: MonteCarloResult['percentile']; pVal: number }[] = [
    { percentile: 'P90', pVal: 0.10 }, // conservative downside
    { percentile: 'P75', pVal: 0.25 },
    { percentile: 'P50', pVal: 0.50 },
    { percentile: 'P25', pVal: 0.75 },
    { percentile: 'P10', pVal: 0.90 }  // optimistic upside
  ];

  return percentiles.map(({ percentile, pVal }) => {
    const idx = getIndex(pVal);
    const cost = costs[idx];
    const rev = revenues[idx];
    const grid = gridRevenues[idx];
    const profit = profits[idx];
    
    // Simple ROI calculation: profit / cost
    const roi = cost > 0 ? (profit / cost) * 100 : 0;

    return {
      percentile,
      revenueUsd: Math.round(rev),
      electricityCostUsd: Math.round(cost),
      gridRevenueUsd: Math.round(grid),
      netProfitUsd: Math.round(profit),
      btcProduced: Number(btcProducedList[idx].toFixed(4)),
      curtailmentPercent: Number(curtailments[idx].toFixed(1)),
      roiPercent: Number(roi.toFixed(2))
    };
  });
}

// Helper standard normal distribution generator (Box-Muller transform)
function gaussianRandom(): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); 
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Generates 30 days of historical series for Backtesting comparisons
 */
export interface BacktestInterval {
  day: number;
  date: string;
  btcPrice: number;
  electricityPrice: number;
  strikePrice: number;
  // Always-On economics
  alwaysOnBtcMined: number;
  alwaysOnRevenue: number;
  alwaysOnPowerCost: number;
  alwaysOnNetProfit: number;
  // Optimised economics
  optimisedBtcMined: number;
  optimisedRevenue: number;
  optimisedPowerCost: number;
  optimisedGridRevenue: number;
  optimisedNetProfit: number;
  curtailmentOccurred: boolean;
}

export function runHistoricalBacktest(
  fleet: ASICMachine[],
  baseMarket: MarketData,
  basePowerMarket: PowerMarketData,
  oppCost: OpportunityCost,
  thermal: ThermalModel,
  switchingConfig: SwitchingCostConfig
): BacktestInterval[] {
  const history: BacktestInterval[] = [];
  const baseBtc = baseMarket.btcPriceUsd;
  const basePower = basePowerMarket.basePricePerMWh;
  const fleetStatsBase = calculateFleetStats(fleet, baseMarket, basePowerMarket, thermal);
  const totalFleetPowerMW = fleetStatsBase.totalPowerMW;

  let cumulativeAlwaysOnProfit = 0;
  let cumulativeOptimisedProfit = 0;

  for (let i = 29; i >= 0; i--) {
    // Generate dates working backwards
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

    // Generate correlated historical values
    // Create price waves & spikes
    const btcTrendFactor = Math.sin((30 - i) * Math.PI / 15) * 2000; // BTC cyclicity
    const btcPrice = Math.max(30000, baseBtc - 4000 + btcTrendFactor + (Math.random() * 1500 - 750));
    
    // Power price has typical seasonal and random spikes
    // Create high price spikes on day 5, 14, 23
    let electricityPrice = basePower + (Math.random() * 20 - 10);
    if (i === 5 || i === 14 || i === 23) {
      electricityPrice += 120; // grid strain spike
    } else if (i === 10 || i === 20) {
      electricityPrice = -5; // wind power negative price
    }

    const currentPowerMarket = { ...basePowerMarket, basePricePerMWh: electricityPrice };
    const currentMarket = { ...baseMarket, btcPriceUsd: btcPrice };

    // Solve Optimdispatch
    const { decisionRecord, allocatedAsicMW, allocatedExportMW } = solveOptimalDispatch(
      fleet,
      currentMarket,
      currentPowerMarket,
      oppCost,
      thermal,
      switchingConfig,
      totalFleetPowerMW,
      12 // mid-day decision
    );

    // 1. Always-On Mining
    // Always runs 100% load, pays electricity wholesale rate + grid charges
    const alwaysOnBtcMined = fleetStatsBase.expectedBtcPerDay;
    const alwaysOnRevenue = alwaysOnBtcMined * btcPrice;
    const alwaysOnMWh = totalFleetPowerMW * 24;
    const fullyLoadedCost = electricityPrice + basePowerMarket.gridChargesPerMWh + basePowerMarket.transmissionChargesPerMWh + basePowerMarket.balancingCostsPerMWh;
    let alwaysOnPowerCost = alwaysOnMWh * fullyLoadedCost;
    if (basePowerMarket.currency === 'GBP') alwaysOnPowerCost = alwaysOnPowerCost / baseMarket.usdToGbpRate;
    const alwaysOnNetProfit = alwaysOnRevenue - alwaysOnPowerCost;

    // 2. Optimised Mining
    // Can choose to curtail, run partially, or export power based on strike prices
    const loadFactor = decisionRecord.recommendedAsicLoadPercent / 100;
    const optimisedBtcMined = alwaysOnBtcMined * loadFactor;
    const optimisedRevenue = optimisedBtcMined * btcPrice;
    
    const activeAsicMWh = (allocatedAsicMW) * 24;
    let optimisedPowerCost = activeAsicMWh * fullyLoadedCost;
    if (basePowerMarket.currency === 'GBP') optimisedPowerCost = optimisedPowerCost / baseMarket.usdToGbpRate;

    // Grid export credits
    const exportMWh = (allocatedExportMW) * 24;
    let optimisedGridRevenue = exportMWh * decisionRecord.bestAlternativeValuePerMWh;
    if (basePowerMarket.currency === 'GBP') optimisedGridRevenue = optimisedGridRevenue / baseMarket.usdToGbpRate;

    const optimisedNetProfit = optimisedRevenue + optimisedGridRevenue - optimisedPowerCost;

    cumulativeAlwaysOnProfit += alwaysOnNetProfit;
    cumulativeOptimisedProfit += optimisedNetProfit;

    history.push({
      day: 30 - i,
      date: dateString,
      btcPrice: Math.round(btcPrice),
      electricityPrice: Math.round(electricityPrice),
      strikePrice: Math.round(decisionRecord.miningStrikePricePerMWh),
      alwaysOnBtcMined,
      alwaysOnRevenue: Math.round(alwaysOnRevenue),
      alwaysOnPowerCost: Math.round(alwaysOnPowerCost),
      alwaysOnNetProfit: Math.round(alwaysOnNetProfit),
      optimisedBtcMined,
      optimisedRevenue: Math.round(optimisedRevenue),
      optimisedPowerCost: Math.round(optimisedPowerCost),
      optimisedGridRevenue: Math.round(optimisedGridRevenue),
      optimisedNetProfit: Math.round(optimisedNetProfit),
      curtailmentOccurred: loadFactor < 0.95
    });
  }

  return history;
}
