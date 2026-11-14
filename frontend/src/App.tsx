import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { HowItWorksPage } from '@/pages/HowItWorksPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PlannerPage } from '@/pages/PlannerPage'
import { ProfilesPage } from '@/pages/ProfilesPage'
import { WalkDetailPage } from '@/pages/WalkDetailPage'
import { WalksPage } from '@/pages/WalksPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<PlannerPage />} />
        <Route path="walks" element={<WalksPage />} />
        <Route path="walks/:id" element={<WalkDetailPage />} />
        <Route path="profiles" element={<ProfilesPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
