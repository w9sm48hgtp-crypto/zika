import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useWakeLock } from './hooks/useWakeLock';
import { BottomNav } from './components/common/BottomNav';
import ChatPage from './pages/ChatPage';
import CompanionPage from './pages/CompanionPage';
import DailyPage from './pages/DailyPage';
import LettersPage from './pages/LettersPage';
import ProfilePage from './pages/ProfilePage';
import CardLibraryPage from './pages/CardLibraryPage';
import CompanionHistoryPage from './pages/CompanionHistoryPage';
import DataManagePage from './pages/DataManagePage';
import TodoSortPage from './pages/TodoSortPage';
import AvatarSettingsPage from './pages/profile/AvatarSettingsPage';
import ChatSettingsPage from './pages/profile/ChatSettingsPage';
import ReplyRatioPage from './pages/profile/ReplyRatioPage';
import SoundManagePage from './pages/profile/SoundManagePage';
import EncouragementPage from './pages/profile/EncouragementPage';
import MoodTagPage from './pages/profile/MoodTagPage';
import PeriodMessagePage from './pages/profile/PeriodMessagePage';
import ChatBackgroundPage from './pages/profile/ChatBackgroundPage';
import './App.css';

function App() {
  useWakeLock();

  return (
    <BrowserRouter>
      <div className="app-container">
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/companion" element={<CompanionPage />} />
            <Route path="/companion/history" element={<CompanionHistoryPage />} />
            <Route path="/companion/todo-sort/:categoryId" element={<TodoSortPage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/letters" element={<LettersPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/cards" element={<CardLibraryPage />} />
            <Route path="/data" element={<DataManagePage />} />
            <Route path="/profile/avatar" element={<AvatarSettingsPage />} />
            <Route path="/profile/chat" element={<ChatSettingsPage />} />
            <Route path="/profile/reply-ratio" element={<ReplyRatioPage />} />
            <Route path="/profile/sounds" element={<SoundManagePage />} />
            <Route path="/profile/encouragement" element={<EncouragementPage />} />
            <Route path="/profile/mood-tags" element={<MoodTagPage />} />
            <Route path="/profile/period-messages" element={<PeriodMessagePage />} />
            <Route path="/profile/chat-background" element={<ChatBackgroundPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
