"use client";

import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ScoresPanel from '@/components/admin/ScoresPanel';
import CalendarPanel from '@/components/admin/CalendarPanel';
import CategoriesPanel from '@/components/admin/CategoriesPanel';
import AdminGuideModal from '@/components/admin/AdminGuideModal';
import { useNotifications } from '@/components/ui/NotificationContext';
import '@/css/miembros.css';

type ArchiveroTab = 'scores' | 'calendar' | 'categories';

const TABS: { id: ArchiveroTab; label: string; icon: string; title: string }[] = [
  { id: 'scores',     label: 'Partituras / Docs', icon: '🎼', title: 'Partituras y Documentos' },
  { id: 'categories', label: 'Programas',        icon: '📁', title: 'Programas y Conciertos'   },
  { id: 'calendar',   label: 'Agenda',           icon: '📅', title: 'Agenda y Eventos'         },
];

export default function ArchiveroPageClient() {
  const { user, isLoading: isAuthLoading, isMaster, isArchiver } = useSupabaseAuth();
  const { showToast } = useNotifications();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ArchiveroTab>('scores');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  // Data states
  const [scores, setScores] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [agrupaciones, setAgrupaciones] = useState<any[]>([]);
  const [tagsDict, setTagsDict] = useState<any>({});
  const [predefinedTags, setPredefinedTags] = useState<string[]>([]);

  const loadedKeys = useRef<Set<string>>(new Set());

  const fetchEndpointsSafely = async (endpoints: Record<string, string>, force = false) => {
    const keysToFetch = force
      ? Object.keys(endpoints)
      : Object.keys(endpoints).filter(k => !loadedKeys.current.has(k));
    if (keysToFetch.length === 0) return;

    keysToFetch.forEach(k => loadedKeys.current.add(k));

    try {
      const resps = await Promise.all(keysToFetch.map(k => fetch(endpoints[k])));
      const data  = await Promise.all(resps.map(r => r.json()));

      keysToFetch.forEach((k, i) => {
        const d = data[i];
        if (k === 'scores')      setScores(Array.isArray(d) ? d : []);
        if (k === 'categories')  setCategories(Array.isArray(d) ? d : []);
        if (k === 'agrupaciones') setAgrupaciones(Array.isArray(d) ? d : []);
        if (k === 'roles') {
          const flatTags = d ? Object.values(d).flat().map((t: any) => t.name) : [];
          setPredefinedTags(flatTags);
          setTagsDict(d || {});
        }
      });

      if (force) showToast("✓ Datos actualizados");
    } catch {
      keysToFetch.forEach(k => loadedKeys.current.delete(k));
      showToast("Error al cargar datos", "error");
    }
  };

  useEffect(() => {
    if (!isAuthLoading) {
      if (!user) {
        router.push("/sign-in");
        return;
      }
      if (!isMaster && !isArchiver) {
        router.push("/miembros/tablon");
        return;
      }

      if (activeTab === 'scores' || activeTab === 'categories') {
        fetchEndpointsSafely({
          scores:      '/api/scores',
          categories:  '/api/archivero/categories',
          agrupaciones: '/api/agrupaciones',
          roles:       '/api/roles',
        });
      }
      // calendar fetches its own data internally
    }
  }, [isAuthLoading, user, isMaster, isArchiver, activeTab]);

  if (isAuthLoading || !user) {
    return (
      <div className="admin-loading-screen">
        <div className="loader"></div>
        <p>Verificando permisos de archivo...</p>
      </div>
    );
  }

  const currentTab = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="admin-orchestrator-page">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="admin-sidebar-wrapper">
        <aside
          className={`admin-sidebar ${sidebarHovered ? 'expanded' : 'collapsed'}`}
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'active' : ''}
              title={tab.title}
            >
              <span className="sidebar-icon">{tab.icon}</span>
              {sidebarHovered && <span className="sidebar-text">{tab.label}</span>}
            </button>
          ))}
        </aside>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="admin-main-content">
        <header className="admin-section-header-premium">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1>{currentTab.title}</h1>
            <button
              onClick={() => setIsHelpOpen(true)}
              style={{
                background: '#eef2ff',
                color: '#4338ca',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ❓ Guía
            </button>
          </div>
          <div className="header-status-pill">
            <span className="pulse-dot"></span>
            {isMaster ? 'Administrador Master' : 'Archivero'}
          </div>
        </header>

        <div className="admin-view-container">
          {activeTab === 'scores' && (
            <ScoresPanel
              scores={scores}
              categories={categories}
              agrupaciones={agrupaciones}
              tagsDict={tagsDict}
              predefinedTags={predefinedTags}
              isMaster={isMaster}
              isArchiver={isArchiver}
              onRefresh={() =>
                fetchEndpointsSafely(
                  {
                    scores:       '/api/scores',
                    categories:   '/api/archivero/categories',
                    agrupaciones: '/api/agrupaciones',
                    roles:        '/api/roles',
                  },
                  true
                )
              }
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesPanel 
              categories={categories}
              onRefresh={() => fetchEndpointsSafely({ categories: '/api/categories' }, true)}
            />
          )}

          {activeTab === 'calendar' && <CalendarPanel />}
        </div>
      </main>

      {/* ── Help modal ────────────────────────────────────────── */}
      {isHelpOpen && (
        <AdminGuideModal
          activeTab={activeTab}
          onClose={() => setIsHelpOpen(false)}
        />
      )}
    </div>
  );
}
