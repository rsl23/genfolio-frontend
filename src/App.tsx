import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import NewRecommendation from '@/pages/NewRecommendation';
import MyPortfolio from '@/pages/MyPortfolio';
import Settings from '@/pages/Settings';
import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/portfolio" replace />} />
          <Route path="/portfolio" element={<MyPortfolio />} />
          <Route path="/generate" element={<NewRecommendation />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
