import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Trash2, 
  Globe, 
  FileText, 
  Camera, 
  Box, 
  Terminal, 
  Database, 
  Code2, 
  Monitor, 
  Cpu, 
  ExternalLink,
  Copy,
  Check,
  Zap,
  Info,
  Clock,
  Settings,
  Power,
  RefreshCw,
  LayoutDashboard,
  Waves
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const CATEGORY_COLORS = {
  Browsers: 'text-mac-blue',
  System: 'text-mac-purple',
  Dev: 'text-mac-safe',
  Tools: 'text-mac-caution',
  Apps: 'text-pink-500'
};

const CLEANUP_MODULES = [
  {
    id: 'chrome',
    name: 'Browser Caches',
    description: 'Chrome & Comet (All Profiles + Global Caches)',
    icon: Globe,
    size: '4.2 GB',
    risk: 'Safe',
    category: 'Browsers',
    commands: [
      '# Chrome & Comet Internal Caches',
      'CHROME_LIKE_APPS=("Google/Chrome" "Comet")',
      'for app_path in "${CHROME_LIKE_APPS[@]}"; do',
      '  app_support="$HOME/Library/Application Support/${app_path}"',
      '  if [ -d "$app_support" ]; then',
      '    GLOBAL_CACHES=("ShaderCache" "GraphiteDawnCache" "extensions_crx_cache" "component_crx_cache")',
      '    for gc in "${GLOBAL_CACHES[@]}"; do rm -rf "${app_support}/${gc}"; done',
      '    for profile in "$app_support"/*/ ; do',
      '      rm -rf "${profile}Cache" "${profile}Code Cache" "${profile}GPUCache"',
      '    done',
      '  fi',
      'done'
    ]
  },
  {
    id: 'system_logs',
    name: 'System Logs',
    description: 'System-wide logs and crash reports',
    icon: FileText,
    size: '1.8 GB',
    risk: 'Safe',
    category: 'System',
    commands: [
      'rm -rf /private/var/log/*',
      'rm -rf ~/Library/Logs/*',
      'sudo aslmanager -s /var/log/asl'
    ]
  },
  {
    id: 'xcode',
    name: 'Xcode & Simulators',
    description: 'DerivedData, DeviceSupport, and Simulator Caches',
    icon: Code2,
    size: '12.4 GB',
    risk: 'Safe',
    category: 'Dev',
    commands: [
      'rm -rf ~/Library/Developer/Xcode/DerivedData/*',
      'rm -rf ~/Library/Developer/CoreSimulator/Caches/*',
      'xcrun simctl delete unavailable'
    ]
  },
  {
    id: 'docker',
    name: 'Docker Containers',
    description: 'Prune unused containers, images, and volumes',
    icon: Box,
    size: '8.5 GB',
    risk: 'Caution',
    category: 'Tools',
    commands: [
      'docker system prune -a -f --volumes'
    ]
  },
  {
    id: 'conda_pip',
    name: 'Python/Conda/Pip',
    description: 'Clean cache and unused packages',
    icon: Cpu,
    size: '3.1 GB',
    risk: 'Caution',
    category: 'Dev',
    commands: [
      'pip cache purge',
      'conda clean --all -y'
    ]
  },
  {
    id: 'brew',
    name: 'Homebrew',
    description: 'Cleanup old versions and cache',
    icon: Database,
    size: '2.5 GB',
    risk: 'Safe',
    category: 'Tools',
    commands: [
      'brew cleanup --prune=all'
    ]
  },
  {
    id: 'snapshots',
    name: 'TM Snapshots',
    description: 'Local Time Machine snapshots',
    icon: Clock,
    size: '5.0 GB',
    risk: 'Caution',
    category: 'System',
    commands: [
      'sudo tmutil deletelocalsnapshots /'
    ]
  },
  {
    id: 'app_caches',
    name: 'AI & Editor Caches',
    description: 'Cursor, Trae, Gemini, Antigravity extensions',
    icon: Zap,
    size: '1.2 GB',
    risk: 'Safe',
    category: 'Apps',
    commands: [
      'rm -rf ~/.cursor/extensions/*',
      'rm -rf ~/.trae/*',
      'rm -rf ~/.gemini/*',
      'rm -rf ~/.antigravity/*'
    ]
  }
];

