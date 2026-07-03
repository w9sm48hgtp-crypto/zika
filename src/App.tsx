import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from './components/common/BottomNav';
import ChatPage from './pages/ChatPage';
import CompanionPage from './pages/CompanionPage';
import DailyPage from './pages/DailyPage';
import LettersPage from './pages/LettersPage';
import ProfilePage from './pages/ProfilePage';
import CardLibraryPage from './pages/CardLibraryPage';
import CompanionHistoryPage from './pages/CompanionHistoryPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/companion" element={<CompanionPage />} />
            <Route path="/companion/history" element={<CompanionHistoryPage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/letters" element={<LettersPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/cards" element={<CardLibraryPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
