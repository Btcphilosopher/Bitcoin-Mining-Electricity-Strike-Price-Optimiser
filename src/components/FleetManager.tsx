/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Cpu, 
  Activity, 
  Heart, 
  Settings, 
  Wrench, 
  AlertCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { ASICMachine, FleetStats, MarketData, PowerMarketData, ThermalModel } from '../types';
import { calculateAsicEconomics } from '../utils/optimiser';

interface FleetManagerProps {
  fleet: ASICMachine[];
  setFleet: React.Dispatch<React.SetStateAction<ASICMachine[]>>;
  fleetStats: FleetStats;
  market: MarketData;
  powerMarket: PowerMarketData;
  thermal: ThermalModel;
}

export default function FleetManager({
  fleet,
  setFleet,
  fleetStats,
  market,
  powerMarket,
  thermal
}: FleetManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<'ALL' | 'FLEET_A' | 'FLEET_B' | 'FLEET_C'>('ALL');

  // Categorise machines into efficiency dispatch tiers
  const categoriseMachine = (m: ASICMachine): 'FLEET_A' | 'FLEET_B' | 'FLEET_C' => {
    if (m.efficiencyJTH < 20) return 'FLEET_A'; // Elite
    if (m.efficiencyJTH <= 30) return 'FLEET_B'; // High efficiency mid-tier
    return 'FLEET_C'; // Legacy / low efficiency
  };

  const getTierDetails = (tier: 'FLEET_A' | 'FLEET_B' | 'FLEET_C') => {
    switch (tier) {
      case 'FLEET_A':
        return {
          name: 'Tier A: Elite Stack',
          desc: 'Ultra-low J/TH nodes. Runs unconditionally in all market scenarios.',
          badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
        };
      case 'FLEET_B':
        return {
          name: 'Tier B: Standard Stack',
          desc: 'High-efficiency mid-tier nodes. Curtailed if electricity price surges above strike price.',
          badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
        };
      case 'FLEET_C':
        return {
          name: 'Tier C: Vintage Stack',
          desc: 'Legacy nodes with high power draw. Subject to immediate curtailment.',
          badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
        };
    }
  };

  // Perform repair maintenance on a machine
  const handleRepair = (id: string) => {
    setFleet(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          temperatureC: 48.0,
          failureProbability: 0.1,
          uptimeHrs: m.uptimeHrs + 24,
          availability: Math.min(100, m.availability + 2.5)
        };
      }
      return m;
    }));
  };

  // Force fail a machine to simulate telemetry triggers
  const handleForceFailure = (id: string) => {
    setFleet(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          status: 'CURTAIL',
          temperatureC: 98.5,
          failureProbability: 100.0,
          availability: Math.max(20, m.availability - 15)
        };
      }
      return m;
    }));
  };

  // Filter fleet based on category and search
  const filteredFleet = fleet.filter(m => {
    const tier = categoriseMachine(m);
    const matchesGroup = selectedGroup === 'ALL' || selectedGroup === tier;
    const matchesSearch = m.id.toLowerCase().includes(searchTerm.toLowerCase()) || m.model.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  const currencySymbol = powerMarket.currency === 'GBP' ? '£' : '$';

  return (
    <div id="asic-fleet-model" className="space-y-6">
      
      {/* FLEET TIER DISPATCH STACKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['FLEET_A', 'FLEET_B', 'FLEET_C'] as const).map(tier => {
          const details = getTierDetails(tier);
          const tierMachines = fleet.filter(m => categoriseMachine(m) === tier);
          const activeCount = tierMachines.filter(m => m.status === 'RUN').length;
          
          return (
            <div 
              key={tier} 
              className={`border rounded-xl p-5 shadow-xs flex flex-col justify-between ${
                selectedGroup === tier ? 'ring-2 ring-blue-500 border-transparent bg-[#15181F]' : 'border-slate-800 bg-[#15181F]'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-sm tracking-wide uppercase ${details.badge}`}>
                    {tier}
                  </span>
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    {activeCount}/{tierMachines.length} RUNNING
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm">{details.name}</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {details.desc}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="text-[10px] font-mono text-slate-500">
                  Avg J/TH:{' '}
                  <span className="font-bold text-white">
                    {(tierMachines.reduce((sum, m) => sum + m.efficiencyJTH, 0) / tierMachines.length).toFixed(1)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedGroup(selectedGroup === tier ? 'ALL' : tier)}
                  className="text-xs font-bold text-white flex items-center gap-1 hover:text-blue-400 cursor-pointer"
                >
                  {selectedGroup === tier ? 'Show All' : 'Filter Tier'} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* INDIVIDUAL ASIC TELEMETRY TABLE */}
      <div className="bg-[#15181F] border border-slate-800 rounded-xl shadow-xs overflow-hidden">
        
        {/* Table Controls */}
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold tracking-wide text-white uppercase">
              Individual Node Telemetry Status
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Active telemetry from {filteredFleet.length} matched ASIC mining units in the cluster.
            </p>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search ASIC ID or Model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#0F1117] border border-slate-800 text-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-0"
            />
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-[#0F1117] border border-slate-800 text-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-0"
            >
              <option value="ALL">All Tiers</option>
              <option value="FLEET_A">Tier A (Elite)</option>
              <option value="FLEET_B">Tier B (Standard)</option>
              <option value="FLEET_C">Tier C (Vintage)</option>
            </select>
          </div>
        </div>

        {/* Scrollable Table View */}
        <div className="overflow-x-auto max-h-[450px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 font-mono">
                <th className="py-3 px-5">Node ID</th>
                <th className="py-3 px-4">Hardware Class</th>
                <th className="py-3 px-4 text-right">Hashrate</th>
                <th className="py-3 px-4 text-right">Power Draw</th>
                <th className="py-3 px-4 text-right">Efficiency</th>
                <th className="py-3 px-4 text-right">Temp</th>
                <th className="py-3 px-4 text-right">Fail Prob</th>
                <th className="py-3 px-4 text-center">Dispatch Status</th>
                <th className="py-3 px-5 text-center">Maintenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-xs text-slate-300">
              {filteredFleet.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                    No active ASICs match the selected search criteria.
                  </td>
                </tr>
              ) : (
                filteredFleet.map((m) => {
                  const tier = categoriseMachine(m);

                  // Dispatch status color styling
                  let statusColor = 'bg-slate-800 text-slate-400';
                  if (m.status === 'RUN') statusColor = 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30';
                  if (m.status === 'THROTTLE') statusColor = 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30';
                  if (m.status === 'CURTAIL') statusColor = 'bg-rose-500/15 text-rose-400 border border-rose-500/30';

                  const isHighFail = m.failureProbability > 10;

                  return (
                    <tr key={m.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-white">{m.id}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-sans font-medium text-slate-200 block">{m.model}</span>
                        <span className="text-[10px] text-slate-500">{tier === 'FLEET_A' ? 'Elite S-Tier' : tier === 'FLEET_B' ? 'High-Eff' : 'Vintage'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">{m.hashrateTH.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">TH</span></td>
                      <td className="py-3.5 px-4 text-right">{m.powerDrawKW.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">kW</span></td>
                      <td className="py-3.5 px-4 text-right font-bold">{m.efficiencyJTH.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">J/TH</span></td>
                      <td className={`py-3.5 px-4 text-right font-bold ${m.temperatureC > 80 ? 'text-rose-400 font-black' : 'text-white'}`}>
                        {m.temperatureC.toFixed(1)}°C
                      </td>
                      <td className={`py-3.5 px-4 text-right ${isHighFail ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                        {m.failureProbability.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[9px] tracking-wide uppercase font-black ${statusColor}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleRepair(m.id)}
                            title="Perform Preventive Heat-sink and Fan Servicing"
                            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/40 rounded cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleForceFailure(m.id)}
                            title="Simulate Instantaneous Node Burnout"
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded cursor-pointer"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
