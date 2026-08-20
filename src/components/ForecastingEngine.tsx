/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Play, TrendingUp, Info, ChevronRight, Layers, ArrowDownUp, RefreshCw } from 'lucide-react';
import { ASICMachine, MarketData, PowerMarketData, OpportunityCost, ThermalModel, SwitchingCostConfig, SimulationScenario, MonteCarloResult, BreakEvenMetrics } from '../types';
import { runMonteCarloSimulation, calculateBreakEvens } from '../utils/optimiser';

interface ForecastingEngineProps {
  fleet: ASICMachine[];
  market: MarketData;
  powerMarket: PowerMarketData;
  oppCost: OpportunityCost;
  thermal: ThermalModel;
  switchingConfig: SwitchingCostConfig;
}

const PRESET_SCENARIOS: SimulationScenario[] = [
  {
    id: 'base_case',
    name: 'Base Case Economy',
    btcTrend: 'BASE',
    powerPriceTrend: 'BASE',
    difficultyTrend: 'BASE',
    gridDemandTrend: 'BASE',
    description: 'Bitcoin tracks sideways with standard 5% price volatility. Power prices align with day-ahead index seasonality. Normal grid operations.'
  },
  {
    id: 'crypto_bull_grid_stress',
    name: 'Crypto Bull + Grid Load',
    btcTrend: 'BULL',
    powerPriceTrend: 'HIGH',
    difficultyTrend: 'HIGH',
    gridDemandTrend: 'HIGH',
    description: 'Bitcoin rallies aggressively, attracting massive network hashrate. High grid load triggers extreme afternoon peak power spikes (£200+/MWh).'
  },
  {
    id: 'crypto_bear_cheap_power',
    name: 'Crypto Bear + Surplus Power',
    btcTrend: 'BEAR',
    powerPriceTrend: 'LOW',
    difficultyTrend: 'LOW',
    gridDemandTrend: 'LOW',
    description: 'Bitcoin price dips. Excess regional renewable generation creates frequent zero or negative electricity pricing hours.'
  }
];

