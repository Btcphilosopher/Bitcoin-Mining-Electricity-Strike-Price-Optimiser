/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ASICMachine {
  id: string;
  model: string;
  hashrateTH: number; // in Terahashes per second (TH/s)
  powerDrawKW: number; // in Kilowatts (kW)
  efficiencyJTH: number; // Joules per Terahash (J/TH)
  temperatureC: number; // Current operating temperature
  uptimeHrs: number;
  ageDays: number;
  availability: number; // percentage (0 - 100)
  failureProbability: number; // current failure probability (0 - 100)
  status: 'RUN' | 'THROTTLE' | 'PAUSE' | 'CURTAIL';
  lastSwitchTime: number; // Timestamp of last switch (to enforce min runtime)
  consecutiveRunningHrs: number;
}

export interface FleetStats {
  totalHashrateEH: number; // Exahashes per second (EH/s)
  totalPowerMW: number; // Megawatts (MW)
  averageEfficiencyJTH: number; // J/TH
  expectedBtcPerDay: number;
  expectedRevenueUsdPerDay: number;
  expectedRevenueGbpPerDay: number;
  expectedEnergyCostUsdPerDay: number;
  expectedEnergyCostGbpPerDay: number;
  expectedGrossMarginUsdPerDay: number;
  expectedGrossMarginGbpPerDay: number;
}

export interface MarketData {
  btcPriceUsd: number;
  btcPriceGbp: number;
  networkDifficultyT: number; // in Trillions (T)
  networkHashrateEH: number; // EH/s
  blockSubsidyBtc: number; // typically 3.125 currently
  avgTxFeeBtc: number; // average transaction fee per block
  poolFeePercent: number;
  usdToGbpRate: number;
}

export interface PowerMarketData {
  currency: 'USD' | 'GBP';
  priceType: 'DAY_AHEAD' | 'INTRADAY' | 'REAL_TIME' | 'FIXED_PPA' | 'VARIABLE_PPA';
  basePricePerMWh: number; // wholesale rate in active currency
  gridChargesPerMWh: number;
  transmissionChargesPerMWh: number;
  demandChargeKwMonth: number;
  balancingCostsPerMWh: number;
  curtailmentPaymentPerMWh: number; // Payment received if we agree to turn off
  negativePricePeriod: boolean;
}

export interface OpportunityCost {
  gridExportPricePerMWh: number;
  batteryStorageValuePerMWh: number;
  demandResponseValuePerMWh: number;
  industrialLoadValuePerMWh: number;
  curtailmentValuePerMWh: number;
}

export interface ThermalModel {
  ambientTempC: number;
  coolingCapacityKW: number;
  coolingEfficiencyCop: number; // Coefficient of Performance (e.g., 3.5)
  coolingPowerDrawKW: number; // Computed power consumption of fans/coolant loops
  thermalDeratingFactor: number; // 0 to 1 scaling of max sustainable hashrate
}

export interface SwitchingCostConfig {
  thermalCyclingWearUsd: number; // cost equivalent of thermal cycle
  startupDelayMinutes: number;
  minimumRuntimeHrs: number;
  minimumShutdownHrs: number;
  lostMiningTimeUsd: number;
}

export interface DecisionRecord {
  timestamp: string;
  unixTime: number;
  electricityPricePerMWh: number;
  expectedMiningValuePerMWh: number;
  miningStrikePricePerMWh: number;
  miningMarginPerMWh: number;
  bestAlternativeValuePerMWh: number;
  bestAlternativeSource: string;
  recommendedAsicLoadPercent: number;
  decision: 'MINE_100' | 'THROTTLE' | 'PAUSE' | 'CURTAIL' | 'GRID_EXPORT';
  reason: string;
  modelVersion: string;
  inputs: {
    btcPrice: number;
    networkDifficulty: number;
    powerPrice: number;
    ambientTemp: number;
  };
}

export interface SimulationScenario {
  id: string;
  name: string;
  btcTrend: 'BULL' | 'BASE' | 'BEAR';
  powerPriceTrend: 'LOW' | 'BASE' | 'HIGH';
  difficultyTrend: 'LOW' | 'BASE' | 'HIGH';
  gridDemandTrend: 'LOW' | 'BASE' | 'HIGH';
  description: string;
}

export interface MonteCarloResult {
  percentile: 'P10' | 'P25' | 'P50' | 'P75' | 'P90';
  revenueUsd: number;
  electricityCostUsd: number;
  gridRevenueUsd: number;
  netProfitUsd: number;
  btcProduced: number;
  curtailmentPercent: number;
  roiPercent: number;
}

export interface BreakEvenMetrics {
  breakEvenBtcPriceUsd: number;
  breakEvenBtcPriceGbp: number;
  breakEvenElectricityPricePerMWh: number;
  breakEvenNetworkDifficultyT: number;
  breakEvenAsicEfficiencyJTH: number;
  breakEvenNetworkHashrateEH: number;
}
