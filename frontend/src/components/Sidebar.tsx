import { Film, Monitor, BarChart2, Users, Globe, Settings, RefreshCw } from 'lucide-react';

interface Props {
  activeTab: 'criativos' | 'contas';
  onTabChange: (tab: 'criativos' | 'contas') => void;
}

export default function Sidebar({ activeTab, onTabChange }: Props) {
  return (
    <aside className="w-12 h-screen bg-[#0e0e11] border-r border-[#1a1a20] flex flex-col items-center pt-3 pb-4 gap-0.5 shrink-0 z-20">
      {/* Logo */}
      <div className="w-8 h-8 rounded-[10px] mb-3 shrink-0 flex items-center justify-center select-none"
        style={{ background: 'linear-gradient(135deg,#5c5fdb 0%,#3730a3 100%)' }}>
        <span className="font-black text-white" style={{ fontSize: 13, letterSpacing: '-0.5px', fontFamily: 'sans-serif' }}>W</span>
      </div>

      <SideIcon icon={<RefreshCw size={15} />} active={false} onClick={() => window.location.reload()} tooltip="Recarregar" />

      <Divider />

      <SideIcon icon={<Film size={15} />} active={activeTab === 'criativos'} onClick={() => onTabChange('criativos')} tooltip="Criativos" />
      <SideIcon icon={<Monitor size={15} />} active={activeTab === 'contas'} onClick={() => onTabChange('contas')} tooltip="Contas" />

      <Divider />

      <SideIcon icon={<BarChart2 size={15} />} active={false} onClick={() => {}} tooltip="Analytics" dim />
      <SideIcon icon={<Users size={15} />} active={false} onClick={() => {}} tooltip="Equipe" dim />
      <SideIcon icon={<Globe size={15} />} active={false} onClick={() => {}} tooltip="Links" dim />

      <div className="flex-1" />

      <SideIcon icon={<Settings size={15} />} active={false} onClick={() => {}} tooltip="Configurações" dim />
    </aside>
  );
}

function Divider() {
  return <div className="w-6 h-px bg-[#1e1e24] my-1.5 shrink-0" />;
}

function SideIcon({
  icon, active, onClick, tooltip, dim,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tooltip: string;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all shrink-0 group
        ${active
          ? 'bg-indigo-600/20 text-indigo-400'
          : dim
          ? 'text-[#35353f] hover:text-[#666670] hover:bg-[#17171d]'
          : 'text-[#555560] hover:text-[#c0c0cc] hover:bg-[#17171d]'}
      `}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r" />
      )}
      {icon}
    </button>
  );
}
