/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Coins, 
  Cpu, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  FileCheck, 
  Thermometer, 
  ArrowRight,
  BatteryCharging,
  Globe
} from 'lucide-react';
import { MarketData, PowerMarketData, OpportunityCost, ThermalModel, DecisionRecord, FleetStats } from '../types';

interface DashboardProps {
  market: MarketData;
  setMarket: React.Dispatch<React.SetStateAction<MarketData>>;
  powerMarket: PowerMarketData;
  setPowerMarket: React.Dispatch<React.SetStateAction<PowerMarketData>>;
  oppCost: OpportunityCost;
  setOppCost: React.Dispatch<React.SetStateAction<OpportunityCost>>;
  thermal: ThermalModel;
  setThermal: React.Dispatch<React.SetStateAction<ThermalModel>>;
  fleetStats: FleetStats;
  decision: DecisionRecord;
  allocatedAsicMW: number;
  allocatedExportMW: number;
  availablePowerMW: number;
  setAvailablePowerMW: (val: number) => void;
  isSimulating: boolean;
  toggleSimulation: () => void;
}

export default function Dashboard({
  market,
  setMarket,
  powerMarket,
  setPowerMarket,
  oppCost,
  setOppCost,
  thermal,
  setThermal,
  fleetStats,
  decision,
  allocatedAsicMW,
  allocatedExportMW,
  availablePowerMW,
  setAvailablePowerMW,
  isSimulating,
  toggleSimulation
}: DashboardProps) {
  
  // Format currencies properly
  const formatCurrency = (val: number, symbol = '$', decimals = 2) => {
    return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const getDecisionStyles = (dec: DecisionRecord['decision']) => {
    switch (dec) {
      case 'MINE_100':
        return {
          bg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
          badge: 'bg-emerald-500 text-white',
          label: 'OPTIMAL DISPATCH: MINE AT 100%'
        };
      case 'THROTTLE':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-200',
          badge: 'bg-amber-500 text-white',
          label: 'OPTIMAL DISPATCH: THROTTLE ASIC FLEET'
        };
      case 'CURTAIL':
        return {
          bg: 'bg-rose-50 text-rose-900 border-rose-200',
          badge: 'bg-rose-500 text-white',
          label: 'OPTIMAL DISPATCH: FULL CURTAILMENT'
        };
      case 'GRID_EXPORT':
        return {
          bg: 'bg-blue-50 text-blue-900 border-blue-200',
          badge: 'bg-blue-500 text-white',
          label: 'OPTIMAL DISPATCH: EXPORT TO GRID'
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-900 border-slate-200',
          badge: 'bg-slate-500 text-white',
          label: 'OPTIMAL DISPATCH: HOLD / PAUSE'
        };
    }
  };

  const currentStyles = getDecisionStyles(decision.decision);
  const currencySymbol = powerMarket.currency === 'GBP' ? '£' : '$';

  return (
    <div id="operational-dashboard" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT PANEL: Live Controls & Inputs */}
      <div id="live-inputs-panel" className="lg:col-span-4 space-y-6">
        <div className="bg-[#15181F] border border-slate-800 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold tracking-wide text-white uppercase">
              Control Console
            </h2>
            <button
              onClick={toggleSimulation}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                isSimulating 
                  ? 'bg-rose-900/40 text-rose-300 border border-rose-500/20 hover:bg-rose-900/60' 
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {isSimulating ? 'Pause Feed' : 'Resume Feed'}
            </button>
          </div>
          
          <p className="text-xs text-slate-400 mb-6">
            Ingesting real-time market and thermal telemetry feeds. Tweak sliders to see immediate algorithmic dispatch overrides.
          </p>

          <div className="space-y-5">
            {/* BTC Price Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-slate-600" /> Bitcoin Price (USD)</span>
                <span className="font-mono text-white">{formatCurrency(market.btcPriceUsd, '$', 0)}</span>
              </div>
              <input
                type="range"
                min="45000"
                max="180000"
                step="500"
                value={market.btcPriceUsd}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMarket(prev => ({ 
                    ...prev, 
                    btcPriceUsd: val,
                    btcPriceGbp: Number((val * prev.usdToGbpRate).toFixed(0))
                  }));
                }}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Electricity Wholesale Price Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-slate-600" /> Electricity Spot Price</span>
                <span className="font-mono text-white">{formatCurrency(powerMarket.basePricePerMWh, currencySymbol, 0)}/MWh</span>
              </div>
              <input
                type="range"
                min="-10"
                max="250"
                step="1"
                value={powerMarket.basePricePerMWh}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPowerMarket(prev => ({ ...prev, basePricePerMWh: val }));
                }}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Network Difficulty */}
            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-slate-600" /> Network Difficulty (T)</span>
                <span className="font-mono text-white">{market.networkDifficultyT.toFixed(1)} T</span>
              </div>
              <input
                type="range"
                min="50"
                max="180"
                step="0.5"
                value={market.networkDifficultyT}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMarket(prev => ({ 
                    ...prev, 
                    networkDifficultyT: val,
                    networkHashrateEH: val * 7.5 // approximate mapping
                  }));
                }}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Ambient Temperature */}
            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5 text-slate-600" /> Ambient Temperature</span>
                <span className={`font-mono ${thermal.ambientTempC > 35 ? 'text-rose-400 font-bold' : 'text-white'}`}>
                  {thermal.ambientTempC.toFixed(1)}°C
                </span>
              </div>
              <input
                type="range"
                min="-10"
                max="45"
                step="0.5"
                value={thermal.ambientTempC}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setThermal(prev => ({ ...prev, ambientTempC: val }));
                }}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Total Available Capacity MW */}
            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-slate-600" /> Facility Available Power</span>
                <span className="font-mono text-white">{availablePowerMW} MW</span>
              </div>
              <input
                type="range"
                min="5"
                max="150"
                step="5"
                value={availablePowerMW}
                onChange={(e) => {
                  setAvailablePowerMW(Number(e.target.value));
                }}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Opportunity Cost Configurations */}
        <div className="bg-[#15181F] border border-slate-800 rounded-xl p-6 shadow-xs">
          <h2 className="text-xs font-bold tracking-wide text-white uppercase mb-4">
            Power Opportunity Costs
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Configure the alternative values of electricity when mining is curtailed. The optimiser automatically shifts load to the highest value option.
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span>Grid Export Value</span>
                <span className="font-mono text-white">{formatCurrency(oppCost.gridExportPricePerMWh, currencySymbol, 0)}/MWh</span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                step="1"
                value={oppCost.gridExportPricePerMWh}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setOppCost(prev => ({ ...prev, gridExportPricePerMWh: val }));
                }}
                className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span>Battery Arbitrage Value</span>
                <span className="font-mono text-white">{formatCurrency(oppCost.batteryStorageValuePerMWh, currencySymbol, 0)}/MWh</span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                step="1"
                value={oppCost.batteryStorageValuePerMWh}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setOppCost(prev => ({ ...prev, batteryStorageValuePerMWh: val }));
                }}
                className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span>Grid Curtailment Payment</span>
                <span className="font-mono text-white">{formatCurrency(powerMarket.curtailmentPaymentPerMWh, currencySymbol, 0)}/MWh</span>
              </div>
              <input
                type="range"
                min="0"
                max="120"
                step="1"
                value={powerMarket.curtailmentPaymentPerMWh}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPowerMarket(prev => ({ ...prev, curtailmentPaymentPerMWh: val }));
                }}
                className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Dispatch Decider & Live Power Flow Visualisation */}
      <div id="dispatch-display" className="lg:col-span-8 space-y-6">
        
        {/* Sleek Central Display Block (Aeterna Recommendation Engine) */}
        <div className="bg-[#0F1117] rounded-2xl border border-slate-800 p-8 flex flex-col justify-center items-center relative overflow-hidden">
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-[9px] text-blue-400 uppercase font-bold tracking-wider">
              Aeterna Recommendation Engine
            </div>
            <span className="text-slate-600 font-mono text-[9px]">
              {decision.modelVersion}
            </span>
          </div>

          <h2 className="text-[72px] md:text-[96px] font-black tracking-tighter leading-none text-white uppercase text-center italic mt-2">
            {decision.decision === 'MINE_100' ? 'RUN' : decision.decision === 'THROTTLE' ? 'THROTTLE' : decision.decision === 'CURTAIL' ? 'CURTAIL' : decision.decision === 'GRID_EXPORT' ? 'EXPORT' : decision.decision}
          </h2>

          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 mt-6">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Target Load</p>
              <p className="text-2xl font-mono text-white mt-0.5">{decision.recommendedAsicLoadPercent.toFixed(0)}%</p>
            </div>
            <div className="hidden md:block w-px h-10 bg-slate-800"></div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Grid Export</p>
              <p className="text-2xl font-mono text-slate-400 mt-0.5">{allocatedExportMW.toFixed(1)} MW</p>
            </div>
            <div className="hidden md:block w-px h-10 bg-slate-800"></div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Mining Margin</p>
              <p className={`text-2xl font-mono mt-0.5 ${decision.miningMarginPerMWh >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400'}`}>
                {formatCurrency(decision.miningMarginPerMWh, currencySymbol, 2)}/MWh
              </p>
            </div>
          </div>

          <div className="mt-8 max-w-xl text-center px-6 py-3 bg-[#15181F] rounded-lg border border-slate-800">
            <p className="text-xs text-slate-400 leading-relaxed">
              Mining produces <span className="text-emerald-400 font-bold">{formatCurrency(Math.max(0, decision.miningMarginPerMWh), currencySymbol, 2)}/MWh</span> more economic value than alternative routing. {decision.reason}
            </p>
          </div>
        </div>

        {/* Live Power Flow Diagram & Grid Visualiser */}
        <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 bg-slate-800 text-[10px] font-mono tracking-wider text-slate-400 rounded-bl-lg">
            RUST DISPATCH TELEMETRY (LIVE)
          </div>

          <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-6">
            Facility Energy Routing
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative items-center">
            
            {/* Grid Input Module */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center z-10">
              <Zap className="w-6 h-6 mx-auto mb-2 text-amber-400" />
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Incoming Power</div>
              <div className="text-2xl font-mono font-black mt-1 text-white">
                {availablePowerMW.toFixed(1)} <span className="text-xs">MW</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1">
                Cost: {formatCurrency(powerMarket.basePricePerMWh, currencySymbol, 0)}/MWh
              </div>
            </div>

            {/* Central Animated Flow Paths */}
            <div className="hidden md:flex flex-col justify-center gap-8 h-full relative py-4">
              {/* Flow line to ASICs */}
              <div className="relative h-2 w-full bg-slate-850 rounded-full overflow-hidden">
                {allocatedAsicMW > 0 && (
                  <motion.div 
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-transparent via-amber-400 to-transparent"
                  />
                )}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-slate-400 uppercase bg-slate-900 px-2 rounded-full border border-slate-800">
                  {allocatedAsicMW.toFixed(1)} MW
                </div>
              </div>

              {/* Flow line to Grid Export */}
              <div className="relative h-2 w-full bg-slate-850 rounded-full overflow-hidden">
                {allocatedExportMW > 0 && (
                  <motion.div 
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                  />
                )}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-slate-400 uppercase bg-slate-900 px-2 rounded-full border border-slate-800">
                  {allocatedExportMW.toFixed(1)} MW
                </div>
              </div>
            </div>

            {/* Right Output Panels */}
            <div className="space-y-4 z-10">
              {/* ASIC Load Output */}
              <div className={`bg-slate-800 border rounded-lg p-4 text-center transition-colors ${allocatedAsicMW > 0 ? 'border-amber-500/50' : 'border-slate-700'}`}>
                <Cpu className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">ASIC Fleet Load</div>
                <div className="text-xl font-mono font-black mt-1 text-white">
                  {allocatedAsicMW.toFixed(1)} <span className="text-xs">MW</span>
                </div>
                <div className="text-[9px] font-mono text-slate-500 mt-1">
                  Expected Value: {formatCurrency(decision.expectedMiningValuePerMWh, currencySymbol, 0)}/MWh
                </div>
              </div>

              {/* Grid / Opportunity Export */}
              <div className={`bg-slate-800 border rounded-lg p-4 text-center transition-colors ${allocatedExportMW > 0 ? 'border-emerald-500/50' : 'border-slate-700'}`}>
                <BatteryCharging className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Alternative Export</div>
                <div className="text-xl font-mono font-black mt-1 text-white">
                  {allocatedExportMW.toFixed(1)} <span className="text-xs">MW</span>
                </div>
                <div className="text-[9px] font-mono text-slate-500 mt-1">
                  Value: {formatCurrency(decision.bestAlternativeValuePerMWh, currencySymbol, 0)}/MWh ({decision.bestAlternativeSource})
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Dynamic Economic & Performance Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="bg-[#15181F] border border-slate-800 rounded-xl p-5 shadow-xs">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">
              Fleet Hashrate
            </span>
            <span className="text-2xl font-mono font-black text-white mt-1 block">
              {(fleetStats.totalHashrateEH * 1000).toFixed(1)} <span className="text-xs text-slate-400 font-normal">PH/s</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              J/TH: {fleetStats.averageEfficiencyJTH.toFixed(1)}
            </span>
          </div>

          <div className="bg-[#15181F] border border-slate-800 rounded-xl p-5 shadow-xs">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">
              Expected Output
            </span>
            <span className="text-2xl font-mono font-black text-white mt-1 block">
              {fleetStats.expectedBtcPerDay.toFixed(5)} <span className="text-xs text-slate-400 font-normal">BTC/day</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              Rev/day: {formatCurrency(fleetStats.expectedRevenueUsdPerDay, '$', 0)}
            </span>
          </div>

          <div className="bg-[#15181F] border border-slate-800 rounded-xl p-5 shadow-xs">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">
              Dynamic Strike Price
            </span>
            <span className="text-2xl font-mono font-black text-white mt-1 block">
              {formatCurrency(decision.miningStrikePricePerMWh, currencySymbol, 0)} <span className="text-xs text-slate-400 font-normal">/MWh</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              Limit price for profitability
            </span>
          </div>

          <div className="bg-[#15181F] border border-slate-800 rounded-xl p-5 shadow-xs">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">
              Expected Gross Margin
            </span>
            <span className={`text-2xl font-mono font-black mt-1 block ${fleetStats.expectedGrossMarginUsdPerDay >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(powerMarket.currency === 'GBP' ? fleetStats.expectedGrossMarginGbpPerDay : fleetStats.expectedGrossMarginUsdPerDay, currencySymbol, 0)}
              <span className="text-xs text-slate-400 font-normal">/day</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              Total gross margin
            </span>
          </div>

        </div>

        {/* Warning Indicators for operational risks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {thermal.ambientTempC > 36 && (
            <div className="flex items-start gap-3 bg-rose-950/30 border border-rose-500/20 rounded-lg p-4 text-xs text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <strong className="font-semibold block uppercase tracking-wide text-rose-200">THERMAL STRESS THRESHOLD ACTIVE</strong>
                Facility ambient temperature is {thermal.ambientTempC.toFixed(1)}°C. High chip temperatures have triggered hashrate derating. Cooling fan consumption is operating at maximum load (lowering J/TH efficiency).
              </div>
            </div>
          )}

          {powerMarket.basePricePerMWh > decision.miningStrikePricePerMWh && (
            <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-500/20 rounded-lg p-4 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block uppercase tracking-wide text-amber-200">SPOT PRICE EXCEEDS MINING STRIKE PRICE</strong>
                Wholesale electricity price is {formatCurrency(powerMarket.basePricePerMWh, currencySymbol, 0)}/MWh, which is higher than the average fleet strike price of {formatCurrency(decision.miningStrikePricePerMWh, currencySymbol, 0)}/MWh. Economic dispatch recommends curtailing ASIC nodes.
              </div>
            </div>
          )}

          {powerMarket.basePricePerMWh <= decision.miningStrikePricePerMWh && thermal.ambientTempC <= 36 && (
            <div className="flex items-start gap-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg p-4 text-xs text-emerald-300 col-span-2">
              <FileCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block uppercase tracking-wide text-emerald-200">OPTIMAL DISPATCH SYSTEM NOMINAL</strong>
                Economic parameters are healthy. Electricity purchase rates are fully optimized against Bitcoin revenue/MWh. Mining efficiency stack is functioning under standard temperature bands. No active curtailments needed.
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
