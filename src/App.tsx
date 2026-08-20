/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  Terminal, 
  LineChart, 
  Cpu, 
  History, 
  ShieldCheck, 
  TrendingUp, 
  HelpCircle,
  Coins,
  Globe,
  Thermometer,
  Play,
  Pause
} from 'lucide-react';

import { 
  ASICMachine, 
  MarketData, 
  PowerMarketData, 
  OpportunityCost, 
  ThermalModel, 
  SwitchingCostConfig, 
  DecisionRecord 
} from './types';

import { 
  generateAsicFleet, 
  solveOptimalDispatch, 
  calculateFleetStats 
} from './utils/optimiser';

// Import sub-components
import Dashboard from './components/Dashboard';
import TelemetryConsole from './components/TelemetryConsole';
import ForecastingEngine from './components/ForecastingEngine';
import FleetManager from './components/FleetManager';
import Backtester from './components/Backtester';
import AuditLogger from './components/AuditLogger';

export default function App() {
  const [activeTab, setActiveTab] = useState<'OPERATIONAL' | 'TELEMETRY' | 'FORECASTING' | 'FLEET' | 'BACKTEST' | 'AUDIT'>('OPERATIONAL');

  // 1. Core States
  const [market, setMarket] = useState<MarketData>({
    btcPriceUsd: 92450,
    btcPriceGbp: 71200,
    networkDifficultyT: 112.5,
    networkHashrateEH: 843.75,
    blockSubsidyBtc: 3.125,
    avgTxFeeBtc: 0.12,
    poolFeePercent: 1.5,
    usdToGbpRate: 0.77
  });

  const [powerMarket, setPowerMarket] = useState<PowerMarketData>({
    currency: 'GBP', // default to grid currency
    priceType: 'INTRADAY',
    basePricePerMWh: 72.0, // £72 / MWh
    gridChargesPerMWh: 8.50,
    transmissionChargesPerMWh: 4.20,
    demandChargeKwMonth: 15.00,
    balancingCostsPerMWh: 2.10,
    curtailmentPaymentPerMWh: 45.00,
    negativePricePeriod: false
  });

  const [oppCost, setOppCost] = useState<OpportunityCost>({
    gridExportPricePerMWh: 65.00,
    batteryStorageValuePerMWh: 55.00,
    demandResponseValuePerMWh: 40.00,
    industrialLoadValuePerMWh: 30.00,
    curtailmentValuePerMWh: 45.00
  });

  const [thermal, setThermal] = useState<ThermalModel>({
    ambientTempC: 18.5,
    coolingCapacityKW: 500.0,
    coolingEfficiencyCop: 3.5,
    coolingPowerDrawKW: 10.0,
    thermalDeratingFactor: 1.0
  });

  const [switchingConfig, setSwitchingConfig] = useState<SwitchingCostConfig>({
    thermalCyclingWearUsd: 15.00,
    startupDelayMinutes: 5,
    minimumRuntimeHrs: 2,
    minimumShutdownHrs: 1,
    lostMiningTimeUsd: 8.50
  });

  // Generate initial fleet of 100 ASICs
  const [fleet, setFleet] = useState<ASICMachine[]>(() => generateAsicFleet(100));
  const [availablePowerMW, setAvailablePowerMW] = useState<number>(80);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);

  // 2. Solve dispatch based on current active states
  const { currentDispatch, allocatedAsicMW, allocatedExportMW } = useMemo(() => {
    const { dispatchFleet, decisionRecord, allocatedAsicMW, allocatedExportMW } = solveOptimalDispatch(
      fleet,
      market,
      powerMarket,
      oppCost,
      thermal,
      switchingConfig,
      availablePowerMW
    );

    return {
      currentDispatch: decisionRecord,
      allocatedAsicMW,
      allocatedExportMW
    };
  }, [fleet, market, powerMarket, oppCost, thermal, switchingConfig, availablePowerMW]);

  // Append initial decision log record
  useEffect(() => {
    setDecisions([currentDispatch]);
  }, []);

  // 3. Live simulation loop to run the Rust/R background updates
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      // Fluctuate Bitcoin price (+- 0.05%)
      const btcVar = 1 + (Math.random() * 0.001 - 0.0005);
      const newBtcUsd = Math.round(market.btcPriceUsd * btcVar);
      
      // Fluctuate electricity price based on daytime variation (+- £1.50)
      const hour = new Date().getHours();
      // peak rates in evening, cheaper at night
      const trend = (hour >= 16 && hour <= 20) ? 0.3 : -0.2;
      const powerVar = (Math.random() * 3 - 1.5) + trend;
      const newPowerBase = Math.max(-5, Number((powerMarket.basePricePerMWh + powerVar).toFixed(2)));

      // Fluctuate ambient temperature (+- 0.1C)
      const tempVar = (Math.random() * 0.4 - 0.2);
      const newTemp = Math.max(-10, Math.min(45, Number((thermal.ambientTempC + tempVar).toFixed(2))));

      // Update basic inputs
      setMarket(prev => ({
        ...prev,
        btcPriceUsd: newBtcUsd,
        btcPriceGbp: Math.round(newBtcUsd * prev.usdToGbpRate)
      }));

      setPowerMarket(prev => ({
        ...prev,
        basePricePerMWh: newPowerBase
      }));

      setThermal(prev => ({
        ...prev,
        ambientTempC: newTemp
      }));

      // Fluctuate individual running ASICs temperatures (+- 0.5C) and failures
      setFleet(prevFleet => {
        return prevFleet.map(machine => {
          if (machine.status === 'RUN' || machine.status === 'THROTTLE') {
            const scale = machine.status === 'THROTTLE' ? 0.6 : 1.0;
            // Temp goes up slightly as ambient goes up
            const targetTemp = 60 + (newTemp - 18) * 0.5 + (Math.random() * 4 - 2);
            // Gradually ease towards target temperature
            const currentTemp = machine.temperatureC + (targetTemp - machine.temperatureC) * 0.1;

            return {
              ...machine,
              temperatureC: Number(currentTemp.toFixed(1)),
              // Failure rate climbs as machine ages or runs hot
              failureProbability: Math.max(0.1, Math.min(99.9, machine.failureProbability + (currentTemp > 80 ? 0.05 : 0.001)))
            };
          } else {
            // Cool down cooled machines towards ambient temperature
            const currentTemp = machine.temperatureC + (newTemp - machine.temperatureC) * 0.1;
            return {
              ...machine,
              temperatureC: Number(currentTemp.toFixed(1))
            };
          }
        });
      });

      // Push solve decision record to audit logs
      setDecisions(prev => {
        const nextLogs = [...prev, currentDispatch];
        // limit to 60 items for performance
        return nextLogs.slice(-60);
      });

    }, 3000); // Ticks every 3 seconds

    return () => clearInterval(interval);
  }, [isSimulating, market, powerMarket, thermal, currentDispatch]);

  // Calculate global fleet calculations based on the dynamic solved status of the nodes
  const fleetStats = useMemo(() => {
    return calculateFleetStats(fleet, market, powerMarket, thermal);
  }, [fleet, market, powerMarket, thermal]);

  const currencySymbol = powerMarket.currency === 'GBP' ? '£' : '$';

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white">
      
      {/* GLOBAL TOP NAV STATUS TICKER (Sleek Theme) */}
      <div className="bg-[#08090C] text-slate-300 border-b border-slate-900 text-xs px-6 py-2.5 flex flex-wrap gap-x-8 gap-y-2 items-center justify-between font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-bold tracking-wide text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            AETERNA DISPATCH CORE ONLINE
          </span>
          <span className="text-slate-800">|</span>
          <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-slate-600" /> BTC/USD: <strong className="text-white">${market.btcPriceUsd.toLocaleString()}</strong></span>
          <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-slate-600" /> Grid: <strong className="text-white">{currencySymbol}{powerMarket.basePricePerMWh.toFixed(2)}/MWh</strong></span>
          <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-slate-600" /> Diff: <strong className="text-white">{market.networkDifficultyT.toFixed(1)} T</strong></span>
          <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-slate-600" /> Hashrate: <strong className="text-white">{(fleetStats.totalHashrateEH * 1000).toFixed(1)} PH/s</strong></span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-sm border border-slate-800 bg-[#15181F] hover:bg-[#1D212A] text-slate-300 transition-colors uppercase cursor-pointer"
          >
            {isSimulating ? (
              <>
                <Pause className="w-3 h-3 text-rose-400" /> Pause Feed
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-400" /> Resume Feed
              </>
            )}
          </button>
          <span className="text-[10px] text-slate-600">SYSTEM TIME: 2026-08-20 // 05:01:17</span>
        </div>
      </div>

      {/* HEADER SECTION */}
      <header className="bg-[#0F1117] border-b border-slate-800 py-6 px-6 md:px-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white italic shrink-0">R</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[9px] font-extrabold font-mono tracking-wider bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xs">
                RUST v4.2 // R-FORECASTING
              </span>
              <span className="text-slate-700">•</span>
              <span className="text-xs font-semibold text-slate-500">AETERNA OPTIMISER</span>
            </div>
            <h1 className="text-lg font-bold leading-none tracking-tight uppercase text-white mt-1">
              Bitcoin Mining Strike-Price Dispatcher
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-right">
          <div className="text-xs">
            <span className="text-slate-500 font-bold uppercase tracking-wider block text-[10px]">Total Connected Power Draw</span>
            <strong className="text-white font-mono text-base font-black">
              {fleetStats.totalPowerMW.toFixed(2)} MW <span className="text-xs font-normal text-slate-500">/ {availablePowerMW} MW Limit</span>
            </strong>
          </div>
        </div>
      </header>

      {/* TAB NAVIGATION */}
      <nav className="bg-[#0F1117] border-b border-slate-800 px-6 md:px-12 flex flex-wrap gap-2 overflow-x-auto py-3">
        <button
          onClick={() => setActiveTab('OPERATIONAL')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'OPERATIONAL' 
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5" /> Operational Dispatch
        </button>

        <button
          onClick={() => setActiveTab('TELEMETRY')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'TELEMETRY' 
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" /> Rust Telemetry Core
        </button>

        <button
          onClick={() => setActiveTab('FORECASTING')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'FORECASTING' 
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LineChart className="w-3.5 h-3.5" /> R Forecasting Core
        </button>

        <button
          onClick={() => setActiveTab('FLEET')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'FLEET' 
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" /> ASIC Fleet Model
        </button>

        <button
          onClick={() => setActiveTab('BACKTEST')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'BACKTEST' 
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" /> Historical Backtester
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'AUDIT' 
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Risk & Audit Log
        </button>
      </nav>

      {/* CORE CONTENT SWITCHER */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        {activeTab === 'OPERATIONAL' && (
          <Dashboard 
            market={market}
            setMarket={setMarket}
            powerMarket={powerMarket}
            setPowerMarket={setPowerMarket}
            oppCost={oppCost}
            setOppCost={setOppCost}
            thermal={thermal}
            setThermal={setThermal}
            fleetStats={fleetStats}
            decision={currentDispatch}
            allocatedAsicMW={allocatedAsicMW}
            allocatedExportMW={allocatedExportMW}
            availablePowerMW={availablePowerMW}
            setAvailablePowerMW={setAvailablePowerMW}
            isSimulating={isSimulating}
            toggleSimulation={() => setIsSimulating(!isSimulating)}
          />
        )}

        {activeTab === 'TELEMETRY' && (
          <TelemetryConsole 
            fleet={fleet}
            decision={currentDispatch}
            switchingConfig={switchingConfig}
            setSwitchingConfig={setSwitchingConfig}
            isSimulating={isSimulating}
          />
        )}

        {activeTab === 'FORECASTING' && (
          <ForecastingEngine 
            fleet={fleet}
            market={market}
            powerMarket={powerMarket}
            oppCost={oppCost}
            thermal={thermal}
            switchingConfig={switchingConfig}
          />
        )}

        {activeTab === 'FLEET' && (
          <FleetManager 
            fleet={fleet}
            setFleet={setFleet}
            fleetStats={fleetStats}
            market={market}
            powerMarket={powerMarket}
            thermal={thermal}
          />
        )}

        {activeTab === 'BACKTEST' && (
          <Backtester 
            fleet={fleet}
            market={market}
            powerMarket={powerMarket}
            oppCost={oppCost}
            thermal={thermal}
            switchingConfig={switchingConfig}
          />
        )}

        {activeTab === 'AUDIT' && (
          <AuditLogger 
            decisions={decisions}
            powerMarket={powerMarket}
            market={market}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-[#0F1117] py-8 px-6 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-400 uppercase tracking-widest text-[10px]">Aeterna Economic Dispatch & Opportunity-Cost Optimiser</p>
        <p className="mt-2 leading-relaxed text-slate-500 max-w-2xl mx-auto">
          Industrial power dispatching model tracking physical silicon constraints, R stochastic forecasting covariance engines, and sub-millisecond Rust equivalent telemetry.
        </p>
        <div className="flex gap-4 items-center justify-center mt-4">
          <span className="px-2 py-0.5 bg-[#0A0B0E] border border-slate-800 text-[9px] font-mono text-emerald-400 uppercase">HASH_OK</span>
          <span className="px-2 py-0.5 bg-[#0A0B0E] border border-slate-800 text-[9px] font-mono text-emerald-400 uppercase">TEMP_34C</span>
          <span className="px-2 py-0.5 bg-[#0A0B0E] border border-slate-800 text-[9px] font-mono text-blue-400 uppercase">RPC_SYNC_0ms</span>
        </div>
        <p className="mt-4 font-mono text-[9px] text-slate-600 uppercase tracking-widest">
          AETERNA-CORE-v4.2 // TELEMETRY-RUST-v1.8 // DEPLOYED COMPLIANT
        </p>
      </footer>

    </div>
  );
}
