/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Settings, RefreshCw, Cpu, Activity, Clock, Shield } from 'lucide-react';
import { ASICMachine, SwitchingCostConfig, DecisionRecord } from '../types';

interface TelemetryConsoleProps {
  fleet: ASICMachine[];
  decision: DecisionRecord;
  switchingConfig: SwitchingCostConfig;
  setSwitchingConfig: React.Dispatch<React.SetStateAction<SwitchingCostConfig>>;
  isSimulating: boolean;
}

export default function TelemetryConsole({
  fleet,
  decision,
  switchingConfig,
  setSwitchingConfig,
  isSimulating
}: TelemetryConsoleProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [latency, setLatency] = useState(0.85);
  const [cpuUsage, setCpuUsage] = useState(12.4);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Generate simulated Rust telemetry logs in real-time
  useEffect(() => {
    // Initial logs
    setLogs([
      `[${new Date().toLocaleTimeString()}] [RUST-INIT] Initializing telemetry channels...`,
      `[${new Date().toLocaleTimeString()}] [RUST-INIT] Spawning ${fleet.length} ASIC listener threads...`,
      `[${new Date().toLocaleTimeString()}] [RUST-INIT] Connection established to grid pricing WebSocket...`,
      `[${new Date().toLocaleTimeString()}] [RUST-INIT] Opportunity cost calculation pipeline online...`,
      `[${new Date().toLocaleTimeString()}] [RUST-CORE] Optimization control loop running at 1000Hz (latency < 1.0ms)`
    ]);
  }, [fleet.length]);

  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      // Pick a random ASIC for telemetry logging
      const randomAsic = fleet[Math.floor(Math.random() * fleet.length)];
      const timestamp = new Date().toLocaleTimeString();
      
      const newLog = `[${timestamp}] [TELEMETRY] Ingested ${randomAsic.id} (${randomAsic.model}) -> ${randomAsic.hashrateTH} TH/s | Draw: ${randomAsic.powerDrawKW} kW | Temp: ${randomAsic.temperatureC}°C | Status: ${randomAsic.status}`;
      
      // Occasionally log grid updates or decision evaluations
      const extraLogs: string[] = [];
      const rand = Math.random();
      if (rand < 0.15) {
        extraLogs.push(`[${timestamp}] [GRID-FEED] Power prices updated. Day-Ahead: $${decision.inputs.powerPrice.toFixed(2)}/MWh. Negative Pricing: ${decision.inputs.powerPrice < 0 ? 'TRUE' : 'FALSE'}`);
      }
      if (rand > 0.85) {
        extraLogs.push(`[${timestamp}] [RUST-OPTIMISER] Dispatched control loop solve. Load target: ${decision.recommendedAsicLoadPercent.toFixed(1)}%. Result action: ${decision.decision}`);
      }

      setLogs(prev => {
        const updated = [...prev, newLog, ...extraLogs];
        // Cap logs at 50 to prevent memory leaks
        return updated.slice(-50);
      });

      // Fluctuate CPU and latency slightly
      setLatency(Number((0.7 + Math.random() * 0.4).toFixed(3)));
      setCpuUsage(Number((8.0 + Math.random() * 8.0).toFixed(1)));

    }, 1200);

    return () => clearInterval(interval);
  }, [isSimulating, fleet, decision]);

  // Scroll to bottom of logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const clearLogs = () => {
    setLogs([`[${new Date().toLocaleTimeString()}] [RUST-CORE] Cleared logs. Ingestion buffer recycled.`]);
  };

  return (
    <div id="rust-telemetry-engine" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* RUST STATISTICS & LIVE FEED */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        
        {/* Core Rust Ingestion Engine Statistics */}
        <div className="bg-[#15181F] border border-slate-800 rounded-xl p-5 text-white grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Loop Latency</span>
              <span className="text-lg font-mono font-black text-white">{latency} ms</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Cpu className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Core Threads</span>
              <span className="text-lg font-mono font-black text-white">16 Workers</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Ingestion Rate</span>
              <span className="text-lg font-mono font-black text-white">1,240 msg/s</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-rose-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">CPU Util</span>
              <span className="text-lg font-mono font-black text-white">{cpuUsage}%</span>
            </div>
          </div>
        </div>

        {/* Live Scrolling Terminal */}
        <div className="bg-[#0F1117] border border-slate-800 rounded-xl p-5 flex-1 flex flex-col min-h-[350px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-mono font-bold text-slate-300">rust_telemetry_broker_daemon.service</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                ACTIVE
              </span>
              <button 
                onClick={clearLogs}
                className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Clear Buffer
              </button>
            </div>
          </div>

          {/* Terminal log panel */}
          <div 
            ref={logContainerRef}
            className="flex-1 font-mono text-xs text-slate-300 overflow-y-auto space-y-1.5 max-h-[300px] scrollbar-thin scrollbar-thumb-slate-800 pr-2"
          >
            {logs.map((log, index) => {
              let colorClass = 'text-slate-300';
              if (log.includes('[TELEMETRY]')) colorClass = 'text-blue-400/90';
              if (log.includes('[RUST-INIT]') || log.includes('[RUST-CORE]')) colorClass = 'text-slate-500';
              if (log.includes('[GRID-FEED]')) colorClass = 'text-amber-400/90';
              if (log.includes('[RUST-OPTIMISER]')) colorClass = 'text-emerald-400/90';

              return (
                <div key={index} className={`break-all leading-normal ${colorClass}`}>
                  {log}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* SWITCHING COST SETTINGS PANEL */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-[#15181F] border border-slate-800 rounded-xl p-6 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-bold tracking-wide text-white uppercase">
              Rust Switch Constraints
            </h2>
          </div>
          
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Rapid thermal cycling (constantly turning ASICs on and off) creates substantial silicon strain, accelerates machine failure, and incurs labor switching overhead. Use these Rust daemon parameters to throttle dispatch frequency.
          </p>

          <div className="space-y-6 flex-1">
            {/* Thermal wear equivalence */}
            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span>Thermal Stress Cost Penalty</span>
                <span className="font-mono text-white">${switchingConfig.thermalCyclingWearUsd}/cycle</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="0.50"
                value={switchingConfig.thermalCyclingWearUsd}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSwitchingConfig(prev => ({ ...prev, thermalCyclingWearUsd: val }));
                }}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Economic penalty added to switching costs before curtailing/resuming.
              </span>
            </div>

            {/* Minimum Runtime */}
            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span>Minimum Run Lockout Time</span>
                <span className="font-mono text-white">{switchingConfig.minimumRuntimeHrs} hrs</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.5"
                value={switchingConfig.minimumRuntimeHrs}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSwitchingConfig(prev => ({ ...prev, minimumRuntimeHrs: val }));
                }}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Locks ASICs in RUN state once started, preventing immediate shutdown.
              </span>
            </div>

            {/* Minimum Shutdown */}
            <div>
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <span>Minimum Shutdown Lockout</span>
                <span className="font-mono text-white">{switchingConfig.minimumShutdownHrs} hrs</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.5"
                value={switchingConfig.minimumShutdownHrs}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSwitchingConfig(prev => ({ ...prev, minimumShutdownHrs: val }));
                }}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Guarantees complete thermal dissipation and cooldown after curtailment.
              </span>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4 bg-slate-900/30 -mx-6 -mb-6 p-6 rounded-b-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400">Lockout Controls:</span>
              <span className="px-2 py-0.5 font-mono text-[10px] bg-slate-800 text-slate-300 rounded-sm font-bold border border-slate-700">
                ENFORCED BY RUST DAEMON
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
