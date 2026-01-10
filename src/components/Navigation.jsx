export default function Navigation({ currentView, onViewChange }) {
  const views = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'templates', label: 'Templates', icon: '📋' },
    { id: 'exercises', label: 'Übungen', icon: '💪' },
    { id: 'history', label: 'History', icon: '📊' },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 fixed bottom-0 left-0 right-0 z-20 shadow-lg">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1 p-2">
        {views.map(view => (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
              currentView === view.id
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-xl mb-1">{view.icon}</span>
            <span className="text-xs font-semibold">{view.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
