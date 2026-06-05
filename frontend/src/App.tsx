import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { Hub } from './pages/Hub'
import { Calendar } from './pages/Calendar'
import { Diary } from './pages/Diary'
import { Qna } from './pages/QnA'
import { Profile } from './pages/Profile'
import { Onboarding } from './pages/Onboarding'
import { Admin } from './pages/Admin'
import { Share } from './pages/Share'
import { Search } from './pages/Search'
import { Schedule } from './pages/Schedule'
import { ScheduleNew } from './pages/ScheduleNew'
import { Plans } from './pages/Plans'
import { PlanCreate } from './pages/PlanCreate'
import { PlanDetail } from './pages/PlanDetail'
import { PlanEdit } from './pages/PlanEdit'
import { PlanDayDetail } from './pages/PlanDayDetail'
import { TasteSurvey } from './pages/TasteSurvey'
import { Recommend } from './pages/Recommend'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { useMockDate } from './hooks/useMockDate'
import { applySeason } from './lib/season'

export default function App() {
  const today = useMockDate()

  useEffect(() => {
    applySeason(today)
  }, [today])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<ProtectedRoute requireProfile={false}><Onboarding /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/hub" replace />} />
        <Route path="/hub" element={<ProtectedRoute><AppLayout><Hub /></AppLayout></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><AppLayout><Calendar /></AppLayout></ProtectedRoute>} />
        <Route path="/diary/:date" element={<ProtectedRoute><AppLayout><Diary /></AppLayout></ProtectedRoute>} />
        <Route path="/qna/:date" element={<ProtectedRoute><AppLayout><Qna /></AppLayout></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
        <Route path="/profile/taste" element={<ProtectedRoute><AppLayout><TasteSurvey /></AppLayout></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requireProfile={false}><AppLayout><Admin /></AppLayout></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><AppLayout><Search /></AppLayout></ProtectedRoute>} />
        <Route path="/schedule/new" element={<ProtectedRoute><AppLayout><ScheduleNew /></AppLayout></ProtectedRoute>} />
        <Route path="/schedule/:id" element={<ProtectedRoute><AppLayout><Schedule /></AppLayout></ProtectedRoute>} />
        <Route path="/plans/new" element={<ProtectedRoute><AppLayout><PlanCreate /></AppLayout></ProtectedRoute>} />
        <Route path="/plans/:planId/edit" element={<ProtectedRoute><AppLayout><PlanEdit /></AppLayout></ProtectedRoute>} />
        <Route path="/plans/:planId/day/:date" element={<ProtectedRoute><AppLayout><PlanDayDetail /></AppLayout></ProtectedRoute>} />
        <Route path="/plans/:planId" element={<ProtectedRoute><AppLayout><PlanDetail /></AppLayout></ProtectedRoute>} />
        <Route path="/plans" element={<ProtectedRoute><AppLayout><Plans /></AppLayout></ProtectedRoute>} />
        <Route path="/recommend" element={<ProtectedRoute><AppLayout><Recommend /></AppLayout></ProtectedRoute>} />
        <Route path="/share/:token" element={<Share />} />
        <Route path="*" element={<Navigate to="/hub" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
