import React, { useState } from 'react';
import { AppView } from './types';
import { DockingInterface } from './components/DockingInterface';
import { ChatInterface } from './components/ChatInterface';
import { ToolsInterface } from './components/ToolsInterface';
import { IconDna, IconBot, IconAnalysis } from './components/Icons';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DOCKING);

  const NavButton = ({ view, icon: Icon, label }: { view: AppView, icon: any, label: string }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        currentView === view
          ? 'bg-science-600 text-white shadow-lg shadow-science-900/50'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-science-500/30">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-science-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <IconDna className="text-science-500" />
            BioDock AI
          </h1>
          <p className="text-xs text-slate-500 mt-1">Molecular Dynamics Studio</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavButton view={AppView.DOCKING} icon={IconDna} label="Docking Workflow" />
          <NavButton view={AppView.CHAT} icon={IconBot} label="AI Assistant" />
          <NavButton view={AppView.ANALYSIS} icon={IconAnalysis} label="AI Tools (Vision/Gen)" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
            <p>Powered by <span className="text-science-400 font-bold">Gemini 3 Pro</span></p>
            <p className="mt-1">Version 2.0.1-beta</p>
          </div>
        </div>
      </aside>

      {/* Mobile Nav Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-50">
        <h1 className="font-bold text-lg flex items-center gap-2">
          <IconDna className="text-science-500" /> BioDock AI
        </h1>
        <div className="flex gap-2">
             <button onClick={() => setCurrentView(AppView.DOCKING)} className={`p-2 rounded ${currentView === AppView.DOCKING ? 'bg-science-600' : 'bg-slate-800'}`}><IconDna /></button>
             <button onClick={() => setCurrentView(AppView.CHAT)} className={`p-2 rounded ${currentView === AppView.CHAT ? 'bg-science-600' : 'bg-slate-800'}`}><IconBot /></button>
             <button onClick={() => setCurrentView(AppView.ANALYSIS)} className={`p-2 rounded ${currentView === AppView.ANALYSIS ? 'bg-science-600' : 'bg-slate-800'}`}><IconAnalysis /></button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative pt-16 md:pt-0">
        <div className="flex-1 overflow-hidden p-4 md:p-8">
          {currentView === AppView.DOCKING && <DockingInterface />}
          {currentView === AppView.CHAT && <ChatInterface />}
          {currentView === AppView.ANALYSIS && <ToolsInterface />}
        </div>
      </main>
    </div>
  );
}