export default function ForecastingEngine({
  fleet,
  market,
  powerMarket,
  oppCost,
  thermal,
  switchingConfig
}: ForecastingEngineProps) {
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario>(PRESET_SCENARIOS[0]);
  const [mcResults, setMcResults] = useState<MonteCarloResult[]>([]);
  const [breakEvens, setBreakEvens] = useState<BreakEvenMetrics | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Compute break-evens based on current real-time state
  useEffect(() => {
    const computed = calculateBreakEvens(fleet, market, powerMarket, thermal);
    setBreakEvens(computed);
  }, [fleet, market, powerMarket, thermal]);

  // Run initial simulation
  useEffect(() => {
    triggerMonteCarlo();
  }, [selectedScenario]);

  const triggerMonteCarlo = () => {
    setIsSimulating(true);
    // Simulate slight lag to represent heavy compute calculations
    setTimeout(() => {
      const results = runMonteCarloSimulation(
        fleet,
        market,
        powerMarket,
        oppCost,
        thermal,
        switchingConfig,
        selectedScenario,
        1000 // 1000 runs
      );
      setMcResults(results);
      setIsSimulating(false);
    }, 600);
  };

  const currencySymbol = powerMarket.currency === 'GBP' ? '£' : '$';

  const formatCurrency = (val: number, symbol = '$', decimals = 0) => {
    return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  return (
    <div id="r-economics-forecasting" className="space-y-6">
      
      {/* SCENARIO SELECTOR */}
      <div className="bg-[#15181F] border border-slate-800 rounded-xl p-6 shadow-xs">
        <h2 className="text-xs font-bold tracking-wide text-white uppercase mb-4">
          R Statistical Scenario Configurator
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRESET_SCENARIOS.map((sc) => {
            const isSelected = selectedScenario.id === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => setSelectedScenario(sc)}
                className={`text-left p-5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected 
                    ? 'border-slate-600 bg-slate-900/50 shadow-xs' 
                    : 'border-slate-800 bg-[#0F1117]/40 hover:bg-[#0F1117]/80'
                }`}
              >
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center justify-between">
                    {sc.name}
                    {isSelected && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {sc.description}
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-800/60 w-full flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
                  <span>BTC: {sc.btcTrend}</span>
                  <span>POWER: {sc.powerPriceTrend}</span>
                  <span>GRID: {sc.gridDemandTrend}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* MONTE CARLO PROBABILITY DISTRIBUTIONS */}
        <div className="lg:col-span-8 bg-[#15181F] border border-slate-800 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold tracking-wide text-white uppercase">
                  Monte Carlo Probability Outcomes (30-Day Projection)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  1,000 distinct randomized mathematical paths computed inside R Economics Core.
                </p>
              </div>
              <button
                onClick={triggerMonteCarlo}
                disabled={isSimulating}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-800 text-slate-300 hover:bg-[#0F1117] hover:text-white disabled:opacity-50 cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 text-slate-400 ${isSimulating ? 'animate-spin' : ''}`} />
                {isSimulating ? 'Computing...' : 'Recalculate (1,000 runs)'}
              </button>
            </div>

            {/* Percentile Explainer Alert */}
            <div className="bg-[#0F1117]/60 rounded-lg p-3.5 text-xs text-slate-400 mb-6 flex items-start gap-2.5 border border-slate-800">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-slate-200 mb-0.5">Understanding Percentiles (Risk Management):</span>
                <strong>P90 (Conservative Downside):</strong> 90% chance that actual earnings exceed this value. 
                <strong className="ml-2">P50 (Median):</strong> 50% chance of exceeding this value. 
                <strong className="ml-2">P10 (Optimistic Upside):</strong> Highly favorable market conditions (10% exceedance probability).
              </div>
            </div>

            {/* Recharts Bar Chart */}
            <div className="h-[280px] w-full">
              {isSimulating ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 font-mono text-xs gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
                  Running 1,000 stochastic economic simulations...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={mcResults}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis 
                      dataKey="percentile" 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <Tooltip 
                      formatter={(value: any, name: any) => [
                        formatCurrency(value, '$', 0), 
                        name === 'netProfitUsd' ? 'Projected Net Profit' : name === 'electricityCostUsd' ? 'Electricity Cost' : 'Alternative Grid Rev'
                      ]}
                      contentStyle={{ background: '#1e293b', color: '#fff', borderRadius: '8px', fontSize: '11px', border: '1px solid #334155' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', fontWeight: 500 }}
                    />
                    <Bar dataKey="electricityCostUsd" name="electricityCostUsd" fill="#475569" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="gridRevenueUsd" name="gridRevenueUsd" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="netProfitUsd" name="netProfitUsd" fill="#3b82f6" stackId="b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Forecast statistics summary footer */}
          <div className="grid grid-cols-5 border-t border-slate-800 pt-5 mt-4 text-center">
            {mcResults.map((r, i) => (
              <div key={i} className="border-r border-slate-800 last:border-0 px-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{r.percentile}</span>
                <span className={`text-sm font-mono font-black mt-1 block ${r.netProfitUsd >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {formatCurrency(r.netProfitUsd, '$', 0)}
                </span>
                <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                  Mined: {r.btcProduced}
                </span>
                <span className="text-[9px] text-slate-400 font-medium block">
                  Curtail: {r.curtailmentPercent}%
                </span>
              </div>
            ))}
          </div>

        </div>

        {/* BREAK-EVEN ANALYSIS PANEL */}
        <div className="lg:col-span-4 bg-[#15181F] border border-slate-800 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold tracking-wide text-white uppercase">
                Facility Break-Evens
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Critical limits at which the active mining operation crosses the boundary from absolute profitability into economic loss (including loaded network adjustments).
            </p>

            <div className="space-y-4">
              {breakEvens && (
                <>
                  <div className="flex items-center justify-between border-b border-slate-800/85 pb-3">
                    <span className="text-xs text-slate-400 font-medium">Break-Even BTC Price</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-white text-sm block">
                        {formatCurrency(breakEvens.breakEvenBtcPriceUsd, '$', 0)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {formatCurrency(breakEvens.breakEvenBtcPriceGbp, '£', 0)} GBP
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-800/85 pb-3">
                    <span className="text-xs text-slate-400 font-medium">Break-Even Power Price</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-white text-sm block">
                        {formatCurrency(breakEvens.breakEvenElectricityPricePerMWh, currencySymbol, 1)}/MWh
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Maximum cost including grid fees
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-800/85 pb-3">
                    <span className="text-xs text-slate-400 font-medium">Max Sustainable Difficulty</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-white text-sm block">
                        {breakEvens.breakEvenNetworkDifficultyT.toFixed(1)} T
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Current: {market.networkDifficultyT.toFixed(1)} T
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs text-slate-400 font-medium">Minimum ASIC Efficiency</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-white text-sm block">
                        {breakEvens.breakEvenAsicEfficiencyJTH.toFixed(1)} J/TH
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Machines with higher (worse) J/TH are unprofitable
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5 text-xs text-slate-400 leading-relaxed bg-slate-900/30 -mx-6 -mb-6 p-6 rounded-b-xl">
            <span className="font-semibold text-slate-300 block mb-1">
              Statistical Model Validation:
            </span>
            These calculations are computed on the overall average fleet efficiency of{' '}
            <strong>
              {fleet.reduce((sum, m) => sum + m.efficiencyJTH, 0) / fleet.length ? (fleet.reduce((sum, m) => sum + m.efficiencyJTH, 0) / fleet.length).toFixed(1) : '25'} J/TH
            </strong>{' '}
            under {thermal.ambientTempC.toFixed(1)}°C temperature cooling drag.
          </div>
        </div>

      </div>

    </div>
  );
}
