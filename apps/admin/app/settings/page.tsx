'use client'

import AdminLayout from '@/components/AdminLayout'
import Link from 'next/link'
import NotificationPermissionButton from '@/components/NotificationPermissionButton'
import { Bell } from '@/components/Icons'

export default function SettingsPage() {
  return (
    <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-sm text-gray-500 mt-1">Configuration générale du back-office</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications push</h2>
          <p className="text-xs text-gray-500 mb-3">Activez les notifications sur cet appareil pour être alerté des nouvelles réservations.</p>
          <NotificationPermissionButton />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/zones" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">Zones tarifaires</h2>
                <p className="text-sm text-gray-500 mt-1">Définir les zones géographiques et les tarifs forfaitaires gare/aéroport</p>
              </div>
            </div>
          </Link>

          <Link href="/destinations" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">Points d&apos;intérêt</h2>
                <p className="text-sm text-gray-500 mt-1">Gérer les gares et aéroports disponibles à la réservation</p>
              </div>
            </div>
          </Link>
        </div>
    </AdminLayout>
  )
}
