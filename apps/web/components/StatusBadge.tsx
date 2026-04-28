type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'refused' | 'cancelled' | 'no_show' | 'cancellation_requested'

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  pending: { label: 'En attente de confirmation', className: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
  confirmed: { label: 'Confirmée', className: 'bg-blue-100 text-blue-800 border border-blue-200' },
  in_progress: { label: 'En cours', className: 'bg-indigo-100 text-indigo-800 border border-indigo-200' },
  completed: { label: 'Effectuée', className: 'bg-green-100 text-green-800 border border-green-200' },
  refused: { label: 'Refusée', className: 'bg-red-100 text-red-800 border border-red-200' },
  cancelled: { label: 'Annulée', className: 'bg-gray-100 text-gray-800 border border-gray-200' },
  no_show: { label: 'No-show', className: 'bg-orange-100 text-orange-800 border border-orange-200' },
  cancellation_requested: { label: 'Annulation en cours', className: 'bg-amber-100 text-amber-800 border border-amber-200' },
}

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as BookingStatus] ?? { label: status, className: 'bg-gray-100 text-gray-800 border border-gray-200' }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
