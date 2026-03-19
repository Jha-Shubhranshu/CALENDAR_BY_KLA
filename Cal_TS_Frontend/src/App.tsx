import { Route, Routes, useNavigate } from 'react-router-dom'
import { Container } from 'react-bootstrap';
import { NotesPage } from './pages/NotesPageOG';
import Authsignup from './componentsOG/auth/Authsignup';
import Authsignin from './componentsOG/auth/Authsignin';
import DragDropFiles from './componentsOG/DragDropFiles';
import { GoogleKeepImport } from './componentsOG/GoogleKeepImport';
import { GoogleKeepBulkImport } from './componentsOG/Googlekeepbulkimport';
import { CalendarPage } from './pages/CalendarPage';


const App = () => {

const navigate1= useNavigate();

const handleAuthSuccessSignup = () => {
    console.log('Signup successful!');
    navigate1("/sign-in");
    // Add navigation or other logic here
  };

const handleAuthSuccessSignin = () => {
    console.log('Signin successful!');
    navigate1("/note");
    // Add navigation or other logic here
  };
const handleLogOut = () => {
    console.log('Logout successful!');
    navigate1("/sign-in");
    // Add navigation or other logic here
  };



  return (
    <div>
      <Container className="my-4">
    <Routes>
      {/* <Route path="/" element={<h1>Home</h1>} />  
      <Route path="/new" element={<NewNote/>} />
      <Route path="/:id">
        <Route index element={<h1>show</h1>} />
        <Route path="edit" element={<h1>Edit</h1>} />
      </Route> */}


      <Route path="/sign-up" element={<Authsignup onAuthSuccess={handleAuthSuccessSignup}/>} />   
      <Route path="/sign-in" element={<Authsignin onAuthSuccess={handleAuthSuccessSignin}/>} />   
      <Route path="/import" element={<DragDropFiles onLogout={handleLogOut}/>} />   
      <Route path="/importnotes" element={<GoogleKeepImport/>} />   
      <Route path="/bulkimportnotes" element={<GoogleKeepBulkImport/>} />   
      <Route path="/calendar" element={<CalendarPage />} />

      <Route path="/note" element={<NotesPage />} />

      

    </Routes>      
      </Container>

    </div>

  //     <AuthProvider>
  //       <div className="min-h-screen bg-white">
  //       <Header searchQuery={searchQuery} onSearchChange={setSearchQuery}/>

  //         {searchQuery &&
  //         <div>
  //         {filteredNotes.map(n => (<Notecard key={n.id} note={n} onChangeColor={changeColor} onDelete={deleteNote} onTogglePin={togglePin}/>))}
  //         </div>
  //         }




  //     <NoteInput onCreateNote={createNoteHook} />

  //     <NotesGrid pinnedNotes={pinnedNotes} unpinnedNotes={unpinnedNotes} hasNotes={hasNote} onDeleteNote={deleteNote} onTogglePin={togglePin} changeColor={changeColor}/>


  //   </div>
  // </AuthProvider>

  )
}

export default App