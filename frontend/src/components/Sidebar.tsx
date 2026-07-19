import { useState } from 'react';
import { Film, Monitor, BarChart2, Users, Globe, Settings, RefreshCw } from 'lucide-react';

interface Props {
  activeTab: 'criativos' | 'contas';
  onTabChange: (tab: 'criativos' | 'contas') => void;
}

export default function Sidebar({ activeTab, onTabChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="h-screen bg-[#0e0e11] border-r border-[#1a1a20] flex flex-col pt-3 pb-4 shrink-0 z-20 overflow-hidden"
      style={{ width: open ? 200 : 48, transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-4 shrink-0" style={{ height: 32 }}>
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 border border-[#2a2a35] bg-[#16161a]">
          <span
            className="font-black text-white select-none"
            style={{ fontSize: 14, letterSpacing: '-0.5px', fontFamily: 'sans-serif' }}
          >
            W
          </span>
        </div>
        <span
          className="text-[13px] font-bold text-white whitespace-nowrap"
          style={{ opacity: open ? 1 : 0, transition: 'opacity 0.12s' }}
        >
          Wave
        </span>
      </div>

      <NavItem icon={<RefreshCw size={15} />} label="Recarregar" active={false} onClick={() => window.location.reload()} open={open} />

      <div className="mx-3 h-px bg-[#1a1a20] my-2 shrink-0" />

      <NavItem icon={<Film size={15} />}    label="Criativos" active={activeTab === 'criativos'} onClick={() => onTabChange('criativos')} open={open} />
      <NavItem icon={<Monitor size={15} />} label="Contas"    active={activeTab === 'contas'}    onClick={() => onTabChange('contas')}    open={open} />

      <div className="mx-3 h-px bg-[#1a1a20] my-2 shrink-0" />

      <NavItem icon={<BarChart2 size={15} />} label="Analytics"     active={false} onClick={() => {}} open={open} muted />
      <NavItem icon={<Users size={15} />}     label="Equipe"         active={false} onClick={() => {}} open={open} muted />
      <NavItem icon={<Globe size={15} />}     label="Links"          active={false} onClick={() => {}} open={open} muted />

      <div className="flex-1" />

      <NavItem icon={<Settings size={15} />} label="Configurações" active={false} onClick={() => {}} open={open} muted />
    </aside>
  );
}

function NavItem({
  icon, label, active, onClick, open, muted,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  open: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-3 mx-1.5 my-0.5 px-2.5 py-2 rounded-lg transition-colors text-left shrink-0 ${
        active
          ? 'text-[#00c896]'
          : muted
          ? 'text-[#383840] hover:text-[#666670] hover:bg-[#111115]'
          : 'text-[#555560] hover:text-[#d0d0dc] hover:bg-[#111115]'
      }`}
      style={{
        width: 'calc(100% - 12px)',
        backgroundColor: active ? 'rgba(0,200,150,0.10)' : undefined,
      }}
    >
      <span className="shrink-0 leading-none">{icon}</span>
      <span
        className="text-[12px] font-medium whitespace-nowrap leading-none"
        style={{ opacity: open ? 1 : 0, transition: 'opacity 0.1s', pointerEvents: 'none' }}
      >
        {label}
      </span>
    </button>
  );
}
