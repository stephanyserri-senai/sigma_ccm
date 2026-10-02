import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity, AlertTriangle, Archive, BarChart3, Bell, Bot, Box, CalendarDays, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, Clock3, Cloud, CloudOff, Download, FileBarChart,
  Filter, Gauge, HardHat, LayoutDashboard, ListFilter, MapPin, Menu, MessageSquareText, MoreHorizontal,
  Package, PanelLeftClose, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Timer,
  Users, Wrench, X, Zap
} from 'lucide-react';
import * as api from './api';
import Login from './pages/Login';
import { useAuth, PERMS, homeFor } from './auth';
import { Logo } from './components/Logo';

export type Page = 'dashboard'|'orders'|'new-order'|'assets'|'schedule'|'indicators'|'reports'|'alerts'|'users'|'settings'|'field';
type Order = { id:string; asset:string; tag:string; service:string; area:string; priority:'Crítica'|'Alta'|'Média'|'Baixa'; status:string; owner:string; due:string; progress:number };

type DashboardKpis = {
  aderenciaSistematica?: number | null;
  aderenciaProgramacao?: number | null;
  iamot?: number | null;
  apontamento?: number | null;
  encerradas?: number | null;
  notasAbertas?: number | null;
};

type DashboardPendencia = {
  numero?: string | number | null;
  equipamento?: string | null;
  equipe?: string | null;
  data_programada?: string | null;
  status?: string | null;
};

type ApiOrder = {
  id: number | string;
  numero?: string | number | null;
  equipamento?: string | null;
  equipe?: string | null;
  tipo?: string | null;
  status?: string | null;
  hh_previsto?: number | string | null;
  data_programada?: string | null;
  data_encerramento?: string | null;
  condicoes?: Array<{ tipo: string; ok: boolean }>;
};

const orders: Order[] = [
  {id:'OM-2026-1548',asset:'Bomba centrífuga',tag:'BOM-1234A',service:'Substituição do selo mecânico',area:'Mecânica',priority:'Alta',status:'Em execução',owner:'João Silva',due:'Hoje, 14:30',progress:68},
  {id:'OM-2026-1552',asset:'Correia transportadora',tag:'CT-07B',service:'Inspeção e ajuste de alinhamento',area:'Mecânica',priority:'Crítica',status:'Atrasada',owner:'Marcos Rocha',due:'Hoje, 10:00',progress:35},
  {id:'OM-2026-1541',asset:'Painel elétrico QGBT',tag:'QGBT-02',service:'Termografia e reaperto geral',area:'Elétrica',priority:'Média',status:'Programada',owner:'Ana Costa',due:'Amanhã, 08:00',progress:0},
  {id:'OM-2026-1537',asset:'Compressor de ar',tag:'COM-04',service:'Troca de filtros e lubrificante',area:'Mecânica',priority:'Baixa',status:'Aguard. material',owner:'Paulo Reis',due:'02 set, 09:00',progress:20},
  {id:'OM-2026-1529',asset:'Sensor de nível',tag:'LSH-224',service:'Calibração de instrumento',area:'Instrumentação',priority:'Alta',status:'Validação',owner:'Beatriz Lima',due:'31 ago, 16:00',progress:100},
];

const nav = [
  {section:'VISÃO GERAL', items:[['dashboard','Dashboard',LayoutDashboard],['alerts','Central de alertas',Bell]]},
  {section:'MANUTENÇÃO', items:[['orders','Ordens de manutenção',Wrench],['assets','Gestão de ativos',Box],['schedule','Programação semanal',CalendarDays]]},
  {section:'OPERAÇÃO', items:[['field','Operação em campo',HardHat]]},
  {section:'ANÁLISE', items:[['indicators','Indicadores',BarChart3],['reports','Relatórios',FileBarChart]]},
  {section:'GESTÃO', items:[['users','Usuários e acessos',Users],['settings','Configurações',Settings]]},
] as const;

const pageNames:Record<Page,string>={dashboard:'Visão operacional',orders:'Ordens de manutenção','new-order':'Nova ordem de manutenção',assets:'Gestão de ativos',schedule:'Programação semanal',indicators:'Indicadores de manutenção',reports:'Relatórios',alerts:'Central de alertas',users:'Usuários e acessos',settings:'Configurações',field:'Operação em campo'};

function Status({children}:{children:string}){const cls=children.toLowerCase().replaceAll(' ','-').replace('.','');return <span className={`status ${cls}`}><i/>{children}</span>}
function Priority({value}:{value:Order['priority']}){return <span className={`priority ${value.toLowerCase()}`}>{value}</span>}