const MeshBackground = () => (
  <div className="mesh-base">
    <div className="mesh-circle bg-mac-blue w-[600px] h-[600px] -top-64 -left-64 opacity-20" />
    <div className="mesh-circle bg-mac-purple w-[500px] h-[500px] top-1/2 -right-32 opacity-10" style={{ animationDelay: '-5s' }} />
    <div className="mesh-circle bg-mac-safe w-[400px] h-[400px] -bottom-32 left-1/2 opacity-10" style={{ animationDelay: '-12s' }} />
  </div>
);

const LiquidMeter = ({ percentage }) => {
  return (
    <div className="relative w-52 h-52">
      <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_12px_rgba(10,132,255,0.4)]">
        <circle
          cx="104"
          cy="104"
          r="92"
          stroke="currentColor"
          strokeWidth="16"
          fill="transparent"
          className="text-white/5"
        />
        <motion.circle
          cx="104"
          cy="104"
          r="92"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray="578"
          initial={{ strokeDashoffset: 578 }}
          animate={{ strokeDashoffset: 578 - (578 * 0.72) }}
          transition={{ duration: 2, ease: [0.34, 1.56, 0.64, 1] }}
          className="text-mac-blue"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div 
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="text-5xl font-black gradient-text">72%</div>
          <div className="text-[10px] text-white/30 uppercase font-black tracking-[0.2em] mt-1">Status: High</div>
        </motion.div>
      </div>
      
      {/* Decorative pulse */}
      <motion.div 
        className="absolute inset-0 border-4 border-mac-blue/20 rounded-full"
        animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </div>
  );
};

