import React, { useState, useMemo, useEffect } from 'react';
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
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

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

export default function App() {
  const [selected, setSelected] = useState(CLEANUP_MODULES.map(m => m.id));
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);
  
  // Advanced Options
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
      '# Mac Cleanup Pro - Optimized Script',
      '# =================================',
      'set -e',
      '',
      'echo "🚀 Starting Mac Cleanup Pro..."',
      ''
    ];

    if (forceKill) {
      lines.push('# Force-killing browsers for deep cleanup');
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
    } else {
      lines.push('echo "✅ Cleanup complete!"');
    }
    
    return lines.join('\n');
  }, [selected, forceKill, reopenApps]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setShowScript(true);
    }, 1200);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-end mb-12"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-mac-blue rounded-lg shadow-lg">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Mac Cleanup Pro</h1>
          </div>
          <p className="text-white/60 text-lg">Precision storage reclamation with macOS-native aesthetics.</p>
        </div>
        <div className="flex gap-4">
          <button className="glass px-4 py-2 flex items-center gap-2 hover:bg-white/10 transition-colors">
            <Settings className="w-4 h-4 text-white/60" />
            <span className="text-sm font-medium">Preferences</span>
          </button>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Stats & Advanced Options */}
        <div className="lg:col-span-4 space-y-6">
          <motion.section 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-8 relative overflow-hidden"
          >
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative w-48 h-48 mb-6">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-white/10"
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray="552.92"
                    initial={{ strokeDashoffset: 552.92 }}
                    animate={{ strokeDashoffset: 552.92 - (552.92 * 0.72) }}
                    transition={{ duration: 1.5, ease: "circOut" }}
                    className="text-mac-blue"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span 
                    key={totalFreed}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-4xl font-bold"
                  >
                    72%
                  </motion.span>
                  <span className="text-xs text-white/40 uppercase tracking-widest">Storage</span>
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center gap-2 mb-1">
                  <LayoutDashboard className="w-4 h-4 text-mac-blue" />
                  <h3 className="text-xl font-semibold">Health: 68/100</h3>
                </div>
                <p className="text-mac-caution text-sm font-medium px-3 py-1 bg-mac-caution/10 rounded-full inline-block">
                  Optimized maintenance recommended
                </p>
              </div>
            </div>
            
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-40 h-40 bg-mac-blue/20 blur-[100px] rounded-full" />
          </motion.section>

          {/* New Control Panel */}
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass p-6"
          >
            <h4 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Zap className="w-3 h-3" /> Script Protocol
            </h4>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between group">
                <div className="flex gap-3">
                  <div className="p-2 bg-mac-danger/10 rounded-lg text-mac-danger">
                    <Power className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Force-Kill Apps</p>
                    <p className="text-[10px] text-white/40">Aggressively close browsers</p>
                  </div>
                </div>
                <button 
                  onClick={() => setForceKill(!forceKill)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative",
                    forceKill ? "bg-mac-blue" : "bg-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: forceKill ? 20 : 2 }}
                    className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <div className="flex items-center justify-between group">
                <div className="flex gap-3">
                  <div className="p-2 bg-mac-safe/10 rounded-lg text-mac-safe">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Auto-Reopen</p>
                    <p className="text-[10px] text-white/40">Launch tools after cleanup</p>
                  </div>
                </div>
                <button 
                  onClick={() => setReopenApps(!reopenApps)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative",
                    reopenApps ? "bg-mac-blue" : "bg-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: reopenApps ? 20 : 2 }}
                    className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/60">Estimated Gain</span>
                  <motion.span 
                    key={totalFreed}
                    initial={{ y: 5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-xl font-black text-mac-blue"
                  >
                    {totalFreed} GB
                  </motion.span>
                </div>
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || selected.length === 0}
                  className={cn(
                    "w-full py-4 rounded-xl font-extrabold text-lg transition-all duration-300",
                    "bg-gradient-to-br from-mac-blue via-mac-blue to-mac-purple shadow-xl",
                    "hover:shadow-mac-blue/20 hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:grayscale"
                  )}
                >
                  {isGenerating ? "Compiling..." : "Generate Script"}
                </button>
              </div>
            </div>
          </motion.section>
        </div>

        {/* Right Column: Grid and Script Preview */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {showScript ? (
              <motion.div 
                key="script"
                layoutId="content"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="glass overflow-hidden h-full flex flex-col shadow-2xl ring-1 ring-white/10"
              >
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-mac-danger shadow-[0_0_8px_rgba(255,69,58,0.5)]" />
                    <div className="w-3 h-3 rounded-full bg-mac-caution shadow-[0_0_8px_rgba(255,214,10,0.5)]" />
                    <div className="w-3 h-3 rounded-full bg-mac-safe shadow-[0_0_8px_rgba(48,209,88,0.5)]" />
                  </div>
                  <div className="text-[10px] text-white/30 font-mono tracking-[0.3em] font-black uppercase">Terminal Engine 2.6</div>
                  <button 
                    onClick={copyToClipboard}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                  >
                    {copied ? <Check className="w-3 h-3 text-mac-safe" /> : <Copy className="w-3 h-3 text-white/40" />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-8 bg-[#0a0a0b]/90 font-mono text-sm overflow-auto flex-grow h-[640px] leading-relaxed custom-scrollbar">
                  <pre className="text-mac-blue/80 whitespace-pre-wrap">
                    <code>{generatedScript}</code>
                  </pre>
                </div>
                <div className="p-6 border-t border-white/5 flex justify-center bg-white/5">
                  <button 
                    onClick={() => setShowScript(false)}
                    className="text-[10px] text-white/30 hover:text-mac-blue uppercase font-black tracking-[0.4em] transition-all hover:tracking-[0.5em]"
                  >
                    ← Modify Payload Selections
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="grid"
                layout
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.05 } }
                }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {CLEANUP_MODULES.map((module) => {
                  const Icon = module.icon;
                  const isSelected = selected.includes(module.id);
                  return (
                    <motion.div
                      key={module.id}
                      layout
                      variants={{
                        hidden: { opacity: 0, y: 15 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                      onClick={() => toggleModule(module.id)}
                      className={cn(
                        "glass p-6 cursor-pointer transition-all duration-300 relative group border-2",
                        isSelected 
                          ? "border-mac-blue/40 bg-mac-blue/5 shadow-[0_0_30px_rgba(0,122,255,0.05)]" 
                          : "border-transparent hover:border-white/10 hover:bg-white/5"
                      )}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className={cn(
                          "p-3 rounded-xl shadow-lg transition-all duration-300",
                          isSelected ? "bg-mac-blue text-white" : "bg-white/5 text-white/40 group-hover:text-mac-blue"
                        )}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                            module.risk === 'Safe' ? "bg-mac-safe/10 text-mac-safe" : 
                            module.risk === 'Caution' ? "bg-mac-caution/10 text-mac-caution" : 
                            "bg-mac-danger/10 text-mac-danger"
                          )}>
                            {module.risk}
                          </span>
                        </div>
                      </div>
                      
                      <div className="relative z-10">
                        <h4 className="font-extrabold text-lg leading-tight mb-1">{module.name}</h4>
                        <p className="text-xs text-white/40 mb-4 h-8 overflow-hidden line-clamp-2">{module.description}</p>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "font-black text-sm transition-colors",
                            isSelected ? "text-mac-blue" : "text-white/60"
                          )}>~{module.size}</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                          <span className="text-[10px] text-white/30 uppercase font-black tracking-widest">{module.category}</span>
                        </div>
                      </div>

                      <div className={cn(
                        "absolute bottom-4 right-4 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-500",
                        isSelected ? "bg-mac-blue text-white rotate-0 scale-100 shadow-lg shadow-mac-blue/20" : "bg-white/5 text-transparent -rotate-90 scale-0 shadow-none"
                      )}>
                        <Check className="w-5 h-5 stroke-[3px]" />
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
        transition={{ delay: 0.8 }}
        className="mt-16 flex justify-center gap-16 text-white/20 text-[10px] font-black uppercase tracking-[0.4em]"
      >
        <div className="flex items-center gap-2 hover:text-white/40 transition-colors cursor-help">
          <ShieldCheck className="w-3 h-3" />
          <span>Privacy Assured</span>
        </div>
        <div className="flex items-center gap-2 hover:text-white/40 transition-colors cursor-help">
          <Terminal className="w-3 h-3" />
          <span>Local Execution</span>
        </div>
        <div className="flex items-center gap-2 hover:text-white/40 transition-colors cursor-help">
          <Info className="w-3 h-3" />
          <span>Open Source</span>
        </div>
      </motion.footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
