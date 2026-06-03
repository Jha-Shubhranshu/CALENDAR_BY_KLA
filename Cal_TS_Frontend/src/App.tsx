import { Route, Routes, useNavigate, Navigate } from 'react-router-dom'
import { NotesPage } from './pages/NotesPageOG';
import Authsignup from './componentsOG/auth/Authsignup';
import Authsignin from './componentsOG/auth/Authsignin';
import ImportsPage from './componentsOG/ImportsPage';
import { CalendarPage } from './pages/CalendarPage';

const App = () => {
  const navigate1 = useNavigate();

  const handleAuthSuccessSignup = () => navigate1('/sign-in');
  const handleAuthSuccessSignin = () => navigate1('/note');

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-200">
      <Routes>
        <Route path="/"                element={<Navigate to="/sign-in" replace />} />
        <Route path="/sign-up"         element={<Authsignup onAuthSuccess={handleAuthSuccessSignup} />} />
        <Route path="/sign-in"         element={<Authsignin onAuthSuccess={handleAuthSuccessSignin} />} />

        {/* Unified imports hub. Old routes redirect here so existing nav links keep working. */}
        <Route path="/import"           element={<ImportsPage />} />
        <Route path="/importnotes"      element={<Navigate to="/import" replace />} />
        <Route path="/bulkimportnotes"  element={<Navigate to="/import" replace />} />

        <Route path="/calendar"        element={<CalendarPage />} />
        <Route path="/note"            element={<NotesPage />} />
      </Routes>
    </div>
  );
};

export default App;