export default function App() {
  const [selected, setSelected] = useState(CLEANUP_MODULES.map(m => m.id));
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);
  
  const [forceKill, setForceKill] = useState(false);
  const [reopenApps, setReopenApps] = useState(true);

  const toggleModule = (id) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const totalFreed = useMemo(() => {
    const sum = selected.reduce((acc, id) => {
      const module = CLEANUP_MODULES.find(m => m.id === id);
      return acc + parseFloat(module.size);
    }, 0);
    return sum.toFixed(1);
  }, [selected]);

  const generatedScript = useMemo(() => {
    const modules = CLEANUP_MODULES.filter(m => selected.includes(m.id));
    const lines = [
      '#!/bin/bash',
      '# Mac Cleanup Pro - Ultra-Premium Script',
      '# =================================',
      'set -e',
      '',
      'echo "🚀 Starting Mac Cleanup Pro..."',
      ''
    ];

    if (forceKill) {
      lines.push('echo "⚠️ Force-killing Chrome and Comet..."');
      lines.push('pkill -af "Google Chrome" || true');
      lines.push('pkill -af "Comet" || true');
      lines.push('');
    }

    modules.forEach(m => {
      lines.push(`echo "🧹 Cleaning ${m.name}..."`);
      lines.push(...m.commands);
      lines.push('');
    });

    if (reopenApps) {
      lines.push('echo "✅ Cleanup complete! Re-launching tools..."');
      lines.push('open -a "Google Chrome" || true');
      lines.push('open -a "Comet" || true');
    }
    
    return lines.join('\n');
  }, [selected, forceKill, reopenApps]);

  return (
    <div className="relative min-h-screen">
      <MeshBackground />
      
      <div className="max-w-7xl mx-auto px-10 py-16">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-20"
        >
          <div className="group cursor-default">
            <div className="flex items-center gap-4 mb-3">
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.8 }}
                className="p-3 bg-gradient-to-br from-mac-blue to-mac-purple rounded-2xl shadow-[0_0_25px_rgba(10,132,255,0.3)]"
              >
                <Waves className="w-8 h-8 text-white" />
              </motion.div>
              <h1 className="text-5xl font-black tracking-tighter">Mac Cleanup <span className="gradient-text">Pro</span></h1>
            </div>
            <p className="text-white/40 text-lg font-medium tracking-tight ml-1">Surgical storage reclamation for power users.</p>
          </div>
          <div className="flex gap-4">
            <button className="glass px-6 py-3 flex items-center gap-3 hover:bg-white/10 group">
              <Settings className="w-4 h-4 text-white/40 group-hover:text-mac-blue transition-colors" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Environment</span>
            </button>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: Performance Hub */}
          <div className="lg:col-span-4 space-y-8">
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="glass p-10 relative overflow-hidden group shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
            >
              <div className="relative z-10 flex flex-col items-center">
                <LiquidMeter />
                
                <div className="text-center mt-8">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <LayoutDashboard className="w-5 h-5 text-mac-blue" />
                    <h3 className="text-2xl font-black uppercase tracking-tight italic text-white/90">System Health</h3>
                  </div>
                  <div className="mt-4 px-5 py-2 glass bg-mac-caution/5 border-mac-caution/20">
                    <span className="text-xs font-black text-mac-caution uppercase tracking-widest">Action Recommended</span>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 left-0 w-full h-full shimmer-bg opacity-20 pointer-events-none" />
            </motion.section>

            <motion.section 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="glass p-8 border border-white/5"
            >
              <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mb-8">Script Control Protocol</h4>
              
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <div className="p-3 bg-mac-danger/5 rounded-xl text-mac-danger group hover:bg-mac-danger/10 transition-colors">
                      <Power className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tighter">Force-Kill Apps</p>
                      <p className="text-[10px] text-white/30 font-bold">Deep Cache Reclamation</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setForceKill(!forceKill)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all duration-500 relative ring-1 ring-white/10",
                      forceKill ? "bg-mac-blue" : "bg-white/5"
                    )}
                  >
                    <motion.div 
                      animate={{ x: forceKill ? 26 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-xl"
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <div className="p-3 bg-mac-safe/5 rounded-xl text-mac-safe group hover:bg-mac-safe/10 transition-colors">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tighter">Automatic Restore</p>
                      <p className="text-[10px] text-white/30 font-bold">Relaunch Post-Cleanup</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setReopenApps(!reopenApps)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all duration-500 relative ring-1 ring-white/10",
                      reopenApps ? "bg-mac-blue" : "bg-white/5"
                    )}
                  >
                    <motion.div 
                      animate={{ x: reopenApps ? 26 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-xl"
                    />
                  </button>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <div className="flex justify-between items-end mb-6">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">Total Target Space</span>
                    <motion.span 
                      key={totalFreed}
                      initial={{ scale: 0.8, color: '#BF5AF2' }}
                      animate={{ scale: 1, color: '#0A84FF' }}
                      className="text-4xl font-black tracking-tighter"
                    >
                      {totalFreed} <span className="text-lg opacity-40 ml-1 italic">GB</span>
                    </motion.span>
                  </div>
                  <button 
                    onClick={() => { setIsGenerating(true); setTimeout(() => { setIsGenerating(false); setShowScript(true); }, 1500); }}
                    disabled={isGenerating || selected.length === 0}
                    className="w-full py-5 mac-button-primary text-xl uppercase tracking-[0.1em] font-black"
                  >
                    {isGenerating ? "Analyzing..." : "Forge Shell Script"}
                  </button>
                </div>
              </div>
            </motion.section>
          </div>

          {/* Right: Grid & Engine Preview */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {showScript ? (
                <motion.div 
                  key="script"
                  layoutId="content"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  className="glass overflow-hidden h-full flex flex-col bg-[#050505]/60 ring-1 ring-white/10"
                >
                  <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/2">
                    <div className="flex gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-mac-danger shadow-[0_0_15px_rgba(255,69,58,0.4)]" />
                      <div className="w-3.5 h-3.5 rounded-full bg-mac-caution shadow-[0_0_15px_rgba(255,214,10,0.4)]" />
                      <div className="w-3.5 h-3.5 rounded-full bg-mac-safe shadow-[0_0_15px_rgba(48,209,88,0.4)]" />
                    </div>
                    <div className="text-[11px] text-mac-blue font-black tracking-[0.4em] uppercase opacity-70">Script Engine Core v2.7</div>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(generatedScript); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="group flex items-center gap-3 px-5 py-2.5 rounded-xl glass bg-mac-blue/10 hover:bg-mac-blue/20 transition-all border-mac-blue/30 active:scale-95"
                    >
                      {copied ? <Check className="w-4 h-4 text-mac-safe" /> : <Copy className="w-4 h-4 text-mac-blue" />}
                      <span className="text-[10px] font-black uppercase tracking-widest">{copied ? "Success" : "Copy Content"}</span>
                    </button>
                  </div>
                  <div className="p-10 bg-black/40 font-mono text-sm overflow-auto flex-grow h-[680px] custom-scrollbar selection:bg-mac-blue/20">
                    <div className="flex gap-6">
                      <div className="text-white/10 text-right select-none font-black opacity-30">
                        {generatedScript.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                      </div>
                      <pre className="text-white/80 whitespace-pre-wrap flex-grow">
                        <code>{generatedScript}</code>
                      </pre>
                    </div>
                  </div>
                  <div className="p-8 border-t border-white/5 flex bg-white/2 justify-center">
                    <button 
                      onClick={() => setShowScript(false)}
                      className="text-[10px] text-white/20 hover:text-white uppercase font-black tracking-[0.6em] transition-all hover:tracking-[0.8em]"
                    >
                      ← Back to Manifest
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="grid"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.08 } }
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-5"
                >
                  {CLEANUP_MODULES.map((module) => {
                    const Icon = module.icon;
                    const isSelected = selected.includes(module.id);
                    const catColor = CATEGORY_COLORS[module.category];
                    
                    return (
                      <motion.div
                        key={module.id}
                        variants={{
                          hidden: { opacity: 0, scale: 0.9, y: 20 },
                          visible: { opacity: 1, scale: 1, y: 0 }
                        }}
                        transition={{ type: "spring", damping: 15 }}
                        onClick={() => toggleModule(module.id)}
                        className={cn(
                          "glass glass-hover p-8 cursor-pointer relative group overflow-hidden",
                          isSelected ? "border-mac-blue/40 bg-mac-blue/5" : "border-transparent"
                        )}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className={cn(
                            "p-4 rounded-2xl shadow-2xl transition-all duration-500",
                            isSelected ? "bg-mac-blue text-white" : cn("bg-white/5", catColor)
                          )}>
                            <Icon className="w-7 h-7" />
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full ring-1 ring-inset",
                              module.risk === 'Safe' ? "bg-mac-safe/5 text-mac-safe ring-mac-safe/20" : 
                              module.risk === 'Caution' ? "bg-mac-caution/5 text-mac-caution ring-mac-caution/20" : 
                              "bg-mac-danger/5 text-mac-danger ring-mac-danger/20"
                            )}>
                              {module.risk}
                            </span>
                          </div>
                        </div>
                        
                        <div className="relative z-10">
                          <h4 className="font-black text-xl leading-tight mb-2 tracking-tight italic uppercase">{module.name}</h4>
                          <p className="text-xs text-white/30 font-medium mb-6 leading-relaxed h-8 line-clamp-2">{module.description}</p>
                          <div className="flex items-center gap-4">
                            <span className={cn(
                              "font-black text-sm tracking-widest",
                              isSelected ? "text-mac-blue" : "text-white/40"
                            )}>~{module.size}</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
                            <span className="text-[9px] text-white/20 uppercase font-bold tracking-[0.2em]">{module.category}</span>
                          </div>
                        </div>

                        {/* Animated Border Shimmer on select */}
                        {isSelected && (
                          <div className="absolute inset-0 border-2 border-mac-blue/30 rounded-2xl pointer-events-none" />
                        )}

                        <div className={cn(
                          "absolute bottom-6 right-6 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500",
                          isSelected ? "bg-mac-blue text-white rotate-0 scale-100 shadow-[0_0_20px_rgba(10,132,255,0.4)]" : "bg-white/5 text-transparent -rotate-90 scale-0 shadow-none"
                        )}>
                          <Check className="w-6 h-6 stroke-[3px]" />
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-24 flex justify-between items-center text-white/10 text-[9px] font-black uppercase tracking-[0.6em] border-t border-white/5 pt-12"
        >
          <div className="flex gap-12">
            <div className="flex items-center gap-2 hover:text-white/30 transition-colors cursor-help group">
              <ShieldCheck className="w-3 h-3 group-hover:text-mac-safe transition-colors" />
              <span>Safety Validated</span>
            </div>
            <div className="flex items-center gap-2 hover:text-white/30 transition-colors cursor-help group">
              <Terminal className="w-3 h-3 group-hover:text-mac-blue transition-colors" />
              <span>POSIX Compliant</span>
            </div>
            <div className="flex items-center gap-2 hover:text-white/30 transition-colors cursor-help group">
              <Info className="w-3 h-3 group-hover:text-mac-purple transition-colors" />
              <span>v2.7 Stable</span>
            </div>
          </div>
          <div>EST. 2026 - POWERED BY ANTIGRAVITY</div>
        </motion.footer>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            border: 3px solid transparent;
            background-clip: padding-box;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.15);
            border: 3px solid transparent;
            background-clip: padding-box;
          }
        `}</style>
      </div>
    </div>
  );
}
