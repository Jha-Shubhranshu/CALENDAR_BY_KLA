import { Menu, Settings, User } from 'lucide-react';


interface HeaderProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onToggleSidebar: () => void;  // NEW

    }



    export function Header ({ searchQuery, onSearchChange, onToggleSidebar}: HeaderProps) {

        return (
            <header className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 h-16">
                <div className="flex items-center justify-between h-full px-4">
                    {/* Menu button - always visible */}
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onToggleSidebar} 
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors" 
                            aria-label="Toggle sidebar"
                        >
                            <Menu size={24} color="gray" />
                        </button>
                        <h1 className="text-xl font-medium text-gray-700">Keep Clone</h1>
                    </div>

                    {/* Search bar - centered */}
                    <div className="flex-1 flex justify-center px-8 max-w-xl mx-auto">
                        <input 
                            value={searchQuery} 
                            className="w-full px-4 py-2 bg-gray-100 border rounded-md focus:shadow-xl focus:outline-none" 
                            placeholder="Search your notes..."
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <span className="material-icons text-xl">refresh</span>
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <span className="material-icons text-xl">view_list</span>
                        </button>
                        <Settings size={24} color="gray" />
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <span className="material-icons text-xl">apps</span>
                        </button>
                        <User size={24} color="gray" />
                    </div>
                </div>
            </header>
        )
    }