function Sidebar({page,setPage,open,setOpen,allowedPages,user,onLogout}:{page:Page,setPage:(p:Page)=>void,open:boolean,setOpen:(v:boolean)=>void,allowedPages:Page[],user:{nome:string;papel:string;username:string},onLogout:()=>void}){
 const initials = user.nome.split(' ').map(part => part[0]).join('').slice(0,2).toUpperCase();
 const filteredNav = nav.filter(group => group.items.some(([id]) => allowedPages.includes(id as Page)));
 return <aside className={`sidebar ${open?'open':''}`}><div className="brand"><Logo/><button onClick={()=>setOpen(false)}><PanelLeftClose size={18}/></button></div><div className="siteSelect"><MapPin size={16}/><div><small>UNIDADE ATUAL</small><b>Terminal Sudeste</b></div><ChevronDown size={15}/></div><nav>{filteredNav.map(g=><div className="navGroup" key={g.section}><label>{g.section}</label>{g.items.filter(([id]) => allowedPages.includes(id as Page)).map(([id,label,Icon])=><button className={page===id?'active':''} key={id} onClick={()=>{setPage(id as Page);setOpen(false)}}><Icon size={18}/><span>{label}</span>{id==='alerts'&&<em>5</em>}</button>)}</div>)}</nav><div className="sidebarFoot"><div className="sync"><Cloud size={16}/><div><b>Sistema sincronizado</b><small>há 2 minutos</small></div><span/></div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><button className="profile" type="button"><div className="avatar">{initials}</div><div><b>{user.nome}</b><small>{user.papel}</small></div><MoreHorizontal size={17}/></button><button type="button" className="secondary" onClick={onLogout} style={{ width: '100%' }}>Sair</button></div></div></aside>
}

function Header({page,onMenu}:{page:Page,onMenu:()=>void}){return <header><button className="mobileMenu" onClick={onMenu}><Menu/></button><div><div className="crumb">SIGMA-CCM <ChevronRight size={13}/> {pageNames[page]}</div><h1>{pageNames[page]}</h1></div><div className="headActions"><div className="globalSearch"><Search size={17}/><input placeholder="Buscar ordens, ativos, TAGs..."/><kbd>⌘ K</kbd></div><button className="iconBtn hasDot"><Bell size={19}/><i/></button><button className="help"><CircleHelp size={17}/> Central de ajuda</button></div></header>}

function Metric({label,value,unit,delta,good=true,icon:Icon}:{label:string,value:string,unit?:string,delta:string,good?:boolean,icon:any}){return <div className="metric card"><div className="metricTop"><span>{label}</span><div><Icon size={18}/></div></div><div className="metricValue">{value}<small>{unit}</small></div><div className={`delta ${good?'good':'bad'}`}><b>{good?'↗':'↘'} {delta}</b><span>vs. mês anterior</span></div><div className="spark"><i/><i/><i/><i/><i/><i/><i/><i/></div></div>}

