'use client'

import Sidebar from './Sidebar'
import MobileHeader from './MobileHeader'
import { SidebarProvider } from './SidebarContext'
import ErrorBoundary from './ErrorBoundary'
import PushSubscriber from './PushSubscriber'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <PushSubscriber />
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 md:ml-64">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