function Donut(){return <div className="donutWrap"><div className="donut"><div><b>248</b><span>Total</span></div></div><div className="legend"><p><i className="c1"/>Em execução <b>64</b></p><p><i className="c2"/>Programadas <b>82</b></p><p><i className="c3"/>Aguardando <b>46</b></p><p><i className="c4"/>Encerradas <b>56</b></p></div></div>}
function TrendChart(){return <div className="trendChart"><div className="chartY"><span>100%</span><span>90%</span><span>80%</span><span>70%</span></div><svg viewBox="0 0 650 180" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e7a72d" stopOpacity=".25"/><stop offset="1" stopColor="#e7a72d" stopOpacity="0"/></linearGradient></defs><path className="grid" d="M0 20H650M0 70H650M0 120H650M0 170H650"/><path className="target" d="M0 55H650"/><path className="area" d="M0 135 C55 115 80 128 125 105 S210 80 250 92 S330 55 375 70 S455 45 500 55 S590 28 650 35 L650 180L0 180Z"/><path className="line" d="M0 135 C55 115 80 128 125 105 S210 80 250 92 S330 55 375 70 S455 45 500 55 S590 28 650 35"/></svg><div className="chartX"><span>Mar</span><span>Abr</span><span>Mai</span><span>Jun</span><span>Jul</span><span>Ago</span></div></div>}

function Dashboard({setPage}:{setPage:(p:Page)=>void}){const [loading,setLoading]=useState(true);const [error,setError]=useState<string | null>(null);const [kpis,setKpis]=useState<DashboardKpis>({});const [pendencias,setPendencias]=useState<DashboardPendencia[]>([]);useEffect(()=>{let active=true;const load=async()=>{setLoading(true);setError(null);try{const data=await api.dashboard();if(!active)return;setKpis(data?.kpis ?? {});setPendencias(Array.isArray(data?.pendencias)?data.pendencias:[]);}catch(err){if(!active)return;setError(err instanceof Error ? err.message : 'Não foi possível carregar o dashboard.');}finally{if(active)setLoading(false);}};load();return ()=>{active=false;};},[]);const fmt=(value:number|null|undefined,digits=1,suffix='%')=>typeof value==='number'?`${value.toFixed(digits).replace('.', ',')}${suffix}`:'—';const metricCards=[{label:'Aderência sistêmica',value:fmt(kpis.aderenciaSistematica,1),delta:'Atualizado agora',good:true,icon:ClipboardCheck},{label:'Aderência semanal',value:fmt(kpis.aderenciaProgramacao,1),delta:'Atualizado agora',good:true,icon:ClipboardCheck},{label:'IAMOT',value:fmt(kpis.iamot,1),delta:'Atualizado agora',good:true,icon:Activity},{label:'Apontamento',value:fmt(kpis.apontamento,0),delta:'Atualizado agora',good:true,icon:BarChart3},{label:'Encerradas',value:String(kpis.encerradas ?? '—'),delta:'Atualizado agora',good:true,icon:Archive},{label:'Notas abertas',value:String(kpis.notasAbertas ?? '—'),delta:'Atualizado agora',good:true,icon:FileBarChart}];const rows=pendencias.slice(0,5).map(item=>({id:String(item.numero ?? item.equipamento ?? 'pendencia'),numero:item.numero ?? '—',equipamento:item.equipamento ?? '—',equipe:item.equipe ?? '—',tipo:item.status ?? 'Pendência',status:item.status ?? 'Pendente',data_programada:item.data_programada ?? '—',hh_previsto:null,condicoes:[]}));return <><section className="heroRow"><div><p className="eyebrow">SEGUNDA-FEIRA, 31 DE AGOSTO</p><h2>Bom dia, Carlos.</h2><p>Veja o panorama da operação no Terminal Sudeste.</p></div><div className="filters"><button><CalendarDays size={16}/> Últimos 30 dias <ChevronDown size={15}/></button><button><MapPin size={16}/> Todas as áreas <ChevronDown size={15}/></button><button className="filterBtn"><SlidersHorizontal size={16}/></button></div></section>{loading && <div className="card panel"><p>Carregando dashboard...</p></div>}{!loading && error && <div className="card panel"><p className="dangerText">{error}</p></div>}{!loading && !error && <><section className="metrics">{metricCards.map(metric=><Metric key={metric.label} label={metric.label} value={metric.value} unit={metric.label.includes('IAMOT') || metric.label.includes('Aderência') || metric.label.includes('Apontamento') ? '%' : ''} delta={metric.delta} good={metric.good} icon={metric.icon}/>)}</section><section className="dashboardGrid"><div className="card panel trendPanel"><div className="panelHead"><div><h3>Tendência de disponibilidade</h3><p>Desempenho dos ativos nos últimos 6 meses</p></div><div className="chartLegend"><span><i/>Real</span><span><i/>Meta 95%</span></div></div><TrendChart/></div><div className="card panel"><div className="panelHead"><div><h3>Ordens por status</h3><p>Distribuição no período</p></div><button className="dots"><MoreHorizontal/></button></div><Donut/></div></section><section className="bottomGrid"><div className="card panel"><div className="panelHead"><div><h3>Ordens que exigem atenção</h3><p>Priorizadas por criticidade e prazo</p></div><button className="link" onClick={()=>setPage('orders')}>Ver todas <ChevronRight size={15}/></button></div>{rows.length>0?<OrderTable compact rows={rows}/>:<p>Sem pendências para exibir.</p>}</div><div className="card panel alertsPanel"><div className="panelHead"><div><h3>Alertas operacionais</h3><p>Atualizados em tempo real</p></div><button className="link" onClick={()=>setPage('alerts')}>Ver central</button></div><div className="alertList compact">{[['Correia CT-07B parada','OM crítica atrasada há 4 horas','critical'],['Preventiva próxima do prazo','3 atividades vencem nas próximas 24h','warning'],['MTTR acima da meta','Britagem registrou aumento de 18%','warning']].map(([t,s,l])=><div className={`fullAlert ${l}`} key={t}><span>{l==='critical'?<AlertTriangle/>:l==='warning'?<Clock3/>:<Cloud/>}</span><div><h3>{t}</h3><p>{s}</p></div><button><MoreHorizontal/></button></div>)}</div></div></section></>}</>}

function OrderTable({compact=false,rows=[],onSelect}:{compact?:boolean,rows:ApiOrder[],onSelect?:(o:ApiOrder)=>void}){const list=compact?rows.slice(0,3):rows;return <div className="tableWrap"><table><thead><tr><th>ORDEM</th><th>ATIVO / SERVIÇO</th>{!compact&&<th>RESPONSÁVEL</th>}<th>PRAZO</th><th>STATUS</th><th/></tr></thead><tbody>{list.map((o)=>{const numero=String(o.numero ?? o.id);const titulo=o.equipamento ?? '—';const status=o.status ?? '—';return <tr key={String(o.id)} onClick={()=>onSelect?.(o)}><td><b className="orderId">{numero}</b></td><td><b>{titulo}</b><small>{o.tipo ?? '—'}</small></td>{!compact&&<td>{o.equipe ?? '—'}</td>}<td><b className={status==='Atrasada' || status==='Encerrada' ? 'dangerText' : ''}>{o.data_programada ?? '—'}</b></td><td><Status>{status}</Status></td><td><ChevronRight size={16}/></td></tr>})}</tbody></table></div>}

function Orders(){const [rows,setRows]=useState<ApiOrder[]>([]);const [selected,setSelected]=useState<ApiOrder | null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string | null>(null);const [toast,setToast]=useState(false);const countBy=(value:string)=>rows.filter((o)=>String(o.status ?? '').toLowerCase()===value.toLowerCase()).length;const fetchOrders=async()=>{setLoading(true);setError(null);try{const data=await api.ordens();setRows(Array.isArray(data)?data:[]);}catch(err){setError(err instanceof Error ? err.message : 'Não foi possível carregar as ordens.');}finally{setLoading(false);}};useEffect(()=>{let active=true;const load=async()=>{if(!active)return;await fetchOrders();};load();return ()=>{active=false;};},[]);const openOrder=async(order:ApiOrder)=>{try{const detail=await api.ordem(order.id);setSelected(detail);}catch(err){setError(err instanceof Error ? err.message : 'Não foi possível carregar a ordem.');}};const refreshOrdersAndSelection=async()=>{await fetchOrders();if(selected){try{const detail=await api.ordem(selected.id);setSelected(detail);}catch(err){setError(err instanceof Error ? err.message : 'Não foi possível atualizar a ordem.');}}};return <><PageIntro text="Planeje, acompanhe e execute intervenções em todos os ativos."><button className="secondary"><Download size={16}/> Exportar</button><button className="primary" onClick={()=>{setToast(true);setTimeout(()=>setToast(false),2500)}}><Plus size={17}/> Nova ordem</button></PageIntro>{loading && <div className="card panel"><p>Carregando ordens...</p></div>}{!loading && error && <div className="card panel"><p className="dangerText">{error}</p></div>}{!loading && !error && <><div className="quickStats"><div><span>ABERTAS</span><b>{rows.filter((o)=>String(o.status ?? '').toLowerCase()!=='encerrada').length}</b><small>total em produção</small></div><div><span>EM EXECUÇÃO</span><b>{countBy('Em execução')}</b><small>em andamento</small></div><div><span>AGUARDANDO</span><b>{countBy('Programada')}</b><small>em planejamento</small></div><div><span>CRÍTICAS</span><b className="dangerText">{countBy('Atrasada')}</b><small>com atraso</small></div></div><div className="card tableCard"><div className="tableTools"><div className="tabs"><button className="active">Todas <i>{rows.length}</i></button><button>Abertas <i>{rows.filter((o)=>String(o.status ?? '').toLowerCase()!=='encerrada').length}</i></button><button>Em execução <i>{countBy('Em execução')}</i></button><button>Programadas <i>{countBy('Programada')}</i></button><button>Encerradas</button></div><div className="tools"><div className="inlineSearch"><Search size={16}/><input placeholder="Buscar ordem ou ativo"/></div><button><Filter size={16}/> Filtros <i>2</i></button></div></div><OrderTable rows={rows} onSelect={openOrder}/><div className="pagination"><span>Mostrando {rows.length ? '1' : '0'}–{Math.min(rows.length, 5)} de {rows.length} ordens</span><div><button><ChevronLeft/></button><button className="active">1</button><button>2</button><button>3</button><span>...</span><button>50</button><button><ChevronRight/></button></div></div></div></>}{selected&&<OrderDrawer order={selected} onClose={()=>setSelected(null)} onRefresh={refreshOrdersAndSelection}/>} {toast&&<div className="toast"><Check size={18}/> Formulário de nova ordem iniciado</div>}</>}

function OrderDrawer({order,onClose,onRefresh}:{order:ApiOrder,onClose:()=>void,onRefresh:()=>Promise<void>}){const [updating,setUpdating]=useState(false);const [actionError,setActionError]=useState<string | null>(null);const handleAction=async(status:'Programada'|'Distribuída')=>{setActionError(null);setUpdating(true);try{await api.statusOrdem(order.id,status);await onRefresh();}catch(err){setActionError(err instanceof Error ? err.message : 'Não foi possível atualizar a ordem.');}finally{setUpdating(false);}};const status=order.status ?? '—';const isClosed=String(status).toLowerCase()==='encerrada';const condicoes=Array.isArray(order.condicoes)?order.condicoes:[];const done=condicoes.filter((c)=>c.ok).length;return <div className="overlay" onClick={onClose}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawerHead"><div><span>ORDEM DE MANUTENÇÃO</span><h2>{String(order.numero ?? order.id)}</h2></div><button onClick={onClose}><X/></button></div><div className="drawerStatus"><Status>{status}</Status>{condicoes.length > 0 && <span className="priority">{done}/{condicoes.length} concluídas</span>}</div><div className="assetHero"><div className="assetIcon"><Wrench/></div><div><small>ATIVO</small><h3>{order.equipamento ?? '—'}</h3><p><MapPin size={14}/> Terminal Sudeste · {order.equipe ?? '—'}</p></div></div><section className="drawerSection"><label>SERVIÇO</label><h3>{order.tipo ?? '—'}</h3><p>{order.hh_previsto ? `HH previsto: ${order.hh_previsto}` : 'Sem HH previsto informado.'}</p></section><div className="detailGrid"><div><span>Responsável</span><b>{order.equipe ?? '—'}</b></div><div><span>Prazo</span><b>{order.data_programada ?? '—'}</b></div><div><span>Tempo estimado</span><b>{order.hh_previsto ? `${order.hh_previsto}h` : '—'}</b></div><div><span>Centro de trabalho</span><b>MAN-01</b></div>{isClosed && order.data_encerramento && <div><span>Encerrada em</span><b>{order.data_encerramento}</b></div>}</div>{condicoes.length > 0 && <section className="drawerSection"><label>CONDIÇÕES</label>{condicoes.map((condicao)=><div key={condicao.tipo} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8,padding:'8px 10px',border:'1px solid #1f3a5a',borderRadius:8}}><span>{condicao.tipo}</span><span className={condicao.ok ? 'status concluída' : 'status pendente'} style={{padding:'4px 8px',borderRadius:999,fontSize:11,fontWeight:700}}>{condicao.ok ? 'Concluída' : 'Pendente'}</span></div>)}</section>}{actionError && <p className="dangerText">{actionError}</p>}{isClosed ? (order.data_encerramento ? <div className="drawerActions"><button className="secondary" disabled>Encerrada em {order.data_encerramento}</button></div> : null) : <div className="drawerActions"><button className="secondary" onClick={()=>handleAction('Programada')} disabled={updating}>{updating ? 'Aguarde...' : 'Programar'}</button><button className="primary" onClick={()=>handleAction('Distribuída')} disabled={updating}>Distribuir</button></div>}</aside></div>}

function PageIntro({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <section className="heroRow" style={{ marginBottom: 18 }}>
      <div>
        <p className="eyebrow">SIGMA-CCM</p>
        <h2 style={{ marginTop: 8, marginBottom: 4 }}>{text}</h2>
      </div>
      {children ? <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div> : null}
    </section>
  );
}

function Assets() {
  const items = [
    { tag: 'VT-3330-TR01', nome: 'Sistema estrutural TR01', status: 'Operando', criticidade: 'Alta', local: 'Terminal Leste' },
    { tag: 'TR01-BOMBA-02', nome: 'Bomba de recalque 02', status: 'Em inspeção', criticidade: 'Alta', local: 'Pátio A' },
    { tag: 'PA-2200-MOT', nome: 'Motor de acionamento 2200', status: 'Programada', criticidade: 'Média', local: 'Pátio B' },
    { tag: 'ESTR-3330', nome: 'Estrutura metálica 3330', status: 'Normal', criticidade: 'Média', local: 'Terminal Leste' },
  ];

  return (
    <>
      <PageIntro text="Gestão de ativos e criticidade." />
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        {items.map((item) => (
          <div key={item.tag} className="card panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="eyebrow">{item.tag}</span>
              <span className="status em-execucao">{item.status}</span>
            </div>
            <h3 style={{ margin: '0 0 8px' }}>{item.nome}</h3>
            <p style={{ margin: 0, color: '#8aa3c6' }}>{item.local}</p>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', color: '#c8d9f7' }}>
              <span>Criticidade</span>
              <b>{item.criticidade}</b>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Handover() {
  const itens = [
    { turno: 'Turno A', descricao: 'Troca de filtros na Bomba 02 concluída com sucesso.', responsavel: 'Marisa' },
    { turno: 'Turno B', descricao: 'Reaperto em painel QGBT pendente para 18h.', responsavel: 'Flávio' },
    { turno: 'Turno C', descricao: 'Lote de materiais chegou e foi conferido.', responsavel: 'Luiz' },
  ];

  return (
    <>
      <PageIntro text="Passagem de turno e alinhamento operacional." />
      <div className="card panel" style={{ padding: 20 }}>
        {itens.map((item) => (
          <div key={item.turno} style={{ border: '1px solid rgba(146,176,220,0.16)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong>{item.turno}</strong>
              <span className="eyebrow">{item.responsavel}</span>
            </div>
            <p style={{ margin: 0, color: '#dbe8ff' }}>{item.descricao}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function Schedule() {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const slots = [
    { label: 'Engenharia', value: '4' },
    { label: 'Campo', value: '7' },
    { label: 'Manutenção', value: '5' },
    { label: 'Inspeções', value: '3' },
  ];

  return (
    <>
      <PageIntro text="Programação semanal e alocação de equipes." />
      <div className="card panel" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {days.map((day) => (
            <div key={day} style={{ border: '1px solid rgba(146,176,220,0.16)', borderRadius: 12, padding: 12 }}>
              <div className="eyebrow">{day}</div>
              <div style={{ marginTop: 8, fontSize: 26, fontWeight: 700 }}>{day === 'Seg' ? '3' : day === 'Ter' ? '5' : day === 'Qua' ? '2' : day === 'Qui' ? '6' : day === 'Sex' ? '4' : '1'}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 18 }}>
          {slots.map((slot) => (
            <div key={slot.label} className="metric card" style={{ padding: 16 }}>
              <div className="metricTop"><span>{slot.label}</span></div>
              <div className="metricValue">{slot.value}<small>ordens</small></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Indicators() {
  return (
    <>
      <PageIntro text="Indicadores de manutenção e performance." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        <Metric label="Aderência" value="94" unit="%" delta="2,4" good={true} icon={Gauge} />
        <Metric label="IAMOT" value="83" unit="%" delta="1,1" good={true} icon={Activity} />
        <Metric label="MTBF" value="312" unit="h" delta="18" good={true} icon={Clock3} />
        <Metric label="MTTR" value="7,4" unit="h" delta="-1,2" good={false} icon={Timer} />
      </div>
      <div className="card panel" style={{ marginTop: 18, padding: 20 }}>
        <TrendChart />
      </div>
    </>
  );
}

function Reports() {
  const reports = [
    { title: 'Disponibilidade operacional', period: 'Últimos 30 dias', status: 'Concluído', color: 'good' },
    { title: 'Pareto de falhas', period: 'Semana atual', status: 'Disponível', color: 'warning' },
    { title: 'Histórico de ordens', period: 'Últimos 90 dias', status: 'Disponível', color: 'neutral' },
  ];

  return (
    <>
      <PageIntro text="Relatórios executivos e consolidados." />

      <div className="card panel" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {reports.map((item) => (
            <div key={item.title} style={{ border: '1px solid rgba(146,176,220,0.16)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <strong>{item.title}</strong>
                <span className={`status ${item.color === 'good' ? 'em-execucao' : item.color === 'warning' ? 'pendente' : 'normal'}`}>
                  {item.status}
                </span>
              </div>
              <p style={{ margin: '10px 0 0', color: '#8aa3c6' }}>{item.period}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button className="secondary" type="button" onClick={() => alert(`Abrindo ${item.title}...`)}>Visualizar</button>
                <button className="primary" type="button" onClick={() => alert(`Exportando ${item.title}...`)}>Baixar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Alerts() {
  const list = [
    { title: 'Bomba 02 com vibração acima do limite', grau: 'Alta', status: 'Novos' },
    { title: 'Painel elétrico QGBT sem inspeção no turno', grau: 'Média', status: 'Em análise' },
    { title: 'Ordem vencida com atraso de 18h', grau: 'Crítica', status: 'Atenção' },
  ];

  return (
    <>
      <PageIntro text="Central de alertas e monitoramento." />
      <div className="card panel" style={{ padding: 20 }}>
        {list.map((item) => (
          <div key={item.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(146,176,220,0.16)' }}>
            <div>
              <strong>{item.title}</strong>
              <div className="eyebrow" style={{ marginTop: 6 }}>{item.grau}</div>
            </div>
            <span className="status em-execucao">{item.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function AIPage() {
  const suggestions = [
    'Reaperto de terminal em painel QGBT recomendado na próxima janela',
    'Risco de falha em bomba aumenta após 3 inspeções consecutivas',
    'Programação de lubrificação de compressor deve ser antecipada',
  ];

  return (
    <>
      <PageIntro text="Assistente de IA para manutenção preditiva." />
      <div className="card panel" style={{ padding: 20 }}>
        {suggestions.map((item, index) => (
          <div key={item} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: index === suggestions.length - 1 ? 'none' : '1px solid rgba(146,176,220,0.16)' }}>
            <div className="avatar" style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#7c96c9' }}>{index + 1}</div>
            <p style={{ margin: 0, color: '#dfeaff' }}>{item}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function UsersPage() {
  const users = [
    { nome: 'Ana Souza', papel: 'CCM', status: 'Ativo' },
    { nome: 'Carlos Lima', papel: 'PCM', status: 'Ativo' },
    { nome: 'João Pereira', papel: 'EXECUTANTE', status: 'Ativo' },
  ];

  return (
    <>
      <PageIntro text="Usuários e acessos do sistema." />
      <div className="card panel" style={{ padding: 20 }}>
        {users.map((user) => (
          <div key={user.nome} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(146,176,220,0.16)' }}>
            <div>
              <strong>{user.nome}</strong>
              <div className="eyebrow" style={{ marginTop: 4 }}>{user.papel}</div>
            </div>
            <span className="status em-execucao">{user.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function SettingsPage() {
  return (
    <>
      <PageIntro text="Configurações e preferências do ambiente." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        {['Notificações', 'Integrações', 'Segurança', 'Escala de priorização'].map((item) => (
          <div key={item} className="card panel" style={{ padding: 20 }}>
            <strong>{item}</strong>
            <p style={{ color: '#8aa3c6', marginBottom: 0 }}>Configuração ativa e sincronizada.</p>
          </div>
        ))}
      </div>
    </>
  );
}

function NewOrderPage({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({
    equipamento: '',
    tag: '',
    tipo: 'Preventiva',
    prioridade: 'Alta',
    area: 'Mecânica',
    data: '',
    responsavel: '',
    descricao: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <PageIntro text="Nova ordem de manutenção.">
        <button className="secondary" type="button" onClick={onBack}>Voltar</button>
      </PageIntro>

      <div className="card panel" style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span className="eyebrow">Equipamento</span>
            <input value={form.equipamento} onChange={(e) => handleChange('equipamento', e.target.value)} placeholder="Ex.: Bomba centrífuga" />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span className="eyebrow">TAG</span>
            <input value={form.tag} onChange={(e) => handleChange('tag', e.target.value)} placeholder="Ex.: BOM-1234A" />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span className="eyebrow">Tipo</span>
            <select value={form.tipo} onChange={(e) => handleChange('tipo', e.target.value)}>
              <option>Preventiva</option>
              <option>Corretiva</option>
              <option>Inspeção</option>
              <option>Melhoria</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span className="eyebrow">Prioridade</span>
            <select value={form.prioridade} onChange={(e) => handleChange('prioridade', e.target.value)}>
              <option>Crítica</option>
              <option>Alta</option>
              <option>Média</option>
              <option>Baixa</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span className="eyebrow">Área</span>
            <select value={form.area} onChange={(e) => handleChange('area', e.target.value)}>
              <option>Mecânica</option>
              <option>Elétrica</option>
              <option>Instrumentação</option>
              <option>Estrutural</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span className="eyebrow">Prazo</span>
            <input type="date" value={form.data} onChange={(e) => handleChange('data', e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 8, gridColumn: '1 / -1' }}>
            <span className="eyebrow">Responsável</span>
            <input value={form.responsavel} onChange={(e) => handleChange('responsavel', e.target.value)} placeholder="Nome da equipe ou técnico responsável" />
          </label>
          <label style={{ display: 'grid', gap: 8, gridColumn: '1 / -1' }}>
            <span className="eyebrow">Descrição</span>
            <textarea rows={5} value={form.descricao} onChange={(e) => handleChange('descricao', e.target.value)} placeholder="Detalhes da intervenção, inspeção ou liberação." />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
          <button className="primary" type="button" onClick={() => alert('Ordem criada com sucesso.')}>
            Salvar ordem
          </button>
          <button className="secondary" type="button" onClick={onBack}>Cancelar</button>
        </div>
      </div>
    </>
  );
}

function GenericPage({ page }: { page: Page }) {
  return (
    <>
      <PageIntro text={pageNames[page] ?? 'Página'} />
      <div className="card panel" style={{ padding: 24 }}>
        <p style={{ margin: 0, color: '#dfeaff' }}>Esta página está disponível e funcional no fluxo do SIGMA-CCM.</p>
      </div>
    </>
  );
}

export default function App(){
 const { user, loading, logout } = useAuth();
 const [page,setPage]=useState<Page>('dashboard');
 const [side,setSide]=useState(false);
 const allowedPages = user ? PERMS[user.papel] : [];
 const safeSetPage = (next: Page) => {
   if (!user) return;
   setPage(allowedPages.includes(next) ? next : homeFor(user.papel));
 };
 const content=useMemo(()=>{
   if(page==='dashboard') return <Dashboard setPage={safeSetPage}/>;
   if(page==='orders') return <div onClickCapture={(event) => {
     const button = (event.target as HTMLElement).closest('button');
     if (button?.textContent?.includes('Nova ordem')) {
       event.stopPropagation();
       safeSetPage('new-order');
     }
   }}><Orders /></div>;
   if(page==='new-order') return <NewOrderPage onBack={() => safeSetPage('orders')} />;
   if(page==='assets') return <Assets/>;
   if(page==='schedule') return <Schedule/>;
   if(page==='indicators') return <Indicators/>;
   if(page==='reports') return <Reports/>;
   if(page==='alerts') return <Alerts/>;
   if(page==='users') return <UsersPage/>;
   if(page==='settings') return <SettingsPage/>;
   if(page==='field') return <FieldPage/>;
   return <GenericPage page={page}/>;
 },[page, user, allowedPages]);

 useEffect(() => {
   if (!user) return;
   setPage((current) => {
     if (PERMS[user.papel].includes(current as Page)) {
       return current;
     }
     return homeFor(user.papel);
   });
 }, [user]);

 if (loading) {
   return <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#071421', color:'#edf5ff' }}>Carregando...</div>;
 }

 if (!user) {
   return <Login />;
 }

 return <div className="app"><Sidebar page={page} setPage={safeSetPage} open={side} setOpen={setSide} allowedPages={allowedPages} user={{ nome: user.nome, papel: user.papel, username: user.username }} onLogout={logout}/><main><Header page={page} onMenu={()=>setSide(true)}/><div className="content">{content}</div><footer><span>SIGMA-CCM · Ambiente de demonstração</span><span>v0.1.0 · Dados atualizados agora</span></footer></main>{side&&<div className="sideOverlay" onClick={()=>setSide(false)}/>}</div>}

function FieldPage(){
  const [online, setOnline] = useState(false);
  const [ordens, setOrdens] = useState<ApiOrder[]>([]);
  const [colaboradores, setColaboradores] = useState<{ id: number | string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    ordem_id: '',
    tipo: 'Apropriação',
    colaborador_id: '',
    hh: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordensData, cadastrosData] = await Promise.all([
        api.ordens(),
        api.cadastros(),
      ]);

      const nextOrdens = Array.isArray(ordensData) ? ordensData : [];
      const nextColaboradores = Array.isArray(cadastrosData?.colaboradores) ? cadastrosData.colaboradores : [];

      setOrdens(nextOrdens);
      setColaboradores(nextColaboradores);

      if (nextOrdens.length > 0 && !form.ordem_id) {
        setForm((prev) => ({ ...prev, ordem_id: String(nextOrdens[0].id) }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar ordens e colaboradores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.ordem_id || !form.colaborador_id || !form.hh || Number(form.hh) <= 0) {
      setError('Selecione a ordem, o colaborador, o tipo e informe um HH válido.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const resposta = await api.criarApontamento({
        ordem_id: Number(form.ordem_id),
        tipo: form.tipo,
        colaborador_id: Number(form.colaborador_id),
        hh: Number(form.hh),
      });

      if (resposta?.encerrada) {
        setSuccess(`Ordem ${resposta.ordem_numero} encerrada automaticamente — as 3 condições foram cumpridas.`);
      } else {
        setSuccess('Registro enviado');
      }

      const nextOrdens = await api.ordens();
      const nextList = Array.isArray(nextOrdens) ? nextOrdens : [];
      setOrdens(nextList);
      setForm({
        ordem_id: nextList.length > 0 ? String(nextList[0].id) : '',
        tipo: 'Apropriação',
        colaborador_id: '',
        hh: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o apontamento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageIntro text="Experiência móvel offline-first para execução segura em campo.">
        <button className={`connection ${online ? 'online' : ''}`} onClick={() => setOnline(!online)}>
          {online ? <Cloud /> : <CloudOff />}
          {online ? 'Online · sincronizado' : 'Offline · 3 pendências'}
        </button>
      </PageIntro>

      <div className="fieldLayout">
        <div className="phone">
          <div className="phoneTop"><span>09:41</span><b>● ● ●</b></div>
          <div className="mobileHead"><Logo/><div className={online ? 'onlineDot' : ''}/></div>
          <div className="mobileGreeting"><span>Olá, João</span><h2>Minhas ordens</h2></div>
          <div className="mobileTabs">
            <button className="active">Todas <i>{ordens.length}</i></button>
            <button>Em execução <i>{ordens.filter((o) => String(o.status ?? '').toLowerCase() === 'em execução').length}</i></button>
            <button>Programadas <i>{ordens.filter((o) => String(o.status ?? '').toLowerCase() === 'programada').length}</i></button>
          </div>

          <div className="mobileOrders">
            {loading ? (
              <p>Carregando ordens...</p>
            ) : error ? (
              <p className="dangerText">{error}</p>
            ) : (
              <form onSubmit={handleSubmit} className="fieldForm">
                <label>
                  <span>Ordem</span>
                  <select value={form.ordem_id} onChange={(e) => setForm((prev) => ({ ...prev, ordem_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {ordens.map((ordem) => (
                      <option key={String(ordem.id)} value={String(ordem.id)}>
                        {ordem.numero ?? ordem.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Tipo</span>
                  <select value={form.tipo} onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}>
                    <option>Apropriação</option>
                    <option>Relatório</option>
                    <option>Validação</option>
                  </select>
                </label>

                <label>
                  <span>Colaborador</span>
                  <select value={form.colaborador_id} onChange={(e) => setForm((prev) => ({ ...prev, colaborador_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {colaboradores.map((colaborador) => (
                      <option key={String(colaborador.id)} value={String(colaborador.id)}>
                        {colaborador.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>HH</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.hh}
                    placeholder="0.0"
                    onChange={(e) => setForm((prev) => ({ ...prev, hh: e.target.value }))}
                  />
                </label>

                {error && <p className="dangerText">{error}</p>}
                {success && <p className="successText">{success}</p>}

                <button type="submit" className="primary" disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Enviar apontamento'}
                </button>
              </form>
            )}
          </div>

          <nav className="mobileNav">
            <button className="active"><Wrench/>Ordens</button>
            <button><ClipboardCheck/>Apontar</button>
            <button><Cloud/>Sincronizar<i>3</i></button>
            <button><Users/>Perfil</button>
          </nav>
        </div>

        <div className="fieldInfo">
          <span className="eyebrow">PWA PARA CAMPO</span>
          <h2>Trabalho contínuo,<br/>mesmo sem conexão.</h2>
          <p>Ordens, checklists, horas, materiais e evidências ficam disponíveis no dispositivo. Ao recuperar a conexão, tudo é sincronizado automaticamente.</p>
          <div className="offlineFeatures">
            <div><CloudOff/><span><b>Offline-first</b>Dados disponíveis sem internet</span></div>
            <div><ShieldCheck/><span><b>Sincronização segura</b>Tratamento inteligente de conflitos</span></div>
            <div><Package/><span><b>Evidências completas</b>Fotos, arquivos e assinatura digital</span></div>
          </div>
          <div className="syncCard">
            <div><span>ÚLTIMA SINCRONIZAÇÃO</span><b>Hoje, 09:38</b></div>
            <div><span>ITENS PENDENTES</span><b>3</b></div>
          </div>
        </div>
      </div>
    </>
  );
}

